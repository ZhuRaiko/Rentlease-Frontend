"""Synthetic, network-isolated bookmark contract checks; never connects to production."""
import json,subprocess,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NAME='rentlease-saved-'+uuid.uuid4().hex[:8]
checks=0
A='00000000-0000-4000-8000-000000000001';B='00000000-0000-4000-8000-000000000002';C='00000000-0000-4000-8000-000000000003'
P='00000000-0000-4000-8000-000000000004';L='00000000-0000-4000-8000-000000000005';M='00000000-0000-4000-8000-000000000006'
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
def sql(q,ok=True):
 r=run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','savedtest','-qAt','-v','ON_ERROR_STOP=1'],input=q)
 assert (r.returncode==0)==ok,r.stderr if ok else 'Expected denial'
 return r.stdout.strip()
def auth(a):return f"set role authenticated;set test.actor='{a}';"
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-qAt','-c','select 1']).returncode==0:break
  time.sleep(.5)
 time.sleep(5)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','savedtest']);assert r.returncode==0,r.stderr
 sql("""create schema if not exists auth;create or replace function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 do $$begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end$$;
 grant usage on schema auth to authenticated;
 create table public.profiles(id uuid primary key,active boolean);
 create function public.is_tier1_verified(uuid) returns boolean language sql security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and active)$$;
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean,city text,barangay text,property_type text,bedrooms smallint,bathrooms numeric,floor_area_sqm numeric,furnishing_status text);
 create table public.listings(id uuid primary key,property_id uuid references public.properties,landlord_id uuid,status text,published_at timestamptz,available_from date,title text,description text,asking_rent_monthly numeric,house_rules text,rental_term text,minimum_stay_months integer,security_deposit_months numeric,advance_rent_months numeric);
 create table public.saved_listings(tenant_id uuid references public.profiles on delete cascade,listing_id uuid references public.listings on delete cascade,created_at timestamptz not null default now(),primary key(tenant_id,listing_id));alter table public.saved_listings enable row level security;revoke all on public.saved_listings from public,anon,authenticated,service_role;
 create policy fixture_owner on public.saved_listings to authenticated using(tenant_id=auth.uid()) with check(tenant_id=auth.uid());
 """)
 sql(f"insert into public.profiles values('{A}',true),('{B}',true),('{C}',false);insert into public.properties values('{P}','{A}',true,'imus','Public area','house',2,1,40,'unfurnished');insert into public.listings values('{L}','{P}','{A}','active',now(),null,'Real fixture','Text',20000,null,'long_term',null,1,1),('{M}','{P}','{A}','active',now(),null,'Second fixture','Text',10000,null,'long_term',null,1,1);")
 sql((ROOT/'supabase/migrations/20261110154025_saved_listings_contract.sql').read_text(encoding='utf-8-sig'))
 sql(auth(B)+f"select public.set_saved_listing('{L}',true);");sql(auth(B)+f"select public.set_saved_listing('{L}',true);")
 check(sql('reset role;select count(*) from public.saved_listings;')=='1','idempotent save unique composite key')
 check(json.loads(sql(auth(A)+"select public.get_saved_listings();"))['count']==0,'other account cannot enumerate bookmarks')
 sql(auth(A)+f"select public.set_saved_listing('{L}',false);")
 check(sql('reset role;select count(*) from public.saved_listings;')=='1','other account removal cannot delete bookmark')
 sql(auth(C)+f"select public.set_saved_listing('{L}',true);",False);check(True,'inactive account denied')
 sql("reset role;set test.actor='';select public.get_saved_listings();",False);check(True,'missing identity denied')
 sql("set role anon;select public.get_saved_listings();",False);check(True,'anonymous EXECUTE denied')
 sql(auth(B)+"select * from public.saved_listings;",False);check(True,'raw table remains ungranted')
 for change in ["status='archived'","status='active',published_at=null","status='active',published_at=now(),available_from=current_date+2"]:
  sql('reset role;update public.listings set '+change+f" where id='{L}';")
  sql(auth(B)+f"select public.set_saved_listing('{L}',true);",False)
  value=json.loads(sql(auth(B)+'select public.get_saved_listings();'))
  check(value['count']==1 and value['rows'][0]['listing'] is None,'ineligible saved listing details suppressed: '+change)
 sql(f"reset role;update public.listings set status='active',published_at=now(),available_from=null where id='{L}';")
 sql(auth(B)+f"select public.set_saved_listing('{M}',true);")
 value=json.loads(sql(auth(B)+"select public.get_saved_listings(0,'price_low');"))
 check([r['listingId'] for r in value['rows']]==[M,L],'price sorting uses actual asking rent')
 sql(f"reset role;update public.properties set is_active=false where id='{P}';")
 value=json.loads(sql(auth(B)+'select public.get_saved_listings();'))
 check(all(r['listing'] is None for r in value['rows']),'inactive property details suppressed')
 sql(auth(B)+f"select public.set_saved_listing('{L}',false);select public.set_saved_listing('{L}',false);")
 check(json.loads(sql(auth(B)+'select public.get_saved_listings();'))['count']==1,'unavailable bookmark removal and retry')
 sql(auth(B)+"select public.get_saved_listing_states(array_fill(gen_random_uuid(),array[101]));",False);check(True,'bounded ID batches')
 sql(auth(B)+"select public.get_saved_listing_states(array[null]::uuid[]);",False);check(True,'null batch IDs rejected')
 check(json.loads(sql(auth(A)+f"select public.get_saved_listing_states(array['{M}']::uuid[]);"))[0]['saved'] is False,'status projection account isolated')
 check(sql("reset role;select count(*) from pg_proc where proname in('get_saved_listings','get_saved_listing_states','set_saved_listing') and prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig=array['search_path=pg_catalog'];")=='3','all RPC security configuration')
 sql((ROOT/'supabase/test-support/saved_listings_rollback.sql').read_text())
 sql(auth(B)+'select public.get_saved_listings();',False)
 check(sql('reset role;select count(*) from public.saved_listings;')=='1','withdrawal retains real bookmarks')
 print(f'{checks} focused SQL checks passed',flush=True)
finally:
 r=run(['docker','rm','-f',NAME]);assert r.returncode==0,r.stderr
 print('Disposable container removed',flush=True)
