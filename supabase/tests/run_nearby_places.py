"""Network-isolated synthetic PostgreSQL/PostGIS checks; accepts no production URL."""
import subprocess,time,json,uuid,concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-nearby-'+uuid.uuid4().hex[:8];checks=0
A='10000000-0000-4000-8000-000000000001';B='10000000-0000-4000-8000-000000000002';X='10000000-0000-4000-8000-000000000003';P='20000000-0000-4000-8000-000000000001';L='30000000-0000-4000-8000-000000000001';K='a'*64

def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
def sql(q,ok=True):
 r=run(['docker','exec','-i',NAME,'psql','-U','postgres','-d','nearby','-qAt','-v','ON_ERROR_STOP=1'],input=q)
 assert (r.returncode==0)==ok,r.stderr
 return r.stdout.strip()
def check(v,label):
 global checks
 assert v,label
 checks+=1;print('PASS '+label,flush=True)
def claim(actor=A):return json.loads(sql(f"set role service_role;select public.claim_nearby_places('{actor}','{K}');"))
def clear():sql('truncate rentlease_nearby.cache,rentlease_nearby.limits;')
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode==0:break
  time.sleep(.3)
 time.sleep(5)
 assert run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','nearby']).returncode==0
 sql(f"""do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end$$;create schema auth;create schema extensions;create extension postgis with schema extensions;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function public.is_tier1_verified(a uuid) returns boolean language sql as $$select a in ('{A}'::uuid,'{B}'::uuid)$$;
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean,edit_version uuid,public_location extensions.geography);
 create table public.listings(id uuid primary key,property_id uuid,landlord_id uuid,status text,published_at timestamptz,available_from date);
 insert into public.properties values('{P}','{A}',true,gen_random_uuid(),extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint((floor(extensions.st_x(extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326),3857))/300)+0.5)*300,(floor(extensions.st_y(extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326),3857))/300)+0.5)*300),3857),4326)::extensions.geography);
 insert into public.listings values('{L}','{P}','{A}','active',now(),null);""")
 sql((ROOT/'supabase/migrations/20261111100000_nearby_places_cache.sql').read_text())
 check(True,'migration installs against declared existing types')
 sql(f"set role authenticated;select public.get_nearby_places_context('{L}');",False);check(True,'anonymous identity denied')
 sql(f"set test.actor='{X}';set role authenticated;select public.get_nearby_places_context('{L}');",False);check(True,'inactive/non-tier1 caller denied')
 for a in [A,B]:
  c=json.loads(sql(f"set test.actor='{a}';set role authenticated;select public.get_nearby_places_context('{L}');"));check(abs(c['latitude']-14.4)<0.005 and abs(c['longitude']-120.9)<0.005,'owner/public viewer receives public point only')
 for clause,restore in [("status='draft'","status='active'"),("published_at=null","published_at=now()"),("available_from=current_date+10","available_from=null"),(f"landlord_id='{B}'",f"landlord_id='{A}'")]:
  sql('update public.listings set '+clause);sql(f"set test.actor='{B}';set role authenticated;select public.get_nearby_places_context('{L}');",False);sql('update public.listings set '+restore);check(True,'listing visibility/ownership mismatch denied')
 sql('update public.properties set is_active=false');sql(f"set test.actor='{A}';set role authenticated;select public.get_nearby_places_context('{L}');",False);sql('update public.properties set is_active=true');check(True,'inactive property denied')
 for role in ['anon','authenticated']:
  sql(f"set role {role};select public.claim_nearby_places('{A}','{K}');",False);check(True,'cache worker denied to '+role)
 sql('set role service_role;select * from rentlease_nearby.cache;',False);check(True,'no direct service cache table grant')
 clear();c=claim();check(c['status']=='refresh','cache miss leases once');check(claim(B)['status']=='busy','concurrent viewer coalesces')
 check(sql(f"set role service_role;select public.finish_nearby_places('{K}','{uuid.uuid4()}','[]');")=='f','foreign/stale lease cannot complete')
 check(sql(f"set role service_role;select public.finish_nearby_places('{K}','{c['lease']}','[]');")=='t','valid empty provider result stored')
 check(claim(B)['status']=='hit','shared fresh hit across actors')
 sql("update rentlease_nearby.cache set expires_at=now()-interval '1 hour'");c=claim();check(c['status']=='refresh' and c['rows']==[],'expired data preserved only as stale candidate')
 sql(f"set role service_role;select public.finish_nearby_places('{K}','{c['lease']}',null,3600);");c=claim();check(c['status']=='busy' and c['rows']==[],'failure cooldown preserves stale data and does not fabricate fresh empty')
 check(sql("select slot>now()+interval '59 minutes' from rentlease_nearby.limits where key='provider:blocked'")=='t','provider Retry-After global cooldown retained')
 clear()
 with concurrent.futures.ThreadPoolExecutor(4) as pool:statuses=list(pool.map(lambda _:claim()['status'],range(4)))
 check(statuses.count('refresh')==1 and statuses.count('busy')==3,'real concurrent cache misses yield one lease')
 clear();c=claim();sql(f"select public.finish_nearby_places('{K}','{c['lease']}','[]');")
 for _ in range(19):claim()
 check(claim()['status']=='rate_limited','per-actor request quota enforced')
 clear();sql("insert into rentlease_nearby.limits values('provider:day',date_trunc('day',clock_timestamp()),300);");check(claim()['status']=='rate_limited','global daily provider budget enforced')
 clear();c=claim();sql(f"select public.finish_nearby_places('{K}','{c['lease']}','[]');update rentlease_nearby.cache set fetched_at=now()-interval '73 hours',expires_at=now()-interval '49 hours',stale_until=now()-interval '1 hour';");check(claim()['rows'] is None,'beyond-retention cache never returned')
 clear();sql("insert into rentlease_nearby.cache(key,rows,fetched_at,expires_at,stale_until) select lpad(i::text,64,'0'),'[]',now(),now()+interval '1 hour',now()+interval '2 hours' from generate_series(1,1000) i;");claim();check(sql('select count(*) from rentlease_nearby.cache')=='1000','cache row count stays capped')
 check(sql("select bool_and(relrowsecurity) from pg_class where oid in('rentlease_nearby.cache'::regclass,'rentlease_nearby.limits'::regclass)")=='t','private tables have RLS')
 print(f'{checks} isolated SQL checks passed',flush=True)
finally:
 run(['docker','rm','-f',NAME])
 print('Disposable network-isolated container removed',flush=True)
