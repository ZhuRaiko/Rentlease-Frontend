"""Executed only inside the disposable UC-08 fixture runner; synthetic appointments only."""
from concurrent.futures import ThreadPoolExecutor
sql("""
create or replace function public.can_access_conversation(conversation_uuid uuid,requested_user uuid default auth.uid()) returns boolean language sql stable security definer as $$ select exists(select 1 from public.conversations where id=conversation_uuid and requested_user in(tenant_id,landlord_id)) or public.is_admin(requested_user) $$;
create type public.viewing_status as enum('pending','confirmed','declined','reschedule_requested','cancelled','completed','no_show');
create table public.viewing_schedules(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references conversations(id),listing_id uuid not null references listings(id),
 tenant_id uuid not null references profiles(id),landlord_id uuid not null references profiles(id),proposed_by uuid not null references profiles(id),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),status viewing_status not null default 'pending',
 response_note text,responded_by uuid references profiles(id),responded_at timestamptz,cancelled_by uuid references profiles(id),cancelled_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table viewing_schedules enable row level security;
create policy viewing_read_participants_admin on viewing_schedules for select to authenticated using(auth.uid() in(tenant_id,landlord_id) or is_admin());
create policy viewing_create_participant on viewing_schedules for insert to authenticated with check(proposed_by=auth.uid() and auth.uid() in(tenant_id,landlord_id) and can_access_conversation(conversation_id));
create policy viewing_update_participants_admin on viewing_schedules for update to authenticated using(auth.uid() in(tenant_id,landlord_id) or is_admin()) with check(auth.uid() in(tenant_id,landlord_id) or is_admin());
""")
load(root/'supabase/test-support/viewing_live_trigger.sql')
sql('create trigger trg_validate_viewing_schedule before insert or update on viewing_schedules for each row execute function validate_viewing_schedule();create trigger trg_viewing_schedules_updated_at before update on viewing_schedules for each row execute function set_updated_at()')
load(next((root/'supabase/migrations').glob('*_property_viewing_scheduling.sql')))
sql(f"update conversations set status='open' where id='{cid}';update listings set status='active',published_at=now(),available_from=null;update properties set is_active=true,landlord_id='{C}' where id='{L3}'")
def req(actor,n=501,conv=cid,start="now()+interval '1 day'",end="now()+interval '1 day 1 hour'",note="'Synthetic viewing note'"):
 return f"select request_property_viewing('{conv}','{uid(n)}',{start},{end},{note})"
# Stable literal times make retries exact even across transactions.
start,end=json.loads(sql("select jsonb_build_array(now()+interval '1 day',now()+interval '1 day 1 hour')"))
st,et=f"'{start}'::timestamptz",f"'{end}'::timestamptz"
def act(actor,n,action,rev=1,op=None,s='null',e='null',note='null'):
 return f"select respond_property_viewing('{uid(n)}','{uid(op or n+1000)}',{rev},'{action}',{s},{e},{note})"
def rows(actor,conversation=None):return json.loads(auth(actor,'select get_property_viewings('+ (f"'{conversation}'" if conversation else '') +')'))
request=req(A,start=st,end=et)
v=json.loads(auth(A,request));check(v['status']=='pending' and v['tenant_id']==A,'role-free renter persists pending viewing with server participants')
check(json.loads(auth(A,request))['id']==v['id'],'same request UUID retry creates no duplicate')
check(denied(A,req(A,502,start=st,end=et),'23505'),'second active request in same conversation denied')
check(denied(B,req(B,503,start=st,end=et)),'owner cannot request own listing as renter')
for actor in [C,D,U,S,'']:
 check(denied(actor,req(actor,504,start=st,end=et)),'foreign Admin unverified suspended and missing identity cannot request')
check(rows(B,cid)[0]['id']==v['id'],'owner sees actual persisted request')
check(rows(C)==[] and rows(D)==[],'unrelated user and nonparticipant Admin see no appointments')
check(denied(C,f"select get_property_viewings('{cid}')"),'foreign conversation-specific viewing reads denied')
check(denied(A,act(A,501,'approve')),'requester cannot approve own request')
check(denied(C,act(C,501,'approve')),'nonparticipant cannot approve')
check(denied(A,act(A,501,'reschedule')),'renter cannot impersonate owner proposal')
confirmed=json.loads(auth(B,act(B,501,'approve')));check(confirmed['status']=='confirmed' and confirmed['responded_by']==B,'actual owner approves request')
check(json.loads(auth(B,act(B,501,'approve')))['revision']==2,'response retry is idempotent')
check(denied(B,act(B,501,'decline',op=1501),'23505'),'operation UUID cannot be reused for another action')
check(denied(B,act(B,501,'cancel',rev=1,op=1502),'40001'),'stale revision cannot overwrite appointment')
check(denied(B,act(B,501,'approve',rev=2,op=1503),'42501'),'confirmed viewing cannot be approved again')
check(denied(B,act(B,501,'cancel',rev=2,op=1504,s=st),'22023'),'cancel cannot reassign appointment time')
newst=f"'{start}'::timestamptz+interval '2 hours'";newet=f"'{end}'::timestamptz+interval '2 hours'"
proposal=json.loads(auth(B,act(B,501,'reschedule',rev=2,op=1505,s=newst,e=newet,note="'Alternative time'")))
check(proposal['status']=='reschedule_requested' and proposal['proposed_by']==B,'owner alternative remains unconfirmed')
check(denied(B,act(B,501,'approve',rev=3,op=1506)),'owner cannot accept own alternative')
check(json.loads(auth(A,act(A,501,'approve',rev=3,op=1507)))['status']=='confirmed','renter accepts owner alternative')
check(json.loads(auth(A,request))['revision']==4,'original request receipt remains retryable after rescheduling')
check(json.loads(auth(A,act(A,501,'cancel',rev=4,op=1508)))['cancelled_by']==A,'renter cancels confirmed viewing')
history=rows(A,cid)[0]['history'];check(len(history)==5 and history[0]['starts_at']!=history[2]['starts_at'],'append-only history retains original and alternative schedules')
check(denied(B,act(B,501,'approve',rev=5,op=1509),'22023'),'cancelled appointments cannot be resurrected')
json.loads(auth(A,req(A,510,start=st,end=et)))
check(json.loads(auth(B,act(B,510,'decline')))['status']=='declined','owner declines pending request')
auth(A,req(A,511,start=st,end=et));auth(B,act(B,511,'reschedule',s=newst,e=newet))
check(json.loads(auth(A,act(A,511,'decline',rev=2,op=1512)))['status']=='declined','renter declines proposed alternative')
auth(A,req(A,512,start=st,end=et));check(json.loads(auth(B,act(B,512,'cancel',op=2512)))['cancelled_by']==B,'owner cancels pending appointment')
for s,e,note in [("now()-interval '1 hour'",et,"null"),(st,st,"null"),(st,et,"repeat('x',1001)"),('null',et,'null')]:
 check(denied(A,req(A,513,start=s,end=e,note=note),'22023'),'invalid past range null or oversized note rejected')
sql(f"update listings set status='paused' where id='{L}'")
check(denied(A,req(A,514,start=st,end=et),'22023'),'paused listing rejects new viewing request')
sql(f"update listings set status='active' where id='{L}';update properties set landlord_id='{C}' where id='{L}'")
check(denied(A,req(A,514,start=st,end=et),'22023'),'actual property ownership mismatch rejects new request')
sql(f"update properties set landlord_id='{B}' where id='{L}'")
for listing_change,property_change in [("published_at=null",None),("published_at=now(),available_from=current_date+2",None),("available_from=null","is_active=false")]:
 sql(f"update listings set {listing_change} where id='{L}'")
 if property_change:sql(f"update properties set {property_change} where id='{L}'")
 check(denied(A,req(A,514,start=st,end=et),'22023'),'unpublished future-available and inactive properties reject new requests')
sql(f"update properties set is_active=true where id='{L}';update listings set published_at=now(),available_from=null where id='{L}'")
rolefree_owner_thread=auth(B,f"select start_property_inquiry('{L2}')")
auth(B,req(B,515,conv=rolefree_owner_thread,start=f'{st}+interval \'4 days\'',end=f'{et}+interval \'4 days\''))
check(json.loads(auth(A,act(A,515,'approve')))['status']=='confirmed','role-free actual property owner approves legacy landlord renter request')
check(denied(B,req(B,515,conv=rolefree_owner_thread,start=st,end=et),'23505'),'request UUID cannot be reused with different time payload')
# Parallel duplicate requests are serialized by conversation row lock.
with ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(lambda _:auth(A,req(A,520,start=st,end=et)),range(2)))
check(all(json.loads(v)['id']==uid(520) for v in results),'concurrent duplicate request produces one appointment')
check(denied(A,req(A,525,start=st,end=et),'23505'),'different request IDs cannot bypass single active conversation request')
# A second renter requests the same owner/time. Pending requests may overlap.
other=auth(C,f"select start_property_inquiry('{L}')")
auth(C,req(C,521,conv=other,start=st,end=et));check(len(rows(B))>=2,'overlapping pending requests are allowed')
with ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(lambda args:auth(args[0],act(args[0],args[1],'approve'),False),[(B,520),(B,521)]))
check(sum(r.returncode==0 for r in results)==1 and any('23P01' in r.stderr for r in results),'parallel approvals allow only one overlapping confirmed owner appointment')
check(denied(A,'select * from viewing_schedules'),'no direct appointment table access')
check(denied(A,'select * from viewing_schedule_events'),'private event log not directly readable')
sql('grant select,insert,update on viewing_schedules to authenticated')
check(denied(A,f"update viewing_schedules set status='confirmed',tenant_id='{C}' where id='{uid(520)}'" ) or auth(A,f"select count(*) from viewing_schedules where id='{uid(520)}'")=='1','restrictive policies prevent direct state and identity manipulation')
# UPDATE with false restrictive USING may return UPDATE 0 instead of an error.
check(sql(f"select count(*) from viewing_schedules where tenant_id='{C}' and id='{uid(520)}'")=='0','identity remains unchanged after direct update attempt')
check(denied(A,f"insert into viewing_schedules(conversation_id,listing_id,tenant_id,landlord_id,proposed_by,starts_at,ends_at) values('{cid}','{L}','{A}','{B}','{A}',{st},{et})"),'direct inserts cannot bypass server request rules')
sql('revoke select,insert,update on viewing_schedules from authenticated')
check(sql("select has_function_privilege('anon','public.get_property_viewings(uuid,integer,integer)','execute')")=='f','anonymous RPC execution denied')
check(sql("select bool_and(prosecdef and proconfig @> array['search_path=\"\"']) from pg_proc where proname in('get_property_viewings','request_property_viewing','respond_property_viewing')")=='t','protected RPCs have empty search path')
check(json.loads(auth(A,f"select get_conversation_messages('{cid}')")),'existing messaging history remains functional')
before=sql('select jsonb_build_array((select count(*) from viewing_schedules),(select count(*) from viewing_schedule_events))')
load(root/'supabase/test-support/property_viewing_scheduling_rollback.sql')
check(sql('select jsonb_build_array((select count(*) from viewing_schedules),(select count(*) from viewing_schedule_events))')==before,'rollback preserves all appointments and event history')
