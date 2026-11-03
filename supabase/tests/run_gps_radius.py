"""Disposable PostgreSQL/PostGIS only; no live URLs, ports, mounts or real data."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--container',required=True);a=p.parse_args()
assert a.container.startswith('rentlease-gps-test-')
info=json.loads(subprocess.check_output(['docker','inspect',a.container],text=True))[0]
assert not info['Mounts'] and not info['HostConfig']['PortBindings']
assert info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.')
root=Path(__file__).resolve().parents[2];db='gps_radius'
subprocess.run(['docker','exec',a.container,'createdb','-U','postgres',db],check=True,capture_output=True)
base=['docker','exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
def sql(q,ok=True):
 r=subprocess.run(base+['-c',q],capture_output=True,text=True)
 if ok:assert r.returncode==0,r.stderr
 return r
def load(path):
 dest='/tmp/'+path.name;subprocess.run(['docker','cp',str(path),a.container+':'+dest],check=True,capture_output=True)
 r=subprocess.run(base+['-f',dest],capture_output=True,text=True);assert r.returncode==0,r.stderr
sql("""
create schema extensions;create extension postgis with schema extensions;
create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
do $$begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;end$$;
create function public.is_tier1_verified(uuid) returns boolean language sql stable as $$select coalesce(current_setting('test.tier1',true)='true',false)$$;
create type public.listing_status as enum('active','draft','archived');
create table public.properties(id uuid primary key,public_location extensions.geography(point,4326),property_type text,city text,barangay text,is_active boolean);
create table public.listings(id uuid primary key,property_id uuid references public.properties,title text,asking_rent_monthly numeric,available_from date,status public.listing_status);
grant usage on schema public,auth,extensions to authenticated;
grant select on public.properties,public.listings to authenticated;
alter table public.properties enable row level security;alter table public.listings enable row level security;
create policy property_read on public.properties for select to authenticated using(is_active);
create policy listing_read on public.listings for select to authenticated using(status='active');
insert into public.properties values('00000000-0000-0000-0000-000000000001',extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326),'apartment','imus','Synthetic',true),('00000000-0000-0000-0000-000000000002',extensions.st_project(extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326)::extensions.geography,9000,0),'house','imus','Synthetic',true);
insert into public.listings select id,id,'Synthetic',9000,null,'active' from public.properties;
""")
load(root/'supabase/test-support/gps_radius_rpc_baseline.sql')
sql('revoke all on function public.search_nearby_listings(double precision,double precision,integer,integer,integer) from public,anon;grant execute on function public.search_nearby_listings(double precision,double precision,integer,integer,integer) to authenticated')
load(next((root/'supabase/migrations').glob('*_gps_nearby_radius_1_to_20.sql')))
checks=0
def check(v,msg):
 global checks
 assert v,msg;checks+=1;print('PASS',msg,flush=True)
def auth(q,tier='true'):
 return "begin;set local role authenticated;set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000001';set local test.tier1='"+tier+"';"+q+';commit;'
def count(radius):
 return int(next(x for x in sql(auth(f'select count(*) from public.search_nearby_listings(14.4,120.9,{radius},20,0)')).stdout.splitlines() if x.isdigit()))
for radius in range(1,21):check(count(radius)>=1,f'radius {radius} accepted for role-free Tier 1')
check(count(3)==1 and count(20)==2,'larger radius returns actual additional PostGIS match')
for radius in ['0','-1','21','null']:
 r=sql(auth(f'select * from public.search_nearby_listings(14.4,120.9,{radius},20,0)'),False);check(r.returncode!=0 and '22023' in r.stderr,'invalid radius rejected: '+radius)
for q,code in [('select * from public.search_nearby_listings(120.9,14.4,3,20,0)','22023'),('select * from public.search_nearby_listings(14.4,120.9,3,0,0)','22023'),('select * from public.search_nearby_listings(14.4,120.9,3,20,1001)','22023')]:
 r=sql(auth(q),False);check(r.returncode!=0 and code in r.stderr,'coordinate/pagination guard retained')
r=sql(auth('select * from public.search_nearby_listings(14.4,120.9,20,20,0)','false'),False);check(r.returncode!=0 and '42501' in r.stderr,'non-Tier-1 denied')
r=sql("begin;set local role anon;select * from public.search_nearby_listings(14.4,120.9,20,20,0);commit",False);check(r.returncode!=0 and '42501' in r.stderr,'anonymous execution denied')
sql("update public.listings set status='draft' where id='00000000-0000-0000-0000-000000000002'")
check(count(20)==1,'draft listing excluded at wide radius')
sql("update public.listings set status='active',available_from=current_date+1 where id='00000000-0000-0000-0000-000000000002'")
check(count(20)==1,'future availability excluded')
sql("update public.listings set available_from=null;update public.properties set is_active=false where id='00000000-0000-0000-0000-000000000002'")
check(count(20)==1,'inactive property excluded')
check(sql("select prosrc not like '%private%' and prosrc like '%p_radius_km * 1000.0%' from pg_proc where proname='search_nearby_listings'").stdout.strip()=='t','public geography and meter conversion retained')
load(root/'supabase/test-support/gps_radius_1_to_20_rollback.sql')
check(sql("select md5(replace(prosrc,chr(13),'')) from pg_proc where proname='search_nearby_listings'").stdout.strip()=='bc659fab2f6311adbba7331a29da4347','rollback restores exact baseline source')
r=sql(auth('select * from public.search_nearby_listings(14.4,120.9,2,20,0)'),False);check(r.returncode!=0 and '22023' in r.stderr,'rollback restores legacy radius rejection')
check(count(3)==1,'rollback retains authorized search and existing safeguards')
print(f'FINAL: {checks} PostgreSQL radius checks passed / 0 failed')
