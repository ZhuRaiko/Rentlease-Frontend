"""Network-isolated synthetic checks for 20261114200000_published_reviews_reviewer_role.sql and its rollback. No hosted connection accepted.

Requires Docker. Everything runs in a disposable container with no network, mounts or published ports; the hosted project is never contacted.
Fixture: public.get_published_rental_reviews and rentlease_reviews.actor are EXTRACTED BYTE-FOR-BYTE from the real migration
20261110125450_tenancy_ratings_reviews.sql and the first is md5-checked against the pin read from the hosted project. The tables they read
(entries with the real columns and checks, tenancies, properties, listings, profiles) are minimal stand-ins. A byte-faithful copy of the ORIGINAL function is kept as
public.get_published_rental_reviews_orig, so every result of the patched function is compared with the original's. Every test body runs inside
BEGIN ... ROLLBACK. See supabase/test-support/PUBLISHED_REVIEWS_REVIEWER_ROLE.md.
Run: python supabase/tests/run_published_reviews_reviewer_role.py   (optionally --migration <modified copy> / --rollback <copy> for mutation checks)
"""
import json, re, subprocess, sys, time, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
NAME = 'rentlease-reviewrole-' + uuid.uuid4().hex[:8]
checks = 0
ORIG = '7f0847017fc4547576efd9e8eb16960a'
SIG = 'public.get_published_rental_reviews(text,uuid,integer)'
args = sys.argv[1:]
def opt(flag, default): return Path(args[args.index(flag) + 1]) if flag in args else default
MIGRATION = opt('--migration', ROOT / 'supabase/migrations/20261114200000_published_reviews_reviewer_role.sql')
ROLLBACK = opt('--rollback', ROOT / 'supabase/test-support/published_reviews_reviewer_role_rollback.sql')
def u(): return str(uuid.uuid4())
T, L, T2, STR = u(), u(), u(), u()   # tenant, landlord, a second tenant, a stranger
def run(a, **kw): return subprocess.run(a, capture_output=True, **kw)
def cmd(): return ['docker', 'exec', '-i', NAME, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'reviewrole', '-qAt', '-v', 'ON_ERROR_STOP=1']
class R:
    def __init__(self, p): self.rc = p.returncode; self.out = p.stdout.decode('utf-8', 'replace'); self.err = p.stderr.decode('utf-8', 'replace')
# Bytes, not text mode: a Windows text pipe rewrites LF as CRLF, which changes md5(prosrc) of function bodies.
def psql(q): return R(subprocess.run(cmd(), input=q.encode('utf-8'), capture_output=True))
def sql(q, ok=True):
    r = psql(q); assert (r.rc == 0) == ok, r.err if ok else 'Expected failure but succeeded: ' + q[:140]
    return r.out.strip()
def check(v, label):
    global checks
    assert v, label
    checks += 1; print('PASS ' + label, flush=True)
def n(q): return int(sql(q))
def tx(body, ok=True): return sql('begin;\n' + body + '\nrollback;', ok)
def md5_of(sig=SIG): return sql(f"select md5(prosrc) from pg_proc where oid='{sig}'::regprocedure;")
def meta(sig=SIG): return sql(f"select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text,proisstrict::text,prorettype::regtype::text,proargtypes::text,pronargdefaults::text) from pg_proc where oid='{sig}'::regprocedure;")
def src(): return (ROOT / 'supabase/migrations/20261110125450_tenancy_ratings_reviews.sql').read_bytes().decode('utf-8').replace('\r\n', '\n')

FIXTURE = """
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create schema rentlease_reviews;
revoke all on schema rentlease_reviews from public,anon,authenticated;
create table public.profiles(id uuid primary key,account_status text not null default 'active');
create function public.is_admin(uuid) returns boolean language sql stable as $$select false$$;
create function public.is_tier1_verified(uuid) returns boolean language sql stable as $$select true$$;
create table public.properties(id uuid primary key,landlord_id uuid not null,is_active boolean not null default true);
create table public.listings(id uuid primary key,property_id uuid not null,landlord_id uuid not null,status text not null,published_at timestamptz,available_from date);
create table public.tenancies(id uuid primary key,property_id uuid not null,tenant_id uuid not null,landlord_id uuid not null,status text not null,actual_end_date date,ended_at timestamptz);
create table rentlease_reviews.entries(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('property','user')),
 tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 property_id uuid not null references public.properties(id) on delete restrict,
 reviewer_id uuid not null,reviewee_id uuid,user_review_id uuid unique,
 rating smallint not null check(rating between 1 and 5),body text check(length(body)<=2000),
 status text not null default 'pending' check(status in('pending','approved','rejected','hidden')),
 revision uuid not null default gen_random_uuid(),created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),moderated_at timestamptz,
 unique(tenancy_id,reviewer_id,kind),
 check((kind='property' and reviewee_id is null and user_review_id is null) or (kind='user' and reviewee_id is not null and reviewee_id<>reviewer_id and user_review_id is not null)));
grant usage on schema public to authenticated,anon;
revoke all on all tables in schema public from public,anon,authenticated;
"""
def extract(text, name):
    m = re.search(r'create function ' + re.escape(name) + r'\(.*?end\$\$;', text, re.S); assert m, name
    return m.group(0)

def boot():
    r = run(['docker', 'run', '--rm', '-d', '--network', 'none', '--name', NAME, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'public.ecr.aws/supabase/postgres:17.6.1.155']); assert r.returncode == 0, r.stderr
    info = json.loads(run(['docker', 'inspect', NAME]).stdout)[0]
    assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode'] == 'none'
    for _ in range(120):
        if run(['docker', 'exec', NAME, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-qAt', '-c', 'select 1']).returncode == 0: break
        time.sleep(1)
    else: raise SystemExit('Postgres did not start')
    r = run(['docker', 'exec', NAME, 'createdb', '-U', 'postgres', '-T', 'template0', 'reviewrole']); assert r.returncode == 0, r.stderr.decode()
def fixture():
    text = src()
    sql(FIXTURE)
    sql(extract(text, 'rentlease_reviews.actor'))
    sql(extract(text, 'public.get_published_rental_reviews'))
    # A byte-faithful copy of the original, for result comparisons.
    sql(extract(text, 'public.get_published_rental_reviews').replace('public.get_published_rental_reviews', 'public.get_published_rental_reviews_orig', 1))
    sql("alter function public.get_published_rental_reviews(text,uuid,integer) owner to postgres;"
        "revoke all on function public.get_published_rental_reviews(text,uuid,integer) from public,anon,authenticated;"
        "grant execute on function public.get_published_rental_reviews(text,uuid,integer) to authenticated;"
        "alter function public.get_published_rental_reviews_orig(text,uuid,integer) owner to postgres;"
        "grant execute on function public.get_published_rental_reviews_orig(text,uuid,integer) to authenticated;"
        "grant execute on function rentlease_reviews.actor(boolean) to authenticated;")
    # The fixture function is the one read from the hosted project: its md5 is the pin.
    check(md5_of() == ORIG, 'fixture function matches the hosted md5 ' + ORIG)
    check(md5_of('public.get_published_rental_reviews_orig(text,uuid,integer)') == ORIG, 'the comparison copy is the same original source')
def apply_migration(path=None): return psql(Path(path or MIGRATION).read_bytes().decode('utf-8'))

def world():
    """Tenancy 1: tenant T rents from landlord L (property P1, ended). Tenancy 2: T is the LANDLORD of property P2, tenant T2 (ended).
    Reviews (all approved): property review by T of P1; user review by L about T; user review by T about L; user review by T2 about T."""
    P1, P2, TEN1, TEN2 = u(), u(), u(), u()
    ids = {k: u() for k in ('pr1', 'ul_t', 'ut_l', 'ut2_t')}
    body = (f"insert into public.properties values('{P1}','{L}',true),('{P2}','{T}',true);"
            f"insert into public.tenancies values('{TEN1}','{P1}','{T}','{L}','ended','2026-10-01','2026-10-01T00:00:00Z'),('{TEN2}','{P2}','{T2}','{T}','ended','2026-10-02','2026-10-02T00:00:00Z');"
            f"insert into rentlease_reviews.entries(id,kind,tenancy_id,property_id,reviewer_id,reviewee_id,user_review_id,rating,body,status,created_at) values"
            f"('{ids['pr1']}','property','{TEN1}','{P1}','{T}',null,null,5,'Great place','approved','2026-11-01T00:00:00Z'),"
            f"('{ids['ul_t']}','user','{TEN1}','{P1}','{L}','{T}','{u()}',4,'Good tenant','approved','2026-11-02T00:00:00Z'),"
            f"('{ids['ut_l']}','user','{TEN1}','{P1}','{T}','{L}','{u()}',2,'Slow repairs','approved','2026-11-03T00:00:00Z'),"
            f"('{ids['ut2_t']}','user','{TEN2}','{P2}','{T2}','{T}','{u()}',1,'Hard landlord','approved','2026-11-04T00:00:00Z');")
    return P1, P2, ids, body
def call(fn, kind, target, offset=0): return f"select {fn}('{kind}','{target}',{offset})::text;"
def as_user(user): return f"set role authenticated;set test.actor='{user}';"

def main():
    boot()
    try:
        fixture()
        before_meta = meta()
        # ---- Precondition abort
        sql("create or replace function public.get_published_rental_reviews(p_kind text,p_target_id uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin return '{}'::jsonb;end$$;")
        r = apply_migration(); check(r.rc != 0 and 'source drift' in r.err, 'a changed source aborts the migration')
        sql(extract(src(), 'public.get_published_rental_reviews').replace('create function', 'create or replace function', 1))
        check(md5_of() == ORIG and meta() == before_meta, 'fixture restored after the abort test')
        # ---- Apply
        r = apply_migration(); assert r.rc == 0, r.err
        check(True, 'the migration applies')
        post = md5_of()
        check(post != ORIG, 'patched md5 differs from the original')
        header = re.search(ORIG + r'\s+->\s+([0-9a-f]{32})', MIGRATION.read_text(encoding='utf-8'))
        check(header is not None and header.group(1) == post, 'the patched md5 equals the pin recorded in the migration header')
        check(meta() == before_meta, 'owner, ACL, security definer, volatility, config, return type and arguments are unchanged')
        check(n("select count(*) from rentlease_reviews.entries;") == 0, 'applying wrote no review rows')

        # ---- Behavior
        P1, P2, ids, body = world()
        out = tx(body + as_user(T) + call('public.get_published_rental_reviews', 'property', P1)).splitlines()[-1]
        rows = json.loads(out)['rows']
        check([x['reviewerRole'] for x in rows] == ['tenant'] and rows[0]['id'] == ids['pr1'], 'a property review (written by the tenant) reads reviewerRole "tenant"')
        out = json.loads(tx(body + as_user(T) + call('public.get_published_rental_reviews', 'user', T)).splitlines()[-1])
        roles = {x['id']: x['reviewerRole'] for x in out['rows']}
        check(roles == {ids['ul_t']: 'landlord', ids['ut2_t']: 'tenant'}, "user reviews about T: the one written by T's landlord is 'landlord', the one written by T's tenant (T is a landlord elsewhere) is 'tenant'")
        out = json.loads(tx(body + as_user(L) + call('public.get_published_rental_reviews', 'user', L)).splitlines()[-1])
        check({x['id']: x['reviewerRole'] for x in out['rows']} == {ids['ut_l']: 'tenant'}, "a user review written by the tenant about the landlord reads 'tenant'")
        # unchanged results versus the original function (apart from the new key)
        for actor, kind, target in ((T, 'property', P1), (T, 'user', T), (L, 'user', L), (L, 'user', T), (T, 'user', L), (T2, 'property', P2)):
            both = tx(body + as_user(actor) + call('public.get_published_rental_reviews', kind, target) + call('public.get_published_rental_reviews_orig', kind, target)).splitlines()
            new, old = json.loads(both[-2]), json.loads(both[-1])
            stripped = {**new, 'rows': [{k: v for k, v in x.items() if k != 'reviewerRole'} for x in new['rows']]}
            check(stripped == old, f'{kind} reviews of {"self" if target == actor else "other"} as {"tenant" if actor == T else "landlord/other"}: same count, average, order and existing keys as the original')
            check(all(set(x.keys()) - {'reviewerRole'} == set(y.keys()) for x, y in zip(new['rows'], old['rows'])) and all('reviewerRole' in x for x in new['rows']), '  every row has exactly the original keys plus reviewerRole')
        check(True, 'count and average are computed over the same rows as before (see the comparisons above)')
        # paging
        paged = tx(body + as_user(T) + call('public.get_published_rental_reviews', 'user', T, 1) + call('public.get_published_rental_reviews_orig', 'user', T, 1)).splitlines()
        a, b = json.loads(paged[-2]), json.loads(paged[-1])
        check(len(a['rows']) == len(b['rows']) == 1 and a['rows'][0]['id'] == b['rows'][0]['id'], 'paging (offset 1) returns the same row as the original')

        # ---- Access rules unchanged: same SQLSTATE and message from both functions
        def denied(q):
            r = psql('begin;\n' + q + '\nrollback;'); return r
        for label, setup, q in (
            ('a stranger asking for another user', as_user(STR), "select public.get_published_rental_reviews('user','%s',0);" % T),
            ('a stranger asking for a property with no listing', as_user(STR), "select public.get_published_rental_reviews('property','%s',0);" % P1),
            ('an invalid kind', as_user(T), "select public.get_published_rental_reviews('both','%s',0);" % T),
            ('a negative offset', as_user(T), "select public.get_published_rental_reviews('user','%s',-1);" % T),
            ('no signed-in user', "set role authenticated;set test.actor='';", "select public.get_published_rental_reviews('user','%s',0);" % T)):
            new = denied(body + setup + q)
            old = denied(body + setup + q.replace('get_published_rental_reviews', 'get_published_rental_reviews_orig'))
            check(new.rc != 0 and old.rc != 0 and re.search(r'ERROR:\s+(.*)', new.err).group(1) == re.search(r'ERROR:\s+(.*)', old.err).group(1), f'access rule unchanged ({label}): same refusal as the original')
        denied_msgs = {re.search(r'ERROR:\s+(.*)', denied(body + as_user(STR) + "select public.get_published_rental_reviews('user','%s',0);" % T).err).group(1)}
        check(denied_msgs == {'Access unavailable'}, 'the refusal text is the original "Access unavailable"')
        check(n("select count(*) from rentlease_reviews.entries;") == 0, 'every test body rolled back: no review rows remain')

        # ---- Rollback
        r = psql(ROLLBACK.read_bytes().decode('utf-8')); assert r.rc == 0, r.err
        check(md5_of() == ORIG, 'rollback restores the original source: md5 equals ' + ORIG)
        check(meta() == before_meta, 'rollback keeps the original owner, ACL and settings')
        r = psql(ROLLBACK.read_bytes().decode('utf-8')); check(r.rc == 0 and md5_of() == ORIG, 'rollback is idempotent')
        out = tx(body + as_user(T) + call('public.get_published_rental_reviews', 'user', T)).splitlines()[-1]
        check(all('reviewerRole' not in x for x in json.loads(out)['rows']), 'after rollback the rows no longer carry reviewerRole')
        sql("create or replace function public.get_published_rental_reviews(p_kind text,p_target_id uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin return '{}'::jsonb;end$$;")
        r = psql(ROLLBACK.read_bytes().decode('utf-8')); check(r.rc != 0 and 'unexpected source' in r.err and md5_of() != ORIG, 'rollback refuses an unknown source')
        sql(extract(src(), 'public.get_published_rental_reviews').replace('create function', 'create or replace function', 1))
        r = apply_migration(); check(r.rc == 0, 'the migration applies again after a rollback')
        r = apply_migration(); check(r.rc != 0 and 'source drift' in r.err, 'a second apply is refused (the source is already patched)')
        print(f'\nALL {checks} CHECKS PASSED')
    finally:
        r = run(['docker', 'rm', '-f', NAME]); print('Disposable container removed' if r.returncode == 0 else 'Container removal failed: ' + r.stderr.decode())

if __name__ == '__main__': main()
