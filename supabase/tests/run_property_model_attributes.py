"""Phase 2A synthetic local PG only. No DB URLs, credentials or production rows accepted."""
import argparse,subprocess,json,time,uuid
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--container',required=True);a=p.parse_args()
assert a.container=='rentlease-phase2a-test'
def docker(*args,ok=True):
 r=subprocess.run(['docker','--context','desktop-linux',*args],capture_output=True,text=True)
 if ok:assert r.returncode==0,r.stderr
 return r
info=json.loads(docker('inspect',a.container).stdout)[0]
assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
assert info['Config']['Image']=='public.ecr.aws/supabase/postgres:17.6.1.141'
root=Path(__file__).resolve().parents[2];db='phase2a_'+uuid.uuid4().hex[:8]
for _ in range(45):
 r=docker('exec',a.container,'createdb','-U','postgres',db,ok=False)
 if r.returncode==0:break
 time.sleep(1)
else:raise RuntimeError('Disposable PostgreSQL not ready')
def sql(q,ok=True):return docker('exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',q,ok=ok)
def scalar(q):return sql(q).stdout.strip()
def load(path,ok=True):
 target='/tmp/'+Path(path).name;docker('cp',str(root/path),a.container+':'+target);return docker('exec',a.container,'psql','-U','postgres','-d',db,'-X','-v','ON_ERROR_STOP=1','-f',target,ok=ok)
# Copy only the three existing synthetic prerequisite fixtures, not local/production backups.
for name in ['listing_completeness_schema.sql','property_media_schema.sql','property_routine_schema.sql']:
 docker('cp',str(root/'supabase/test-support'/name),a.container+':/tmp/'+name)
load('supabase/test-support/property_media_schema.sql')
load('supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql')
load('supabase/migrations/20261101180736_property_media_versioned_management.sql')
load('supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql')
load('supabase/test-support/property_routine_schema.sql')
load('supabase/migrations/20261102044416_property_routine_details_update_and_tenancy_guard.sql')
sql("""create extension if not exists postgis with schema extensions;
create type public.account_status as enum('active','suspended');
create table public.profiles(id uuid primary key,account_status public.account_status not null,tier1_verified_at timestamptz);
create or replace function public.is_tier1_verified(uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=$1 and tier1_verified_at is not null and account_status='active')$$;
alter table public.properties alter column id set default gen_random_uuid(),alter column public_location drop default;
alter table public.properties alter column public_location type extensions.geography(Point,4326) using null;
alter table public.property_private_locations alter column exact_location drop default;
alter table public.property_private_locations alter column exact_location type extensions.geography(Point,4326) using null;
alter table public.property_private_locations add column address_line_2 text,add column postal_code text;
""")
# Exercise the actual canonical snapshot and deferred identity gate without fabricating full verification workflows.
identity_sql=(root/'supabase/migrations/20261102081459_property_identity_revision_verification.sql').read_text(encoding='utf-8')
sql(identity_sql[identity_sql.index('create schema rentlease_property_identity;'):identity_sql.index('-- Observations of existing complete data')])
sql(identity_sql[identity_sql.index('create function rentlease_property_identity.canonical_consistency()'):identity_sql.index('-- Serialize file deletion')])
functions=json.loads((root/'supabase/test-support/property_model_attributes_baseline.json').read_text(encoding='utf-8'))
for f in functions:sql(f['definition'])
owner='90000000-0000-4000-8000-000000000001';other='90000000-0000-4000-8000-000000000002';foreign='90000000-0000-4000-8000-000000000004';restricted='90000000-0000-4000-8000-000000000003'
sql(f"insert into public.profiles values('{owner}','active',now()),('{other}','active',null),('{restricted}','suspended',now()),('{foreign}','active',now())")
def auth(user=owner):return f"begin;set local role authenticated;set local request.jwt.claim.sub='{user}';"
count=0
def check(value,label):
 global count
 assert value,label;count+=1;print('PASS PHASE2A',label,flush=True)
def rejected(q,code,label):
 r=sql(q,False);check(r.returncode!=0 and code in r.stderr,label+' '+r.stderr[:120])
def baseline():return scalar("select md5(string_agg(pg_get_functiondef(p.oid)||pg_get_userbyid(p.proowner)||coalesce(p.proacl::text,''),'' order by n.nspname,p.proname)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('create_property_setup','update_property_details','get_owned_property_edit_context','get_property_details_operation')) or n.nspname in ('rentlease_property_edit','rentlease_property_identity')")
before=baseline()
def security_catalog():return scalar("select md5(jsonb_build_object('relations',(select jsonb_agg(jsonb_build_object('name',relname,'owner',relowner,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity) order by relname) from pg_class where oid in ('public.properties'::regclass,'public.listings'::regclass,'public.property_private_locations'::regclass)),'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public'),'columns',(select jsonb_agg(jsonb_build_object('name',attname,'type',atttypid,'acl',attacl,'default',pg_get_expr(d.adbin,d.adrelid)) order by attname) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.properties'::regclass and a.attnum>0 and not a.attisdropped and a.attname not in ('property_subtype','lot_area_sqm','parking_spaces')))::text)")
security_before=security_catalog()
# Legacy record exists before ADD COLUMN: never backfilled.
legacy=str(uuid.uuid4());sql(f"insert into public.properties(id,landlord_id) values('{legacy}','{owner}')")
original_create=next(f['definition'] for f in functions if f['name']=='create_property_setup')
sql(original_create.replace('v_property_id uuid;','v_property_id uuid; -- synthetic drift'))
r=load('supabase/migrations/20261109115021_property_model_attributes_v2.sql',ok=False)
check(r.returncode!=0 and 'baseline mismatch' in r.stderr,'source drift blocks migration')
check(scalar("select not exists(select 1 from information_schema.columns where table_schema='public' and table_name='properties' and column_name='property_subtype')")=='t','failed guard changes no columns')
sql(original_create)
sql("create function public.create_property_setup_v2() returns void language sql as $$select null$$")
r=load('supabase/migrations/20261109115021_property_model_attributes_v2.sql',ok=False)
check(r.returncode!=0 and 'Unexpected existing Phase 2A RPC' in r.stderr,'colliding v2 function blocks apply')
sql("drop function public.create_property_setup_v2()")
load('supabase/migrations/20261109115021_property_model_attributes_v2.sql')
check(security_catalog()==security_before,'existing RLS policies owners table/column grants and defaults unchanged')
check(baseline()==before,'original function definitions preserved')
check(scalar(f"select property_subtype is null and lot_area_sqm is null and parking_spaces is null from public.properties where id='{legacy}'")=='t','legacy fields remain null')
create_args="p_property_type=>'house',p_city=>'imus',p_barangay=>'Fixture',p_public_lat=>14.4,p_public_lng=>120.9,p_address_line_1=>'Synthetic address',p_exact_lat=>14.401,p_exact_lng=>120.901,p_bedrooms=>1::smallint,p_bathrooms=>1::numeric,p_floor_area_sqm=>30::numeric,p_floor_number=>null,p_total_floors=>2::smallint"
def create(extra='',user=owner,fn='create_property_setup_v2'):
 return auth(user)+f"select public.{fn}({create_args}{extra});commit;"
r=sql(create(",p_property_subtype=>'villa',p_lot_area_sqm=>0,p_parking_spaces=>0"));created=json.loads(next(x for x in r.stdout.splitlines() if x.startswith('{')));prop=created['property_id']
check(scalar(f"select property_subtype='villa' and lot_area_sqm=0 and parking_spaces=0 from public.properties where id='{prop}'")=='t','creation atomically stores explicit zeros and subtype')
check(scalar(f"select count(*) from public.property_private_locations where property_id='{prop}'")=='1','creation retains private location transaction')
check('exact_location' not in r.stdout and 'Synthetic' not in r.stdout,'creation receipt excludes private data')
sql(f"with r as(insert into rentlease_property_identity.revisions(property_id,owner_id,identity,provenance) values('{prop}','{owner}',rentlease_property_identity.snapshot('{prop}'),'synthetic confirmed identity') returning id) insert into rentlease_property_identity.current_identity(property_id,revision_id) select '{prop}',id from r;insert into public.verification_submissions(property_id,status) values('{prop}','approved')")
identity_before=scalar(f"select rentlease_property_identity.snapshot('{prop}')::text")
verification_before=scalar(f"select md5(string_agg(row_to_json(v)::text,'' order by id)) from public.verification_submissions v where property_id='{prop}'")

old=sql(create(fn='create_property_setup'));check('created' in old.stdout,'old creation RPC remains callable')
for user,label in [('', 'anonymous'),(other,'non-Tier1'),(restricted,'inactive')]:rejected(create(user=user),'42501',label+' creation denied')
for extra in [",p_property_subtype=>'studio'",",p_lot_area_sqm=>-0.001",",p_lot_area_sqm=>'NaN'::numeric",",p_parking_spaces=>-1"]:rejected(create(extra),'23' if 'studio' in extra else '22023','invalid optional creation rejected')
for parent,subs in [('house',['house','townhouse','beach_house','villa']),('apartment',['apartment','room','condominium','studio','loft','penthouse','condotel']),('condominium',['apartment','room','condominium','studio','loft','penthouse','condotel'])]:
 for subtype in subs:
  q=create(",p_property_subtype=>'"+subtype+"'").replace("p_property_type=>'house'","p_property_type=>'"+parent+"'");sql(q);check(True,parent+' / '+subtype+' allowed')
q=create(",p_property_subtype=>'room'").replace("p_property_type=>'house'","p_property_type=>'room'");rejected(q,'23514','standalone room not reclassified')
def token():return scalar(f"select edit_version from public.properties where id='{prop}'")
def update(v=None,request=None,extra=",p_property_subtype=>'villa',p_lot_area_sqm=>20,p_parking_spaces=>2",fn='update_property_details_v2'):
 return f"select public.{fn}(p_property_id=>'{prop}',p_expected_edit_version=>'{v or token()}',p_request_id=>'{request or uuid.uuid4()}',p_bedrooms=>1::smallint,p_bathrooms=>1::numeric,p_floor_area_sqm=>30::numeric,p_max_occupants=>null,p_total_floors=>2::smallint,p_furnishing_status=>'unfurnished',p_amenity_ids=>array[]::bigint[],p_access_instructions=>null{extra});"
v=token();request=str(uuid.uuid4());u=update(v,request);sql(auth()+u+'commit;');new=token();check(new!=v,'new attribute update rotates edit version')
sql(auth()+u+'commit;');check(token()==new,'exact retry replays without rotating version')
rejected(auth()+update(v)+'commit;','40001','stale version denied')
rejected(auth()+update(v,request,extra=",p_property_subtype=>'villa',p_lot_area_sqm=>21,p_parking_spaces=>2")+'commit;','22023','request reuse with changed attributes denied')
rejected(auth(foreign)+update()+'commit;','42501','foreign owner denied')
rejected(auth(restricted)+update()+'commit;','42501','inactive owner denied')
ctx=json.loads(next(x for x in sql(auth()+f"select public.get_owned_property_edit_context_v2('{prop}');commit;").stdout.splitlines() if x.startswith('{')))
check(ctx['model_attributes_version']==2 and ctx['lot_area_sqm']==20 and 'exact_location' not in ctx,'owned v2 context has minimal new fields')
rejected(auth(foreign)+f"select public.get_owned_property_edit_context_v2('{prop}');commit;",'42501','foreign context denied')
for state in ['proposed','pending_confirmation','active']:
 listing=str(uuid.uuid4());sql(f"insert into public.listings(id,property_id,landlord_id) values('{listing}','{prop}','{owner}');insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version) values('{prop}','{listing}','{state}','{token()}')")
 for extra in [",p_property_subtype=>'townhouse',p_lot_area_sqm=>20,p_parking_spaces=>2",",p_property_subtype=>'villa',p_lot_area_sqm=>21,p_parking_spaces=>2",",p_property_subtype=>'villa',p_lot_area_sqm=>20,p_parking_spaces=>3"]:rejected(auth()+update(extra=extra)+'commit;','22023',state+' freezes new material fields')
 sql(f"update public.tenancies set status='ended' where property_id='{prop}'")
prior=scalar(f"select row(property_subtype,lot_area_sqm,parking_spaces)::text from public.properties where id='{prop}'")
sql(auth()+update(extra='',fn='update_property_details')+'commit;');check(scalar(f"select row(property_subtype,lot_area_sqm,parking_spaces)::text from public.properties where id='{prop}'")==prior,'legacy updates preserve Phase 2 data')
rejected(auth()+f"update public.properties set parking_spaces=4 where id='{prop}';commit;",'42501','direct attribute write denied')
check(scalar("select has_function_privilege('anon','public.get_owned_property_edit_context_v2(uuid)','execute')")=='f','anonymous v2 context grant denied')
for name in ['create_property_setup','update_property_details']:
 f=next(f for f in functions if f['name']==name);signature=','.join(a.strip().split(' ',1)[1] for a in f['signature'].split(','))+',text,numeric,integer'
 check(scalar(f"select has_function_privilege('anon','public.{name}_v2({signature})','execute')")=='f','anonymous '+name+' v2 grant denied')

check(baseline()==before,'baseline source still unchanged after RPC tests')
check(scalar(f"select rentlease_property_identity.snapshot('{prop}')::text")==identity_before,'v2 and legacy edits preserve canonical identity snapshot')
check(scalar(f"select md5(string_agg(row_to_json(v)::text,'' order by id)) from public.verification_submissions v where property_id='{prop}'")==verification_before,'verification records and existing identity evidence unchanged')
rejected(f"update public.properties set city='tagaytay' where id='{prop}'",'42501','existing deferred gate still denies identity bypass')

# Two genuine PostgreSQL sessions serialize an attribute edit and tenancy acceptance.
v=token();edit=update(extra=",p_property_subtype=>'villa',p_lot_area_sqm=>22,p_parking_spaces=>2")
first=subprocess.Popen(['docker','--context','desktop-linux','exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-c',auth()+edit+'select pg_sleep(1.5);commit;'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.4)
r=sql(f"insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version) values('{prop}','{listing}','proposed','{v}')",False)
_,err=first.communicate(timeout=10);check(first.returncode==0,'concurrent attribute edit succeeds: '+err);check(r.returncode!=0 and '40001' in r.stderr,'concurrent tenancy rejects stale attribute version')
prior=scalar(f"select row(property_subtype,lot_area_sqm,parking_spaces)::text from public.properties where id='{prop}'")
load('supabase/test-support/property_model_attributes_v2_rollback.sql')
check(scalar("select to_regprocedure('public.get_owned_property_edit_context_v2(uuid)') is null")=='t','rollback disables v2')
check(scalar(f"select row(property_subtype,lot_area_sqm,parking_spaces)::text from public.properties where id='{prop}'")==prior,'rollback retains stored optional data')
check(baseline()==before,'rollback preserves legacy contracts')
check(security_catalog()==security_before,'rollback preserves legacy privacy and grants')
print('PHASE2A TOTAL',count,'passed / 0 failed',flush=True)
