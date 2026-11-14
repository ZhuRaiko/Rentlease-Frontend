"""Network-isolated synthetic checks for 20261114120000_admin_reinstate_relist_guard.sql and its rollback. No hosted connection accepted.

Requires Docker. Everything runs in a disposable container with no network, mounts or published ports; the hosted project is never contacted.
Fixture: the REAL reporting (20261110171913), admin-access (20261112155016) and admin-actions-audit (20261113180000) migrations are applied on a small
synthetic schema, plus supabase/test-support/admin_actions_audit_baseline.sql (moderation tables and the apply_moderation_action trigger, md5-pinned) and
supabase/test-support/admin_reinstate_relist_guard_baseline.json: byte-faithful copies (md5-pinned) of the hosted save_listing_draft, publish_listing,
reactivate_listing, update_listing_draft, validate_listing_owner, rotate_listing_edit_version and remember_publication, with the hosted listing triggers,
constraints and client privileges. Completeness, property verification and the other tables are minimal stand-ins; see
supabase/test-support/ADMIN_REINSTATE_RELIST_GUARD.md for what that does and does not prove.
Run: python supabase/tests/run_admin_reinstate_relist_guard.py   (optionally: --migration <modified copy> for mutation checks; --discover prints the new md5 pins)
"""
import hashlib,json,re,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-reinstate-'+uuid.uuid4().hex[:8];checks=0
def u():return str(uuid.uuid4())
# Actors. ADM: Admin without Tier 1 (the real account shape). ADM2: second Admin. ADM3: third Admin (made conflicted in some tests). ADMS: suspended Admin.
# N: ordinary user. REP: reporter. LL: landlord with a confirmed public nickname, Tier 1. T1,T2: Tier 1 users without a public nickname.
ADM,ADM2,ADM3,ADMS,N,REP,LL,T1,T2=[u() for _ in range(9)]
LEGAL='PRIVATE-LEGAL-NAME'
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
class Result:
 def __init__(self,p):self.returncode=p.returncode;self.stdout=p.stdout.decode('utf-8','replace');self.stderr=p.stderr.decode('utf-8','replace')
# Bytes, not text mode: a Windows text pipe rewrites LF as CRLF, which changes md5(prosrc) of function bodies.
def cmd():return ['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','reinstatetest','-qAt','-v','ON_ERROR_STOP=1']
def psql(q):return Result(subprocess.run(cmd(),input=q.encode('utf-8'),capture_output=True))
def sql(q,ok=True):
 r=psql(q);assert (r.returncode==0)==ok,r.stderr if ok else 'Expected failure but statement succeeded: '+q[:140]
 return r.stdout.strip()
def deny(q,text,code=None):
 # code: also assert the SQLSTATE, read from a verbose error ("ERROR:  22023: message").
 r=psql(('\\set VERBOSITY verbose\n' if code else '')+q);assert r.returncode!=0,'Expected denial: '+q[:140]
 assert text in r.stderr,f'Expected {text!r} in: {r.stderr.strip()[:300]}'
 if code:assert f'{code}: ' in r.stderr,f'Expected SQLSTATE {code} in: {r.stderr.strip()[:300]}'
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
def n(q):return int(sql(q))
def audits(where='true'):return n(f"select count(*) from public.admin_audit_logs where {where};")
def lstatus(l):return sql(f"select status from public.listings where id='{l}';")
def mk_property(owner=None,verified=True):
 owner=owner or LL;p=u();sql(f"insert into public.properties values('{p}','{owner}',true,{'true' if verified else 'false'});");return p
def mk_listing(status='active',owner=None,prop=None,title=None):
 # The hosted validate_listing_owner trigger refuses an INSERT as active, so insert a draft and then move it to the wanted status.
 owner=owner or LL;p=prop or mk_property(owner);l=u();t=sq(title) if title else f"'Rental '||left('{l}',6)"
 sql(f"insert into public.listings(id,property_id,landlord_id,status,title) values('{l}','{p}','{owner}','draft',{t});"+(f"update public.listings set status='{status}' where id='{l}';" if status!='draft' else ''))
 return l,p
def force_removed(l,reason='Removed directly for a fixture'):sql(f"update public.listings set status='removed',removed_at=now(),removal_reason='{reason}' where id='{l}';")
AUTO={}
def auto_report(user,listing):
 # suspend_account and remove_listing REQUIRE an upheld report; fixture shortcut: an upheld report row inserted directly (one stable report per target).
 key=(user,listing)
 if key not in AUTO:
  col,val=('reported_user_id',user) if user is not None else ('reported_listing_id',listing)
  rid=u();sql(f"insert into public.reports(id,reporter_id,{col},reason,details,status) values('{rid}','{REP}','{val}','other','Fixture report','upheld');");AUTO[key]=rid
 return AUTO[key]
def act(actor,action,user=None,listing=None,report=None,reason='Repeated misleading listings after a warning',ends=None,op=None):
 if report is None and action in('suspend_account','remove_listing') and (user is not None or listing is not None) and not(user is not None and listing is not None):report=auto_report(user,listing)
 return auth(actor)+f"select public.apply_admin_moderation_action('{op or u()}','{action}',{sq(user)},{sq(listing)},{sq(report)},{sq(reason)},{sq(ends)});"
def act_ok(*a,**k):return json.loads(sql(act(*a,**k)))
def remove(l,reason='Listing removed for misleading photos'):return act_ok(ADM,'remove_listing',listing=l,reason=reason)
def reinstate(actor,l,reason='Removal reviewed and reversed after appeal',**k):return act(actor,'reinstate_listing',listing=l,reason=reason,**k)
def save(p,title='Draft title',desc='Draft description',rent=1000):return f"select * from public.save_listing_draft('{p}','{title}','{desc}',{rent});"
def log(kind='all',off=0,actor=ADM):return json.loads(sql(auth(actor)+f"select public.get_admin_audit_log('{kind}',{off});"))
def removed_list(actor=ADM):return json.loads(sql(auth(actor)+"select public.get_admin_removed_listings();"))
def as_(actor):return f"set test.actor='{actor}';"
def mk_report(kind='listing',reported=None):
 rep=u();sql(f"insert into public.profiles(id,tier1) values('{rep}',true);");l_,p_=mk_listing(owner=reported);c_=u();sql(f"insert into public.conversations values('{c_}','{l_}','{rep}','{reported or LL}','open');")
 return json.loads(sql(submit(rep,kind,l_ if kind=='listing' else c_)))['id'],l_,rep
def submit(actor,kind,context):return auth(actor)+f"select public.submit_rental_report('{u()}','{kind}','{context}','other','Concern');"
def moderate(actor,rid,status,note='Private reviewer reason',op=None):
 rev=json.loads(sql(auth(actor)+f"select public.get_rental_report('{rid}',true);"))['revision']
 return auth(actor)+f"select public.moderate_rental_report('{rid}','{op or u()}','{rev}','{status}','{note}','');"
def uphold(rid,actor=ADM):
 sql(moderate(actor,rid,'under_review','Starting review of this report'));sql(moderate(actor,rid,'upheld','Report confirmed after review'))
PATCHED=("public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)","public.publish_listing(uuid)","public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)","public.get_admin_audit_log(text,integer)")
UNTOUCHED=("public.reactivate_listing(uuid)","public.update_listing_draft(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)","public.get_admin_restrictions()","public.apply_moderation_action()","public.validate_listing_owner()","public.rotate_listing_edit_version()","rentlease_unfinished_posts.remember_publication()")
# Hosted md5(prosrc) as read 2026-11-14 (the user's list plus the functions this migration must leave alone).
OLD={PATCHED[0]:'260ffe2c338beb57840aa761072e2b82',PATCHED[1]:'11e9d42b4ff2cdec8bd2148557beb92a',PATCHED[2]:'7cb33c1bc86c374a0761049ecfcfc879',PATCHED[3]:'08481f61304cb7498c51ea359af2bbef'}
SAME={UNTOUCHED[0]:'8eb305fd08f1edfebd2b66b21aff22e9',UNTOUCHED[1]:'1cbc01da840fe61e6465e1c6c0f8f61b',UNTOUCHED[2]:'96da176a5c89402a1390c25ac4c816f5',UNTOUCHED[3]:'311afeb3c10eef8dd2b1b5a965377f21',UNTOUCHED[4]:'986f1672c657ac3f6d4bfc77620ba094',UNTOUCHED[5]:'29523f51f58611aea3403a30f3310e8d',UNTOUCHED[6]:'0a2eafe977a03f73ab65be10c445f2c8'}
def reg(l):return "'"+"'::regprocedure,'".join(l)+"'::regprocedure"
def md5_of(sig):return sql(f"select md5(prosrc) from pg_proc where oid='{sig}'::regprocedure;")
def md5_all(sigs):return {s:md5_of(s) for s in sigs}
def state(sigs):return sql("select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text[],'secdef',p.prosecdef,'config',p.proconfig,'volatile',p.provolatile,'lang',p.prolang)) from pg_proc p where p.oid in("+reg(sigs)+");")
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-qAt','-c','select 1']).returncode==0:break
  time.sleep(.5)
 time.sleep(10)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','reinstatetest']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create type public.account_status as enum('active','restricted','suspended','deleted');
 create table public.profiles(id uuid primary key,display_name text not null default 'PRIVATE-LEGAL-NAME',public_nickname text,public_nickname_confirmed_at timestamptz,account_status public.account_status not null default 'active',suspended_until timestamptz,suspension_reason text,updated_at timestamptz not null default now(),tier1 boolean not null default false,admin boolean not null default false);
 create function public.is_tier1_verified(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=requested_user and p.tier1 and p.account_status='active')$$;
 create function public.is_admin(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=requested_user and p.admin)$$;
 grant execute on function public.is_tier1_verified(uuid),public.is_admin(uuid) to authenticated;
 create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
 create type public.listing_status as enum('draft','active','paused','rented','archived','removed');
 create type public.tenancy_status as enum('proposed','pending_confirmation','active','ended','cancelled');
 create type public.rental_term_type as enum('long_term','short_term');
 -- Hosted public.properties has more columns; the code under test reads id, landlord_id, is_active. 'verified' feeds the identity stand-in below.
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean,verified boolean not null default true);
 -- public.listings: hosted columns, defaults, NOT NULLs, CHECK constraints, foreign keys, indexes and triggers as read on 2026-11-14.
 create table public.listings(
  id uuid not null default gen_random_uuid(),
  property_id uuid not null,
  landlord_id uuid not null,
  title text not null,
  description text not null default 'Fixture description',
  house_rules text,
  rental_term public.rental_term_type not null default 'long_term',
  asking_rent_monthly numeric(12,2) not null default 1000,
  security_deposit_months numeric(4,2) not null default 1,
  advance_rent_months numeric(4,2) not null default 1,
  minimum_stay_months smallint,
  available_from date,
  status public.listing_status not null default 'draft',
  completeness_score numeric(5,4) not null default 0,
  published_at timestamptz,paused_at timestamptz,archived_at timestamptz,removed_at timestamptz,removal_reason text,
  edit_version uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint listings_pkey primary key(id),
  constraint listings_advance_rent_months_check check(advance_rent_months>=0),
  constraint listings_asking_rent_monthly_check check(asking_rent_monthly>0),
  constraint listings_completeness_score_check check(completeness_score>=0 and completeness_score<=1),
  constraint listings_minimum_stay_months_check check(minimum_stay_months>0),
  constraint listings_security_deposit_months_check check(security_deposit_months>=0),
  constraint listings_landlord_id_fkey foreign key(landlord_id) references public.profiles(id) on delete restrict,
  constraint listings_property_id_fkey foreign key(property_id) references public.properties(id) on delete cascade);
 create index idx_listings_active_search on public.listings(status,available_from,asking_rent_monthly);
 create index idx_listings_landlord_status on public.listings(landlord_id,status);
 create index idx_listings_property on public.listings(property_id);
 alter table public.listings enable row level security;
 revoke all on public.listings from public,anon,authenticated,service_role;grant select on public.listings to authenticated;
 create policy listings_read_allowed on public.listings for select to authenticated using(landlord_id=auth.uid() or public.is_admin());
 create schema rentlease_completeness;create function rentlease_completeness.calculate_listing_completeness(uuid,text,text,numeric,date) returns numeric language sql as $$select 0.9::numeric$$;
 create schema rentlease_property_identity;create function rentlease_property_identity.verified(p uuid) returns boolean language sql stable as $$select coalesce((select x.verified from public.properties x where x.id=p),false)$$;
 create schema rentlease_unfinished_posts;create table rentlease_unfinished_posts.records(property_id uuid primary key,ever_published boolean not null default false);
 create table public.conversations(id uuid primary key,listing_id uuid references public.listings,tenant_id uuid,landlord_id uuid,status text);
 create table public.tenancies(id uuid primary key,listing_id uuid,property_id uuid,tenant_id uuid,landlord_id uuid,status public.tenancy_status not null default 'proposed');
 create table public.messages(id uuid primary key);
 create type public.report_reason as enum('fraudulent_listing','misleading_information','harassment','impersonation','unsafe_property','spam','policy_violation','other');
 create type public.report_status as enum('submitted','under_review','needs_information','upheld','dismissed','closed');
 create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles on delete restrict,reported_user_id uuid references public.profiles on delete set null,reported_listing_id uuid references public.listings on delete set null,reported_message_id uuid references public.messages on delete set null,reason public.report_reason not null,details text not null,status public.report_status not null default 'submitted',assigned_admin_id uuid references public.profiles on delete set null,admin_summary text,submitted_at timestamptz not null default now(),resolved_at timestamptz,updated_at timestamptz not null default now(),check(num_nonnulls(reported_user_id,reported_listing_id,reported_message_id)>=1));
 alter table public.reports enable row level security;revoke all on public.reports from public,anon,authenticated,service_role;
 create policy old_read on public.reports to authenticated using(reporter_id=auth.uid());
 create trigger trg_reports_updated_at before update on public.reports for each row execute function public.set_updated_at();
 create type public.verification_tier as enum('tier_2_identity','tier_3_property');
 create type public.verification_status as enum('pending','under_review','approved','rejected','cancelled','revoked');
 create table public.verification_submissions(id uuid primary key default gen_random_uuid(),user_id uuid not null,tier public.verification_tier not null,property_id uuid,status public.verification_status not null default 'pending',submitted_note text,reviewed_by uuid,review_note text,rejection_reason text,updated_at timestamptz not null default now());
 create schema rentlease_reviews;
 create table rentlease_reviews.entries(id uuid primary key default gen_random_uuid(),kind text not null);
 create table rentlease_reviews.events(id uuid primary key default gen_random_uuid(),review_id uuid not null references rentlease_reviews.entries,actor_id uuid not null,action text not null,note text,created_at timestamptz not null default now());
 """)
 sql(f"""insert into public.profiles(id,tier1,account_status,admin,public_nickname,public_nickname_confirmed_at) values
 ('{ADM}',false,'active',true,null,null),('{ADM2}',true,'active',true,null,null),('{ADM3}',false,'active',true,null,null),('{ADMS}',true,'suspended',true,null,null),('{N}',true,'active',false,null,null),
 ('{REP}',true,'active',false,null,null),('{LL}',true,'active',false,'Landlord Lee',now()),('{T1}',true,'active',false,null,null),('{T2}',true,'active',false,null,null);""")
 read=lambda p:(ROOT/p).read_text(encoding='utf-8-sig')
 reporting=read('supabase/migrations/20261110171913_reporting_moderation.sql');access=read('supabase/migrations/20261112155016_admin_reports_access.sql');actions=read('supabase/migrations/20261113180000_admin_actions_audit.sql')
 flag=sys.argv[1] if len(sys.argv)>1 else '';migration_path=Path(sys.argv[2]) if flag=='--migration' else ROOT/'supabase/migrations/20261114120000_admin_reinstate_relist_guard.sql'
 migration=migration_path.read_text(encoding='utf-8-sig');rollback=read('supabase/test-support/admin_reinstate_relist_guard_rollback.sql')
 baseline=read('supabase/test-support/admin_actions_audit_baseline.sql').replace('\r\n','\n')
 head,body,tail=baseline.split('$ama$');ama_create='$ama$'.join([head,body.replace('\n','\r\n'),tail])
 sql(reporting);sql(access);r=psql(ama_create);assert r.returncode==0,r.stderr
 # Hosted listing functions, byte-faithful (JSON keeps CR and LF exactly). ACLs as hosted: RPCs executable by authenticated, trigger functions by nobody.
 fx=json.loads((ROOT/'supabase/test-support/admin_reinstate_relist_guard_baseline.json').read_text(encoding='utf-8'))['functions']
 for f in fx:
  r=psql(f['def']);assert r.returncode==0,r.stderr
  sig=f['sig'] if '.' in f['sig'].split('(')[0] else 'public.'+f['sig']
  assert md5_of(sig)==f['md5'],'fixture copy differs from the hosted pin: '+sig
  grant=sig.startswith('public.') and 'trigger' not in sql(f"select prorettype::regtype::text from pg_proc where oid='{sig}'::regprocedure;")
  sql(f"alter function {sig} owner to postgres;revoke all on function {sig} from public,anon,authenticated,service_role;"+(f"grant execute on function {sig} to authenticated;" if grant else ""))
 sql("""create trigger trg_listings_edit_version before update of title,description,asking_rent_monthly,house_rules,rental_term,security_deposit_months,advance_rent_months,minimum_stay_months,available_from,status,property_id,landlord_id,edit_version on public.listings for each row execute function rotate_listing_edit_version();
 create trigger trg_listings_updated_at before update on public.listings for each row execute function set_updated_at();
 create trigger trg_validate_listing_owner before insert or update on public.listings for each row execute function validate_listing_owner();
 create trigger unfinished_post_publication before insert or update on public.listings for each row execute function rentlease_unfinished_posts.remember_publication();""")
 # Hosted state before this migration: the audit migration applied as-is, then moderation baseline checks.
 sql(actions)
 if flag=='--discover':
  # Prints the md5 pins of the patched functions after the migration (its own md5 checks are neutralized for this one run).
  m=migration.replace('is distinct from spec.final_md5','is null');m=re.sub(r'^ if \(select md5\(prosrc\) from pg_proc where oid=patched\[1\]\).*$','',m,flags=re.M);sql(m)
  def prosrc(k):
   # Raw bytes from psql minus the one newline -qAt appends; sql() would strip and change the md5.
   out=subprocess.run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','reinstatetest','-qAt','-c',f"select prosrc from pg_proc where oid='{k}'::regprocedure"],capture_output=True).stdout.decode('utf-8')
   return out[:-1]
  eff={'_note':'Patched source (prosrc) of the four functions after 20261114120000_admin_reinstate_relist_guard.sql, as produced by the harness. The harness asserts it equals the real patched functions; regenerate with --discover. Read by tests/adminActionsErrorDrift.test.ts.','functions':{k.split('(')[0].split('.')[1]:{'md5':md5_of(k),'source':prosrc(k)} for k in PATCHED}}
  for v in eff['functions'].values():assert hashlib.md5(v['source'].encode()).hexdigest()==v['md5'],'snapshot md5 mismatch'
  (ROOT/'supabase/test-support/admin_reinstate_relist_guard_effective.json').write_text(json.dumps(eff,indent=1)+'\n',encoding='utf-8',newline='\n')
  print(json.dumps(md5_all(PATCHED),indent=1));sys.exit(0)
 # ================= Fixture fidelity
 check(md5_all(PATCHED)==OLD,'fixture: the four functions to patch carry the hosted md5 pins (save 260ffe2c, publish 11e9d42b, apply_admin_moderation_action 7cb33c1b, get_admin_audit_log 08481f61)')
 check(md5_all(UNTOUCHED)==SAME,'fixture: reactivate, update_listing_draft, get_admin_restrictions, apply_moderation_action, validate_listing_owner, rotate_listing_edit_version and remember_publication carry the hosted pins')
 check(n("select count(*) from pg_trigger where tgrelid='public.listings'::regclass and not tgisinternal and tgenabled='O';")==4,'fixture: the four hosted listing triggers are present')
 deny(auth(LL)+f"update public.listings set status='active' where landlord_id='{LL}';",'permission denied');deny(auth(LL)+"insert into public.listings(property_id,landlord_id,title) values(gen_random_uuid(),gen_random_uuid(),'x');",'permission denied')
 check(True,'fixture: authenticated has only SELECT on public.listings (hosted state): owners cannot write listings directly')
 base_state=state(PATCHED);base_md5=md5_all(PATCHED+UNTOUCHED)
 L0,P0=mk_listing()
 # ================= Drift guards: each aborts the migration atomically
 for sig in PATCHED+UNTOUCHED:
  src=sql(f"select pg_get_functiondef('{sig}'::regprocedure);")
  if sig=='public.apply_moderation_action()':continue  # covered below (CRLF body)
  sql(re.sub(r'\bbegin\b','begin perform 1;',src,count=1));r=psql(migration);check(r.returncode!=0 and 'source differs from the reviewed definition' in r.stderr,f'drift guard: a changed {sig.split("(")[0]} aborts the migration (md5 pin)');sql(src)
  assert md5_of(sig)==(OLD|SAME)[sig],'restore failed for '+sig
 sql("create or replace function public.apply_moderation_action() returns trigger language plpgsql security definer set search_path=public as $x$begin return new;end$x$;");r=psql(migration);check(r.returncode!=0 and 'source differs from the reviewed definition' in r.stderr,'drift guard: a changed apply_moderation_action aborts the migration (md5 pin)')
 ama_replace=ama_create[ama_create.index('create function public.apply_moderation_action()'):].split('create trigger trg_apply_moderation_action')[0].replace('create function','create or replace function',1)
 r=psql(ama_replace);assert r.returncode==0,r.stderr;check(md5_of('public.apply_moderation_action()')==SAME['public.apply_moderation_action()'],'fixture restored to the pinned apply_moderation_action source')
 check(md5_all(PATCHED+UNTOUCHED)==base_md5 and state(PATCHED)==base_state,'every drift probe was restored exactly; nothing was left behind')
 sql("grant update on public.listings to authenticated;");r=psql(migration);check(r.returncode!=0 and 'write privileges on public.listings' in r.stderr,'drift guard: a client write privilege on public.listings aborts the migration');sql("revoke update on public.listings from authenticated;")
 sql("grant select on public.admin_audit_logs to authenticated;");r=psql(migration);check(r.returncode!=0 and 'Clients unexpectedly hold privileges' in r.stderr,'drift guard: a client privilege on admin_audit_logs aborts the migration');sql("revoke all on public.admin_audit_logs from authenticated;")
 sql("alter table public.listings disable trigger trg_validate_listing_owner;");r=psql(migration);check(r.returncode!=0 and 'listing triggers are missing or not enabled' in r.stderr,'drift guard: a disabled listing trigger aborts the migration');sql("alter table public.listings enable trigger trg_validate_listing_owner;")
 sql("create function public.get_admin_removed_listings() returns jsonb language sql as $x$select '{}'::jsonb$x$;");r=psql(migration);check(r.returncode!=0 and 'already exists' in r.stderr,'drift guard: a pre-existing get_admin_removed_listings aborts the migration');sql("drop function public.get_admin_removed_listings();")
 check(md5_all(PATCHED+UNTOUCHED)==base_md5,'an aborted migration leaves every function exactly as it was')
 # ================= Apply
 sql(migration);check(True,'migration applies cleanly')
 header=dict(re.findall(r'--\s+(save_listing_draft|publish_listing|apply_admin_moderation_action|get_admin_audit_log)\s+[0-9a-f]{32}\s+->\s+([0-9a-f]{32})',migration))
 new=md5_all(PATCHED);check(flag=='--migration' or len(header)==4 and (flag=='--migration' or [header[k] for k in('save_listing_draft','publish_listing','apply_admin_moderation_action','get_admin_audit_log')]==[new[s] for s in PATCHED]),'the new md5 values recorded in the migration header equal the patched functions')
 check(all(new[s]!=OLD[s] for s in PATCHED),'all four patched functions actually changed')
 snap=json.loads((ROOT/'supabase/test-support/admin_reinstate_relist_guard_effective.json').read_text(encoding='utf-8'))['functions']
 check(all(snap[k.split('(')[0].split('.')[1]]['md5']==new[k] for k in PATCHED) or flag=='--migration','the committed effective-source snapshot (read by the frontend drift test) matches the patched functions')
 check({s:md5_of(s) for s in UNTOUCHED}==SAME,'the seven untouched functions (reactivate_listing, update_listing_draft, get_admin_restrictions, apply_moderation_action, validate_listing_owner, rotate_listing_edit_version, remember_publication) are byte-identical')
 check(state(PATCHED)==base_state,'owner, ACL, security definer, search_path and volatility of the four patched functions are unchanged')
 # ================= Grants and denied callers (new RPC)
 NEWRPC='public.get_admin_removed_listings()'
 check(n(f"select count(*) from pg_proc where oid='{NEWRPC}'::regprocedure and prosecdef and provolatile='s' and pg_get_userbyid(proowner)='postgres' and proconfig=array['search_path=pg_catalog'] and has_function_privilege('authenticated',oid,'execute') and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('service_role',oid,'execute') and not has_function_privilege('public',oid,'execute');")==1,'get_admin_removed_listings: security definer, stable, owner postgres, search_path=pg_catalog, executable by authenticated only')
 deny("set role anon;select public.get_admin_removed_listings();",'permission denied');check(True,'get_admin_removed_listings: anonymous EXECUTE denied')
 for who,label in((N,'non-admin'),(ADMS,'suspended Admin'),(None,'unauthenticated')):
  pre="set role authenticated;set test.actor='';" if who is None else auth(who)
  deny(pre+"select public.get_admin_removed_listings();",'Access unavailable',code='42501')
  deny(pre+f"select public.apply_admin_moderation_action('{u()}','reinstate_listing',null,'{L0}',null,'Valid reason text here',null);",'Access unavailable',code='42501')
  check(True,f'{label} is denied get_admin_removed_listings and reinstate_listing')
 for t in('public.moderation_actions','public.admin_audit_logs','rentlease_admin_actions.receipts'):deny(auth(ADM)+f"select * from {t};",'permission denied')
 deny(auth(ADM)+f"update public.listings set status='paused' where id='{L0}';",'permission denied')
 check(True,'even an Admin has no direct table access to moderation, audit, receipt or listing writes')
 # ================= PART A: a removed listing blocks re-listing the property
 LA,PA=mk_listing();remove(LA);check(lstatus(LA)=='removed','fixture: a listing was removed through the real RPC')
 deny(auth(LL)+save(PA),'Property has a removed listing',code='22023')
 check(n(f"select count(*) from public.listings where property_id='{PA}';")==1,'save_listing_draft: a NEW draft on a property with a removed listing is refused, nothing was created')
 LB,PB=mk_listing();d=sql(auth(LL)+f"select listing_id from public.save_listing_draft('{PB}','Draft title','Draft description',900);");check(lstatus(d)=='draft','fixture: a draft exists on a property with an active listing (existing behavior)')
 sql(auth(LL)+save(PB,'Edited while live'));check(sql(f"select title from public.listings where id='{d}';")=='Edited while live','before removal an existing draft can still be updated through save_listing_draft')
 remove(LB)
 deny(auth(LL)+save(PB,'Edited after removal'),'Property has a removed listing',code='22023')
 check(sql(f"select title from public.listings where id='{d}';")=='Edited while live' and n(f"select count(*) from public.listings where property_id='{PB}' and status='draft';")==1,'save_listing_draft: updating an EXISTING draft on a property with a removed listing is refused too, the draft is unchanged')
 deny(auth(LL)+f"select * from public.publish_listing('{d}');",'Property has a removed listing',code='22023');check(lstatus(d)=='draft','publish_listing: a draft on a property with a removed listing cannot be published')
 pc=mk_property();dc=sql(auth(LL)+f"select listing_id from public.save_listing_draft('{pc}','Other title','Other description',1200);");res=sql(auth(LL)+f"select listing_status from public.publish_listing('{dc}');")
 check(res=='active' and lstatus(dc)=='active','a different property is unaffected: it saves a draft and publishes normally')
 check(n(f"select count(*) from public.listings where property_id='{PA}' and status='removed';")==1 and sql(auth(LL)+f"select count(*) from public.save_listing_draft('{mk_property()}','T','D',1);")=='1','another property of the same landlord is unaffected too')
 deny(auth(LL)+f"select * from public.reactivate_listing('{LA}');",'Only a paused listing can be reactivated',code='22023')
 ev=sql(f"select edit_version from public.listings where id='{LA}';");deny(auth(LL)+f"select * from public.update_listing_draft('{LA}','{ev}','Edit','Edit',500);",'Draft changed or is no longer editable',code='40001')
 deny(auth(LL)+f"select * from public.publish_listing('{LA}');",'Only a draft listing can be published',code='22023')
 deny(auth(LL)+f"update public.listings set status='active',removed_at=null where id='{LA}';",'permission denied')
 check(lstatus(LA)=='removed','an owner cannot reactivate, edit, publish or directly update a removed listing (existing behavior, now pinned)')
 # Concurrency: the removal's effect lands under the property lock; a save that starts while it is held must wait and then see the removal.
 lk,pk=mk_listing();held=bg(f"begin;select pg_advisory_xact_lock(hashtextextended('{pk}',0));select pg_sleep(3);update public.listings set status='removed',removed_at=now(),removal_reason='Removal under the property lock' where id='{lk}';commit;")
 time.sleep(1);t0=time.time();rc,o,e=fin(bg(auth(LL)+save(pk,'Racing draft')));el=time.time()-t0;fin(held)
 check(rc!=0 and 'Property has a removed listing' in e and el>1.0 and n(f"select count(*) from public.listings where property_id='{pk}' and status='draft';")==0,'concurrency: a draft save that starts while the removal holds the property lock waits for it and then refuses (lock ordering: guard runs after the lock)')
 lk,pk=mk_listing();dk=sql(auth(LL)+f"select listing_id from public.save_listing_draft('{pk}','Racing draft','Racing description',900);");lock_pub=bg(f"begin;select pg_advisory_xact_lock(hashtextextended('{pk}',0));select pg_sleep(3);update public.listings set status='removed',removed_at=now(),removal_reason='Removal under the property lock' where id='{lk}';commit;")
 time.sleep(1);rc,o,e=fin(bg(auth(LL)+f"select * from public.publish_listing('{dk}');"));fin(lock_pub)
 check(rc!=0 and ('Property has a removed listing' in e) and lstatus(dk)=='draft','concurrency: publish_listing that starts while the removal holds the property lock waits and then refuses')
 bad=0
 for i in range(5):
  lk,pk=mk_listing();p1=bg(act(ADM,'remove_listing',listing=lk,reason='Removal racing a draft save one'));p2=bg(auth(LL)+save(pk,'Racing draft '+str(i)));fin(p1);fin(p2)
  bad+=n(f"select count(*) from public.listings d join public.listings r on r.property_id=d.property_id and r.status='removed' where d.property_id='{pk}' and d.status='draft' and d.xmin::text::bigint>r.xmin::text::bigint;")
 check(bad==0,'concurrency: five real remove_listing vs save_listing_draft races never leave a draft written after the removal (transaction ids: the writer that wins the property lock writes first)')
 # ================= PART B: reinstate_listing validations (each refused case must change nothing)
 def breinstate(text,actor,l,code=None,**k):deny(reinstate(actor,l,**k),text,code=code)
 LR,PR=mk_listing();remove(LR);a0=audits();m0=n("select count(*) from public.moderation_actions;");r0=n("select count(*) from rentlease_admin_actions.receipts;")
 for st in('draft','active','paused','rented','archived'):
  l_,_=mk_listing(st);breinstate('Listing is not removed',ADM,l_,code='22023');check(lstatus(l_)==st,f'reinstate: a {st} listing is refused and unchanged')
 deny(act(ADM,'reinstate_listing',user=T1),'Choose exactly one target',code='22023');deny(act(ADM,'reinstate_listing',user=T1,listing=LR),'Choose exactly one target',code='22023');deny(act(ADM,'reinstate_listing'),'Choose exactly one target',code='22023')
 check(True,'reinstate: exactly one target, and it must be a listing')
 rid=u();sql(f"insert into public.reports(id,reporter_id,reported_listing_id,reason,details,status) values('{rid}','{REP}','{LR}','other','Fixture','upheld');")
 deny(reinstate(ADM,LR,report=rid),'A report is not used for this action',code='22023');check(lstatus(LR)=='removed','reinstate: a report id is refused (even a real upheld report on this very listing)')
 deny(reinstate(ADM,LR,ends='2099-01-01T00:00:00Z'),'End date applies only to suspensions',code='22023');check(lstatus(LR)=='removed','reinstate: an end date is refused')
 for rs in('too short','x'*9,'          ','x'*501,None):deny(reinstate(ADM,LR,reason=rs),'Reason must be 10 to 500 characters',code='22023')
 check(True,'reinstate: the reason must be 10 to 500 characters after trimming')
 deny(act(ADM,'pause_listing',listing=LR),'Action not supported',code='22023');deny(act(ADM,'unknown_action',listing=LR),'Action not supported',code='22023');check(True,'actions outside the list are still refused (pause_listing, unknown)')
 breinstate('Target unavailable',ADM,u(),code='22023');check(True,'reinstate: an unknown listing is refused')
 l_adm,_=mk_listing(owner=ADM);force_removed(l_adm);l_adm2,_=mk_listing(owner=ADM2);force_removed(l_adm2)
 breinstate('cannot take action on their own account',ADM,l_adm,code='22023');breinstate('Admin accounts cannot be targeted',ADM,l_adm2,code='22023');check(lstatus(l_adm)=='removed' and lstatus(l_adm2)=='removed','reinstate: an Admin cannot reinstate their own listing, nor the listing of any Admin')
 for st in('active','paused','rented'):
  lx,px=mk_listing();force_removed(lx);mk_listing(st,prop=px);breinstate('This property already has a live listing',ADM,lx,code='22023');check(lstatus(lx)=='removed','reinstate: refused while another listing on the property is '+st)
 ld,pd=mk_listing();force_removed(ld);mk_listing('draft',prop=pd)
 rd=act_ok(ADM,'reinstate_listing',listing=ld,reason='A draft elsewhere does not block reinstating');check(rd['status']=='paused' and lstatus(ld)=='paused','reinstate: another listing that is only a DRAFT does not block')
 la,pa=mk_listing();force_removed(la);mk_listing('archived',prop=pa);mk_listing('removed',prop=pa);check(act_ok(ADM,'reinstate_listing',listing=la,reason='Archived and removed siblings do not block')['status']=='paused','reinstate: archived or removed siblings do not block')
 check(audits()==a0+2 and n("select count(*) from public.moderation_actions;")==m0 and n("select count(*) from rentlease_admin_actions.receipts;")==r0+2,'every refused reinstatement above changed nothing (audit rows and receipts only for the two accepted ones; no moderation_actions row)')
 # conflicted Admin: a report about this listing on which the calling Admin is a party (real rule: the Admin was a tenant on the reported property)
 rc,Lc,_=mk_report('listing');uphold(rc);remove_c=act_ok(ADM,'remove_listing',listing=Lc,report=rc,reason='Removed after the upheld conflicted-report check')
 pc2=sql(f"select property_id from public.listings where id='{Lc}';");sql(f"insert into public.tenancies(id,listing_id,property_id,tenant_id,landlord_id,status) values(gen_random_uuid(),'{Lc}','{pc2}','{ADM3}','{LL}','ended');")
 breinstate('Access unavailable',ADM3,Lc,code='42501');check(lstatus(Lc)=='removed','reinstate: an Admin who is conflicted on a report about the listing is refused (Access unavailable) and nothing changes')
 a_before=audits();rcx=act_ok(ADM,'reinstate_listing',listing=Lc,reason='A non conflicted Admin reverses the removal');check(rcx['status']=='paused' and audits()==a_before+1,'reinstate: a non conflicted Admin can reinstate the same listing')
 # ================= Effect, audit row, receipt shape
 LE,PE=mk_listing();rem=remove(LE,'Listing removed for misleading photos');ev0=sql(f"select edit_version from public.listings where id='{LE}';");a0=audits("action='reinstate_listing'");m0=n("select count(*) from public.moderation_actions;")
 op=u();res=act_ok(ADM,'reinstate_listing',listing=LE,op=op,reason='Removal reviewed and reversed after appeal')
 row=json.loads(sql(f"select jsonb_build_object('s',status,'paused',paused_at is not null,'removed_at',removed_at,'reason',removal_reason,'pub',published_at is not null,'ev',edit_version::text) from public.listings where id='{LE}';"))
 check(row['s']=='paused' and row['paused'] and row['removed_at'] is None and row['reason'] is None and row['pub'],'reinstate: removed -> paused, paused_at set, removed_at and removal_reason cleared, published_at kept')
 check(row['ev']!=ev0,'reinstate: edit_version rotated by the existing trigger (a stale editor token is rejected)')
 check(set(res)=={'id','action','status','targetUserId','targetListingId','reportId','endsAt'} and res['status']=='paused' and res['action']=='reinstate_listing' and res['targetListingId']==LE and res['targetUserId'] is None and res['reportId'] is None and res['endsAt'] is None and res['id']==op,'reinstate: result has the same shape as the other actions with status paused')
 check(audits("action='reinstate_listing'")==a0+1 and n(f"select count(*) from public.admin_audit_logs where admin_id='{ADM}' and action='reinstate_listing' and entity_type='listing' and entity_id='{LE}' and metadata='{{\"reason\": \"Removal reviewed and reversed after appeal\", \"status\": \"paused\", \"previous_status\": \"removed\"}}'::jsonb;")==1,'reinstate: exactly one audit row with reason, previous_status removed and status paused')
 check(n("select count(*) from public.moderation_actions;")==m0 and n(f"select count(*) from rentlease_admin_actions.receipts where actor_id='{ADM}' and operation_id='{op}';")==1,'reinstate: no moderation_actions row (no enum value), one receipt')
 # idempotency
 c0=audits("action='reinstate_listing'");again=json.loads(sql(act(ADM,'reinstate_listing',listing=LE,op=op,reason='Removal reviewed and reversed after appeal')))
 check(again==res and audits("action='reinstate_listing'")==c0,'an exact retry returns the stored result with no second effect and no second audit row')
 deny(act(ADM,'reinstate_listing',listing=LE,op=op,reason='A different reason text here'),'Conflicting retry',code='22023');deny(act(ADM,'reinstate_listing',listing=LR,op=op,reason='Removal reviewed and reversed after appeal'),'Conflicting retry',code='22023')
 check(True,'the same operation id with changed input is refused')
 force_removed(LE,'Removed again directly');check(json.loads(sql(act(ADM,'reinstate_listing',listing=LE,op=op,reason='Removal reviewed and reversed after appeal')))==res and lstatus(LE)=='removed','an exact retry after the listing changed still returns the stored result and does NOT apply again')
 check(act_ok(ADM2,'reinstate_listing',listing=LE,op=op,reason='Removal reviewed and reversed after appeal')['status']=='paused' and lstatus(LE)=='paused','receipts are per actor: another Admin using the same operation id acts independently')
 # concurrent double reinstate
 LC2,PC2=mk_listing();remove(LC2);a0=audits("action='reinstate_listing'");q1=act(ADM,'reinstate_listing',listing=LC2,reason='Concurrent reinstatement attempt one');q2=act(ADM2,'reinstate_listing',listing=LC2,reason='Concurrent reinstatement attempt two')
 p1,p2=bg(q1),bg(q2);(rc1,o1,e1),(rc2,o2,e2)=fin(p1),fin(p2)
 check(sorted([rc1==0,rc2==0])==[False,True] and 'Listing is not removed' in (e1+e2) and audits("action='reinstate_listing'")==a0+1 and lstatus(LC2)=='paused','two Admins reinstating at once: exactly one effect and one audit row, the other is told the listing is not removed')
 LC3,PC3=mk_listing();remove(LC3);opc=u();q=act(ADM,'reinstate_listing',listing=LC3,op=opc,reason='Concurrent identical retry attempt');a0=audits("action='reinstate_listing'");p1,p2=bg(q),bg(q);(rc1,o1,e1),(rc2,o2,e2)=fin(p1),fin(p2)
 check(rc1==0 and rc2==0 and o1.split('\n')[-1]==o2.split('\n')[-1] and audits("action='reinstate_listing'")==a0+1,'two simultaneous identical retries both return the same result with one audit row')
 # strict audit: the RPC refuses and rolls back when the audit row cannot be written
 LF,PF=mk_listing();remove(LF);sql("alter table public.admin_audit_logs add constraint zz_audit_unwritable check(action<>'reinstate_listing') not valid;");r0=n("select count(*) from rentlease_admin_actions.receipts;")
 deny(act(ADM,'reinstate_listing',listing=LF,reason='Audit failure rollback check one'),'zz_audit_unwritable');check(lstatus(LF)=='removed' and n("select count(*) from rentlease_admin_actions.receipts;")==r0,'audit failure: the reinstatement rolls back entirely (still removed, no receipt)')
 sql("alter table public.admin_audit_logs drop constraint zz_audit_unwritable;");check(act_ok(ADM,'reinstate_listing',listing=LF,reason='Audit failure rollback check one')['status']=='paused','audit failure: after recovery the reinstatement succeeds exactly once')
 # ================= Owner reactivates, then re-listing rules
 LO,PO=mk_listing();remove(LO);deny(auth(LL)+f"select * from public.reactivate_listing('{LO}');",'Only a paused listing can be reactivated',code='22023');act_ok(ADM,'reinstate_listing',listing=LO,reason='Removal reviewed and reversed after appeal')
 sql(auth(LL)+save(PO,'New draft after reinstate'));dn=sql(f"select id from public.listings where property_id='{PO}' and status='draft';");check(dn!='','after reinstatement the property no longer has a removed listing, so a new draft may be saved')
 deny(auth(LL)+f"select * from public.publish_listing('{dn}');",'This property already has a live listing',code='23505');check(lstatus(dn)=='draft','the existing live-listing rule still blocks publishing a second listing while the reinstated one is paused')
 ract=sql(auth(LL)+f"select listing_status from public.reactivate_listing('{LO}');");check(ract=='active' and lstatus(LO)=='active' and sql(f"select paused_at is null from public.listings where id='{LO}';")=='t','the owner reactivates a reinstated listing with the existing reactivate_listing (verified property, Tier 1)')
 LU,PU=mk_listing(prop=mk_property(verified=False));remove(LU);act_ok(ADM,'reinstate_listing',listing=LU,reason='Removal reviewed and reversed after appeal')
 deny(auth(LL)+f"select * from public.reactivate_listing('{LU}');",'Approved Tier 3 verification',code='42501');check(lstatus(LU)=='paused','an unverified property cannot be reactivated after reinstatement (existing rule)')
 # remove again after reinstating: the cycle works with a fresh report
 LY,PY=mk_listing();remove(LY);act_ok(ADM,'reinstate_listing',listing=LY,reason='Removal reviewed and reversed after appeal');sql(auth(LL)+f"select * from public.reactivate_listing('{LY}');")
 rid2=u();sql(f"insert into public.reports(id,reporter_id,reported_listing_id,reason,details,status) values('{rid2}','{REP}','{LY}','other','Second report','upheld');")
 act_ok(ADM,'remove_listing',listing=LY,report=rid2,reason='Removed again after a second upheld report');check(lstatus(LY)=='removed','remove -> reinstate -> reactivate -> remove again works')
 check(sql(f"select count(*) from public.admin_audit_logs where entity_id='{LY}' and action in('remove_listing','reinstate_listing');")=='3','the cycle left three audit rows')
 # ================= PART C: audit log names
 sql(f"insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values(null,'report_dismissed','report',gen_random_uuid(),'{{}}');")
 allr=log('all');check(all('actorId' in x for x in allr['rows']),'audit log: every row carries actorId')
 check(any(x['actorId']==ADM and x['actor']=='Admin '+ADM[:8] for x in allr['rows']),'audit log: actorId is the Admin id (text) alongside the public actor label')
 allrows=[];off=0
 while True:
  pg=log('all',off);allrows+=pg['rows'];off+=25
  if off>=pg['count']:break
 check(any(x['actor']=='System' and x['actorId'] is None for x in allrows),'audit log: a System row has actorId null')
 # verification subject
 vl=u();vn=u();sql(f"insert into public.verification_submissions(id,user_id,tier,status,submitted_note) values('{vl}','{LL}','tier_3_property','pending','Applicant note with a document name: land_title_scan.jpg'),('{vn}','{T1}','tier_2_identity','pending','Another private note: passport_photo.jpg');")
 sql(as_(ADM)+f"update public.verification_submissions set status='under_review' where id in('{vl}','{vn}');update public.verification_submissions set status='rejected',rejection_reason='Document does not match',review_note='internal note' where id='{vn}';")
 allrows=[];off=0
 while True:
  pg=log('verification',off);allrows+=pg['rows'];off+=25
  if off>=pg['count']:break
 sub={(x['entityId'],x['action']):x['subject'] for x in allrows}
 check(sub[(vl,'verification_under_review')]=='Landlord Lee' and sub[(vn,'verification_under_review')]=='User '+T1[:8] and sub[(vn,'verification_rejected')]=='User '+T1[:8],"audit log: a verification row's subject is the applicant's confirmed public nickname, else 'User ' + the first 8 characters of the id")
 check(all('land_title' not in json.dumps(x) and 'passport' not in json.dumps(x) and 'internal note' not in json.dumps(x) for x in allrows),'audit log: no applicant note, document name or review note in verification rows')
 # report subject
 rl,Lrep,_=mk_report('listing');ru,_,_=mk_report('user');rt1,_,_=mk_report('user',reported=T1)
 for rid_ in(rl,ru,rt1):sql(moderate(ADM,rid_,'dismissed','Dismissed after review of the evidence'))
 tl=sql(f"select title from public.listings where id='{Lrep}';")
 rows={x['entityId']:x for x in log('reports')['rows'] if x['action']=='report_dismissed' and x['entityId'] in(rl,ru,rt1)}
 check(rows[rl]['subject']==tl and tl.startswith('Rental '),"audit log: a listing report's subject is the reported listing's title")
 who=lambda rid_:sql(f"select reported_user_id from public.reports where id='{rid_}';");exp=lambda uid:'Landlord Lee' if uid==LL else 'User '+uid[:8]
 check(who(rt1)==T1 and rows[rt1]['subject']=='User '+T1[:8] and who(ru)!='' and rows[ru]['subject']==exp(who(ru)),"audit log: a user report's subject is the reported user's confirmed public nickname, else a short id")
 blank,_=mk_listing(title='   ');rb=u();sql(f"insert into public.reports(id,reporter_id,reported_listing_id,reason,details,status) values('{rb}','{REP}','{blank}','other','x','upheld');insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values('{ADM}','report_upheld','report','{rb}','{{}}');")
 check(any(x['entityId']==rb and x['subject']=='Listing '+blank[:8] for x in log('reports')['rows']),"audit log: a report about a listing with a blank title falls back to 'Listing ' + short id")
 check(LEGAL not in json.dumps(log('all'))+json.dumps(allrows)+json.dumps(rows),'audit log: the private display_name never appears')
 acts=[];off=0
 while True:
  pg=log('actions',off);acts+=pg['rows'];off+=25
  if off>=pg['count']:break
 check(any(x['action']=='reinstate_listing' for x in acts) and log('actions')['count']==audits("action in('suspend_account','restore_account','pause_listing','remove_listing','reinstate_listing','restrict_account','warning')"),"audit log: the actions filter includes 'reinstate_listing' and its count covers it")
 rrow=[x for x in acts if x['action']=='reinstate_listing'][0];check(rrow['entityType']=='listing' and rrow['subject'] and rrow['reason'] and rrow['status']=='paused' and rrow['previousStatus']=='removed' and rrow['actorId'] in(ADM,ADM2) and set(rrow)=={'id','createdAt','action','entityType','entityId','actorId','actor','subject','reportReason','reason','status','previousStatus','tier','kind','endsAt','reportId'},'audit log: a reinstatement row shows listing title, reason, previous status and status, and only the documented fields are returned')
 # conflicted Admin filters still work: ADM3 is conflicted on the report rc (Lc); ADM is not
 def all_rows(actor,kind='all'):
  first=log(kind,0,actor=actor);rows_=list(first['rows']);off_=25
  while off_<first['count']:rows_+=log(kind,off_,actor=actor)['rows'];off_+=25
  return first['count'],rows_
 c3,r3=all_rows(ADM3);cA,rA=all_rows(ADM)
 check(not any(x['entityId']==rc or x['reportId']==rc for x in r3) and any(x['entityId']==rc for x in rA) and any(x['reportId']==rc for x in rA),'conflicted Admin: report events and actions carrying that report id are still hidden; a non conflicted Admin sees them')
 check(c3==len(r3) and cA==len(rA)==audits(),'conflicted Admin: count equals the rows actually returned for both Admins (the filter is still inside the counted set)')
# ================= Conflicted Admin: removed list, reinstate and the reinstate audit row (report about the LISTING, and report about its OWNER only)
 # Scenario L: a report about the listing. ADM3 is conflicted through a real tenancy on the reported property (the real rule, as before).
 rcL,LcL,_=mk_report('listing');uphold(rcL);act_ok(ADM,'remove_listing',listing=LcL,report=rcL,reason='Removed after the upheld listing report')
 pL=sql(f"select property_id from public.listings where id='{LcL}';");sql(f"insert into public.tenancies(id,listing_id,property_id,tenant_id,landlord_id,status) values(gen_random_uuid(),'{LcL}','{pL}','{ADM3}','{LL}','ended');")
 # Scenario O: a report about the OWNER only. A user report has no property (its case holds only the two conversation parties), so the real rule makes an
 # Admin conflicted by being a party: ADM4 (an Admin with Tier 1) is the tenant in a conversation with OWN and reported OWN. LX has no report that conflicts for ADM4.
 ADM4=u();sql(f"insert into public.profiles(id,tier1,admin) values('{ADM4}',true,true);")
 OWN=T2;l4,_=mk_listing(owner=OWN);c4=u();sql(f"insert into public.conversations values('{c4}','{l4}','{ADM4}','{OWN}','open');");ro=json.loads(sql(submit(ADM4,'user',c4)))['id']
 LX,PX=mk_listing(owner=OWN);remove(LX,'Removed after an upheld report about this listing')
 conf=lambda r_,a_:sql(f"select rentlease_reporting.conflicted('{r_}','{a_}');")
 check(conf(rcL,ADM3)=='t' and conf(rcL,ADM)=='f' and conf(rcL,ADM4)=='f','premise: only ADM3 is conflicted on the report about the listing LcL (real rule)')
 check(sql(f"select reported_user_id from public.reports where id='{ro}';")==OWN and conf(ro,ADM4)=='t' and conf(ro,ADM3)=='f' and sql(f"select count(*) from public.reports where reported_listing_id='{LX}' and rentlease_reporting.conflicted(id,'{ADM4}');")=='0','premise: ADM4 is conflicted ONLY through a report about the OWNER; no report about LX itself conflicts for ADM4 (real rule)')
 vis=lambda actor:{x['listingId'] for x in removed_list(actor)['rows']}
 check({LcL,LX}<=vis(ADM) and LcL not in vis(ADM3) and LX in vis(ADM3) and LX not in vis(ADM4) and LcL in vis(ADM4),'removed list: a non conflicted Admin sees both listings; each conflicted Admin misses exactly the listing they are conflicted on (listing report, owner report)')
 for who in(ADM,ADM3,ADM4):
  lst=removed_list(who);check(lst['count']==len(lst['rows']),'removed list: count equals the rows returned (same conflict filter) for '+('the non conflicted Admin' if who==ADM else 'a conflicted Admin'))
 check(removed_list(ADM)['count']-removed_list(ADM3)['count']==1 and removed_list(ADM)['count']-removed_list(ADM4)['count']==1,'removed list: the count drops by exactly the one hidden listing for each conflicted Admin')
 breinstate('Access unavailable',ADM3,LcL,code='42501');breinstate('Access unavailable',ADM4,LX,code='42501')
 check(lstatus(LcL)=='removed' and lstatus(LX)=='removed','reinstate: a conflicted Admin is refused (Access unavailable, 42501) for a report about the listing (ADM3) AND for a report about its owner (ADM4); nothing changes')
 a_=audits("action='reinstate_listing'")
 act_ok(ADM,'reinstate_listing',listing=LcL,reason='Reinstated by a non conflicted Admin after review');act_ok(ADM,'reinstate_listing',listing=LX,reason='Reinstated by a non conflicted Admin after review')
 check(audits("action='reinstate_listing'")==a_+2 and lstatus(LcL)=='paused' and lstatus(LX)=='paused','a non conflicted Admin sees both in the list and reinstates both')
 c3,r3=all_rows(ADM3);c4_,r4=all_rows(ADM4);cA,rA=all_rows(ADM)
 rein=lambda rows:{x['entityId'] for x in rows if x['action']=='reinstate_listing'}
 check({LcL,LX}<=rein(rA) and LcL not in rein(r3) and LX in rein(r3) and LX not in rein(r4) and LcL in rein(r4),'audit log: a non conflicted Admin sees both reinstate rows; each conflicted Admin misses only the row of the listing they are conflicted on (listing report, owner report)')
 check(c3==len(r3) and c4_==len(r4) and cA==len(rA)==audits(),'audit log: count equals the rows returned for all three Admins with the reinstate filter in place')
 for kind in('actions','all'):
  for who,gone in((ADM3,LcL),(ADM4,LX)):
   ck,rk=all_rows(who,kind);check(ck==len(rk) and gone not in rein(rk),f'audit log: the {kind} filter hides the reinstate row from the conflicted Admin and its count is consistent')
 # reinstatable=false must match what the RPC itself refuses for a reason other than the conflict
 byid_={x['listingId']:x for x in removed_list(ADM)['rows']}
 check(byid_[l_adm]['reinstatable'] is False and byid_[l_adm2]['reinstatable'] is False,'removed list: reinstatable is false for an Admin-owned listing...')
 breinstate('cannot take action on their own account',ADM,l_adm,code='22023');breinstate('Admin accounts cannot be targeted',ADM,l_adm2,code='22023')
 lz2,pz2=mk_listing();force_removed(lz2);mk_listing('paused',prop=pz2);check({x['listingId']:x for x in removed_list(ADM)['rows']}[lz2]['reinstatable'] is False,'...and for a property with another live listing')
 breinstate('This property already has a live listing',ADM,lz2,code='22023')
 # ================= get_admin_removed_listings
 rl_=removed_list();check(set(rl_)=={'count','rows'} and rl_['count']==n("select count(*) from public.listings where status='removed';"),'removed list: {count, rows} and the count covers every removed listing')
 byid={x['listingId']:x for x in rl_['rows']};lx=LR;check(set(byid[lx])=={'listingId','title','ownerName','removedAt','reason','reinstatable'},'removed list: only the documented fields are returned')
 check(byid[lx]['ownerName']=='Landlord Lee' and byid[lx]['reason']=='Listing removed for misleading photos' and byid[lx]['title'].startswith('Rental ') and byid[lx]['removedAt'] is not None,'removed list: title, public owner nickname, removal reason and removal time')
 check(LEGAL not in json.dumps(rl_),'removed list: the private display_name never appears')
 blank_l,_=mk_listing(owner=T1,title='   ')
 sql(f"update public.listings set status='removed',removed_at=now(),removal_reason='Blank title fixture' where id='{blank_l}';");byid={x['listingId']:x for x in removed_list()['rows']}
 check(byid[blank_l]['title']=='Listing '+blank_l[:8] and byid[blank_l]['ownerName']=='User '+T1[:8],"removed list: blank title falls back to 'Listing ' + short id and an owner without a confirmed nickname to 'User ' + short id")
 check(byid[blank_l]['reinstatable'] is True and byid[l_adm]['reinstatable'] is False,'removed list: reinstatable is false when the owner is an Admin and true otherwise')
 lz,pz=mk_listing();force_removed(lz);ly,_=mk_listing('paused',prop=pz);byid={x['listingId']:x for x in removed_list()['rows']}
 check(byid[lz]['reinstatable'] is False,'removed list: reinstatable is false while another active, paused or rented listing exists on the property')
 sql(f"update public.listings set status='rented' where id='{ly}';");check({x['listingId']:x for x in removed_list()['rows']}[lz]['reinstatable'] is False,'removed list: a rented sibling also makes it not reinstatable')
 sql(f"update public.listings set status='archived' where id='{ly}';");check({x['listingId']:x for x in removed_list()['rows']}[lz]['reinstatable'] is True,'removed list: an archived sibling does not')
 ts=[x['removedAt'] for x in removed_list()['rows'] if x['removedAt']];check(ts==sorted(ts,reverse=True),'removed list: newest removal first')
 sql("do $x$ declare i integer;p uuid;begin for i in 1..105 loop p:=gen_random_uuid();insert into public.properties values(p,'"+LL+"',true);insert into public.listings(property_id,landlord_id,status,title,removed_at,removal_reason) values(p,'"+LL+"','removed','Bulk '||i,now()-(i||' minutes')::interval,'Bulk');end loop;end$x$;")
 big=removed_list();check(len(big['rows'])==100 and big['count']>=105,'removed list: at most 100 rows while count reports them all')
 # ================= Rollback
 snap_audit=audits();snap_receipts=n("select count(*) from rentlease_admin_actions.receipts;");snap_listings=sql("select md5(string_agg(id::text||status::text,',' order by id)) from public.listings;");snap_reinst=n("select count(*) from public.admin_audit_logs where action='reinstate_listing';")
 sql(rollback)
 check(md5_all(PATCHED)==OLD,'rollback restores the four functions to the exact pre-migration md5 pins')
 check(state(PATCHED)==base_state and {s:md5_of(s) for s in UNTOUCHED}==SAME,'rollback leaves owner, ACL and configuration identical and does not touch the seven other functions')
 check(sql("select to_regprocedure('public.get_admin_removed_listings()') is null;")=='t','rollback drops get_admin_removed_listings')
 check(audits()==snap_audit and n("select count(*) from public.admin_audit_logs where action='reinstate_listing';")==snap_reinst and n("select count(*) from rentlease_admin_actions.receipts;")==snap_receipts and sql("select md5(string_agg(id::text||status::text,',' order by id)) from public.listings;")==snap_listings,'rollback retains every audit row (including reinstate_listing), every receipt and every reinstated listing; it never undoes an applied action')
 deny(act(ADM,'reinstate_listing',listing=mk_listing()[0]),'Action not supported',code='22023');check(True,'after rollback the old RPC no longer accepts reinstate_listing')
 LAfter,PAfter=mk_listing();force_removed(LAfter);sql(auth(LL)+save(PAfter,'Allowed again after rollback'));check(True,'after rollback the old save_listing_draft behavior is back (a removed listing no longer blocks)')
 check(any(x['action']=='reinstate_listing' for x in all_rows(ADM)[1]),'the old audit function still shows reinstate_listing rows under All')
 r=psql(rollback);check(r.returncode!=0 and 'not applied or is already rolled back' in r.stderr,'a second rollback fails loudly instead of changing anything')
 sql(migration);check(md5_all(PATCHED)==new,'the migration re-applies cleanly after rollback and produces the same md5 pins')
 check(act_ok(ADM,'reinstate_listing',listing=LAfter,reason='Reapplied migration works after rollback')['status']=='paused','after re-apply the RPC works')
 print(f'{checks} focused SQL checks passed',flush=True)
finally:
 r=run(['docker','rm','-f',NAME]);print('Disposable container removed' if r.returncode==0 else 'Container removal failed: '+r.stderr,flush=True)
