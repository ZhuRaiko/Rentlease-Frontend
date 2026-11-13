"""Network-isolated synthetic checks for 20261112155016_admin_reports_access.sql and its rollback. No hosted connection accepted.

Requires Docker. Everything runs in a disposable container with no network, mounts or published ports; the hosted project is never contacted.
Run: python supabase/tests/run_admin_reports_access.py
"""
import json,subprocess,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-adminacc-'+uuid.uuid4().hex[:8];checks=0
# Actors: A conflicted Admin (owns the listing), B reporter, N non-admin without Tier 1, X Admin WITHOUT Tier 1 (the real-world case),
# Y Admin with Tier 1 (control), S suspended Admin, R restricted Admin, K Admin without Tier 1 who is a tenancy participant, Q unrelated reporter.
A,B,N,X,Y,S,R,K,Q,P,L,C=[str(uuid.uuid4()) for _ in range(12)]
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
class Result:
 def __init__(self,p):self.returncode=p.returncode;self.stdout=p.stdout.decode('utf-8','replace');self.stderr=p.stderr.decode('utf-8','replace')
# Bytes, not text mode: a Windows text pipe rewrites LF as CRLF, which changes md5(prosrc) of function bodies.
def psql(q,db='admintest'):return Result(subprocess.run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d',db,'-qAt','-v','ON_ERROR_STOP=1'],input=q.encode('utf-8'),capture_output=True))
def sql(q,ok=True):
 r=psql(q);assert (r.returncode==0)==ok,r.stderr if ok else 'Expected failure but statement succeeded: '+q[:120]
 return r.stdout.strip()
def deny(q,text):
 r=psql(q);assert r.returncode!=0,'Expected denial: '+q[:120];assert text in r.stderr,f'Expected {text!r} in: {r.stderr.strip()[:200]}'
def auth(a):return f"set role authenticated;set test.actor='{a}';"
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
def lst(actor,admin,kind='all'):return json.loads(sql(auth(actor)+f"select public.get_rental_reports({str(admin).lower()},'{kind}','all',0);"))
def one(actor,r,admin):return json.loads(sql(auth(actor)+f"select public.get_rental_report('{r}',{str(admin).lower()});"))
def decide(actor,r,revision,status,op=None,note='Private reason',public=''):
 return auth(actor)+f"select public.moderate_rental_report('{r}','{op or uuid.uuid4()}','{revision}','{status}','{note}','{public}');"
def submit(actor,kind,context,op=None):return auth(actor)+f"select public.submit_rental_report('{op or uuid.uuid4()}','{kind}','{context}','other','Concern');"
FNS=("public.get_rental_report(uuid,boolean)","public.get_rental_reports(boolean,text,text,integer)","public.moderate_rental_report(uuid,uuid,uuid,text,text,text)")
NAMES=('get_rental_report','get_rental_reports','moderate_rental_report')
def md5s():return json.loads(sql("select jsonb_object_agg(proname,md5(prosrc)) from pg_proc where oid in('"+"'::regprocedure,'".join(FNS)+"'::regprocedure);"))
def posture():return sql("select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text[],'secdef',prosecdef,'config',proconfig,'vol',provolatile)) from pg_proc where oid in('"+"'::regprocedure,'".join(FNS)+"'::regprocedure);")
def counts():return sql("select concat_ws(',',(select count(*) from public.reports),(select count(*) from rentlease_reporting.cases),(select count(*) from rentlease_reporting.events),(select count(*) from rentlease_reporting.receipts));")
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-qAt','-c','select 1']).returncode==0:break
  time.sleep(.5)
 time.sleep(10)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','admintest']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create type public.account_status as enum('active','restricted','suspended','deleted');
 create table public.profiles(id uuid primary key,tier1 boolean not null default false,account_status public.account_status not null default 'active',admin boolean not null default false);
 -- Same semantics as the hosted helpers read on 2026-11-12: Tier 1 needs tier1_verified_at AND active; is_admin is only the role.
 create function public.is_tier1_verified(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=requested_user and p.tier1 and p.account_status='active')$$;
 create function public.is_admin(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=requested_user and p.admin)$$;
 grant execute on function public.is_tier1_verified(uuid),public.is_admin(uuid) to authenticated;
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
 sql(f"""insert into public.profiles(id,tier1,account_status,admin) values('{A}',true,'active',true),('{B}',true,'active',false),('{N}',false,'active',false),('{X}',false,'active',true),('{Y}',true,'active',true),('{S}',true,'suspended',true),('{R}',false,'restricted',true),('{K}',false,'active',true),('{Q}',true,'active',false);
 insert into public.properties values('{P}','{A}',true);insert into public.listings values('{L}','{P}','{A}','active',now(),null,'Authorized rental');insert into public.conversations values('{C}','{L}','{B}','{A}','open');""")
 reporting=(ROOT/'supabase/migrations/20261110171913_reporting_moderation.sql').read_text(encoding='utf-8-sig')
 migration=(ROOT/'supabase/migrations/20261112155016_admin_reports_access.sql').read_text(encoding='utf-8-sig')
 rollback=(ROOT/'supabase/test-support/admin_reports_access_rollback.sql').read_text(encoding='utf-8-sig')
 sql(reporting)
 rid=json.loads(sql(submit(B,'listing',L)))['id'];rev=one(B,rid,False)['revision']
 base=md5s();check(len(base)==3,'baseline reporting functions installed')
 # ---- The problem, before the migration
 deny(auth(X)+"select public.get_rental_reports(true);",'Access unavailable');deny(auth(X)+f"select public.get_rental_report('{rid}',true);",'Access unavailable');deny(decide(X,rid,rev,'under_review'),'Access unavailable')
 check(True,'BEFORE: Admin without Tier 1 is denied list, read and moderate (the reported problem)')
 check(lst(Y,True)['count']==1,'BEFORE: Admin with Tier 1 can list (control)')
 # ---- Drift guard: a changed source must stop the migration loudly and atomically
 original=sql("select pg_get_functiondef('public.get_rental_reports(boolean,text,text,integer)'::regprocedure);")
 tampered=original.replace("Invalid report filters","Invalid report filter",1);assert tampered!=original
 sql(tampered);r=psql(migration);check(r.returncode!=0 and 'source differs from the reviewed definition' in r.stderr,'drifted source (md5 pin) aborts the migration')
 check(sql("select count(*) from pg_proc where proname='is_active_admin';")=='0','failed migration is atomic: no helper left behind')
 sql(original);check(md5s()==base,'drifted function restored to the reviewed definition')
 # ---- Apply
 rows_before=counts();posture_before=posture()
 sql(migration);check(counts()==rows_before,'migration changes no data (reports, cases, events, receipts unchanged)')
 after=md5s();check(all(after[k]!=base[k] for k in NAMES),'all three functions were patched')
 check(posture()==posture_before,'owner, ACL, security definer, search_path and volatility unchanged on all three functions')
 check(sql("select count(*) from pg_proc where proname='is_active_admin' and prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig=array['search_path=pg_catalog'];")=='1','is_active_admin is security definer, owned by postgres, search_path pg_catalog')
 deny(auth(B)+f"select public.is_active_admin('{X}');",'permission denied');deny("set role anon;"+f"select public.is_active_admin('{X}');",'permission denied');check(True,'clients cannot execute is_active_admin (no admin probing)')
 truth={A:'t',B:'f',N:'f',X:'t',Y:'t',S:'f',R:'f',K:'t',Q:'f'}
 check(all(sql(f"select public.is_active_admin('{a}');")==v for a,v in truth.items()),'is_active_admin: active Admins true; suspended, restricted and non-admins false')
 check(sql("select public.is_active_admin(null);")=='f' and sql(f"select public.is_active_admin('{uuid.uuid4()}');")=='f','is_active_admin: null and unknown users false')
 # ---- Admin without Tier 1 can list, read and moderate
 q=lst(X,True);check(q['count']==1 and len(q['rows'])==1 and q['rows'][0]['id']==rid,'AFTER: Admin without Tier 1 lists the Admin queue')
 d=one(X,rid,True);check(d['id']==rid and 'history' in d and 'context' in d,'AFTER: Admin without Tier 1 reads the Admin projection')
 op=str(uuid.uuid4());m1=json.loads(sql(decide(X,rid,rev,'under_review',op)))['current'];check(m1['status']=='under_review','AFTER: Admin without Tier 1 begins review')
 check(json.loads(sql(decide(X,rid,rev,'under_review',op)))['current']['revision']==m1['revision'],'exact decision retry is idempotent (receipt retained)')
 deny(decide(Y,rid,rev,'dismissed'),'Report changed');check(True,'versioning intact: stale revision denied')
 deny(decide(Y,rid,m1['revision'],'under_review'),'Invalid transition');check(True,'transition rules intact')
 f=json.loads(sql(decide(Y,rid,m1['revision'],'upheld',note='Confidential',public='Reviewed')))['current'];check(f['status']=='upheld','Admin with Tier 1 still decides')
 check(sql(f"select count(*) from rentlease_reporting.events where report_id='{rid}';")=='3' and sql(f"select count(*) from rentlease_reporting.receipts where report_id='{rid}';")=='3','events and receipts recorded exactly once per operation')
 safe=one(B,rid,False);check('history' not in safe and 'Confidential' not in json.dumps(safe),'reporter projection stays non-revealing')
 # ---- Non-admin branch still requires Tier 1
 deny(auth(N)+"select public.get_rental_reports(false);",'Access unavailable');deny(auth(X)+"select public.get_rental_reports(false);",'Access unavailable')
 check(True,'non-admin branch still needs Tier 1: a non-admin and an Admin acting as a reporter without Tier 1 are denied')
 check(lst(B,False)['count']==1 and one(B,rid,False)['id']==rid,'reporter with Tier 1 still lists and reads own report')
 deny(auth(B)+"select public.get_rental_reports(true);",'Access unavailable');deny(auth(B)+f"select public.get_rental_report('{rid}',true);",'Access unavailable');deny(decide(B,rid,f['revision'],'dismissed'),'Access unavailable')
 check(True,'non-admin cannot use Admin mode or moderate')
 sql(f"update public.profiles set tier1=false where id='{B}';");deny(auth(B)+f"select public.get_rental_report('{rid}',false);",'Access unavailable');deny(auth(B)+"select public.get_rental_reports(false);",'Access unavailable')
 sql(f"update public.profiles set tier1=true where id='{B}';");check(one(B,rid,False)['id']==rid,'reporter loses and regains access with Tier 1')
 # ---- Suspended, restricted, conflicted
 for who,label in ((S,'suspended Admin'),(R,'restricted Admin')):
  deny(auth(who)+"select public.get_rental_reports(true);",'Access unavailable');deny(auth(who)+f"select public.get_rental_report('{rid}',true);",'Access unavailable');deny(decide(who,rid,f['revision'],'dismissed'),'Access unavailable')
  check(True,f'{label} is denied list, read and moderate')
 sql(f"update public.profiles set account_status='suspended' where id='{X}';");deny(auth(X)+"select public.get_rental_reports(true);",'Access unavailable')
 sql(f"update public.profiles set account_status='active' where id='{X}';");check(lst(X,True)['count']==1,'an Admin suspended after the migration is denied at once and regains access when reactivated')
 sql(f"update public.profiles set account_status='deleted' where id='{X}';");deny(auth(X)+"select public.get_rental_reports(true);",'Access unavailable');sql(f"update public.profiles set account_status='active' where id='{X}';")
 check(lst(A,True)['count']==0,'conflicted Admin (listing owner) is excluded from the Admin queue');deny(auth(A)+f"select public.get_rental_report('{rid}',true);",'Access unavailable');deny(decide(A,rid,f['revision'],'dismissed'),'Access unavailable')
 sql(f"update public.profiles set tier1=false where id='{A}';");deny(auth(A)+f"select public.get_rental_report('{rid}',true);",'Access unavailable');deny(decide(A,rid,f['revision'],'dismissed'),'Access unavailable');sql(f"update public.profiles set tier1=true where id='{A}';")
 check(True,'conflicted Admin stays denied with or without Tier 1')
 sql(f"insert into public.tenancies values(gen_random_uuid(),'{P}','{K}','{A}');");deny(auth(K)+f"select public.get_rental_report('{rid}',true);",'Access unavailable');deny(decide(K,rid,f['revision'],'dismissed'),'Access unavailable')
 check(lst(K,True)['count']==0,'Admin without Tier 1 who is a tenancy participant is conflicted out')
 deny("set role anon;select public.get_rental_reports(true);",'permission denied');check(True,'anonymous EXECUTE still denied')
 check(sql("select count(*) from pg_proc where oid in('"+"'::regprocedure,'".join(FNS)+"'::regprocedure) and has_function_privilege('authenticated',oid,'execute') and not has_function_privilege('anon',oid,'execute');")=='3','the three RPCs remain authenticated-only')
 # ---- Rollback restores the exact previous bodies, and migration can be re-applied
 rows_mid=counts();sql(rollback);check(md5s()==base,'rollback restores the exact pre-migration function bodies (md5(prosrc) identical)')
 check(sql("select count(*) from pg_proc where proname='is_active_admin';")=='0','rollback drops is_active_admin');check(posture()==posture_before,'rollback leaves owner, ACL and configuration identical')
 check(counts()==rows_mid,'rollback retains reports, cases, events and receipts')
 deny(auth(X)+"select public.get_rental_reports(true);",'Access unavailable');check(lst(Y,True)['count']==1,'after rollback: Admin without Tier 1 denied again; Tier 1 Admin allowed')
 r=psql(rollback);check(r.returncode!=0 and 'is_active_admin is missing' in r.stderr,'a second rollback fails loudly instead of changing anything')
 sql(migration);check(lst(X,True)['count']==1,'migration re-applies cleanly after rollback')
 print(f'{checks} focused SQL checks passed',flush=True)
finally:
 r=run(['docker','rm','-f',NAME]);print('Disposable container removed' if r.returncode==0 else 'Container removal failed: '+r.stderr,flush=True)
