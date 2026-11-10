"""Small network-isolated synthetic T1 check. No production connection accepted."""
import subprocess,json,time,uuid,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];os.chdir(ROOT)
NAME='rentlease-tenancy-t1-'+uuid.uuid4().hex[:8]
checks=0
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
def sql(q,ok=True):
 r=run(['docker','exec','-i',NAME,'psql','-U','postgres','-d','t1','-qAt','-v','ON_ERROR_STOP=1'],input=q)
 if ok:assert r.returncode==0,r.stderr
 else:assert r.returncode!=0,'Expected rejection'
 return r.stdout.strip()
def check(condition,label):
 global checks
 assert condition,label
 checks+=1;print('PASS '+label,flush=True)
def uid():return str(uuid.uuid4())
A=uid();B=uid();X=uid()
def auth(actor):return f"set test.actor='{actor}';set role authenticated;"
def context(r,actor=A):return json.loads(sql(auth(actor)+f"select public.get_tenancy_establishment('{r}');"))
def create(r,ctx,actor=A,op=None,rent=10000):return auth(actor)+f"select public.establish_tenancy('{r}','{op or uid()}','{ctx['propertyVersion']}','{ctx['identityRevision']}',{rent},5);"
def respond(r,ctx,action,actor=B,op=None):return auth(actor)+f"select public.respond_tenancy_establishment('{r}','{op or uid()}','{ctx['setupRevision']}','{ctx['propertyVersion']}','{ctx['identityRevision']}','{action}');"
def fixture(future=0,property_id=None):
 p=property_id or uid();l=uid();c=uid();r=uid();i=uid()
 if not property_id:
  sql(f"insert into public.properties values('{p}','{A}',true,gen_random_uuid(),'apartment','imus','Fixture',1,1,35,'unfurnished');insert into rentlease_property_identity.revisions values('{i}');insert into rentlease_property_identity.current_identity values('{p}','{i}');")
 sql(f"insert into public.listings values('{l}','{p}','{A}','active',now(),null,10000,'Fixture rental',now(),null);insert into public.conversations values('{c}','{l}','{B}','{A}','open');insert into public.rental_reservations values('{r}','{c}','{l}','{p}','{B}','{A}',(now() at time zone 'Asia/Manila')::date+{future},(now() at time zone 'Asia/Manila')::date+{future}+30,'approved',now()+interval '60 days');")
 return r,p,l
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode==0:break
  time.sleep(.5)
 time.sleep(5)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','t1']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,active boolean not null);
 create function public.is_tier1_verified(uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and active)$$;
 create type public.tenancy_status as enum('proposed','pending_confirmation','active','ended','cancelled');
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean,edit_version uuid,property_type text,city text,barangay text,bedrooms smallint,bathrooms numeric,floor_area_sqm numeric,furnishing_status text);
 create table public.listings(id uuid primary key,property_id uuid,landlord_id uuid,status text,published_at timestamptz,available_from date,asking_rent_monthly numeric,title text,updated_at timestamptz,archived_at timestamptz);
 create table public.conversations(id uuid primary key,listing_id uuid,tenant_id uuid,landlord_id uuid,status text);
 create table public.rental_reservations(id uuid primary key,conversation_id uuid,listing_id uuid,property_id uuid,tenant_id uuid,landlord_id uuid,move_in_date date,end_date date,status text,expires_at timestamptz);
 create schema rentlease_property_edit;create schema rentlease_reservations;create schema rentlease_property_identity;
 create table rentlease_property_identity.revisions(id uuid primary key);
 create table rentlease_property_identity.current_identity(property_id uuid primary key,revision_id uuid);
 create function rentlease_property_identity.verified(uuid) returns boolean language sql stable as $$select current_setting('test.identity',true) is distinct from 'false' and exists(select 1 from rentlease_property_identity.current_identity where property_id=$1)$$;
 """)
 catalog=json.loads((ROOT/'supabase/test-support/tenancy_establishment_baseline.json').read_text())
 columns=[]
 for col in catalog['columns']:
  columns.append(col['name']+' '+col['type']+(' not null' if not col['nullable'] else '')+(' default '+col['default'] if col['default'] else ''))
 sql('create table public.tenancies('+','.join(columns)+');alter table public.tenancies enable row level security;')
 for i,c in enumerate(catalog['constraints']):sql('alter table public.tenancies add constraint fixture_'+str(i)+' '+c+';')
 for trigger in catalog['triggers']:sql(trigger['function']);sql(trigger['definition']+';')
 sql(f"insert into public.profiles values('{A}',true),('{B}',true),('{X}',true);")
 sql((ROOT/'supabase/migrations/20261110055859_tenancy_establishment.sql').read_text())
 r,p,l=fixture(2);ctx=context(r)
 check(ctx['eligible'] and ctx['tenancy'] is None,'approved reservation is not an automatic tenancy')
 sql(create(r,ctx,B),False);sql(auth(X)+f"select public.get_tenancy_establishment('{r}');",False);check(True,'tenant cannot propose and foreign caller cannot inspect')
 op=uid();first=json.loads(sql(create(r,ctx,op=op)));check(first['tenancy']['status']=='pending_confirmation' and not first['tenancy']['tenantConfirmed'],'owner proposal awaits renter')
 replay=json.loads(sql(create(r,ctx,op=op)));check(replay==first,'exact retry returns original receipt')
 sql(create(r,ctx,op=op,rent=11000),False);sql(create(r,ctx),False);check(True,'conflicting operation replay and duplicate reservation proposal reject')
 sql(respond(r,first,'confirm',A),False);check(True,'owner cannot supply renter confirmation')
 confirmed=json.loads(sql(respond(r,first,'confirm')));check(confirmed['tenancy']['tenantConfirmed'] and confirmed['tenancy']['status']=='pending_confirmation','future confirmed tenancy remains upcoming')
 sql(respond(r,confirmed,'activate',A),False);check(True,'early activation rejects')
 sql(respond(r,first,'cancel',A),False);check(True,'stale setup revision rejects')
 sql(f"update public.properties set edit_version=gen_random_uuid() where id='{p}';")
 stale=context(r);sql(respond(r,stale,'activate',A),False)
 reviewed=json.loads(sql(respond(r,stale,'review',A)));check(not reviewed['tenancy']['tenantConfirmed'],'owner review of changed property clears renter confirmation')
 cancelled=json.loads(sql(respond(r,reviewed,'cancel',B)));check(cancelled['tenancy']['status']=='cancelled','either participant may cancel pending setup without changing reservation')
 check(sql(f"select status from public.rental_reservations where id='{r}';")=='approved','reservation lifecycle untouched')
 r2,p2,l2=fixture();created=json.loads(sql(create(r2,context(r2))));active=json.loads(sql(respond(r2,created,'confirm')))
 check(active['tenancy']['status']=='active','same-day explicit second-party confirmation activates')
 check(sql(f"select status from public.listings where id='{l2}';")=='rented','existing listing sync trigger retained')
 r3,_,_=fixture(property_id=p2);sql(create(r3,context(r3)),False);check(True,'same-property overlapping tenancy cannot be duplicated')
 r4,p4,_=fixture();before=context(r4);sql(f"update public.properties set edit_version=gen_random_uuid() where id='{p4}';");sql(create(r4,before),False);check(True,'stale property version cannot create tenancy')
 sql("set test.identity='false';"+create(r4,context(r4)),False);check(True,'revoked identity approval blocks establishment')
 sql(auth(A)+"select * from rentlease_tenancy_setup.bindings;",False)
 check(sql("select has_function_privilege('anon','public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer)','execute')")=='f','private tables and anonymous creation denied')
 sql(auth(A)+"select * from public.get_tenancy_establishment_links(array_fill(gen_random_uuid(),array[51]));",False);check(True,'source association reads are bounded')
 print(str(checks)+' focused SQL checks passed.')
finally:
 run(['docker','rm','-f',NAME]);assert run(['docker','inspect',NAME]).returncode!=0;print('Disposable container removed.')
