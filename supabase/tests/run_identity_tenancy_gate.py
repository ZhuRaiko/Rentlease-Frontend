"""Network-isolated synthetic checks for 20261112164000_identity_tenancy_gate.sql and its rollback. No hosted connection accepted.

Requires Docker. A disposable container with no network, mounts or published ports; the hosted project is never contacted.
The identity function bodies are the LIVE pre-migration definitions (supabase/test-support/identity_tenancy_gate_baseline.sql, captured
read-only) and establish_tenancy/context come from the real tenancy migration; this harness asserts their md5(prosrc) equals the pins.
Stubs (documented in the fixture below): check_identity, verified, completeness refresh, is_admin, profiles.
Run: python supabase/tests/run_identity_tenancy_gate.py
"""
import json,re,subprocess,threading,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-idgate-'+uuid.uuid4().hex[:8];checks=0
A,B,N,X=[str(uuid.uuid4()) for _ in range(4)]   # A owner, B tenant, N unrelated landlord, X admin
PINS={'manage_property_identity':'c11e5b963e27ffd7601fb161def042fe','begin_property_identity_verification':'79d82e9403a5f04511b53b25ed8b695d','establish_tenancy':'975614f0e93a64eda006f25af4b1e7b3','get_admin_property_identity_review':'2f59d5579001d78cb2a8b8d40003d96a','promote':'e4de0578032cae920f8f73b3a6f20b92'}
PATCHED=('manage_property_identity','begin_property_identity_verification','establish_tenancy','get_admin_property_identity_review')
T_OPEN="Identity cannot change while a tenancy is open";T_PENDING="Resolve the pending identity review first."
# Files are read as bytes, never line-ending-normalized: the hosted function bodies contain CR, and the md5 pins are over those exact bytes.
def raw(path):return (ROOT/path).read_bytes().decode('utf-8')
def run(args,**kw):return subprocess.run(args,capture_output=True,**kw)
class Result:
 def __init__(self,p):self.returncode=p.returncode;self.stdout=p.stdout.decode('utf-8','replace');self.stderr=p.stderr.decode('utf-8','replace')
# Bytes, not text mode: a Windows text pipe rewrites LF as CRLF, which changes md5(prosrc) of function bodies.
def psql(q):return Result(run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','gate','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input=q.encode('utf-8')))
def sql(q,ok=True):
 r=psql(q);assert (r.returncode==0)==ok,r.stderr if ok else 'Expected failure but succeeded: '+q[:140]
 return r.stdout.strip()
def deny(q,text,code='22023'):
 r=psql(q);assert r.returncode!=0,'Expected denial: '+q[:140];assert text in r.stderr and code in r.stderr,f'Expected {text!r}/{code} in: {r.stderr.strip()[:260]}'
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
def uid():return str(uuid.uuid4())
def auth(actor):return f"set test.actor='{actor}';set role authenticated;"
IDENT={"property_type":"apartment","city":"imus","barangay":"Fixture","floor_number":1,"address_line_1":"x","address_line_2":None,"postal_code":None,"exact_lat":14.4,"exact_lng":120.9,"public_lat":14.4,"public_lng":120.9}
def ident(barangay):return json.dumps({**IDENT,"barangay":barangay})
def md5s():return json.loads(sql("select jsonb_object_agg(proname,md5(prosrc)) from pg_proc where proname in('manage_property_identity','begin_property_identity_verification','establish_tenancy','get_admin_property_identity_review','promote');"))
def posture():return sql("select jsonb_object_agg(proname,jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text[],'secdef',prosecdef,'config',proconfig,'vol',provolatile)) from pg_proc where proname in('manage_property_identity','begin_property_identity_verification','establish_tenancy','get_admin_property_identity_review','promote');")
def fdef(name):return sql(f"select pg_get_functiondef(p.oid) from pg_proc p where p.proname='{name}';")
def prop(owner=A):
 p,i,a=uid(),uid(),uid()   # a = the approved Tier 3 submission a verified property has
 sql(f"insert into public.properties(id,landlord_id,is_active,property_type,city,barangay,floor_number,public_location) values('{p}','{owner}',true,'apartment','imus','Fixture',1,extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326));insert into public.property_private_locations(property_id,address_line_1,exact_location) values('{p}','x',extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326));insert into rentlease_property_identity.revisions(id,property_id,owner_id,identity,provenance) values('{i}','{p}','{owner}','{ident('Fixture')}','seed');insert into public.verification_submissions(id,user_id,tier,property_id,status,identity_revision_id,ready_for_review_at) values('{a}','{owner}','tier_3_property','{p}','approved','{i}',now());insert into rentlease_property_identity.current_identity values('{p}','{i}','{a}');")
 return p
def reservation(p,future=2):
 l,c,r=uid(),uid(),uid()
 sql(f"insert into public.listings values('{l}','{p}','{A}','active',now(),null,10000,'Fixture rental',now(),null);insert into public.conversations values('{c}','{l}','{B}','{A}','open');insert into public.rental_reservations values('{r}','{c}','{l}','{p}','{B}','{A}',(now() at time zone 'Asia/Manila')::date+{future},(now() at time zone 'Asia/Manila')::date+{future}+30,'approved',now()+interval '60 days');")
 return r
def context(r,actor=A):return json.loads(sql(auth(actor)+f"select public.get_tenancy_establishment('{r}');"))
def establish_q(r,ctx,actor=A,op=None):return auth(actor)+f"select public.establish_tenancy('{r}','{op or uid()}','{ctx['propertyVersion']}','{ctx['identityRevision']}',10000,5);"
def version(p):return sql(f"select edit_version from public.properties where id='{p}';")
def correct_q(p,barangay,actor=A,op=None):return auth(actor)+f"select public.manage_property_identity('{p}','{version(p)}','{op or uid()}','same_property_correction','{ident(barangay)}'::jsonb);"
def cver(cid):return sql(f"select version from rentlease_property_identity.corrections where id='{cid}';")
def cancel_q(p,cid,actor=A):return auth(actor)+f"select public.manage_property_identity('{p}','{version(p)}','{uid()}','cancel',null,'{cid}','{cver(cid)}');"
def draft(p,barangay='Changed'):
 cid=json.loads(sql(correct_q(p,barangay)))['correction_id'];return cid
def candidate(cid):return sql(f"select candidate_revision_id from rentlease_property_identity.corrections where id='{cid}';")
def begin_q(p,cid,actor=A):return auth(actor)+f"select public.begin_property_identity_verification('{p}','{candidate(cid)}');"
def open_tenancy(p):
 r=reservation(p);json.loads(sql(establish_q(r,context(r))));return r
def raw_tenancy(p,status):
 # session_replication_role=replica skips triggers and foreign keys, so only the gate under test matters (simulates a row from before the gate existed).
 sql(f"set session_replication_role=replica;insert into public.tenancies(id,listing_id,property_id,conversation_id,tenant_id,landlord_id,status,agreed_monthly_rent,start_date,expected_end_date,rent_due_day,created_by) values(gen_random_uuid(),gen_random_uuid(),'{p}',gen_random_uuid(),'{B}','{A}','{status}',1,current_date,current_date+30,5,'{A}');")
def end_tenancies(p):sql(f"update public.tenancies set status='ended' where property_id='{p}' and status in('proposed','pending_confirmation','active');")
def state(p):return sql(f"select (select count(*) from public.tenancies where property_id='{p}' and status in('proposed','pending_confirmation','active'))||'/'||(select count(*) from public.verification_submissions where property_id='{p}' and status in('pending','under_review'))||'/'||(select count(*) from rentlease_property_identity.corrections where property_id='{p}' and status in('draft','submitted'));")
def holding_lock(p,seconds,call):
 """Hold the property advisory lock in one session; run `call` from another once the lock is really held. Returns (elapsed seconds, Result)."""
 t=threading.Thread(target=lambda:psql(f"begin;select pg_advisory_xact_lock(hashtextextended('{p}',0));select pg_sleep({seconds});commit;"));t.start()
 for _ in range(100):
  if sql("select count(*) from pg_locks where locktype='advisory' and granted and pid<>pg_backend_pid();")!='0':break
  time.sleep(.05)
 t0=time.time();res=psql(call);elapsed=time.time()-t0;t.join();return elapsed,res
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode==0:break
  time.sleep(.5)
 time.sleep(8)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','gate']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create schema extensions;create extension if not exists postgis with schema extensions;grant usage on schema extensions to authenticated;
 create table public.profiles(id uuid primary key,active boolean not null,admin boolean not null default false);
 create function public.is_tier1_verified(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and active)$$;
 create function public.is_admin(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and admin)$$;
 create type public.tenancy_status as enum('proposed','pending_confirmation','active','ended','cancelled');
 create type public.property_type as enum('apartment','house','condominium');create type public.cavite_city as enum('imus','dasmarinas','tagaytay');
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean,edit_version uuid default gen_random_uuid(),property_type text,city text,barangay text,bedrooms smallint,bathrooms numeric,floor_area_sqm numeric,furnishing_status text,floor_number smallint,public_location extensions.geography);
 create table public.property_private_locations(property_id uuid primary key,address_line_1 text,address_line_2 text,postal_code text,exact_location extensions.geography);
 create table public.listings(id uuid primary key,property_id uuid,landlord_id uuid,status text,published_at timestamptz,available_from date,asking_rent_monthly numeric,title text,updated_at timestamptz,archived_at timestamptz,completeness_score numeric not null default 1);
 create table public.conversations(id uuid primary key,listing_id uuid,tenant_id uuid,landlord_id uuid,status text);
 create table public.rental_reservations(id uuid primary key,conversation_id uuid,listing_id uuid,property_id uuid,tenant_id uuid,landlord_id uuid,move_in_date date,end_date date,status text,expires_at timestamptz);
 create table public.verification_documents(id uuid primary key default gen_random_uuid(),submission_id uuid);
 create table public.verification_submissions(id uuid primary key default gen_random_uuid(),user_id uuid,tier text,property_id uuid,status text not null default 'pending',identity_revision_id uuid,identity_correction_id uuid,ready_for_review_at timestamptz,identity_review_version uuid not null default gen_random_uuid(),submitted_at timestamptz not null default now());
 create schema rentlease_property_edit;create schema rentlease_reservations;create schema rentlease_property_identity;create schema rentlease_completeness;
 create table rentlease_property_identity.revisions(id uuid primary key default gen_random_uuid(),property_id uuid,owner_id uuid,identity jsonb,provenance text,created_at timestamptz not null default now());
 create table rentlease_property_identity.current_identity(property_id uuid primary key,revision_id uuid,approved_submission_id uuid);
 create table rentlease_property_identity.corrections(id uuid primary key default gen_random_uuid(),property_id uuid not null,owner_id uuid,base_revision_id uuid,candidate_revision_id uuid,status text not null check(status in('draft','submitted','applied','rejected','cancelled')),version uuid not null default gen_random_uuid(),submission_id uuid);
 create table rentlease_property_identity.receipts(owner_id uuid,operation_id uuid,property_id uuid,input jsonb,result jsonb);
 create table rentlease_property_identity.repairs(property_id uuid);
 -- Documented stubs: validation and approval history are not under test.
 create function rentlease_property_identity.check_identity(p_id uuid,j jsonb) returns jsonb language sql as $$select j$$;
 create function rentlease_completeness.refresh_listing_completeness_for_property(uuid) returns void language sql as $$select 1$$;
 create function rentlease_property_identity.verified(uuid) returns boolean language sql stable as $$select exists(select 1 from rentlease_property_identity.current_identity where property_id=$1)$$;
 """)
 sql(raw('supabase/test-support/identity_tenancy_gate_baseline.sql'))
 catalog=json.loads((ROOT/'supabase/test-support/tenancy_establishment_baseline.json').read_text(encoding='utf-8-sig'))
 sql('create table public.tenancies('+','.join(c['name']+' '+c['type']+(' not null' if not c['nullable'] else '')+(' default '+c['default'] if c['default'] else '') for c in catalog['columns'])+');alter table public.tenancies enable row level security;')
 for i,c in enumerate(catalog['constraints']):sql('alter table public.tenancies add constraint fixture_'+str(i)+' '+c+';')
 for t in catalog['triggers']:sql(t['function']);sql(t['definition']+';')
 sql(f"insert into public.profiles values('{A}',true,false),('{B}',true,false),('{N}',true,false),('{X}',true,true);")
 sql(raw('supabase/migrations/20261110055859_tenancy_establishment.sql'))
 sql("grant usage on schema public,rentlease_property_identity to authenticated;grant select,insert,update on all tables in schema public to authenticated;")
 base=md5s();bad={k:(base.get(k),v) for k,v in PINS.items() if base.get(k)!=v};assert not bad,f'fixture bodies differ from the live pins (got, pinned): {bad}'
 check(True,'fixture function bodies equal the live pins (manage, begin, establish, get_admin review, promote)')
 check(sql("select md5(prosrc) from pg_proc where proname='context' and pronamespace='rentlease_tenancy_setup'::regnamespace;")=='3be79a0c23f55eb2870a7b5960180c8c','tenancy context body equals the live definition')
 migration=raw('supabase/migrations/20261112164000_identity_tenancy_gate.sql')
 rollback=raw('supabase/test-support/identity_tenancy_gate_rollback.sql')
 # ---- Scenario data created BEFORE the migration
 pre=prop();pre_cid=draft(pre);json.loads(sql(begin_q(pre,pre_cid)))
 sid=sql(f"select id from public.verification_submissions where property_id='{pre}' and identity_correction_id is not null;");review_before=json.loads(sql(auth(X)+f"select public.get_admin_property_identity_review('{sid}');"))
 check('open_tenancy' not in review_before,'BEFORE: admin review has no open_tenancy key')
 gap1=prop();open_tenancy(gap1);gap_cid=draft(gap1,'GapBarangay')
 check(state(gap1)=='1/0/1','BEFORE: owner with an open tenancy CAN start an identity correction (the gap)')
 json.loads(sql(begin_q(gap1,gap_cid)));check(state(gap1)=='1/1/1','BEFORE: owner with an open tenancy CAN begin verification (the gap)')
 gap2=prop();g2c=draft(gap2,'Pending');json.loads(sql(begin_q(gap2,g2c)));r2=reservation(gap2);json.loads(sql(establish_q(r2,context(r2))))
 check(state(gap2)=='1/1/1','BEFORE: a tenancy CAN be proposed while a correction is pending (the reverse gap)')
 rows_before=sql("select (select count(*) from public.verification_submissions)||'/'||(select count(*) from public.tenancies)||'/'||(select count(*) from rentlease_property_identity.corrections)||'/'||(select count(*) from rentlease_property_identity.receipts);")
 # ---- Drift guards
 original=fdef('manage_property_identity');tampered=original.replace("Property changed. Reload before requesting correction","Property changed. Reload before requesting corrections",1);assert tampered!=original
 sql(tampered);r=psql(migration);check(r.returncode!=0 and 'source differs from the reviewed definition' in r.stderr and md5s()['establish_tenancy']==base['establish_tenancy'],'drifted source (md5 pin) aborts the whole migration atomically')
 sql(original);check(md5s()==base,'drifted function restored')
 # ---- Apply
 posture_before=posture();sql(migration)
 after=md5s();check(all(after[k]!=base[k] for k in PATCHED) and after['promote']==base['promote'],'four functions patched; promote byte-identical')
 check(posture()==posture_before,'owner, ACL, security definer, search_path and volatility identical on all five functions')
 check(sql("select (select count(*) from public.verification_submissions)||'/'||(select count(*) from public.tenancies)||'/'||(select count(*) from rentlease_property_identity.corrections)||'/'||(select count(*) from rentlease_property_identity.receipts);")==rows_before,'migration changes no data')
 # ---- Lock-order evidence (static)
 lk=fdef('lock_owner');ctxdef=sql("select pg_get_functiondef(p.oid) from pg_proc p where p.proname='context' and p.pronamespace='rentlease_tenancy_setup'::regnamespace;")
 LOCK_P='pg_advisory_xact_lock(hashtextextended(p_property_id::text,0))';LOCK_R='pg_advisory_xact_lock(hashtextextended(r.property_id::text,0))'
 check('hashtextextended(p_property_id::text,0)' in lk,'lock_owner takes the per-property advisory lock key')
 m=fdef('manage_property_identity');b=fdef('begin_property_identity_verification');e=fdef('establish_tenancy')
 check(m.index('lock_owner(')<m.index(LOCK_P)<m.index(T_OPEN),'manage: lock_owner (advisory lock) -> explicit lock -> open-tenancy check')
 check(b.index('lock_owner(')<b.index(LOCK_P)<b.index(T_OPEN)<b.index('insert into public.verification_submissions'),'begin: lock_owner (advisory lock) -> explicit lock -> open-tenancy check -> insert')
 check(e.index('rentlease_tenancy_setup.context(')<e.index(LOCK_R)<e.index(T_PENDING)<e.index('insert into public.tenancies'),'establish: context() (advisory lock, then row locks) -> explicit lock -> pending-review check -> insert')
 check('hashtextextended(r.property_id::text,0)' in ctxdef and ctxdef.index('pg_advisory_xact_lock')<ctxdef.index('for share'),'context takes the advisory lock before any row lock')
 # ---- Lock-order evidence (runtime): each function queues on the exact property key
 lp=prop();lc=draft(lp,'LockProbe');lr=reservation(lp);lctx=context(lr)
 for label,call in (('manage',correct_q(lp,'LockedTry')),('begin',begin_q(lp,lc)),('establish',establish_q(lr,lctx))):
  elapsed,res=holding_lock(lp,3,call);check(elapsed>=1.8,f'{label} waits on the same per-property advisory lock ({elapsed:.1f}s while another session held it)')
 # ---- Submission gate
 own=prop();ocid=draft(own,'NoTenancy');check(state(own)=='0/0/1','owner without a tenancy can start a correction')
 json.loads(sql(begin_q(own,ocid)));check(state(own)=='0/1/1','owner without a tenancy can begin verification')
 t1=prop();c1=draft(t1,'Before');open_tenancy(t1)
 deny(correct_q(t1,'Second'),T_OPEN);deny(begin_q(t1,c1),T_OPEN);check(state(t1)=='1/0/1','owner with an open tenancy cannot start a correction or begin verification (22023, nothing written)')
 t2=prop();open_tenancy(t2);deny(correct_q(t2,'New'),T_OPEN);check(state(t2)=='1/0/0','open tenancy blocks a brand-new correction too')
 for status in ('proposed','pending_confirmation','active'):
  t=prop();tc=draft(t,'Before'+status);raw_tenancy(t,status)
  deny(correct_q(t,'New'+status),T_OPEN);deny(begin_q(t,tc),T_OPEN);check(state(t)=='1/0/1',f'a {status} tenancy blocks both submission paths')
 for status in ('ended','cancelled'):
  t=prop();tc=draft(t,'Done'+status);raw_tenancy(t,status);json.loads(sql(begin_q(t,tc)));check(state(t)=='0/1/1',f'a {status} tenancy does not block')
 end_tenancies(t1);json.loads(sql(begin_q(t1,c1)));check(state(t1)=='0/1/1','once the tenancy ends the same owner can begin verification')
 # An exact retry that only returns an existing submission stays allowed even in a legacy state (tenancy opened before this gate existed).
 lg=prop();lc2=draft(lg,'Legacy');first=json.loads(sql(begin_q(lg,lc2)));raw_tenancy(lg,'active')
 again=json.loads(sql(begin_q(lg,lc2)));check(again['id']==first['id'] and state(lg)=='1/1/1','begin returning an already-existing submission is still allowed (reads and idempotent retries are not blocked)')
 # ---- Withdraw stays allowed
 w=prop();wc=draft(w,'ToWithdraw');open_tenancy(w)
 sql(cancel_q(w,wc));check(sql(f"select status from rentlease_property_identity.corrections where id='{wc}';")=='cancelled' and state(w)=='1/0/0','cancelling a draft correction still works while a tenancy is open')
 # ---- Reverse gate
 def proposal(p):
  r=reservation(p);return r,context(r)
 for label,setup,blocked in (('submitted correction',lambda c:sql(f"update rentlease_property_identity.corrections set status='submitted' where id='{c}';"),True),('begun verification (pending submission)',None,True),('correction under review',lambda c:sql(f"update public.verification_submissions set status='under_review',ready_for_review_at=now() where identity_correction_id='{c}';update rentlease_property_identity.corrections set status='submitted' where id='{c}';"),True)):
  p=prop();c=draft(p,'Pending');json.loads(sql(begin_q(p,c)))
  if setup:setup(c)
  r,ctx=proposal(p);deny(establish_q(r,ctx),T_PENDING);check(sql(f"select count(*) from public.tenancies where property_id='{p}';")=='0',f'tenancy proposal refused while a {label} exists (22023, no tenancy created)')
 p=prop();c=draft(p,'DraftOnly');r,ctx=proposal(p);json.loads(sql(establish_q(r,ctx)));check(state(p)=='1/0/1','a draft correction without begun verification does not block a proposal (then begin is blocked by the submission gate)')
 deny(begin_q(p,c),T_OPEN)
 p=prop();r,ctx=proposal(p);json.loads(sql(establish_q(r,ctx)));check(state(p)=='1/0/0','a property with no correction can propose a tenancy')
 p=prop();c=draft(p,'Cancelled');json.loads(sql(begin_q(p,c)));sql(cancel_q(p,c));r,ctx=proposal(p);json.loads(sql(establish_q(r,ctx)));check(state(p)=='1/0/0','after the correction is withdrawn the proposal is allowed')
 p=prop();c=draft(p,'Applied');sql(f"update rentlease_property_identity.corrections set status='applied' where id='{c}';");r,ctx=proposal(p);json.loads(sql(establish_q(r,ctx)));check(state(p)=='1/0/0','an applied or rejected correction does not block')
 op=uid();p=prop();r,ctx=proposal(p);first=json.loads(sql(establish_q(r,ctx,op=op)))
 check(json.loads(sql(establish_q(r,ctx,op=op)))==first,'exact retry of an earlier proposal still returns its original receipt')
 # ---- Race: exactly one wins, in both orders
 wins={'begin':0,'establish':0}
 for rnd in range(8):
  p=prop();c=draft(p,f'Race{rnd}');r=reservation(p);ctx=context(r);gate=threading.Barrier(2);out={}
  def go(name,q):
   gate.wait();out[name]=psql(q)
  ts=[threading.Thread(target=go,args=('begin',begin_q(p,c))),threading.Thread(target=go,args=('establish',establish_q(r,ctx)))]
  for t in ts:t.start()
  for t in ts:t.join()
  ok=[k for k,v in out.items() if v.returncode==0];failed=[k for k,v in out.items() if v.returncode!=0]
  check(len(ok)==1 and ((failed==['begin'] and T_OPEN in out['begin'].stderr) or (failed==['establish'] and T_PENDING in out['establish'].stderr)),f'race {rnd+1}/8: exactly one of begin vs propose wins ({ok[0] if ok else "none"}), the loser gets the clear 22023 message')
  tenancy,subs,_=map(int,state(p).split('/'));check(not(tenancy and subs),f'race {rnd+1}/8: never an open tenancy together with begun verification')
  wins[ok[0]]+=1
 print('race winners:',wins,flush=True)
 # ---- Admin review: additive key only
 review_after=json.loads(sql(auth(X)+f"select public.get_admin_property_identity_review('{sid}');"))
 check(review_after.pop('open_tenancy')is False and review_after==review_before,'admin review adds only open_tenancy (false); every existing key and value is unchanged')
 ot=prop();oc=draft(ot,'ReviewTenancy');json.loads(sql(begin_q(ot,oc)));osid=sql(f"select id from public.verification_submissions where property_id='{ot}' and identity_correction_id is not null;")
 raw_tenancy(ot,'active')
 check(json.loads(sql(auth(X)+f"select public.get_admin_property_identity_review('{osid}');"))['open_tenancy'] is True,'admin review reports open_tenancy true for an open tenancy')
 deny(auth(A)+f"select public.get_admin_property_identity_review('{osid}');",'Admin required','42501');check(True,'non-admin still denied the admin review')
 # ---- Approve path unchanged
 ap=prop();ac=draft(ap,'Approved');sql(f"select rentlease_property_identity.promote('{ap}','{candidate(ac)}');");check(sql(f"select barangay from public.properties where id='{ap}';")=='Approved','approve path (promote) still applies a correction when no tenancy is open')
 bp=prop();bc=draft(bp,'Blocked');open_tenancy(bp);deny(f"select rentlease_property_identity.promote('{bp}','{candidate(bc)}');",T_OPEN);check(sql(f"select barangay from public.properties where id='{bp}';")=='Fixture','promote still refuses with an open tenancy (unchanged)')
 # ---- Rollback
 rows_mid=sql("select (select count(*) from public.verification_submissions)||'/'||(select count(*) from public.tenancies)||'/'||(select count(*) from rentlease_property_identity.corrections);")
 sql(rollback);check(md5s()==base,'rollback restores all five bodies byte-identically (md5(prosrc) equals the pins)')
 check(posture()==posture_before,'rollback leaves owner, ACL and configuration identical');check(sql("select (select count(*) from public.verification_submissions)||'/'||(select count(*) from public.tenancies)||'/'||(select count(*) from rentlease_property_identity.corrections);")==rows_mid,'rollback retains all data')
 g=prop();open_tenancy(g);json.loads(sql(correct_q(g,'Again')));check(state(g)=='1/0/1','after rollback the pre-migration behavior is back (a correction can again start during an open tenancy)')
 r=psql(rollback);check(r.returncode!=0 and 'found 0 times' in r.stderr,'a second rollback fails loudly instead of changing anything')
 sql(migration);check(md5s()==after,'migration re-applies cleanly after rollback to the same bodies')
 print(f'{checks} focused SQL checks passed',flush=True)
finally:
 r=run(['docker','rm','-f',NAME]);print('Disposable container removed' if r.returncode==0 else 'Container removal failed: '+r.stderr.decode(),flush=True)
