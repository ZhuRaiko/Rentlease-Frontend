"""Small network-isolated T6 check using the existing T1 fixture and captured triggers. No production connection accepted."""
import subprocess,json,time,uuid,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];os.chdir(ROOT)
NAME='rentlease-tenancy-t6-'+uuid.uuid4().hex[:8]
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
 sql((ROOT/'supabase/migrations/20261110091413_tenancy_completion_termination.sql').read_text(encoding='utf-8-sig'))
 def active():
  r,p,l=fixture();created=json.loads(sql(create(r,context(r))));ended=json.loads(sql(respond(r,created,'confirm')));return ended['tenancy']['id'],p,l
 def lc(t,actor=A):return json.loads(sql(auth(actor)+f"select public.get_tenancy_lifecycle('{t}');"))
 def command(t,c,action,actor=A,op=None,reason='Reviewed rental ending'):
  rev="'"+c['pending']['revision']+"'" if c['pending'] else 'null'
  return auth(actor)+f"select public.write_tenancy_lifecycle('{t}','{op or uid()}','{action}','{c['version']}',{rev},'{reason}');"
 t,p,l=active();c=lc(t)
 sql(command(t,c,'complete'),False);check(True,'normal completion cannot silently end an unexpired period')
 sql(auth(X)+f"select public.get_tenancy_lifecycle('{t}');",False);sql(command(t,c,'request_end',X),False);check(True,'foreign read and write rejected')
 request=json.loads(sql(command(t,c,'request_end')));check(request['pending']['initiatorId']==A and request['status']=='active','proposal leaves tenancy active and binds actual initiator')
 sql(command(t,request,'accept'),False);check(True,'initiator cannot accept own ending request')
 sql(command(t,request,'request_end',B),False);check(True,'only one pending request is allowed')
 sql(f"update public.properties set edit_version=gen_random_uuid() where id='{p}';")
 fresh=lc(t,B);sql(command(t,fresh,'accept',B),False);check(True,'property drift invalidates accepted request provenance')
 rejected=json.loads(sql(command(t,fresh,'reject',B)));check(rejected['pending'] is None and rejected['status']=='active','other participant can reject stale request without ending tenancy')
 op=uid();new=json.loads(sql(command(t,rejected,'request_end',A,op)));check(json.loads(sql(command(t,rejected,'request_end',A,op)))==new,'exact request receipt replay is stable')
 sql(command(t,rejected,'request_end',A,op,'Changed reason'),False);check(True,'conflicting replay rejected')
 withdrawn=json.loads(sql(command(t,new,'withdraw')));check(withdrawn['pending'] is None,'requester withdrawal retains request history')
 final_request=json.loads(sql(command(t,withdrawn,'request_end')))
 original=sql(f"select (to_jsonb(t)-array['status','actual_end_date','ended_at','updated_at'])::text from public.tenancies t where id='{t}';")
 op2=uid();accepted=json.loads(sql(command(t,final_request,'accept',B,op2)));check(accepted['status']=='ended' and accepted['actualEndDate']==accepted['today'] and accepted['endedAt'] is not None,'counterparty explicitly ends tenancy on agreed current day')
 check(sql(f"select (to_jsonb(t)-array['status','actual_end_date','ended_at','updated_at'])::text from public.tenancies t where id='{t}';")==original,'all original tenancy terms and accepted identity/version evidence preserved')
 check(sql(f"select status from public.listings where id='{l}';")=='archived','existing listing sync archives and never republishes')
 check(sql(f"select count(*) from public.conversations where listing_id='{l}';")=='1' and sql(f"select count(*) from public.rental_reservations where listing_id='{l}';")=='1','conversation and reservation source retained')
 check(json.loads(sql(command(t,final_request,'accept',B,op2)))==accepted,'uncertain ending retry returns receipt after relationship ended')
 sql(command(t,accepted,'complete'),False);check(lc(t,B)['events'][0]['action']=='accept','ended tenancy retains participant history and rejects another ending')
 sql("update rentlease_tenancy_end.events set reason='overwrite';",False);sql('delete from rentlease_tenancy_end.receipts;',False);check(True,'immutable lifecycle history and receipts cannot be rewritten')
 t2,p2,l2=active();sql(f"update public.tenancies set start_date=(now() at time zone 'Asia/Manila')::date-60,expected_end_date=(now() at time zone 'Asia/Manila')::date-1 where id='{t2}';")
 normal=lc(t2,B);completed=json.loads(sql(command(t2,normal,'complete',B)));check(completed['status']=='ended' and completed['actualEndDate']==normal['expectedEndDate'],'explicit normal completion uses recorded inclusive end date')
 t3,p3,l3=active();rq=json.loads(sql(command(t3,lc(t3),'request_end')))
 from concurrent.futures import ThreadPoolExecutor
 def contender(action):
  return run(['docker','exec','-i',NAME,'psql','-U','postgres','-d','t1','-qAt','-v','ON_ERROR_STOP=1'],input=command(t3,rq,action,B))
 with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(contender,['accept','reject']))
 check(sum(r.returncode==0 for r in results)==1,'concurrent accept/reject decisions serialize with exactly one winner')
 check(sql(f"select count(*) from rentlease_tenancy_end.events where tenancy_id='{t3}' and action in('accept','reject');")=='1','one immutable decision event under concurrency')
 sql(auth(A)+'select * from rentlease_tenancy_end.requests;',False);check(sql("select has_function_privilege('anon','public.get_tenancy_lifecycle(uuid,integer)','execute');")=='f','private schema and anonymous entry points restricted')
 sql(f"update public.profiles set active=false where id='{B}';");sql(auth(B)+f"select public.get_tenancy_lifecycle('{t}');",False);check(True,'restricted historical participant remains denied')
 print(str(checks)+' focused T6 SQL checks passed.')
finally:
 run(['docker','rm','-f',NAME]);assert run(['docker','inspect',NAME]).returncode!=0;print('Disposable container removed.')
