"""Synthetic UC-09B cases, run only by the guarded disposable UC-08 runner."""
from concurrent.futures import ThreadPoolExecutor
import time
sql("""
alter table profiles add column if not exists tier2_verified_at timestamptz;
alter table properties add column if not exists edit_version uuid not null default gen_random_uuid();
create schema if not exists rentlease_property_edit;create schema if not exists rentlease_property_identity;
create table rentlease_property_identity.current_identity(property_id uuid primary key,revision_id uuid not null);
create type tenancy_status as enum('proposed','pending_confirmation','active','ended','cancelled');
create table tenancies(id uuid primary key default gen_random_uuid(),listing_id uuid not null references listings(id),property_id uuid not null references properties(id),tenant_id uuid not null references profiles(id),landlord_id uuid not null references profiles(id),status tenancy_status not null default 'proposed',start_date date not null,expected_end_date date,actual_end_date date,tenant_confirmed_at timestamptz,landlord_confirmed_at timestamptz,accepted_property_edit_version uuid,accepted_identity_revision_id uuid);
insert into rentlease_property_identity.current_identity select id,gen_random_uuid() from properties;
""")
load(root/'supabase/test-support/reservation_tenancy_live_guards.sql')
sql('create trigger aaa_tenancy_property_gate before insert or update or delete on tenancies for each row execute function rentlease_property_edit.guard_tenancy_property_version();create trigger aab_tenancy_identity_gate before insert or update on tenancies for each row execute function rentlease_property_identity.guard_tenancy_identity()')
load(next((root/'supabase/migrations').glob('*_property_rental_reservations.sql')))
sql(f"update conversations set status='open';update listings set status='active',published_at=now(),available_from=null;update properties set is_active=true,landlord_id='{C}' where id='{L3}'")
date=sql("select ((now() at time zone 'Asia/Manila')::date+30)::text")
future=lambda days:f"'{date}'::date+{days}"
def reserve(actor,n,conv=cid,date_sql=None,months=12,message="'Synthetic reservation'"):
 return f"select request_rental_reservation('{conv}','{uid(n)}',{date_sql or future(0)},{months},{message})"
def respond(actor,n,action,rev=1,op=None,note='null'):
 return f"select respond_rental_reservation('{uid(n)}','{uid(op or n+10000)}',{rev},'{action}',{note})"
def reservations(actor,conv=None):return json.loads(auth(actor,'select get_rental_reservations('+ (f"'{conv}'" if conv else '') +')'))
request=reserve(A,701)
r=json.loads(auth(A,request));check(r['effective_status']=='pending' and r['status']=='pending','role-free renter creates a genuine pending request, not an approved reservation')
check(r['property_id']==L and r['tenant_id']==A and r['landlord_id']==B,'conversation establishes property and participants without caller-supplied identities')
check(r['applicant_label']=='Renter' and r['applicant_tier1'] and 'display_name' not in r,'neutral applicant identity exposes only actual verification status')
check(sql(f"select expires_at<=created_at+interval '7 days 1 second' and expires_at<=move_in_date::timestamp at time zone 'Asia/Manila' from rental_reservations where id='{uid(701)}'")=='t','pending deadline capped at seven days and move-in midnight')
check(json.loads(auth(A,request))['id']==r['id'],'same UUID request retry is idempotent')
check(denied(A,reserve(A,701,months=6),'23505'),'request UUID cannot be reused for a different payload')
check(denied(A,reserve(A,702),'23505'),'duplicate active request denied')
check(reservations(B,cid)[0]['id']==r['id'],'owner sees real incoming request')
for actor in [C,D]:check(reservations(actor)==[],'unrelated user and nonparticipant Admin cannot list requests')
for actor in [C,D,U,S,'']:check(denied(actor,reserve(actor,703)),'foreign Admin unverified suspended and missing identity request denied')
check(denied(B,reserve(B,704)),'owner cannot reserve own listing through renter flow')
check(denied(A,respond(A,701,'approve')),'renter cannot approve own request')
check(denied(C,respond(C,701,'approve')),'foreign owner cannot approve')
approved=json.loads(auth(B,respond(B,701,'approve')))
check(approved['status']=='approved' and approved['revision']==2 and approved['responded_by']==B,'only actual owner approves pending reservation')
check(sql(f"select expires_at=end_date::timestamp at time zone 'Asia/Manila' from rental_reservations where id='{uid(701)}'")=='t','approved commitment expires at requested period end')
check(json.loads(auth(B,respond(B,701,'approve')))['revision']==2,'approval retries return the existing receipt')
check(denied(B,respond(B,701,'cancel',rev=1,op=20701),'40001'),'stale revision cannot overwrite approval')
check(denied(B,respond(B,701,'decline',rev=2,op=20702)),'approved commitment cannot be declined')
auth(A,reserve(A,705,date_sql=f"('{date}'::date+interval '12 months')::date"))
check(json.loads(auth(B,respond(B,705,'approve')))['status']=='approved','adjacent non-overlapping periods are allowed even for the same renter')
auth(A,respond(A,705,'cancel',rev=2,op=20705))
check(json.loads(auth(A,respond(A,701,'cancel',rev=2,op=20703)))['status']=='cancelled','renter cancels approved commitment')
check(denied(B,respond(B,701,'approve',rev=3,op=20704),'22023'),'final state cannot be resurrected')
auth(A,reserve(A,710));check(json.loads(auth(B,respond(B,710,'decline')))['status']=='declined','owner declines pending request')
auth(A,reserve(A,711));check(json.loads(auth(A,respond(A,711,'cancel')))['status']=='cancelled','renter cancels pending request')
auth(A,reserve(A,712));check(json.loads(auth(B,respond(B,712,'cancel')))['status']=='cancelled','owner cancels pending request')
for date_sql,months,message in [("current_date-1",12,'null'),("'infinity'::date",12,'null'),(future(0),0,'null'),(future(0),121,'null'),(future(0),12,"repeat('x',1001)")]:
 check(denied(A,reserve(A,713,date_sql=date_sql,months=months,message=message),'22023'),'invalid dates duration and oversized message rejected')
# Effective expiry is evaluated on server reads without a scheduler or client clock.
auth(A,reserve(A,720));sql(f"update rental_reservations set expires_at=clock_timestamp()-interval '1 second' where id='{uid(720)}'")
check(next(r for r in reservations(A,cid) if r['id']==uid(720))['effective_status']=='expired','server read reports expired pending request without cron or mutation')
check(denied(B,respond(B,720,'approve'),'22023'),'expired request cannot be approved')
check(json.loads(auth(B,respond(B,720,'expire')))['status']=='expired','participant can materialize expiration only after deadline')
auth(A,reserve(A,721));check(denied(B,respond(B,721,'expire'),'22023'),'unexpired reservation cannot be expired early')
auth(B,respond(B,721,'approve'));sql(f"update rental_reservations set expires_at=clock_timestamp()-interval '1 second' where id='{uid(721)}'")
check(next(r for r in reservations(A,cid) if r['id']==uid(721))['effective_status']=='expired','approved commitments expire at server deadline')
check(denied(A,respond(A,721,'cancel',rev=2,op=20721),'22023'),'expired commitment cannot perform a new cancellation transition')
# New requests may replace expired requests; month-end semantics match PostgreSQL.
auth(A,reserve(A,722,date_sql="'2030-01-31'::date",months=1));r=next(r for r in reservations(A,cid) if r['id']==uid(722));check(r['end_date']=='2030-02-28','calendar-month duration clamps month end without inventing days')
auth(A,respond(A,722,'cancel'))
for change,restore in [("status='paused'","status='active'"),("published_at=null","published_at=now()"),("available_from='2099-01-01'","available_from=null")]:
 sql(f"update listings set {change} where id='{L}'");check(denied(A,reserve(A,723),'22023'),'inactive unpublished or unavailable listing cannot accept reservation');sql(f"update listings set {restore} where id='{L}'")
sql(f"update properties set landlord_id='{C}' where id='{L}'");check(denied(A,reserve(A,723),'22023'),'actual property owner mismatch denies request');sql(f"update properties set landlord_id='{B}' where id='{L}'")
sql(f"update conversations set status='closed' where id='{cid}'");check(denied(A,reserve(A,723),'22023'),'closed conversation cannot receive new reservation');sql(f"update conversations set status='open' where id='{cid}'")
# Two actual requests can remain pending; only one conflicting approval succeeds.
alias=uid(109)
sql(f"insert into listings values('{alias}','{L}','{B}','Synthetic alternate listing','active',now(),null)")
other=auth(C,f"select start_property_inquiry('{alias}')")
with ThreadPoolExecutor(max_workers=2) as pool:
 receipts=list(pool.map(lambda _:auth(A,reserve(A,730)),range(2)))
check(all(json.loads(x)['id']==uid(730) for x in receipts),'simultaneous duplicate submissions create one request')
auth(C,reserve(C,731,conv=other));check(sql("select count(*) from rental_reservations where status='pending' and expires_at>now()")=='2','overlapping pending requests do not reserve the unit')
with ThreadPoolExecutor(max_workers=2) as pool:
 attempts=list(pool.map(lambda n:auth(B,respond(B,n,'approve'),False),[730,731]))
check(sum(x.returncode==0 for x in attempts)==1 and any('23P01' in x.stderr for x in attempts),'simultaneous overlapping approvals across different listings of the same property allow only one commitment')
winner=int(sql("select right(id::text,12)::int from rental_reservations where status='approved' and expires_at>now()"));loser=731 if winner==730 else 730
auth(B,respond(B,loser,'decline',op=21000+loser))
# A different renter may hold a non-overlapping future commitment for the same unit.
nonoverlap=reserve(C if loser==731 else A,740,conv=other if loser==731 else cid,date_sql=future(800))
auth(C if loser==731 else A,nonoverlap);check(json.loads(auth(B,respond(B,740,'approve')))['status']=='approved','non-overlapping approved commitments allowed')
check(sql('select count(*) from tenancies')=='0','reservation approval creates no tenancy')
check(sql(f"select status from listings where id='{L}'")=='active','approval does not mark listing rented or change publication')
# Existing tenancy/identity gates remain and a manual unrelated tenancy cannot bypass holds.
def tenancy(actor,days=0,months=1):
 return f"insert into tenancies(listing_id,property_id,tenant_id,landlord_id,start_date,expected_end_date,accepted_property_edit_version,accepted_identity_revision_id) select '{L}','{L}','{actor}','{B}',{future(days)},({future(days)}+make_interval(months=>{months}))::date-1,p.edit_version,i.revision_id from properties p join rentlease_property_identity.current_identity i on i.property_id=p.id where p.id='{L}'"
winner_actor=A if winner==730 else C;foreign_actor=C if winner_actor==A else A
bad=sql(tenancy(foreign_actor),False);check(bad.returncode!=0 and '23P01' in bad.stderr,'manual tenancy for a different renter cannot bypass an approved reservation')
sql(tenancy(winner_actor));check(sql('select count(*) from tenancies')=='1','same-renter manual tenancy remains possible without automatic conversion')
check(denied(A,'select * from rental_reservations'),'no direct reservation table SELECT')
check(denied(A,'select * from rentlease_reservations.events'),'private event history inaccessible directly')
check(denied(A,f"update rental_reservations set tenant_id='{C}',status='approved' where id='{uid(730)}'"),'status and participant identity cannot be directly forged')
check(denied(C,f"select get_rental_reservations('{cid}')"),'foreign conversation lookup denied')
rolefree=auth(B,f"select start_property_inquiry('{L2}')")
auth(B,reserve(B,760,conv=rolefree))
check(json.loads(auth(A,respond(A,760,'approve')))['status']=='approved','role-free property owner approves legacy landlord renter request')
legacy_tenant_owner=auth(B,f"select start_property_inquiry('{L3}')")
auth(B,reserve(B,761,conv=legacy_tenant_owner))
check(json.loads(auth(C,respond(C,761,'decline')))['status']=='declined','legacy Tenant property owner manages incoming reservations without role changes')
# A reservation approval races a manual tenancy proposal under the same property lock.
auth(A,reserve(A,750,date_sql=future(1600)))
with ThreadPoolExecutor(max_workers=2) as pool:
 race=list(pool.map(lambda q:sql(q,False),[f"begin;set local role authenticated;set local request.jwt.claim.sub='{B}';{respond(B,750,'approve')};commit",tenancy(C,days=1600)]))
check(sum(x.returncode==0 for x in race)==1 and any('23P01' in x.stderr for x in race),'simultaneous reservation approval and unrelated manual tenancy cannot both commit overlapping periods')
check(sql("select bool_and(not has_function_privilege('anon',oid,'execute')) from pg_proc where proname in('get_rental_reservations','request_rental_reservation','respond_rental_reservation')")=='t','all reservation RPCs deny anonymous execution')
check(len(reservations(A,cid)[0]['history'])>=1,'reservation decision history persists')
check(json.loads(auth(A,f"select get_conversation_messages('{cid}')")),'existing messaging still functions')
before=sql('select jsonb_build_array((select count(*) from rental_reservations),(select count(*) from rentlease_reservations.events),(select count(*) from tenancies))')
load(root/'supabase/test-support/property_rental_reservations_rollback.sql')
check(sql('select jsonb_build_array((select count(*) from rental_reservations),(select count(*) from rentlease_reservations.events),(select count(*) from tenancies))')==before,'feature-disable rollback preserves reservations events and tenancies')
check(sql("select count(*) from pg_trigger where tgrelid='public.tenancies'::regclass and tgname in('aaa_tenancy_property_gate','aab_tenancy_identity_gate')")=='2','rollback preserves original property version and identity triggers')
check(sql("select count(*) from pg_trigger where tgrelid='public.tenancies'::regclass and tgname='aac_reservation_tenancy_commitment'")=='1','feature-disable rollback continues protecting unexpired approved reservation commitments')
