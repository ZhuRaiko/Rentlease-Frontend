"""Network-isolated synthetic reporting checks. No hosted connection accepted."""
import json,subprocess,time,uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-report-'+uuid.uuid4().hex[:8];checks=0
A,B,X,Y,Z,P,L,C=[str(uuid.uuid4()) for _ in range(8)]
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
def sql(q,ok=True):
 r=run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','reporttest','-qAt','-v','ON_ERROR_STOP=1'],input=q)
 assert (r.returncode==0)==ok,r.stderr if ok else 'Expected denial'
 return r.stdout.strip()
def auth(a):return f"set role authenticated;set test.actor='{a}';"
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
def submit(actor,kind,context,op=None,reason='other',details='Concern'):
 return auth(actor)+f"select public.submit_rental_report('{op or uuid.uuid4()}','{kind}','{context}','{reason}','{details}');"
def detail(actor,r,admin=False):return json.loads(sql(auth(actor)+f"select public.get_rental_report('{r}',{str(admin).lower()});"))
def decide(actor,r,revision,status,op=None,note='Private reason',public=''):
 return auth(actor)+f"select public.moderate_rental_report('{r}','{op or uuid.uuid4()}','{revision}','{status}','{note}','{public}');"
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-qAt','-c','select 1']).returncode==0:break
  time.sleep(.5)
 time.sleep(10)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','reporttest']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create table public.profiles(id uuid primary key,active boolean,admin boolean);
 create function public.is_tier1_verified(uuid) returns boolean language sql security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and active)$$;
 create function public.is_admin(uuid) returns boolean language sql security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and admin)$$;
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean);
 create table public.listings(id uuid primary key,property_id uuid references public.properties,landlord_id uuid,status text,published_at timestamptz,available_from date,title text);
 create table public.conversations(id uuid primary key,listing_id uuid references public.listings,tenant_id uuid,landlord_id uuid,status text);
 create table public.tenancies(id uuid primary key,property_id uuid,tenant_id uuid,landlord_id uuid);
 create table public.messages(id uuid primary key);
 create type public.report_reason as enum('fraudulent_listing','misleading_information','harassment','impersonation','unsafe_property','spam','policy_violation','other');
 create type public.report_status as enum('submitted','under_review','needs_information','upheld','dismissed','closed');
 create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles on delete restrict,reported_user_id uuid references public.profiles on delete set null,reported_listing_id uuid references public.listings on delete set null,reported_message_id uuid references public.messages on delete set null,reason public.report_reason not null,details text not null,status public.report_status not null default 'submitted',assigned_admin_id uuid references public.profiles on delete set null,admin_summary text,submitted_at timestamptz not null default now(),resolved_at timestamptz,updated_at timestamptz not null default now(),check(num_nonnulls(reported_user_id,reported_listing_id,reported_message_id)>=1));
 alter table public.reports enable row level security;revoke all on public.reports from public,anon,authenticated,service_role;
 create policy old_read on public.reports to authenticated using(reporter_id=auth.uid());
 create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
 create trigger trg_reports_updated_at before update on public.reports for each row execute function public.set_updated_at();
 """)
 sql(f"insert into public.profiles values('{A}',true,true),('{B}',true,false),('{X}',true,true),('{Y}',true,true),('{Z}',false,true);insert into public.properties values('{P}','{A}',true);insert into public.listings values('{L}','{P}','{A}','active',now(),null,'Authorized rental');insert into public.conversations values('{C}','{L}','{B}','{A}','open');")
 migration=(ROOT/'supabase/migrations/20261110171913_reporting_moderation.sql').read_text(encoding='utf-8-sig')
 legacy=str(uuid.uuid4());sql(f"insert into public.reports(id,reporter_id,reported_listing_id,reason,details) values('{legacy}','{B}','{L}','other','Legacy');")
 sql(migration,False);check(sql('select count(*) from public.reports;')=='1','nonempty legacy reports stop migration without loss');sql(f"delete from public.reports where id='{legacy}';");sql(migration)
 op=str(uuid.uuid4());r=json.loads(sql(submit(B,'listing',L,op)));rid=r['id'];check(r['status']=='submitted','eligible listing submission')
 check(json.loads(sql(submit(B,'listing',L,op)))['id']==rid,'exact submission receipt retry')
 sql(submit(B,'listing',L,op,details='Changed'),False);check(True,'conflicting operation replay denied')
 sql(submit(B,'listing',L),False);check(True,'second open report prevented')
 sql(submit(B,'listing',str(uuid.uuid4())),False);check(True,'unknown listing denied')
 sql(submit(Z,'listing',L),False);check(True,'inactive reporter denied')
 sql(submit(X,'user',C),False);check(True,'unrelated conversation user report denied')
 u=json.loads(sql(submit(B,'user',C)));uid=u['id'];check(sql('reset role;select reported_user_id from public.reports where id=\''+uid+'\';')==A,'user target derived from actual counterpart')
 sql(f"reset role;insert into public.conversations values(gen_random_uuid(),'{L}','{B}','{B}','open');")
 selfc=sql('select id from public.conversations where tenant_id=landlord_id;');sql(submit(B,'user',selfc),False);check(True,'self-report context denied')
 sql(auth(A)+f"select public.get_rental_report('{rid}',false);",False);check(True,'reported owner cannot read reporter report')
 sql(auth(B)+"select public.get_rental_reports(true);",False);check(True,'ordinary caller cannot read Admin queue')
 sql(auth(A)+f"select public.get_rental_report('{rid}',true);",False);check(True,'Admin listing owner conflict denied')
 sql(f"reset role;insert into public.tenancies values(gen_random_uuid(),'{P}','{Y}','{A}');")
 sql(auth(Y)+f"select public.get_rental_report('{rid}',true);",False);check(True,'Admin direct tenancy participant conflict denied')
 sql('set role anon;select public.get_rental_reports();',False);check(True,'anonymous EXECUTE denied')
 sql(auth(B)+'select * from public.reports;',False);sql(auth(X)+'select * from rentlease_reporting.events;',False);check(True,'raw reports and private audit inaccessible')
 sql(decide(X,rid,r['revision'],'upheld'),False);check(True,'resolution before review denied')
 midop=str(uuid.uuid4());mid=json.loads(sql(decide(X,rid,r['revision'],'under_review',midop)))['current'];check(mid['status']=='under_review','begin independent review')
 check(json.loads(sql(decide(X,rid,r['revision'],'under_review',midop)))['current']['revision']==mid['revision'],'exact decision retry no second version')
 sql(decide(X,rid,r['revision'],'dismissed'),False);check(True,'stale decision revision denied')
 final=json.loads(sql(decide(X,rid,mid['revision'],'upheld',note='Confidential investigation',public='Concern reviewed')))['current'];safe=detail(B,rid);check(safe['status']=='upheld' and safe['publicSummary']=='Concern reviewed' and 'history' not in safe and 'Confidential investigation' not in json.dumps(safe),'reporter sees only safe resolution')
 replay=json.loads(sql(decide(X,rid,r['revision'],'under_review',midop)));check(replay['status']=='under_review' and replay['current']['status']=='upheld','original decision reconciles after later resolution')
 sql(decide(X,rid,final['revision'],'dismissed'),False);check(True,'terminal decision cannot change')
 check(sql('reset role;select count(*) from rentlease_reporting.events where report_id=\''+rid+'\';')=='3','submission and decisions audited exactly once')
 sql(f"reset role;update rentlease_reporting.events set note='tampered' where report_id='{rid}';",False);sql(f"reset role;delete from public.reports where id='{rid}';",False);check(True,'history and report deletion blocked')
 sql(f"reset role;update public.reports set details='tampered' where id='{rid}';",False);check(True,'original explanation immutable')
 check(sql(f"reset role;select status from public.listings where id='{L}';")=='active','resolution does not mutate listing lifecycle')
 sql('reset role;grant select on public.reports to authenticated;');check(sql(auth(B)+'select count(*) from public.reports;')=='0','restrictive policy blocks future raw read grants');sql('reset role;revoke select on public.reports from authenticated;')
 check(sql("select count(*) from pg_proc where proname in('get_rental_report','get_rental_reports','submit_rental_report','moderate_rental_report') and prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig=array['search_path=pg_catalog'];")=='4','all public RPC security configurations')
 # Competing independent Admins must serialize and only one may accept this revision.
 gate=Barrier(2)
 def race(actor):
  gate.wait()
  return run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','reporttest','-qAt','-v','ON_ERROR_STOP=1'],input=decide(actor,uid,u['revision'],'under_review'))
 with ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(race,actor) for actor in (X,Y)]
  outcomes=[f.result() for f in futures]
 check(sum(r.returncode==0 for r in outcomes)==1 and any('Report changed' in r.stderr for r in outcomes if r.returncode),'concurrent Admin decisions accept exactly one revision')
 check(sql(f"reset role;select count(*) from rentlease_reporting.events where report_id='{uid}';")=='2' and sql(f"select count(*) from rentlease_reporting.receipts where report_id='{uid}';")=='2','losing concurrent decision leaves no event or receipt')
 sql((ROOT/'supabase/test-support/reporting_moderation_rollback.sql').read_text());sql(auth(B)+'select public.get_rental_reports();',False);check(sql('reset role;select count(*) from public.reports;')=='2','withdrawal retains reports and audit')
 print(f'{checks} focused SQL checks passed',flush=True)
finally:
 r=run(['docker','rm','-f',NAME]);assert r.returncode==0,r.stderr
 print('Disposable reporting container removed',flush=True)
