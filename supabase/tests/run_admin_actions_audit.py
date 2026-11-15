"""Network-isolated synthetic checks for 20261113180000_admin_actions_audit.sql and its rollback. No hosted connection accepted.

Requires Docker. Everything runs in a disposable container with no network, mounts or published ports; the hosted project is never contacted.
Fixture: the REAL reporting migration (20261110171913) and admin-access migration (20261112155016) are applied on a small synthetic schema, plus
supabase/test-support/admin_actions_audit_baseline.sql, which reproduces the hosted moderation objects (the apply_moderation_action source is
rebuilt byte-for-byte and its md5 pin is asserted). Review, verification and tenancy tables are minimal synthetic stand-ins; see
supabase/test-support/ADMIN_ACTIONS_AUDIT.md for what that does and does not prove.
Run: python supabase/tests/run_admin_actions_audit.py   (optionally: --migration <modified copy> for mutation checks)
"""
import json,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-adminact-'+uuid.uuid4().hex[:8];checks=0
PIN='311afeb3c10eef8dd2b1b5a965377f21'
def u():return str(uuid.uuid4())
# Actors. ADM: Admin without Tier 1 (the real account shape). ADM2: second Admin. ADMS: suspended Admin. N: ordinary user. REP: reporter.
# LL: landlord with a confirmed public nickname. T1,T2: users with no public nickname. RES: restricted by SQL (no action row). DEL: deleted.
ADM,ADM2,ADMS,N,REP,LL,T1,T2,RES,DEL=[u() for _ in range(10)]
LEGAL='PRIVATE-LEGAL-NAME'
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
class Result:
 def __init__(self,p):self.returncode=p.returncode;self.stdout=p.stdout.decode('utf-8','replace');self.stderr=p.stderr.decode('utf-8','replace')
# Bytes, not text mode: a Windows text pipe rewrites LF as CRLF, which changes md5(prosrc) of function bodies.
def cmd():return ['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','actionstest','-qAt','-v','ON_ERROR_STOP=1']
def psql(q):return Result(subprocess.run(cmd(),input=q.encode('utf-8'),capture_output=True))
def sql(q,ok=True):
 r=psql(q);assert (r.returncode==0)==ok,r.stderr if ok else 'Expected failure but statement succeeded: '+q[:140]
 return r.stdout.strip()
def deny(q,text):
 r=psql(q);assert r.returncode!=0,'Expected denial: '+q[:140];assert text in r.stderr,f'Expected {text!r} in: {r.stderr.strip()[:240]}'
def auth(a):return f"set role authenticated;set test.actor='{a}';"
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
def bg(q):
 p=subprocess.Popen(cmd(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE);p.stdin.write(q.encode('utf-8'));p.stdin.close();return p
def fin(p):
 out=p.stdout.read().decode('utf-8','replace');err=p.stderr.read().decode('utf-8','replace');p.wait();return p.returncode,out.strip(),err
def sq(v):return 'null' if v is None else "'"+str(v)+"'"
AUTO={}
def auto_report(user,listing):
 # suspend_account and remove_listing REQUIRE an upheld report. Fixture shortcut: an upheld report row inserted directly (the real reporting
 # flow is exercised separately in the report-linkage section). One stable report per target so exact retries stay exact. A target that does not
 # exist gets a generic upheld report so the target checks, not the report checks, are what is exercised.
 key=(user,listing)
 if key not in AUTO:
  if user is not None and n(f"select count(*) from public.profiles where id='{user}';")==1:col,val='reported_user_id',user
  elif listing is not None and n(f"select count(*) from public.listings where id='{listing}';")==1:col,val='reported_listing_id',listing
  else:col,val='reported_user_id',REP
  rid=u();sql(f"insert into public.reports(id,reporter_id,{col},reason,details,status) values('{rid}','{REP}','{val}','other','Fixture report','upheld');");AUTO[key]=rid
 return AUTO[key]
def act(actor,action,user=None,listing=None,report=None,reason='Repeated misleading listings after a warning',ends=None,op=None,norep=False):
 if report is None and not norep and action in('suspend_account','remove_listing') and (user is not None or listing is not None) and not(user is not None and listing is not None):report=auto_report(user,listing)
 return auth(actor)+f"select public.apply_admin_moderation_action('{op or u()}','{action}',{sq(user)},{sq(listing)},{sq(report)},{sq(reason)},{sq(ends)});"
def act_ok(*a,**k):return json.loads(sql(act(*a,**k)))
def status_of(user):return sql(f"select account_status from public.profiles where id='{user}';")
def lstatus(l):return sql(f"select status from public.listings where id='{l}';")
def n(q):return int(sql(q))
def audits(where='true'):return n(f"select count(*) from public.admin_audit_logs where {where};")
def mk_listing(status='active',owner=None):
 owner=owner or LL;p=u();l=u()
 sql(f"insert into public.properties values('{p}','{owner}',true);insert into public.listings(id,property_id,landlord_id,status,title,published_at) values('{l}','{p}','{owner}','{status}','Rental {l[:6]}',now());")
 return l,p
def tenancy(l,p,status):sql(f"insert into public.tenancies(id,listing_id,property_id,tenant_id,landlord_id,status) values(gen_random_uuid(),'{l}','{p}','{T1}','{LL}','{status}');")
def restrictions(actor=ADM):return json.loads(sql(auth(actor)+"select public.get_admin_restrictions();"))
def log(kind='all',off=0,actor=ADM):return json.loads(sql(auth(actor)+f"select public.get_admin_audit_log('{kind}',{off});"))
def as_(actor):return f"set test.actor='{actor}';"
def mk_report(kind='listing'):
 rep=u();sql(f"insert into public.profiles(id,tier1) values('{rep}',true);");l_,p_=mk_listing();c_=u();sql(f"insert into public.conversations values('{c_}','{l_}','{rep}','{LL}','open');")
 return json.loads(sql(submit(rep,kind,l_ if kind=='listing' else c_)))['id'],l_,rep
def submit(actor,kind,context):return auth(actor)+f"select public.submit_rental_report('{u()}','{kind}','{context}','other','Concern');"
def moderate(actor,rid,status,note='Private reviewer reason',op=None):
 rev=json.loads(sql(auth(actor)+f"select public.get_rental_report('{rid}',true);"))['revision']
 return auth(actor)+f"select public.moderate_rental_report('{rid}','{op or u()}','{rev}','{status}','{note}','');"
def uphold(rid,actor=ADM):
 sql(moderate(actor,rid,'under_review','Starting review of this report'));sql(moderate(actor,rid,'upheld','Report confirmed after review'))
FNS=("public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)","public.get_admin_restrictions()","public.get_admin_audit_log(text,integer)")
def reg(l):return "'"+"'::regprocedure,'".join(l)+"'::regprocedure"
def md5s():return sql("select jsonb_object_agg(oid::regprocedure::text,md5(prosrc)) from pg_proc where oid in("+reg(["public.apply_moderation_action()","public.moderate_rental_report(uuid,uuid,uuid,text,text,text)","public.is_active_admin(uuid)","rentlease_reporting.conflicted(uuid,uuid)"])+");")
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-qAt','-c','select 1']).returncode==0:break
  time.sleep(.5)
 time.sleep(10)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','actionstest']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create type public.account_status as enum('active','restricted','suspended','deleted');
 create table public.profiles(id uuid primary key,display_name text not null default 'PRIVATE-LEGAL-NAME',public_nickname text,public_nickname_confirmed_at timestamptz,account_status public.account_status not null default 'active',suspended_until timestamptz,suspension_reason text,updated_at timestamptz not null default now(),tier1 boolean not null default false,admin boolean not null default false);
 create function public.is_tier1_verified(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=requested_user and p.tier1 and p.account_status='active')$$;
 create function public.is_admin(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=requested_user and p.admin)$$;
 grant execute on function public.is_tier1_verified(uuid),public.is_admin(uuid) to authenticated;
 create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
 create type public.listing_status as enum('draft','active','paused','rented','archived','removed');
 create type public.tenancy_status as enum('proposed','pending_confirmation','active','ended','cancelled');
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean);
 create table public.listings(id uuid primary key,property_id uuid not null references public.properties,landlord_id uuid not null,status public.listing_status not null default 'draft',published_at timestamptz,available_from date,title text,paused_at timestamptz,removed_at timestamptz,removal_reason text,updated_at timestamptz not null default now());
 create table public.conversations(id uuid primary key,listing_id uuid references public.listings,tenant_id uuid,landlord_id uuid,status text);
 create table public.tenancies(id uuid primary key,listing_id uuid,property_id uuid,tenant_id uuid,landlord_id uuid,status public.tenancy_status not null default 'proposed');
 create table public.messages(id uuid primary key);
 create type public.report_reason as enum('fraudulent_listing','misleading_information','harassment','impersonation','unsafe_property','spam','policy_violation','other');
 create type public.report_status as enum('submitted','under_review','needs_information','upheld','dismissed','closed');
 create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles on delete restrict,reported_user_id uuid references public.profiles on delete set null,reported_listing_id uuid references public.listings on delete set null,reported_message_id uuid references public.messages on delete set null,reason public.report_reason not null,details text not null,status public.report_status not null default 'submitted',assigned_admin_id uuid references public.profiles on delete set null,admin_summary text,submitted_at timestamptz not null default now(),resolved_at timestamptz,updated_at timestamptz not null default now(),check(num_nonnulls(reported_user_id,reported_listing_id,reported_message_id)>=1));
 alter table public.reports enable row level security;revoke all on public.reports from public,anon,authenticated,service_role;
 create policy old_read on public.reports to authenticated using(reporter_id=auth.uid());
 create trigger trg_reports_updated_at before update on public.reports for each row execute function public.set_updated_at();
 -- Synthetic stand-ins for the review and verification tables (columns the audit triggers read; see ADMIN_ACTIONS_AUDIT.md).
 create type public.verification_tier as enum('tier_2_identity','tier_3_property');
 create type public.verification_status as enum('pending','under_review','approved','rejected','cancelled','revoked');
 create table public.verification_submissions(id uuid primary key default gen_random_uuid(),user_id uuid not null,tier public.verification_tier not null,property_id uuid,status public.verification_status not null default 'pending',submitted_note text,reviewed_by uuid,review_note text,rejection_reason text,updated_at timestamptz not null default now());
 create schema rentlease_reviews;
 create table rentlease_reviews.entries(id uuid primary key default gen_random_uuid(),kind text not null);
 create table rentlease_reviews.events(id uuid primary key default gen_random_uuid(),review_id uuid not null references rentlease_reviews.entries,actor_id uuid not null,action text not null,note text,created_at timestamptz not null default now());
 """)
 sql(f"""insert into public.profiles(id,tier1,account_status,admin,public_nickname,public_nickname_confirmed_at,suspension_reason) values
 ('{ADM}',false,'active',true,null,null,null),('{ADM2}',true,'active',true,null,null,null),('{ADMS}',true,'suspended',true,null,null,null),('{N}',true,'active',false,null,null,null),
 ('{REP}',true,'active',false,null,null,null),('{LL}',true,'active',false,'Landlord Lee',now(),null),('{T1}',true,'active',false,null,null,null),('{T2}',true,'active',false,null,null,null),
 ('{RES}',true,'restricted',false,null,null,'Set by SQL, no action row'),('{DEL}',false,'deleted',false,null,null,null);""")
 reporting=(ROOT/'supabase/migrations/20261110171913_reporting_moderation.sql').read_text(encoding='utf-8-sig')
 access=(ROOT/'supabase/migrations/20261112155016_admin_reports_access.sql').read_text(encoding='utf-8-sig')
 # Optional: --migration <file> runs the same checks against a modified copy (used to prove the checks fail when the migration is broken).
 migration=(Path(sys.argv[2]) if len(sys.argv)>2 and sys.argv[1]=='--migration' else ROOT/'supabase/migrations/20261113180000_admin_actions_audit.sql').read_text(encoding='utf-8-sig')
 rollback=(ROOT/'supabase/test-support/admin_actions_audit_rollback.sql').read_text(encoding='utf-8-sig')
 baseline=(ROOT/'supabase/test-support/admin_actions_audit_baseline.sql').read_text(encoding='utf-8-sig').replace('\r\n','\n')
 head,body,tail=baseline.split('$ama$');ama_create='$ama$'.join([head,body.replace('\n','\r\n'),tail])
 ama_replace=ama_create[ama_create.index('create function public.apply_moderation_action()'):].split('create trigger trg_apply_moderation_action')[0].replace('create function','create or replace function',1)
 sql(reporting);sql(access)
 r=psql(ama_create);assert r.returncode==0,r.stderr
 P0,L0=u(),u();sql(f"insert into public.properties values('{P0}','{LL}',true);insert into public.listings(id,property_id,landlord_id,status,title,published_at) values('{L0}','{P0}','{LL}','active','Reported rental',now());")
 C=u();sql(f"insert into public.conversations values('{C}','{L0}','{REP}','{LL}','open');")
 # ================= Fixture fidelity
 check(sql("select md5(prosrc) from pg_proc where oid='public.apply_moderation_action()'::regprocedure;")==PIN,'fixture: apply_moderation_action rebuilt byte-for-byte (md5 equals the hosted pin)')
 check(sql("select count(*) from pg_trigger where tgname='trg_apply_moderation_action' and tgenabled='O';")=='1','fixture: hosted trigger present')
 deny(auth(ADM)+"select * from public.moderation_actions;",'permission denied');deny(auth(ADM)+"select * from public.admin_audit_logs;",'permission denied')
 check(True,'fixture: authenticated has no privileges on moderation_actions or admin_audit_logs (hosted state)')
 base=md5s();before_ama=sql("select jsonb_build_object('owner',pg_get_userbyid(proowner),'secdef',prosecdef,'config',proconfig,'acl',proacl::text[]) from pg_proc where oid='public.apply_moderation_action()'::regprocedure;")
 # ================= Drift guards: each aborts the migration atomically
 sql("create or replace function public.apply_moderation_action() returns trigger language plpgsql security definer set search_path=public as $x$begin return new;end$x$;")
 r=psql(migration);check(r.returncode!=0 and 'source differs from the reviewed definition' in r.stderr,'drifted apply_moderation_action (md5 pin) aborts the migration')
 check(sql("select to_regprocedure('public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)') is null;")=='t' and sql("select to_regnamespace('rentlease_admin_actions') is null;")=='t','an aborted migration leaves nothing behind')
 r=psql(ama_replace);assert r.returncode==0,r.stderr;check(sql("select md5(prosrc) from pg_proc where oid='public.apply_moderation_action()'::regprocedure;")==PIN,'fixture restored to the pinned source')
 sql("alter function public.is_active_admin(uuid) rename to is_active_admin_x;");r=psql(migration);check(r.returncode!=0 and 'Admin helpers are missing' in r.stderr,'missing is_active_admin aborts the migration');sql("alter function public.is_active_admin_x(uuid) rename to is_active_admin;")
 sql("grant select on public.moderation_actions to authenticated;");r=psql(migration);check(r.returncode!=0 and 'Clients unexpectedly hold privileges' in r.stderr,'a client privilege on moderation_actions aborts the migration');sql("revoke all on public.moderation_actions from authenticated;")
 sql("grant insert on public.admin_audit_logs to anon;");r=psql(migration);check(r.returncode!=0 and 'Clients unexpectedly hold privileges' in r.stderr,'an anon privilege on admin_audit_logs aborts the migration');sql("revoke all on public.admin_audit_logs from anon;")
 sql("create schema rentlease_admin_actions;");r=psql(migration);check(r.returncode!=0 and 'already exists' in r.stderr,'a pre-existing private schema aborts the migration');sql("drop schema rentlease_admin_actions;")
 sql("alter table public.moderation_actions disable trigger trg_apply_moderation_action;");r=psql(migration);check(r.returncode!=0 and 'not enabled' in r.stderr,'a disabled apply trigger aborts the migration');sql("alter table public.moderation_actions enable trigger trg_apply_moderation_action;")
 # ================= Apply
 sql(migration);check(True,'migration applies cleanly')
 check(md5s()==base,'existing function sources (apply_moderation_action, moderate_rental_report, is_active_admin, conflicted) are unchanged by the migration')
 check(sql("select jsonb_build_object('owner',pg_get_userbyid(proowner),'secdef',prosecdef,'config',proconfig,'acl',proacl::text[]) from pg_proc where oid='public.apply_moderation_action()'::regprocedure;")==before_ama,'apply_moderation_action owner, ACL and configuration are unchanged')
 # ================= Grants and denied callers
 check(n("select count(*) from pg_proc where oid in("+reg(FNS)+") and prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig=array['search_path=pg_catalog'] and has_function_privilege('authenticated',oid,'execute') and not has_function_privilege('anon',oid,'execute');")==3,'RPCs are security definer, search_path=pg_catalog, executable by authenticated only')
 check(n("select count(*) from pg_proc where pronamespace='rentlease_admin_actions'::regnamespace and (has_function_privilege('authenticated',oid,'execute') or has_function_privilege('anon',oid,'execute'));")==0,'private trigger functions are not executable by clients')
 deny("set role anon;select public.get_admin_restrictions();",'permission denied');deny("set role anon;select public.get_admin_audit_log('all',0);",'permission denied');deny("set role anon;"+act(ADM,'suspend_account',user=T1).replace('set role authenticated;',''),'permission denied')
 check(True,'anonymous EXECUTE denied on all three RPCs')
 for t in('public.moderation_actions','public.admin_audit_logs','rentlease_admin_actions.receipts'):deny(auth(ADM)+f"select * from {t};",'permission denied')
 deny(auth(ADM)+f"insert into public.moderation_actions(admin_id,action_type,target_user_id,reason) values('{ADM}','suspend_account','{T1}','direct insert attempt');",'permission denied')
 deny(auth(ADM)+"select rentlease_admin_actions.audit_report_decision();",'permission denied')
 check(True,'authenticated (even an Admin) cannot read or write the moderation, audit or receipt tables directly, nor call trigger functions')
 for who,label in((N,'non-admin'),(ADMS,'suspended Admin'),(None,'unauthenticated')):
  pre="set role authenticated;set test.actor='';" if who is None else auth(who)
  deny(pre+f"select public.get_admin_restrictions();",'Access unavailable');deny(pre+"select public.get_admin_audit_log('all',0);",'Access unavailable')
  deny(pre+f"select public.apply_admin_moderation_action('{u()}','suspend_account','{T1}',null,null,'Valid reason text here',null);",'Access unavailable')
  check(True,f'{label} is denied all three RPCs')
 check(status_of(T1)=='active' and audits()==0,'denied callers changed nothing')
 # ================= Validation matrix (each denied case must change nothing)
 def bad(text,*a,**k):
  deny(act(*a,**k),text)
 for a_ in('warning','restrict_account','dismiss_report','delete_account','pause_listing','',None):
  bad('Action not supported',ADM,a_,user=T1)
 bad('Action not supported',ADM,'pause_listing',listing=u());check(True,'unsupported actions are refused (warning, restrict_account, dismiss_report, pause_listing and unknown values)')
 for rs in('too short','x'*9,'          ','x'*501):bad('Reason must be 10 to 500 characters',ADM,'suspend_account',user=T1,reason=rs)
 bad('Reason must be 10 to 500 characters',ADM,'suspend_account',user=T1,reason=None)
 check(True,'reason must be 10 to 500 characters after trimming (9, blank, 501 and null refused)')
 LA,PA=mk_listing()
 bad('Choose exactly one target',ADM,'suspend_account');bad('Choose exactly one target',ADM,'suspend_account',user=T1,listing=LA);bad('Choose exactly one target',ADM,'remove_listing',user=T1);bad('Choose exactly one target',ADM,'remove_listing')
 check(True,'exactly one target of the right kind is required')
 bad('End date applies only to suspensions',ADM,'remove_listing',listing=LA,ends='2099-01-01T00:00:00Z');bad('End date applies only to suspensions',ADM,'restore_account',user=RES,ends='2099-01-01T00:00:00Z')
 bad('End date must be in the future',ADM,'suspend_account',user=T1,ends='2020-01-01T00:00:00Z')
 check(True,'end date: past refused; only suspensions accept one')
 bad('cannot take action on their own account',ADM,'suspend_account',user=ADM);bad('cannot take action on their own account',ADM,'restore_account',user=ADM)
 bad('Admin accounts cannot be targeted',ADM,'suspend_account',user=ADM2);bad('Admin accounts cannot be targeted',ADM,'restore_account',user=ADMS)
 la_adm,_=mk_listing(owner=ADM);la_adm2,_=mk_listing(owner=ADM2)
 bad('cannot take action on their own account',ADM,'remove_listing',listing=la_adm);bad('Admin accounts cannot be targeted',ADM,'remove_listing',listing=la_adm2)
 check(True,'self-targeting and targeting any Admin (account or listing) is denied')
 bad('Target unavailable',ADM,'suspend_account',user=DEL);bad('Target unavailable',ADM,'suspend_account',user=u());bad('Target unavailable',ADM,'remove_listing',listing=u())
 check(True,'missing, deleted or unknown targets are refused')
 bad('already restricted or suspended',ADM,'suspend_account',user=RES);bad('not suspended or restricted',ADM,'restore_account',user=T1)
 check(True,'suspend only an active account; restore only a suspended or restricted one')
 for st in('draft','rented','archived','removed'):
  l_,_=mk_listing(st);bad('cannot be removed from its current status',ADM,'remove_listing',listing=l_)
 check(True,'remove only from active or paused')
 for st in('proposed','pending_confirmation','active'):
  l_,p_=mk_listing();tenancy(l_,p_,st);bad('cannot be removed while a tenancy is open',ADM,'remove_listing',listing=l_);check(lstatus(l_)=='active',f'remove is blocked while a tenancy is {st}')
 l_,p_=mk_listing();sql(f"insert into public.tenancies(id,listing_id,property_id,tenant_id,landlord_id,status) values(gen_random_uuid(),null,'{p_}','{T1}','{LL}','pending_confirmation');")
 bad('cannot be removed while a tenancy is open',ADM,'remove_listing',listing=l_);check(True,'an open tenancy on the same property (not the same listing row) also blocks remove')
 l_,p_=mk_listing();tenancy(l_,p_,'ended');tenancy(l_,p_,'cancelled');r_=act_ok(ADM,'remove_listing',listing=l_);check(r_['status']=='removed' and lstatus(l_)=='removed','ended or cancelled tenancies do not block remove')

 check(n("select count(*) from public.moderation_actions;")==1 and status_of(T1)=='active','every refused case above changed nothing (only the one accepted action exists)')
 # ================= Happy paths and their audit rows
 a0=audits();ends=sql("select to_char((now()+interval '30 days') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"');")
 r_=act_ok(ADM,'suspend_account',user=T1,ends=ends,reason='Repeated misleading listings after a warning')
 check(r_['status']=='suspended' and r_['targetUserId']==T1 and status_of(T1)=='suspended','suspend: account is suspended and the result says so')
 check(sql(f"select suspension_reason||'|'||(suspended_until is not null) from public.profiles where id='{T1}';")=='Repeated misleading listings after a warning|true','suspend: reason and end date are stored on the profile by the existing trigger')
 check(n(f"select count(*) from public.moderation_actions where id='{r_['id']}' and admin_id='{ADM}' and action_type='suspend_account' and target_user_id='{T1}';")==1,'suspend: one moderation_actions row written')
 check(audits()==a0+1 and n(f"select count(*) from public.admin_audit_logs where admin_id='{ADM}' and action='suspend_account' and entity_type='user' and entity_id='{T1}' and metadata->>'reason'='Repeated misleading listings after a warning';")==1,'suspend: exactly one audit row, written by the existing trigger')
 r_=act_ok(ADM,'restore_account',user=T1,reason='Suspension period reviewed and lifted');check(r_['status']=='active' and status_of(T1)=='active' and sql(f"select suspension_reason is null and suspended_until is null from public.profiles where id='{T1}';")=='t','restore: account active again, suspension fields cleared')
 check(n("select count(*) from public.admin_audit_logs where action='restore_account';")==1,'restore: audit row written')
 sql(f"update public.profiles set suspended_until=now() where id='{RES}';");r_=act_ok(ADM,'restore_account',user=RES,reason='Restricted account reviewed and restored');check(r_['status']=='active','restore also works for a restricted account')
 lr,_=mk_listing('paused');r_=act_ok(ADM,'remove_listing',listing=lr,reason='Listing removed for misleading photos');check(r_['status']=='removed' and sql(f"select removal_reason||'|'||(removed_at is not null) from public.listings where id='{lr}';")=='Listing removed for misleading photos|true','remove: removed with reason and removed_at (also from paused)')
 check(n("select count(*) from public.admin_audit_logs where action='remove_listing' and entity_type='listing';")==2,'each removal wrote an audit row (the tenancy-ended removal and the paused-listing removal)')
 # ================= Idempotency
 op=u();c0=n("select count(*) from public.moderation_actions;");a0=audits()
 first=act_ok(ADM,'suspend_account',user=T2,op=op,reason='Harassment confirmed by two reports')
 again=act_ok(ADM,'suspend_account',user=T2,op=op,reason='Harassment confirmed by two reports')
 check(first==again and n("select count(*) from public.moderation_actions;")==c0+1 and audits()==a0+1,'same operation id replays the stored result: one action row, one audit row')
 deny(act(ADM,'suspend_account',user=T2,op=op,reason='A different reason text here'),'Conflicting retry');deny(act(ADM,'suspend_account',user=T1,op=op,reason='Harassment confirmed by two reports'),'Conflicting retry')
 check(True,'the same operation id with changed input is refused')
 act_ok(ADM,'restore_account',user=T2,reason='Reviewed and restored after appeal')
 check(act_ok(ADM,'suspend_account',user=T2,op=op,reason='Harassment confirmed by two reports')==first and status_of(T2)=='active','an exact retry after the target changed still returns the stored result and does NOT apply it again')
 other=act_ok(ADM2,'suspend_account',user=T2,op=op,reason='Harassment confirmed by two reports');check(other['id']!=first['id'] and status_of(T2)=='suspended','receipts are per actor: another Admin using the same operation id acts independently')
 act_ok(ADM,'restore_account',user=T2,reason='Reviewed and restored by the first Admin')
 soon=sql("select to_char((now()+interval '3 seconds') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"');");op2=u()
 f2=act_ok(ADM,'suspend_account',user=T2,op=op2,ends=soon,reason='Suspended until the review completes');time.sleep(4)
 check(act_ok(ADM,'suspend_account',user=T2,op=op2,ends=soon,reason='Suspended until the review completes')==f2,'a retry after the end date has passed still replays (receipt is checked before the future-date rule)')
 act_ok(ADM,'restore_account',user=T2,reason='Reviewed and restored after the period')
 op3=u();same_instant=act_ok(ADM,'suspend_account',user=T2,op=op3,ends='2099-06-01T12:00:00Z',reason='Time zone canonicalization check')
 check(act_ok(ADM,'suspend_account',user=T2,op=op3,ends='2099-06-01T20:00:00+08:00',reason='Time zone canonicalization check')==same_instant,'the same end instant written in another UTC offset is the same input')
 act_ok(ADM,'restore_account',user=T2,reason='Reviewed and restored after the check')
 # ================= Concurrency
 t3,t4=u(),u();sql(f"insert into public.profiles(id,tier1) values('{t3}',true),('{t4}',true);")
 p1=bg(act(ADM,'suspend_account',user=t3,reason='Concurrent suspension attempt one'));p2=bg(act(ADM2,'suspend_account',user=t3,reason='Concurrent suspension attempt two'))
 (rc1,o1,e1),(rc2,o2,e2)=fin(p1),fin(p2)
 check(sorted([rc1==0,rc2==0])==[False,True] and 'already restricted or suspended' in (e1+e2) and n(f"select count(*) from public.moderation_actions where target_user_id='{t3}';")==1 and audits(f"entity_id='{t3}'")==1,'two Admins suspending the same user at once: exactly one wins, the other is told it is already suspended')
 op4=u();q=act(ADM,'suspend_account',user=t4,op=op4,reason='Concurrent identical retry attempt');p1=bg(q);p2=bg(q);(rc1,o1,e1),(rc2,o2,e2)=fin(p1),fin(p2)
 check(rc1==0 and rc2==0 and o1.split('\n')[-1]==o2.split('\n')[-1] and n(f"select count(*) from public.moderation_actions where target_user_id='{t4}';")==1,'two simultaneous identical retries both return the same result with one action row')
 lk,pk=mk_listing();hold=bg(f"begin;select pg_advisory_xact_lock(hashtextextended('{pk}',0));insert into public.tenancies(id,listing_id,property_id,tenant_id,landlord_id,status) values(gen_random_uuid(),'{lk}','{pk}','{T1}','{LL}','proposed');select pg_sleep(3);commit;")
 time.sleep(1);t0=time.time();(rc,o,e)=fin(bg(act(ADM,'remove_listing',listing=lk,reason='Removal racing a tenancy proposal')));el=time.time()-t0;fin(hold)
 check(rc!=0 and 'while a tenancy is open' in e and el>1.0 and lstatus(lk)=='active','remove waits on the per-property lock and then sees the tenancy proposed meanwhile, so it is refused (no removal slips past a proposal)')
 # ================= Report linkage (real reporting functions)
 rid,Lr,_=mk_report('listing');uid_,_,_=mk_report('user')
 bad('Report must be upheld first',ADM,'remove_listing',listing=Lr,report=rid)
 bad('Report unavailable',ADM,'remove_listing',listing=Lr,report=u());bad('Report unavailable',ADM,'suspend_account',user=T1,report=u())
 bad('A report is required',ADM,'suspend_account',user=T1,norep=True);bad('A report is required',ADM,'remove_listing',listing=Lr,norep=True)
 check(status_of(T1)=='active' and lstatus(Lr)=='active','suspend_account and remove_listing are refused without a report, and with an unknown report')
 uphold(rid);check(n("select count(*) from public.admin_audit_logs where action in('report_under_review','report_upheld') and entity_id='"+rid+"';")==2,'report decisions made through the real moderate_rental_report are audited by the new trigger (under_review and upheld)')
 other_l,_=mk_listing();bad('Report does not match the target',ADM,'remove_listing',listing=other_l,report=rid)
 bad('Report does not match the target',ADM,'suspend_account',user=T1,report=rid)
 r_=act_ok(ADM,'suspend_account',user=LL,report=rid,reason='Landlord of the upheld listing report');check(r_['reportId']==rid and status_of(LL)=='suspended',"an upheld listing report allows suspending that listing's landlord")
 act_ok(ADM,'restore_account',user=LL,report=rid,reason='Landlord restored after review');check(True,'restore_account accepts a report reference but does not need one (see the earlier restore calls without one)')
 r_=act_ok(ADM,'remove_listing',listing=Lr,report=rid,reason='Removed after the upheld report');check(r_['status']=='removed' and r_['reportId']==rid,'an upheld listing report allows removing that exact listing')
 bad('Report must be upheld first',ADM,'suspend_account',user=LL,report=uid_)
 uphold(uid_);act_ok(ADM,'suspend_account',user=LL,report=uid_,reason='Harassment upheld by report review');check(status_of(LL)=='suspended','an upheld user report allows suspending the reported user')
 act_ok(ADM,'restore_account',user=LL,reason='Restored without a report reference')
 conf=u();pc=u();lc=u();rep_c=u();cc=u()
 sql(f"insert into public.profiles(id,tier1,admin) values('{conf}',false,true);insert into public.profiles(id,tier1) values('{rep_c}',true);insert into public.properties values('{pc}','{conf}',true);insert into public.listings(id,property_id,landlord_id,status,title,published_at) values('{lc}','{pc}','{conf}','active','Owned by an Admin',now());insert into public.conversations values('{cc}','{lc}','{rep_c}','{conf}','open');")
 rc_=json.loads(sql(submit(rep_c,'listing',lc)))['id'];uphold(rc_)
 bad('Access unavailable',conf,'remove_listing',listing=lc,report=rc_);check(lstatus(lc)=='active','an Admin who is a party to the reported property is refused even with an upheld report')
 # ================= get_admin_restrictions
 for x in(T1,T2,t3,t4,LL):
  if status_of(x)!='active':sql(f"update public.profiles set account_status='active' where id='{x}';")
 sql(f"update public.profiles set account_status='active',suspension_reason=null,suspended_until=null where id in('{RES}');")
 act_ok(ADM,'suspend_account',user=LL,reason='Landlord suspended for the restrictions list',ends='2099-01-01T00:00:00Z');act_ok(ADM,'suspend_account',user=T1,reason='User suspended without an end date')
 sql(f"update public.profiles set account_status='restricted',suspension_reason='Set by SQL, no action row',suspended_until=now()-interval '1 day' where id='{RES}';")
 res=restrictions();by={x['userId']:x for x in res['rows']}
 check(res['count']==4 and set(by)=={LL,T1,RES,ADMS},'restrictions: lists exactly the suspended and restricted accounts (including the suspended Admin fixture)')
 check(by[LL]['name']=='Landlord Lee' and by[T1]['name']=='User '+T1[:8],'restrictions: public nickname when confirmed, otherwise a short id')
 check(LEGAL not in json.dumps(res),'restrictions: the private display_name never appears')
 check(by[LL]['status']=='suspended' and by[LL]['reason']=='Landlord suspended for the restrictions list' and by[LL]['ended'] is False and by[LL]['startedAt'] is not None and by[LL]['endsAt'] is not None,'restrictions: status, reason, end date and start date from the action row')
 check(by[T1]['endsAt'] is None and by[T1]['ended'] is False,'restrictions: no end date means not ended')
 check(by[RES]['status']=='restricted' and by[RES]['ended'] is True and by[RES]['startedAt'] is None,'restrictions: a past end date is flagged ended; a SQL-set restriction has no recorded start')
 check(all(x['restorable'] for x in res['rows'] if x['userId']!=ADMS) and by[ADMS]['restorable'] is False,'restrictions: ordinary users are restorable; a suspended Admin is listed but not restorable from the app')
 check(set(restrictions()['rows'][0].keys())=={'userId','name','status','reason','endsAt','startedAt','ended','restorable'},'restrictions: only the documented fields are returned')
 # ================= Audit triggers: verification
 v=u();sql(f"insert into public.verification_submissions(id,user_id,tier,status,submitted_note) values('{v}','{T1}','tier_3_property','pending','Applicant note with a document name: land_title_scan.jpg');")
 a0=audits();sql(as_(T1)+f"update public.verification_submissions set status='cancelled' where id='{v}';update public.verification_submissions set status='pending' where id='{v}';");check(audits()==a0,'verification: a non-Admin status change (user cancel/reopen) is not an Admin decision and is not audited')
 sql(as_(ADM)+f"update public.verification_submissions set updated_at=now() where id='{v}';");check(audits()==a0,'verification: an update that does not change status is not audited')
 sql(as_(ADM)+f"update public.verification_submissions set status='under_review',reviewed_by='{ADM}' where id='{v}';");sql(as_(ADM)+f"update public.verification_submissions set status='rejected',rejection_reason='Document does not match the property',review_note='internal' where id='{v}';")
 vr=sql("select jsonb_agg(jsonb_build_object('a',action,'e',entity_type,'i',entity_id,'m',metadata,'admin',admin_id) order by id) from public.admin_audit_logs where entity_type='verification_submission';");vr=json.loads(vr)
 check([x['a'] for x in vr]==['verification_under_review','verification_rejected'] and all(x['i']==v and x['admin']==ADM for x in vr),'verification: Admin decisions are audited with the Admin as actor')
 check(set(vr[1]['m'])=={'status','previous_status','tier','reason'} and vr[1]['m']['previous_status']=='under_review' and vr[1]['m']['reason']=='Document does not match the property' and vr[1]['m']['tier']=='tier_3_property','verification: metadata holds only status, previous status, tier and the rejection reason')
 check('land_title' not in json.dumps(vr) and str(T1) not in json.dumps([x['m'] for x in vr]),'verification: no applicant note, document name or user id is copied into the audit row')
 sql(as_(ADM)+f"update public.verification_submissions set status='approved' where id='{v}';");check(audits("action='verification_approved'")==1,'verification: approval audited (reason null when no note)')
 sql(as_(ADM)+f"update public.verification_submissions set status='revoked' where id='{v}';");check(audits("action='verification_revoked'")==0,'verification: only under_review, approved and rejected are audited')
 sql(f"insert into public.verification_submissions(user_id,tier,status) values('{T1}','tier_2_identity','under_review');");check(audits("entity_type='verification_submission'")==3,'verification: an INSERT is not audited')
 # ================= Audit triggers: reports
 a0=audits("entity_type='report'");rr,_,_=mk_report('user');mk_report('listing')
 check(audits("entity_type='report'")==a0,'reports: a reporter\'s own submission event is not an Admin decision')
 sql(moderate(ADM,rr,'dismissed','Dismissed after review of the evidence'))
 row=json.loads(sql(f"select jsonb_build_object('m',metadata,'a',action,'admin',admin_id) from public.admin_audit_logs where entity_id='{rr}';"))
 check(row['a']=='report_dismissed' and row['admin']==ADM and set(row['m'])=={'status','kind','reason'} and row['m']['kind']=='user' and row['m']['reason']=='Dismissed after review of the evidence','reports: decision audited with kind and the Admin\'s note only')
 # ================= Audit triggers: reviews
 rv=u();sql(f"insert into rentlease_reviews.entries(id,kind) values('{rv}','property');")
 a0=audits("entity_type='review'");sql(f"insert into rentlease_reviews.events(review_id,actor_id,action,note) values('{rv}','{REP}','submitted','Tenant text');insert into rentlease_reviews.events(review_id,actor_id,action,note) values('{rv}','{N}','approved','Not an Admin');");check(audits("entity_type='review'")==a0,'reviews: submission events and non-Admin actors are not audited')
 for st in('approved','hidden','rejected'):sql(f"insert into rentlease_reviews.events(review_id,actor_id,action,note) values('{rv}','{ADM}','{st}','Moderation note for {st}');")
 rows=json.loads(sql("select jsonb_agg(jsonb_build_object('a',action,'m',metadata) order by id) from public.admin_audit_logs where entity_type='review';"))
 check([x['a'] for x in rows]==['review_approved','review_hidden','review_rejected'] and all(set(x['m'])=={'status','kind','reason'} and x['m']['kind']=='property' for x in rows),'reviews: approved, hidden and rejected decisions are audited with kind and note only')
 # ================= get_admin_audit_log
 allr=log('all');check(allr['count']==audits() and len(allr['rows'])==25,'audit log: first page has 25 rows and the count covers every row')
 check(all(allr['rows'][i]['createdAt']>=allr['rows'][i+1]['createdAt'] for i in range(24)),'audit log: newest first')
 total=allr['count'];pg2=log('all',25);check(total>25 and len(pg2['rows'])==min(25,total-25) and not({x['id'] for x in allr['rows']}&{x['id'] for x in pg2['rows']}),'audit log: pagination returns the next page with no overlap')
 for kind,pred in(('verification',"starts_with(action,'verification_')"),('reports',"starts_with(action,'report_') or action='dismiss_report'"),('reviews',"starts_with(action,'review_')"),('actions',"action in('suspend_account','restore_account','pause_listing','remove_listing','restrict_account','warning')")):
  res=log(kind);check(res['count']==audits(pred) and res['count']>0 and all((kind=='actions' and x['entityType'] in('user','listing')) or (kind=='verification' and x['entityType']=='verification_submission') or (kind=='reports' and x['entityType']=='report') or (kind=='reviews' and x['entityType']=='review') for x in res['rows']),f'audit log: filter {kind} returns only its own entries')
 check(audits("action not in('suspend_account','restore_account','pause_listing','remove_listing','restrict_account','warning','dismiss_report') and not starts_with(action,'verification_') and not starts_with(action,'report_') and not starts_with(action,'review_')")==0,'audit log: every audit row belongs to exactly one filter (or all)')
 acts=[x for x in log('actions',0)['rows'] if x['action']=='suspend_account'][0];check(acts['actor']=='Admin '+ADM[:8] and acts['subject'] in('Landlord Lee','User '+T1[:8],'User '+T2[:8],'User '+t3[:8],'User '+t4[:8]) and 'metadata' not in acts,'audit log: actor and subject are public labels; raw metadata is not returned')
 check(LEGAL not in json.dumps(allr)+json.dumps(pg2),'audit log: the private display_name never appears')
 listing_row=[x for x in log('actions',0)['rows']+log('actions',25)['rows'] if x['action']=='remove_listing'][0];check(listing_row['subject'].startswith('Rental ') and listing_row['reason'],'audit log: listing actions show the listing title and the reason')
 vrow=log('verification')['rows'][0];check(vrow['tier']=='tier_3_property' or vrow['tier']=='tier_2_identity','audit log: verification rows carry the tier')
 rrow=[x for x in log('reports')['rows'] if x['action']=='report_upheld'][0];check(rrow['reportReason']=='other' and rrow['status']=='upheld' and rrow['reason'],'audit log: report rows carry the reporter reason code, status and the Admin note')
 for bad_kind,off in(('everything',0),('all',-1),('all',10001),(None,0)):
  deny(auth(ADM)+f"select public.get_admin_audit_log({sq(bad_kind)},{off});",'Invalid audit filter')
 check(True,'audit log: invalid filters and offsets are refused')
 check(log('all',10000)['rows']==[] ,'audit log: an offset past the end returns an empty page, not an error')
 # ================= Audit log hides rows of reports the calling Admin is conflicted on
 ADM3=u();sql(f"insert into public.profiles(id,tier1,admin) values('{ADM3}',false,true);")
 rc2,Lc2,_=mk_report('listing');uphold(rc2);act_ok(ADM,'remove_listing',listing=Lc2,report=rc2,reason='Removed after the upheld conflicted-report check')
 pc2=sql(f"select property_id from public.listings where id='{Lc2}';");tid=u()
 # Conflict through the real rule: the Admin was a tenant on the reported property (cases are immutable, so the fixture adds the tenancy instead).
 sql(f"insert into public.tenancies(id,listing_id,property_id,tenant_id,landlord_id,status) values('{tid}','{Lc2}','{pc2}','{ADM3}','{LL}','ended');")
 mine=f"entity_id='{rc2}' or metadata->>'report_id'='{rc2}'";nmine=audits(mine)
 check(n(f"select count(*) from public.admin_audit_logs where entity_type='report' and entity_id='{rc2}';")>=2 and n(f"select count(*) from public.admin_audit_logs where metadata->>'report_id'='{rc2}' and action='remove_listing';")==1,'conflict fixture: the report has event rows and an action row that carries its id')
 def all_rows(actor,kind='all'):
  first=log(kind,0,actor=actor);rows=list(first['rows']);off=25
  while off<first['count']:rows+=log(kind,off,actor=actor)['rows'];off+=25
  return first['count'],rows
 c3,r3=all_rows(ADM3);cA,rA=all_rows(ADM)
 check(not any(x['entityId']==rc2 or x['reportId']==rc2 for x in r3),'conflicted Admin: report events and actions carrying that report_id are not returned')
 check(any(x['entityId']==rc2 for x in rA) and any(x['reportId']==rc2 for x in rA),'a non-conflicted Admin sees both the report events and the action that carries the report')
 check(c3==len(r3)==cA-nmine and cA==len(rA)==audits(),'count equals the rows actually returned for both Admins (the filter is inside the counted set)')
 check(sorted(x['id'] for x in r3)==sorted(x['id'] for x in rA if x['entityId']!=rc2 and x['reportId']!=rc2),'the conflicted Admin still sees every other audit row, nothing more is hidden')
 for kind in('reports','actions'):
  ck,rk=all_rows(ADM3,kind);check(ck==len(rk) and not any(x['entityId']==rc2 or x['reportId']==rc2 for x in rk),f'conflicted Admin: the {kind} filter hides the report rows and its count is consistent')
 sql(f"delete from public.tenancies where id='{tid}';")
 check(all_rows(ADM3)[0]==cA,'removing the conflict makes the rows visible again (the filter follows the live conflict state)')
 # ================= Strict audit policy: an audit failure rolls the decision back
 sql("alter table public.admin_audit_logs add constraint zz_audit_unwritable check(false) not valid;")
 tgt=u();sql(f"insert into public.profiles(id,tier1) values('{tgt}',true);");aop=u();c0=n("select count(*) from public.moderation_actions;");r0=n("select count(*) from rentlease_admin_actions.receipts;")
 deny(act(ADM,'suspend_account',user=tgt,op=aop,reason='Audit failure rollback check one'),'zz_audit_unwritable')
 check(status_of(tgt)=='active' and n("select count(*) from public.moderation_actions;")==c0 and n("select count(*) from rentlease_admin_actions.receipts;")==r0,'audit failure: the RPC rolls back entirely (account unchanged, no action row, no receipt)')
 lf,_=mk_listing();deny(act(ADM,'remove_listing',listing=lf,reason='Audit failure rollback check two'),'zz_audit_unwritable');check(lstatus(lf)=='active','audit failure: a listing removal rolls back too')
 rid2,_,_=mk_report('listing');e0=n("select count(*) from rentlease_reporting.events;");st0=sql(f"select status from public.reports where id='{rid2}';");mop=u()
 deny(moderate(ADM,rid2,'under_review','Report decision under a failing audit',op=mop),'zz_audit_unwritable')
 check(sql(f"select status from public.reports where id='{rid2}';")==st0 and n("select count(*) from rentlease_reporting.events;")==e0,'audit failure: a report decision rolls back (status unchanged, no event row)')
 vv=u();sql(f"insert into public.verification_submissions(id,user_id,tier,status) values('{vv}','{T1}','tier_2_identity','pending');")
 deny(as_(ADM)+f"update public.verification_submissions set status='under_review' where id='{vv}';",'zz_audit_unwritable');check(sql(f"select status from public.verification_submissions where id='{vv}';")=='pending','audit failure: a verification decision rolls back')
 rv2=u();sql(f"insert into rentlease_reviews.entries(id,kind) values('{rv2}','user');");deny(f"insert into rentlease_reviews.events(review_id,actor_id,action,note) values('{rv2}','{ADM}','approved','Failing audit');",'zz_audit_unwritable')
 check(n(f"select count(*) from rentlease_reviews.events where review_id='{rv2}';")==0,'audit failure: a review decision rolls back (no event row)')
 check(audits("action='suspend_account' and entity_id='"+tgt+"'")==0,'audit failure: no partial audit row survives')
 sql("alter table public.admin_audit_logs drop constraint zz_audit_unwritable;")
 check(act_ok(ADM,'suspend_account',user=tgt,op=aop,reason='Audit failure rollback check one')['status']=='suspended' and audits("entity_id='"+tgt+"'")==1,'audit failure: once audit works again, retrying the SAME operation id succeeds exactly once')
 sql(moderate(ADM,rid2,'under_review','Report decision under a failing audit',op=mop));check(audits("entity_id='"+rid2+"'")==1,'audit failure: the same report operation id succeeds after recovery')
 # ================= Defense in depth: the RPC refuses an unapplied or unaudited result
 sql("alter table public.moderation_actions disable trigger trg_apply_moderation_action;");dd=u();sql(f"insert into public.profiles(id,tier1) values('{dd}',true);")
 c0=n("select count(*) from public.moderation_actions;");deny(act(ADM,'suspend_account',user=dd,reason='Trigger disabled safety check'),'Action was not applied')
 check(n("select count(*) from public.moderation_actions;")==c0 and status_of(dd)=='active','defense in depth: with the apply trigger disabled the RPC refuses and rolls back')
 sql("alter table public.moderation_actions enable trigger trg_apply_moderation_action;")
 sql("create or replace function public.apply_moderation_action() returns trigger language plpgsql security definer set search_path=public as $x$begin if new.action_type='suspend_account' then update public.profiles set account_status='suspended' where id=new.target_user_id;end if;return new;end$x$;")
 deny(act(ADM,'suspend_account',user=dd,reason='No audit row safety check'),'Audit entry was not written');check(status_of(dd)=='active','defense in depth: if no audit row is written the RPC refuses and rolls back')
 r=psql(ama_replace);assert r.returncode==0,r.stderr;check(sql("select md5(prosrc) from pg_proc where oid='public.apply_moderation_action()'::regprocedure;")==PIN,'fixture restored to the pinned source')
 # ================= Rollback
 snap_audit=audits();snap_actions=n("select count(*) from public.moderation_actions;");snap_receipts=n("select count(*) from rentlease_admin_actions.receipts;");profile_state=sql("select md5(string_agg(id||account_status::text,',' order by id)) from public.profiles;")
 check(snap_receipts>0,'rollback precondition: receipts exist')
 sql(rollback)
 check(n("select count(*) from pg_proc where proname in('apply_admin_moderation_action','get_admin_restrictions','get_admin_audit_log');")==0 and n("select count(*) from pg_trigger where tgname in('audit_verification_decision','audit_report_decision','audit_review_decision');")==0,'rollback removes the RPCs and the three audit triggers')
 check(n("select count(*) from pg_proc where pronamespace='rentlease_admin_actions'::regnamespace and prorettype='trigger'::regtype and proname like 'audit_%';")==0 and sql("select to_regclass('public.idx_admin_audit_logs_created_at') is null;")=='t','rollback removes the audit trigger functions and the pagination index')
 check(audits()==snap_audit and n("select count(*) from public.moderation_actions;")==snap_actions and sql("select md5(string_agg(id||account_status::text,',' order by id)) from public.profiles;")==profile_state,'rollback keeps every audit row and does not undo any applied action')
 check(n("select count(*) from rentlease_admin_actions.receipts;")==snap_receipts,'rollback retains a non-empty receipts table as evidence')
 check(md5s()==base and sql("select count(*) from pg_trigger where tgname='trg_apply_moderation_action' and tgenabled='O';")=='1','rollback leaves the existing moderation trigger and the reporting functions untouched')
 r=psql(rollback);check(r.returncode!=0 and 'not applied or is already rolled back' in r.stderr,'a second rollback fails loudly instead of changing anything')
 r=psql(migration);check(r.returncode!=0 and 'already exists' in r.stderr,'re-applying while retained receipts exist is refused (schema still present)')
 sql("drop table rentlease_admin_actions.receipts;drop function rentlease_admin_actions.immutable();drop schema rentlease_admin_actions;")
 sql(migration);sql(rollback);check(sql("select to_regnamespace('rentlease_admin_actions') is null;")=='t' and n("select count(*) from pg_proc where proname in('apply_admin_moderation_action','get_admin_restrictions','get_admin_audit_log');")==0,'rollback with an empty receipts table drops the whole private schema')
 sql(migration);check(act_ok(ADM,'restore_account',user=tgt,reason='Reapplied migration works after rollback')['status']=='active','the migration re-applies cleanly after rollback and the RPC works')
 print(f'{checks} focused SQL checks passed',flush=True)
finally:
 r=run(['docker','rm','-f',NAME]);print('Disposable container removed' if r.returncode==0 else 'Container removal failed: '+r.stderr,flush=True)
