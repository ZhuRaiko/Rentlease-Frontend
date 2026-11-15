"""Network-isolated synthetic checks for 20261114180000_verification_update_notifications.sql and its rollback. No hosted connection accepted.

Requires Docker. Everything runs in a disposable container with no network, mounts or published ports; the hosted project is never contacted.
Fixture: the notification functions (rentlease_notifications.emit, generate, caller and public.get_in_app_notification_target) are EXTRACTED BYTE-FOR-BYTE
from the real migration 20261111035305_in_app_notifications.sql and md5-checked against the pins read from the hosted project. The tables they touch
(notifications, properties, verification_submissions, conversations, tenancies, reports) are minimal stand-ins, and the two review functions
(review_verification_submission with its delegated inner function, review_property_identity_verification) are stand-ins that run the same
UPDATE ... SET status the hosted ones run. See supabase/test-support/VERIFICATION_UPDATE_NOTIFICATIONS.md for what that does and does not prove.
Every test body runs inside BEGIN ... ROLLBACK and the notification row count is asserted unchanged afterwards.
Run: python supabase/tests/run_verification_update_notifications.py   (optionally --migration <modified copy> and --rollback <copy> for mutation checks)
"""
import hashlib, json, re, subprocess, sys, time, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
NAME = 'rentlease-verifnotif-' + uuid.uuid4().hex[:8]
checks = 0
ORIG = '535a95ee46f7060e6adeaea28509ef8c'
EMIT = '81a5f1b377e0a5c57ccca6d23a0374bb'
GEN = '08b686c7868662747ec9bf3f119c6177'
args = sys.argv[1:]
def opt(flag, default):
    return Path(args[args.index(flag) + 1]) if flag in args else default
MIGRATION = opt('--migration', ROOT / 'supabase/migrations/20261114180000_verification_update_notifications.sql')
ROLLBACK = opt('--rollback', ROOT / 'supabase/test-support/verification_update_notifications_rollback.sql')
def u(): return str(uuid.uuid4())
ADMIN, OWNER, OTHER, TENANT = u(), u(), u(), u()
def run(a, **kw): return subprocess.run(a, capture_output=True, **kw)
def cmd(): return ['docker', 'exec', '-i', NAME, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'verifnotif', '-qAt', '-v', 'ON_ERROR_STOP=1']
class R:
    def __init__(self, p): self.rc = p.returncode; self.out = p.stdout.decode('utf-8', 'replace'); self.err = p.stderr.decode('utf-8', 'replace')
# Bytes, not text mode: a Windows text pipe rewrites LF as CRLF, which changes md5(prosrc) of function bodies.
def psql(q): return R(subprocess.run(cmd(), input=q.encode('utf-8'), capture_output=True))
def sql(q, ok=True):
    r = psql(q); assert (r.rc == 0) == ok, r.err if ok else 'Expected failure but succeeded: ' + q[:140]
    return r.out.strip()
def deny(q, text):
    r = psql(q); assert r.rc != 0, 'Expected denial: ' + q[:140]
    assert text in r.err, f'Expected {text!r} in: {r.err.strip()[:300]}'
def check(v, label):
    global checks
    assert v, label
    checks += 1; print('PASS ' + label, flush=True)
def n(q): return int(sql(q))
def tx(body, ok=True): return sql('begin;\n' + body + '\nrollback;', ok)
def count_all(): return n('select count(*) from public.notifications;')
def cnt(user, where='true'): return n(f"select count(*) from public.notifications where user_id='{user}' and {where};")
def md5_of(sig): return sql(f"select md5(prosrc) from pg_proc where oid='{sig}'::regprocedure;")
TARGET_SIG = 'public.get_in_app_notification_target(uuid)'
def src():
    return (ROOT / 'supabase/migrations/20261111035305_in_app_notifications.sql').read_bytes().decode('utf-8').replace('\r\n', '\n')
def extract(text, name):
    m = re.search(r'create function ' + re.escape(name) + r'\(.*?end\$\$;', text, re.S); assert m, name
    return m.group(0)

FIXTURE = """
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create schema rentlease_notifications; revoke all on schema rentlease_notifications from public,anon,authenticated,service_role;
create type public.notification_type as enum('new_message','viewing_update','tenancy_update','maintenance_update','rent_due','report_update','verification_update');
create type public.verification_status as enum('pending','under_review','approved','rejected','cancelled','revoked');
create type public.verification_tier as enum('tier_1_contact','tier_2_identity','tier_3_property');
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null,type public.notification_type not null,title text not null,body text not null,data jsonb,event_key text,read_at timestamptz,created_at timestamptz not null default now());
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
create unique index notifications_event_unique on public.notifications(user_id,event_key) where event_key is not null;
create policy notifications_rpc_only on public.notifications as restrictive for all to authenticated using(false) with check(false);
create table public.properties(id uuid primary key,landlord_id uuid not null);
create table public.verification_submissions(id uuid primary key default gen_random_uuid(),user_id uuid not null,property_id uuid,tier public.verification_tier not null,status public.verification_status not null default 'pending',rejection_reason text,review_note text,reviewed_by uuid);
create table public.conversations(id uuid primary key,tenant_id uuid not null,landlord_id uuid not null);
create table public.tenancies(id uuid primary key,tenant_id uuid not null,landlord_id uuid not null);
create table public.reports(id uuid primary key,reporter_id uuid not null);
create function public.is_tier1_verified(uuid) returns boolean language sql stable as $$select true$$;
grant usage on schema public to authenticated,anon;
revoke all on all tables in schema public from public,anon,authenticated;
-- Stand-ins for the hosted review functions: same statement shape (UPDATE ... SET status), Tier 2 through a delegated inner function.
create schema rentlease_stub;
create function rentlease_stub.review_verification_submission(requested_submission_id uuid,requested_status public.verification_status,requested_note text,requested_reason text) returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 update public.verification_submissions set status=requested_status,reviewed_by=auth.uid(),review_note=nullif(btrim(requested_note),''),rejection_reason=case when requested_status='rejected' then btrim(requested_reason) else null end where id=requested_submission_id;
end$$;
create function public.review_verification_submission(requested_submission_id uuid,requested_status public.verification_status,requested_note text,requested_reason text) returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 perform rentlease_stub.review_verification_submission(requested_submission_id,requested_status,requested_note,requested_reason);
end$$;
create function public.review_property_identity_verification(p_submission_id uuid,p_status public.verification_status,p_note text,p_reason text) returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 update public.verification_submissions set status=p_status,reviewed_by=auth.uid(),review_note=nullif(btrim(p_note),''),rejection_reason=case when p_status='rejected' then btrim(p_reason) else null end where id=p_submission_id;
end$$;
"""

def boot():
    r = run(['docker', 'run', '--rm', '-d', '--network', 'none', '--name', NAME, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'public.ecr.aws/supabase/postgres:17.6.1.155']); assert r.returncode == 0, r.stderr
    info = json.loads(run(['docker', 'inspect', NAME]).stdout)[0]
    assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode'] == 'none'
    for _ in range(120):
        if run(['docker', 'exec', NAME, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-qAt', '-c', 'select 1']).returncode == 0: break
        time.sleep(1)
    else: raise SystemExit('Postgres did not start')
    r = run(['docker', 'exec', NAME, 'createdb', '-U', 'postgres', '-T', 'template0', 'verifnotif']); assert r.returncode == 0, r.stderr.decode()
def fixture():
    text = src()
    sql(FIXTURE)
    sql("create function rentlease_notifications.emit" + extract(text, 'rentlease_notifications.emit')[len('create function rentlease_notifications.emit'):])
    sql(extract(text, 'rentlease_notifications.generate'))
    sql(extract(text, 'rentlease_notifications.caller'))
    sql(extract(text, 'public.get_in_app_notification_target'))
    sql("alter function public.get_in_app_notification_target(uuid) owner to postgres;"
        "revoke all on all functions in schema rentlease_notifications from public,anon,authenticated,service_role;"
        "revoke all on function public.get_in_app_notification_target(uuid) from public,anon,authenticated,service_role;"
        "grant execute on function public.get_in_app_notification_target(uuid) to authenticated;")
    # The extracted bodies must be the ones read from the hosted project.
    check(md5_of(TARGET_SIG) == ORIG, 'fixture get_in_app_notification_target matches the hosted md5 ' + ORIG)
    check(md5_of('rentlease_notifications.emit(uuid,text,public.notification_type,text,text,uuid)') == EMIT, 'fixture emit matches the hosted md5')
    check(md5_of('rentlease_notifications.generate()') == GEN, 'fixture generate matches the hosted md5')
    check('security definer' in sql("select pg_get_functiondef('public.get_in_app_notification_target(uuid)'::regprocedure);").lower(), 'target function is security definer')
def apply_migration(path=None):
    p = path or MIGRATION
    r = psql(Path(p).read_bytes().decode('utf-8')); return r

def main():
    boot()
    try:
        fixture()
        before_rows = count_all()
        before_meta = sql(f"select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text) from pg_proc where oid='{TARGET_SIG}'::regprocedure;")
        # ---- Preconditions abort (each in the migration's own transaction, so nothing must remain)
        text = src()
        def restore_all():
            sql('create or replace function rentlease_notifications.emit' + extract(text, 'rentlease_notifications.emit')[len('create function rentlease_notifications.emit'):])
            sql(extract(text, 'rentlease_notifications.generate').replace('create function', 'create or replace function', 1))
            sql(extract(text, 'public.get_in_app_notification_target').replace('create function', 'create or replace function', 1))
        sql("create or replace function rentlease_notifications.emit(recipient uuid,event text,typ public.notification_type,label text,kind text,target uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$begin return; end$$;")
        r = apply_migration(); check(r.rc != 0 and 'emit source drift' in r.err, 'a changed emit() aborts the migration'); restore_all()
        sql(extract(text, 'rentlease_notifications.generate').replace('create function', 'create or replace function', 1).replace('actor:=new.sender_id', 'actor:=new.sender_id;perform 1'))
        r = apply_migration(); check(r.rc != 0 and 'generate source drift' in r.err, 'a changed generate() aborts the migration'); restore_all()
        sql(extract(text, 'public.get_in_app_notification_target').replace('create function', 'create or replace function', 1).replace("kind='report'", "kind='reportx'"))
        r = apply_migration(); check(r.rc != 0 and 'get_in_app_notification_target source drift' in r.err, 'a changed target function aborts the migration'); restore_all()
        check(md5_of(TARGET_SIG) == ORIG and md5_of('rentlease_notifications.generate()') == GEN, 'fixture restored after the abort tests')
        check(sql("select count(*) from pg_trigger where tgname='inapp_verification';") == '0' and sql("select to_regprocedure('rentlease_notifications.generate_verification()') is null;") == 't', 'aborted migrations leave nothing behind')

        # ---- Apply
        r = apply_migration(); assert r.rc == 0, r.err
        check(True, 'the migration applies')
        post = md5_of(TARGET_SIG)
        check(post != ORIG, 'patched target md5 differs from the original')
        header = re.search(r'get_in_app_notification_target\(uuid\)\s+' + ORIG + r'\s+->\s+([0-9a-f]{32})', MIGRATION.read_text(encoding='utf-8'))
        check(header is not None and header.group(1) == post, 'the patched md5 equals the pin recorded in the migration header')
        check(sql(f"select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text) from pg_proc where oid='{TARGET_SIG}'::regprocedure;") == before_meta, 'target function owner, ACL, security definer, volatility and config are unchanged')
        check(md5_of('rentlease_notifications.generate()') == GEN, '8: generate() md5 is unchanged after the migration')
        check(md5_of('rentlease_notifications.emit(uuid,text,public.notification_type,text,text,uuid)') == EMIT, 'emit() md5 is unchanged after the migration')
        check(count_all() == before_rows, 'applying the migration wrote no notification rows')

        # ---- Helpers for test bodies
        def setup(*, tier='tier_3_property', owner=OWNER, status='pending'):
            p, s = u(), u()
            body = (f"insert into public.properties values('{p}','{owner}');"
                    f"insert into public.verification_submissions(id,user_id,property_id,tier,status) values('{s}','{owner}',{('%r' % p) if tier == 'tier_3_property' else 'null'},'{tier}','{status}');"
                    f"set test.actor='{ADMIN}';")
            return p, s, body.replace('"', "'")
        def prop_review(s, status, note='', reason=''): return f"select public.review_property_identity_verification('{s}','{status}','{note}','{reason}');"
        def id_review(s, status, note='', reason=''): return f"select public.review_verification_submission('{s}','{status}','{note}','{reason}');"

        # 1. pending -> under_review writes nothing
        p, s, b = setup()
        out = tx(b + prop_review(s, 'under_review') + f"select count(*) from public.notifications where user_id='{OWNER}';")
        check(out.splitlines()[-1] == '0', '1: tier_3 pending -> under_review writes 0 rows')
        check(count_all() == before_rows, 'rows unchanged after test 1')

        # 2. approve: exactly one row with the right content
        p, s, b = setup()
        out = tx(b + prop_review(s, 'under_review') + prop_review(s, 'approved') +
                 f"select count(*) from public.notifications where user_id='{OWNER}';"
                 f"select type||'|'||title||'|'||body||'|'||(data->>'kind')||'|'||(data->>'id')||'|'||event_key from public.notifications where user_id='{OWNER}';"
                 f"select count(*) from public.notifications where user_id='{ADMIN}';")
        lines = [l for l in out.splitlines() if l.strip()]
        check(lines[-3] == '1', '2: tier_3 approved writes exactly 1 row for the owner')
        check(lines[-2] == f"verification_update|Property verification approved|Open RentLease to review this update.|property_verification|{p}|verification:{s}:approved", '2: type, title, generic body, kind, property id and event key are correct')
        check(lines[-1] == '0', '6: the admin who reviewed receives nothing')
        check(count_all() == before_rows, 'rows unchanged after test 2')

        # 3. rejected: one row, no reason text anywhere
        p, s, b = setup()
        SECRET_R, SECRET_N = 'SECRET-REJECTION-REASON-XYZ', 'SECRET-REVIEW-NOTE-XYZ'
        out = tx(b + prop_review(s, 'under_review') + prop_review(s, 'rejected', SECRET_N, SECRET_R) +
                 f"select count(*) from public.notifications where user_id='{OWNER}';"
                 f"select title||'|'||(data->>'kind') from public.notifications where user_id='{OWNER}';"
                 f"select (n::text like '%{SECRET_R}%' or n::text like '%{SECRET_N}%') from public.notifications n where user_id='{OWNER}';"
                 f"select count(*) from public.notifications where user_id='{ADMIN}';")
        lines = [l for l in out.splitlines() if l.strip()]
        check(lines[-4] == '1' and lines[-3] == 'Property verification needs changes|property_verification', '3: tier_3 rejected writes 1 row with the "needs changes" title')
        check(lines[-2] == 'f', '3: neither the rejection reason nor the review note appears anywhere in the row')
        check(lines[-1] == '0', '6: no admin notification on reject')

        # 4. Tier 2 through the delegated review function: approve and reject
        for status, title in (('approved', 'Identity verification approved'), ('rejected', 'Identity verification needs changes')):
            p, s, b = setup(tier='tier_2_identity')
            out = tx(b + id_review(s, 'under_review') + id_review(s, status, SECRET_N, SECRET_R) +
                     f"select count(*) from public.notifications where user_id='{OWNER}';"
                     f"select type||'|'||title||'|'||(data->>'kind')||'|'||(data->>'id')||'|'||event_key from public.notifications where user_id='{OWNER}';"
                     f"select count(*) from public.notifications where user_id='{OWNER}' and (title||body||data::text) like '%SECRET%';")
            lines = [l for l in out.splitlines() if l.strip()]
            check(lines[-3] == '1', f'4: tier_2 {status} through review_verification_submission (delegated) writes 1 row')
            check(lines[-2] == f'verification_update|{title}|identity_verification|{s}|verification:{s}:{status}', f'4: tier_2 {status} row content and target (submission id)')
            check(lines[-1] == '0', f'4: tier_2 {status} row has no reviewer text')
        p, s, b = setup(tier='tier_2_identity')
        out = tx(b + prop_review(s, 'under_review') + prop_review(s, 'approved') + f"select count(*) from public.notifications where user_id='{OWNER}';")
        check(out.splitlines()[-1] == '1', '4: the property review function also fires the trigger for a Tier 2 row (the trigger is on the table)')
        check(count_all() == before_rows, 'rows unchanged after test 4')

        # 5. repeating the same status: still one row
        p, s, b = setup()
        out = tx(b + prop_review(s, 'under_review') + prop_review(s, 'approved') + prop_review(s, 'approved') + f"update public.verification_submissions set status='approved' where id='{s}';"
                 f"update public.verification_submissions set review_note='x' where id='{s}';select count(*) from public.notifications where user_id='{OWNER}';")
        check(out.splitlines()[-1] == '1', '5: repeating the same status (and editing another column) keeps 1 row')
        out = tx(b + prop_review(s, 'under_review') + prop_review(s, 'approved') + f"update public.verification_submissions set status='under_review' where id='{s}';" + prop_review(s, 'approved') + f"select count(*) from public.notifications where user_id='{OWNER}';")
        check(out.splitlines()[-1] == '1', '5: approving again after a step back does not add a second row for the same event key')
        # other tiers and other statuses write nothing
        p, s, b = setup(tier='tier_1_contact')
        out = tx(b + id_review(s, 'under_review') + id_review(s, 'approved') + f"select count(*) from public.notifications where user_id='{OWNER}';")
        check(out.splitlines()[-1] == '0', 'a tier that is neither 2 nor 3 writes nothing')
        p, s, b = setup()
        out = tx(b + f"update public.verification_submissions set status='cancelled' where id='{s}';update public.verification_submissions set status='revoked' where id='{s}';select count(*) from public.notifications where user_id='{OWNER}';")
        check(out.splitlines()[-1] == '0', 'cancelled and revoked write nothing')
        p2, s2, b2 = setup(tier='tier_3_property')
        out = tx(b2 + f"update public.verification_submissions set property_id=null where id='{s2}';" + prop_review(s2, 'under_review') + prop_review(s2, 'approved') + f"select count(*) from public.notifications where user_id='{OWNER}';")
        check(out.splitlines()[-1] == '0', 'a Tier 3 row without a property id writes nothing (emit ignores a null target)')
        check(count_all() == before_rows, 'rows unchanged after test 5')

        # 7. the trigger function is not executable by clients
        check(sql("select has_function_privilege('authenticated','rentlease_notifications.generate_verification()','execute') or has_function_privilege('anon','rentlease_notifications.generate_verification()','execute') or has_function_privilege('service_role','rentlease_notifications.generate_verification()','execute') or has_function_privilege('public','rentlease_notifications.generate_verification()','execute');") == 'f', '7: generate_verification is not executable by authenticated, anon, service_role or PUBLIC')
        deny("set role authenticated; select rentlease_notifications.generate_verification();", 'permission denied')
        deny("set role anon; select rentlease_notifications.generate_verification();", 'permission denied')
        check(True, '7: authenticated and anon calls are denied')
        check(sql("select prosecdef::text||'|'||coalesce(proconfig::text,'') from pg_proc where oid='rentlease_notifications.generate_verification()'::regprocedure;") == 'true|{search_path=pg_catalog}', 'generate_verification is security definer with search_path=pg_catalog')
        check(sql("select count(*) from pg_trigger where tgrelid='public.verification_submissions'::regclass and tgname='inapp_verification' and tgenabled='O';") == '1', 'the trigger exists and is enabled')
        trig = sql("select pg_get_triggerdef(oid) from pg_trigger where tgname='inapp_verification';")
        check('AFTER UPDATE OF status' in trig and 'FOR EACH ROW' in trig and 'old.status IS DISTINCT FROM new.status' in trig.lower().replace('OLD', 'old').replace('NEW', 'new') or ('IS DISTINCT FROM' in trig and 'AFTER UPDATE OF status' in trig), 'the trigger is AFTER UPDATE OF status, per row, only when the status changed')
        check(count_all() == before_rows, 'rows unchanged after test 7')

        # ---- Target RPC
        def as_user(user): return f"set role authenticated;set test.actor='{user}';"
        def target_of(user, nid): return f"select coalesce(public.get_in_app_notification_target('{nid}')::text,'NULL');"
        # Owner taps the property notification
        p, s, b = setup()
        common = b + prop_review(s, 'under_review') + prop_review(s, 'approved') + f"create temp table t as select id from public.notifications where user_id='{OWNER}';grant select on t to authenticated;"
        r = psql('begin;\n' + common + as_user(OTHER) + "select public.get_in_app_notification_target((select id from t));\nrollback;")
        check(r.rc != 0 and 'Notification unavailable' in r.err, 'a different user opening this notification id gets the 42501 exception')
        out = tx(common + as_user(OWNER) + "select coalesce(public.get_in_app_notification_target((select id from t))::text,'NULL');").splitlines()[-1]
        check(json.loads(out) == {'kind': 'property_verification', 'id': p}, 'the owner taps the property notification and gets {kind: property_verification, id}')
        # data pointing at someone else's property / submission -> null
        Q, S3, S4, S5 = u(), u(), u(), u()
        def raw_notif(user, kind, target):
            return f"insert into public.notifications(user_id,type,title,body,data,event_key) values('{user}','verification_update','t','b',jsonb_build_object('kind','{kind}','id','{target}'),'k:'||gen_random_uuid());"
        data = (f"insert into public.properties values('{Q}','{OTHER}');"
                f"insert into public.verification_submissions(id,user_id,property_id,tier,status) values('{S3}','{OTHER}',null,'tier_2_identity','approved'),('{S4}','{OWNER}',null,'tier_2_identity','approved'),('{S5}','{OWNER}','{Q}','tier_3_property','approved');"
                + raw_notif(OWNER, 'property_verification', Q) + raw_notif(OWNER, 'identity_verification', S3) + raw_notif(OWNER, 'identity_verification', S4) + raw_notif(OWNER, 'identity_verification', S5)
                + f"create temp table nn as select id,data->>'kind' k,(data->>'id')::uuid t from public.notifications where user_id='{OWNER}';grant select on nn to authenticated;" + as_user(OWNER))
        def pick(kind, tgt): return f"select coalesce(public.get_in_app_notification_target((select id from nn where k='{kind}' and t='{tgt}'))::text,'NULL');"
        out = tx(data + pick('property_verification', Q) + pick('identity_verification', S3) + pick('identity_verification', S4) + pick('identity_verification', S5)).splitlines()
        check(out[-4] == 'NULL', "a notification whose data points at someone else's property returns null")
        check(out[-3] == 'NULL', "tier-2: a notification pointing at someone else's submission returns null (non-owner gets null)")
        check(json.loads(out[-2]) == {'kind': 'identity_verification', 'id': S4}, 'tier-2: the owner gets the target for their own submission')
        check(out[-1] == 'NULL', 'identity_verification pointing at a Tier 3 submission returns null (tier must be tier_2_identity)')
        # Regression: the old kinds, and unknown kinds
        C, T, REP = u(), u(), u()
        reg = (f"insert into public.conversations values('{C}','{OWNER}','{OTHER}');insert into public.tenancies values('{T}','{OWNER}','{OTHER}');insert into public.reports values('{REP}','{OWNER}');"
               + raw_notif(OWNER, 'conversation', C) + raw_notif(OWNER, 'tenancy', T) + raw_notif(OWNER, 'report', REP) + raw_notif(OWNER, 'profile', C)
               + raw_notif(OWNER, 'conversation', T) + raw_notif(OTHER, 'report', REP)
               + f"create temp table rr as select id,data->>'kind' k,(data->>'id')::uuid t,user_id from public.notifications where user_id in('{OWNER}','{OTHER}');grant select on rr to authenticated;" + as_user(OWNER))
        def rpick(kind, tgt, user=OWNER): return f"select coalesce(public.get_in_app_notification_target((select id from rr where k='{kind}' and t='{tgt}' and user_id='{user}'))::text,'NULL');"
        out = tx(reg + rpick('conversation', C) + rpick('tenancy', T) + rpick('report', REP) + rpick('profile', C) + rpick('conversation', T)).splitlines()
        check(json.loads(out[-5]) == {'kind': 'conversation', 'id': C} and json.loads(out[-4]) == {'kind': 'tenancy', 'id': T} and json.loads(out[-3]) == {'kind': 'report', 'id': REP}, 'regression: conversation, tenancy and report kinds still resolve for their participants')
        check(out[-2] == 'NULL' and out[-1] == 'NULL', 'regression: an unknown kind and a kind/id mismatch still return null')
        out = tx(reg.replace(as_user(OWNER), as_user(OTHER)) + rpick('report', REP, OTHER)).splitlines()
        check(out[-1] == 'NULL', "regression: another user's report notification pointing at a report they did not file returns null")
        check(count_all() == before_rows, 'rows unchanged after the target tests')
        check(sql("select count(*) from public.notifications;") == '0', 'the notifications table is empty: every test rolled back')

        # ---- Rollback
        r = psql(ROLLBACK.read_bytes().decode('utf-8')); assert r.rc == 0, r.err
        check(md5_of(TARGET_SIG) == ORIG, 'rollback restores the original target source: md5 equals ' + ORIG)
        check(sql("select count(*) from pg_trigger where tgname='inapp_verification';") == '0' and sql("select to_regprocedure('rentlease_notifications.generate_verification()') is null;") == 't', 'rollback drops the trigger and its function')
        check(sql(f"select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text) from pg_proc where oid='{TARGET_SIG}'::regprocedure;") == before_meta, 'rollback keeps the original owner, ACL and settings')
        r = psql(ROLLBACK.read_bytes().decode('utf-8')); check(r.rc == 0 and md5_of(TARGET_SIG) == ORIG, 'rollback is idempotent')
        out = tx(reg + rpick('conversation', C) + rpick('report', REP)).splitlines()
        check(json.loads(out[-2])['kind'] == 'conversation' and json.loads(out[-1])['kind'] == 'report', 'after rollback the old kinds still resolve')
        out = tx(data + pick('property_verification', Q) + pick('identity_verification', S4)).splitlines()
        check(out[-2] == 'NULL' and out[-1] == 'NULL', 'after rollback the new kinds return null again (the original behavior)')
        check(md5_of('rentlease_notifications.generate()') == GEN and md5_of('rentlease_notifications.emit(uuid,text,public.notification_type,text,text,uuid)') == EMIT, 'rollback leaves emit() and generate() untouched')
        # Migration can be applied again after a rollback, and refuses a second apply.
        r = apply_migration(); check(r.rc == 0, 'the migration applies again after a rollback')
        r = apply_migration(); check(r.rc != 0 and ('source drift' in r.err or 'already exists' in r.err), 'a second apply is refused by a precondition (the target source is already patched)')
        check(count_all() == 0, 'no notification rows exist at the end')
        print(f'\nALL {checks} CHECKS PASSED')
    finally:
        r = run(['docker', 'rm', '-f', NAME]); print('Disposable container removed' if r.returncode == 0 else 'Container removal failed: ' + r.stderr.decode())

if __name__ == '__main__': main()
