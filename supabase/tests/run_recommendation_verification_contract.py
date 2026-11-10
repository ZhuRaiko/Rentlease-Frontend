"""Synthetic-only local contract/security/rollback tests. Never connects to Supabase."""
import argparse
import json
import subprocess
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--container', required=True)
a = p.parse_args()
assert a.container == 'rentlease-recommendation-test-tier2'
docker = ['docker', '--context', 'desktop-linux']
info = json.loads(subprocess.check_output(docker + ['inspect', a.container], text=True))[0]
assert info['HostConfig']['NetworkMode'] == 'none'
assert not info['Mounts'] and not info['HostConfig']['PortBindings']
assert info['Config']['Image'] == 'public.ecr.aws/supabase/postgres:17.6.1.141'
root = Path(__file__).resolve().parents[2]
db = 'recommendation_contract'
for cmd in [['dropdb', '--if-exists', db], ['createdb', db]]:
    subprocess.run(docker + ['exec', a.container, cmd[0], '-U', 'postgres'] + cmd[1:], check=True, capture_output=True)
base = docker + ['exec', '-i', a.container, 'psql', '-U', 'postgres', '-d', db, '-XAtq', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']


def sql(q, ok=True):
    r = subprocess.run(base, input=q, text=True, encoding='utf-8', capture_output=True)
    if ok:
        assert r.returncode == 0, r.stderr
        return r.stdout.strip()
    return r


def load(path, ok=True):
    return sql(path.read_text(encoding='utf-8'), ok)


def uid(n):
    return f'00000000-0000-4000-8000-{n:012d}'


count = 0


def check(condition, label):
    global count
    assert condition, label
    count += 1
    print('PASS', label, flush=True)


def auth(actor, query, role='authenticated', ok=True):
    return sql(f"begin;set local role {role};set local request.jwt.claim.sub='{actor}';{query};rollback;", ok)


def denied(actor, query, code='42501', role='authenticated'):
    r = auth(actor, query, role, False)
    return r.returncode != 0 and code in r.stderr


sql("""
create schema auth;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;
end $$;
grant usage on schema public,auth to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create type public.account_status as enum('active','restricted','suspended','deleted');
create type public.app_role as enum('tenant','landlord','admin');
create type public.listing_status as enum('draft','active','paused','rented','removed','archived');
create type public.verification_tier as enum('tier_1_basic','tier_2_identity','tier_3_property');
create type public.verification_status as enum('pending','under_review','approved','rejected','cancelled','revoked');
create table public.profiles(id uuid primary key,account_status public.account_status default 'active',tier1_verified_at timestamptz,tier2_verified_at timestamptz,tier3_verified_at timestamptz,updated_at timestamptz);
create table public.user_roles(user_id uuid,role public.app_role);
create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean);
create table public.listings(id uuid primary key,property_id uuid,landlord_id uuid,status public.listing_status,published_at timestamptz,available_from date);
create table public.tenancies(property_id uuid,listing_id uuid,tenant_id uuid,landlord_id uuid);
create table public.verification_submissions(id uuid primary key,user_id uuid,tier public.verification_tier,status public.verification_status,property_id uuid,reviewed_at timestamptz,reviewed_by uuid);
create table public.verification_documents(id uuid,submission_id uuid);
create function public.has_app_role(requested_role public.app_role,requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.user_roles where user_id=requested_user and role=requested_role)$$;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.listings enable row level security;
alter table public.verification_submissions enable row level security;
alter table public.verification_documents enable row level security;
-- Synthetic participant-scoped tenancy prerequisite for the inspected listing policy.
alter table public.tenancies enable row level security;
create policy fixture_tenancies_participant on public.tenancies for select to authenticated using(auth.uid() in(tenant_id,landlord_id));
grant select on public.profiles,public.properties,public.listings,public.verification_submissions,public.tenancies to authenticated;
""")
load(root / 'supabase/test-support/recommendation_verification_live_contract.sql')

# Snapshot every existing function/ACL, policy, relation/column grant and trigger.
snapshot_query = """select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid),proacl::text) order by oid) from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace) and proname<>'get_recommendation_owner_verification'),
 'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public'),
 'relations',(select jsonb_agg(jsonb_build_array(oid::regclass::text,relacl::text,relrowsecurity) order by oid) from pg_class where relnamespace='public'::regnamespace),
 'columns',(select jsonb_agg(jsonb_build_array(attrelid,attnum,attacl::text) order by attrelid,attnum) from pg_attribute where attrelid in(select oid from pg_class where relnamespace='public'::regnamespace)),
 'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by oid) from pg_trigger where not tgisinternal))::text"""
before = sql(snapshot_query)
migration = next((root / 'supabase/migrations').glob('*_recommendation_owner_tier2_status.sql'))
load(migration)
check(before == sql(snapshot_query), 'migration preserves existing functions, grants, RLS and triggers')
fn = 'public.get_recommendation_owner_verification'
call = lambda expression: f'select * from {fn}({expression})'
A, B, U, S, D = [uid(i) for i in range(1, 6)]
for actor, status, tier1 in [(A, 'active', True), (B, 'active', True), (U, 'active', False), (S, 'suspended', True), (D, 'active', True)]:
    sql(f"insert into profiles(id,account_status,tier1_verified_at) values('{actor}','{status}',{'now()' if tier1 else 'null'})")
sql(f"insert into user_roles values('{B}','landlord'),('{D}','admin')")
L, P = uid(101), uid(201)
sql(f"insert into properties values('{P}','{B}',true);insert into listings values('{L}','{P}','{B}','active',now(),null)")
batch = f"array['{L}']::uuid[]"


def result(actor=A):
    return json.loads(auth(actor, f"select coalesce(jsonb_agg(to_jsonb(s)),'[]') from {fn}({batch}) s"))


def value():
    return result()[0]['owner_tier2_verified']


check(result()[0]['listing_owner_id'] == B, 'role-free Tier 1 caller resolves actual owner')
check(value() is False, 'confirmed no approval is false')
check(result(B)[0]['listing_id'] == L, 'legacy landlord caller remains compatible')
sql(f"insert into user_roles values('{A}','tenant')")
check(len(result()) == 1, 'legacy tenant caller remains compatible')
check(denied('', call(batch), role='anon'), 'anonymous EXECUTE denied')
for actor, label in [('', 'missing identity'), (U, 'missing Tier 1'), (S, 'suspended caller')]:
    check(denied(actor, call(batch)), label + ' denied')
for status in ['restricted', 'deleted']:
    sql(f"update profiles set account_status='{status}' where id='{S}'")
    check(denied(S, call(batch)), status + ' caller denied')
for expression in ['null::uuid[]', "'{}'::uuid[]", 'array[null]::uuid[]', f"array_fill('{L}'::uuid,array[51])", f"array[['{L}']]::uuid[]"]:
    check(denied(A, call(expression), '22023'), 'invalid batch rejected: ' + expression)
check(denied(A, call("array['not-a-uuid']::uuid[]"), '22P02'), 'malformed UUID rejected by type boundary')
check(len(json.loads(auth(A, f"select jsonb_agg(to_jsonb(s)) from {fn}(array_fill('{L}'::uuid,array[50])) s"))) == 1, 'fifty supplied duplicates accepted and deduplicated')
check(auth(A, call(f"array['{uid(999)}']::uuid[]")) == '', 'nonexistent IDs omitted')
for status in ['draft', 'paused', 'archived', 'removed', 'rented']:
    sql(f"update listings set status='{status}' where id='{L}'")
    for actor in [A, B, D]:
        check(result(actor) == [], status + ' omitted without owner/Admin bypass')
sql(f"update listings set status='active',published_at=null where id='{L}'")
check(result() == [], 'unpublished active listing omitted')
sql(f"update listings set published_at=now(),available_from=(now() at time zone 'Asia/Manila')::date+1 where id='{L}'")
check(result() == [], 'future availability omitted')
sql(f"update listings set available_from=(now() at time zone 'Asia/Manila')::date where id='{L}'")
check(len(result()) == 1, 'Manila current-day availability accepted')
sql(f"update properties set is_active=false where id='{P}'")
check(result() == [], 'inactive property omitted')
sql(f"update properties set is_active=true,landlord_id='{A}' where id='{P}'")
check(result() == [], 'physical/listing owner mismatch omitted')
sql(f"update properties set landlord_id='{B}' where id='{P}'")
check(auth(A, f"select count(*) from listings where id='{L}'") == '1', 'eligible row also visible under caller listing RLS')
check(auth(A, f"select count(*) from properties where id='{P}'") == '1', 'eligible physical row visible under caller property RLS')

V = uid(301)
for status in ['pending', 'under_review', 'rejected', 'cancelled', 'revoked']:
    sql(f"insert into verification_submissions values('{V}','{B}','tier_2_identity','{status}',null,null,null)")
    check(value() is False, status + ' gives no positive verification')
    sql(f"delete from verification_submissions where id='{V}'")
sql(f"insert into verification_submissions values('{V}','{B}','tier_2_identity','approved',null,'2026-01-01','{D}')")
check(value() is True, 'approved current Tier 2 and refreshed cache return true')
sql(f"delete from user_roles where user_id='{D}'")
check(value() is True, 'historical approval does not require current reviewer Admin membership')
sql(f"insert into verification_submissions values('{uid(302)}','{B}','tier_2_identity','rejected',null,'2026-02-01','{D}')")
check(value() is True, 'later rejected history does not override still-approved evidence')
sql(f"update verification_submissions set status='revoked' where id='{V}'")
check(value() is False, 'revocation refresh removes final approval and clears bonus')
sql(f"update profiles set tier2_verified_at='2026-01-01' where id='{B}'")
check(value() is None, 'stale positive cache without approval is unknown')
sql(f"update verification_submissions set status='approved' where id='{V}'")
for change in ["tier2_verified_at=null", "tier2_verified_at='2026-03-01'"]:
    sql(f"update profiles set {change} where id='{B}'")
    check(value() is None, 'missing/mismatched cached timestamp is unknown')
for change in ["reviewed_by=null", "reviewed_at=null", f"property_id='{P}'", "reviewed_at=now()+interval '1 day'"]:
    sql(f"update verification_submissions set property_id=null,reviewed_by='{D}',reviewed_at='2026-01-01' where id='{V}'")
    sql(f"update verification_submissions set {change} where id='{V}'")
    check(value() is None, 'untrusted approval metadata is unknown: ' + change.split('=')[0])
sql(f"delete from verification_submissions where id='{V}';insert into verification_submissions values('{V}','{B}','tier_3_property','approved','{P}','2026-01-01','{D}')")
check(value() is False, 'Tier 3 approval never substitutes for Tier 2')
sql(f"delete from verification_submissions where id='{V}';insert into verification_submissions values('{V}','{B}','tier_2_identity','approved',null,'2026-01-01','{D}')")
for status in ['suspended', 'restricted', 'deleted']:
    sql(f"update profiles set account_status='{status}' where id='{B}'")
    check(value() is None, 'inactive owner evidence never awards a boost: ' + status)
sql(f"update profiles set account_status='active',tier1_verified_at=null where id='{B}'")
check(value() is None, 'owner missing active Tier 1 receives no approval signal')
sql(f"update profiles set tier1_verified_at=now() where id='{B}'")
check(set(result()[0]) == {'listing_id', 'listing_owner_id', 'owner_tier2_verified'}, 'output contains exactly three minimal fields')
check(auth(A, f"select count(*) from profiles where id='{B}'") == '0', 'RPC does not grant foreign profile reads')
check(auth(A, f"select count(*) from verification_submissions where user_id='{B}'") == '0', 'RPC does not grant foreign verification reads')
check(denied(A, 'select * from verification_documents'), 'document permissions remain private')
check(denied(A, f"update profiles set tier2_verified_at=now() where id='{A}'"), 'caller cannot forge timestamp')
check(sql(f"select prosecdef and provolatile='s' and proconfig=array['search_path=\"\"'] from pg_proc where oid='{fn}(uuid[])'::regprocedure") == 't', 'stable definer uses empty search path')
for role, allowed in [('anon', False), ('authenticated', True), ('service_role', False)]:
    check(sql(f"select has_function_privilege('{role}','{fn}(uuid[])','EXECUTE')") == ('t' if allowed else 'f'), role + ' explicit execution privilege')
check(before == sql(snapshot_query), 'all existing grants/RLS/functions unchanged after tests')
load(root / 'supabase/test-support/recommendation_owner_tier2_status_rollback.sql')
check(sql(f"select to_regprocedure('{fn}(uuid[])') is null") == 't', 'rollback removes only new RPC')
check(before == sql(snapshot_query), 'rollback preserves all existing catalog contracts')
check(sql(f"select count(*) from verification_submissions where id='{V}'") == '1', 'rollback retains historical verification data')
load(migration)
check(value() is True, 'reviewed migration reapplies cleanly after scoped rollback')
# Unexpected source drift must stop before function creation.
load(root / 'supabase/test-support/recommendation_owner_tier2_status_rollback.sql')
sql("alter function public.is_tier1_verified(uuid) set search_path='public'")
original = sql("select pg_get_functiondef('public.is_tier1_verified(uuid)'::regprocedure)")
sql("create or replace function public.is_tier1_verified(requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path='public' as $$select true$$")
r = load(migration, False)
check(r.returncode != 0 and 'baseline drift' in r.stderr, 'migration fails closed on helper drift')
check(sql(f"select to_regprocedure('{fn}(uuid[])') is null") == 't', 'drift failure leaves no new RPC')
sql(original)
load(migration)
check(value() is True, 'restored inspected baseline permits local migration')
print(f'RESULT: {count} passed / 0 failed', flush=True)
