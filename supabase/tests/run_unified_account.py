"""Local PostgreSQL contracts only. Run the identity fixture runner first.

Uses a no-port/no-volume disposable container and production contract definitions,
never production data or a connection URL. Storage tests exercise metadata/RLS,
not Storage HTTP. --baseline installs the fixture and demonstrates the old denial.
"""
import argparse
import hashlib
import json
import subprocess
import uuid
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--container', required=True)
p.add_argument('--baseline', action='store_true')
a = p.parse_args()
assert a.container.startswith('rentlease-identity-test-')
info = json.loads(subprocess.check_output(['docker', 'inspect', a.container], text=True))[0]
assert not info.get('Mounts') and not info['HostConfig']['PortBindings']
assert info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.')
root = Path(__file__).resolve().parents[2]
db = 'identity_milestone4'
snapshot = json.loads((root / 'supabase/test-support/unified_account_baseline.json').read_text())
base = ['docker', 'exec', a.container, 'psql', '-U', 'postgres', '-d', db,
        '-XAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']

def sql(q, ok=True):
    r = subprocess.run(base + ['-c', q], text=True, capture_output=True)
    if ok:
        assert r.returncode == 0, r.stderr
    return r

def scalar(q):
    return sql(q).stdout.strip()

def load(path):
    target = '/tmp/' + Path(path).name
    subprocess.run(['docker', 'cp', str(root / path), a.container + ':' + target], check=True, capture_output=True)
    r = subprocess.run(base + ['-f', target], text=True, capture_output=True)
    assert r.returncode == 0, r.stderr

def quote(s):
    return "'" + s.replace("'", "''") + "'"

def policy(p):
    return (f"create policy {p['policyname']} on {p['schemaname']}.{p['tablename']} "
            f"as {p['permissive']} for {p['cmd']} to authenticated "
            + (f"using ({p['qual']}) " if p['qual'] else '')
            + (f"with check ({p['with_check']})" if p['with_check'] else '') + ';')

owner = '90000000-0000-4000-8000-000000000001'
other = '90000000-0000-4000-8000-000000000002'
admin = '90000000-0000-4000-8000-000000000003'
tenant = '90000000-0000-4000-8000-000000000004'
landlord = '90000000-0000-4000-8000-000000000005'
legacy = '52897654-d4f8-405e-b11e-44e57b4b4007'

def auth(q, user=owner):
    return f"begin;set local role authenticated;set local request.jwt.claim.sub='{user}';{q};commit;"

checks = 0
def check(v, msg):
    global checks
    assert v, msg
    checks += 1
    print('PASS UNIFIED', msg, flush=True)

def deny(q, code, msg):
    r = sql(q, False)
    check(r.returncode != 0 and code in r.stderr, msg + ': ' + r.stderr[:110])

# Complete the deliberately partial existing fixture with inspected contracts.
if a.baseline:
    for e in snapshot['enums']:
        if scalar(f"select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname={quote(e['typname'])}") == '0':
            sql(f"create type public.{e['typname']} as enum ({','.join(map(quote,e['labels']))})")
    fresh = ['user_roles', 'conversations', 'saved_listings', 'tenant_preferences']
    for table in fresh:
        sql(f'create table if not exists public.{table} ()')
    for c in snapshot['columns']:
        if c['name'] == 'trust_score':
            continue  # Existing fixture owns its generated-trust approximation.
        existing = scalar(f"select count(*) from information_schema.columns where table_schema='public' and table_name={quote(c['table'])} and column_name={quote(c['name'])}")
        if existing == '0':
            sql(f"alter table public.{c['table']} add column {c['name']} {c['type']}" + (f" default {c['default']}" if c['default'] else ''))
    sql("alter table public.properties alter column id set default gen_random_uuid();alter table public.listings alter column id set default gen_random_uuid();alter table public.tenancies add column if not exists tenant_id uuid,add column if not exists landlord_id uuid;do $$begin if not exists(select 1 from pg_constraint where conrelid='public.user_roles'::regclass and contype='p') then alter table public.user_roles add primary key(user_id,role);alter table public.user_roles add foreign key(user_id) references public.profiles(id);alter table public.conversations add primary key(id);end if;end$$")
    sql("drop function if exists public.is_admin() cascade")
    for f in snapshot['functions']:
        sql(f['definition'])
    for f in snapshot['functions']:
        if f['schema'] == 'public':
            sig = f"public.{f['name']}({f['args']})"
            sql(f'revoke all on function {sig} from public,anon;grant execute on function {sig} to authenticated')
    # Replace fixture-permissive policies with the actual scoped policies.
    for table in ['profiles','properties','listings','property_private_locations','user_roles','verification_submissions','verification_documents','conversations','saved_listings','tenant_preferences']:
        sql(f"do $$declare r record;begin for r in select policyname from pg_policies where schemaname='public' and tablename='{table}' loop execute format('drop policy %I on public.{table}',r.policyname);end loop;end$$;alter table public.{table} enable row level security")
    sql('drop policy if exists fixture_storage on storage.objects')
    sql("create or replace function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$")
    for pol in snapshot['policies']:
        if pol['schemaname'] == 'storage':
            sql(f"drop policy if exists {pol['policyname']} on storage.objects")
        sql(policy(pol))
    sql("drop trigger if exists unified_fixture_conversation on public.conversations;drop trigger if exists unified_fixture_conversation_identity on public.conversations;create trigger unified_fixture_conversation before insert or update on public.conversations for each row execute function public.validate_conversation_participants();create trigger unified_fixture_conversation_identity before update on public.conversations for each row execute function public.prevent_conversation_identity_changes()")
    sql("grant select on public.profiles,public.user_roles,public.verification_submissions,public.verification_documents to authenticated;grant select,insert,update,delete on public.conversations,public.saved_listings,public.tenant_preferences to authenticated;revoke update on public.profiles from authenticated;grant update(display_name,bio,avatar_path) on public.profiles to authenticated")
    sql(f"update public.profiles set account_status='active',tier1_verified_at=now();insert into public.profiles(id,display_name,account_status,tier1_verified_at) values('{other}','Other','active',now()),('{admin}','Admin','active',now()),('{tenant}','Tenant legacy','active',now()),('{landlord}','Landlord legacy','active',now()) on conflict do nothing;insert into public.user_roles(user_id,role) values('{admin}','admin'),('{tenant}','tenant'),('{landlord}','landlord')")
    # Red phase: role-free Tier 1 is still denied by the unchanged baseline.
    deny(auth('select count(*) from public.search_nearby_listings(14.4,120.9,3)'), '42501', 'baseline reproduces role-free GPS denial')
    print('BASELINE: expected old membership denial confirmed; run again without --baseline')
    raise SystemExit(0)

migration = next((root / 'supabase/migrations').glob('*_unified_account_authorization.sql'))
sql("grant select on public.tenancies to authenticated;alter table public.tenancies enable row level security;drop policy if exists unified_fixture_tenancy on public.tenancies;create policy unified_fixture_tenancy on public.tenancies for select to authenticated using(auth.uid() in (tenant_id,landlord_id) or public.is_admin())")
if scalar("select count(*) from pg_trigger where tgname='trg_listings_edit_version'") == '0':
    version_sql = (root/'supabase/migrations/20261101130456_update_listing_draft_exact_version.sql').read_text()
    sql(version_sql[version_sql.index('create function public.rotate_listing_edit_version'):version_sql.index('create function public.update_listing_draft')])
# On a rerun the inverse script first restores the exact baseline while retaining
# preference data. This also exercises compatible rollback/reapplication.
if scalar("select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='experience_preference'") == '1':
    load('supabase/test-support/unified_account_rollback.sql')
protected_sql = "select md5(string_agg(n.nspname||p.proname||p.prosrc,'|' order by n.nspname,p.proname,p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='rentlease_property_identity' or p.proname in ('manage_property_identity','begin_property_identity_verification','attach_property_identity_document','get_admin_property_identity_review','set_user_roles','has_app_role','is_admin','is_tier1_verified','validate_listing_owner'))"
protected_before = scalar(protected_sql)
private_policies_sql = "select md5(string_agg(schemaname||tablename||policyname||coalesce(qual,'')||coalesce(with_check,''),'|' order by schemaname,tablename,policyname)) from pg_policies where schemaname='storage' or tablename in ('verification_documents','property_private_locations','user_roles')"
private_before = scalar(private_policies_sql)
load(migration.relative_to(root))
check(protected_before==scalar(protected_sql),'identity transitions, evidence, repair, role and Admin helpers unchanged')
check(private_before==scalar(private_policies_sql),'Storage, private location/document and Admin membership policies unchanged')
check(scalar("select count(*) from public.profiles where experience_preference is not null") == '2', 'legacy preference backfill only; no roles invented')
check(scalar(f"select count(*) from public.user_roles where user_id='{owner}'") == '0', 'role-free owner stays role-free')
roles_before = scalar('select md5(string_agg(user_id::text||role::text,\',\' order by user_id,role)) from public.user_roles')
check(sql(auth('select count(*) from public.search_nearby_listings(14.4,120.9,3)')).returncode == 0, 'role-free GPS search')
check(sql(auth('select count(*) from public.search_nearby_listings(14.4,120.9,3)', landlord)).returncode == 0, 'legacy landlord GPS search')
check(sql(auth('select count(*) from public.search_nearby_listings(14.4,120.9,3)', tenant)).returncode == 0, 'legacy tenant GPS search')

def create(user=owner):
    q = "select public.create_property_setup('apartment','imus','Fixture',14.4,120.9,'Fixture address',14.4,120.9,array[1]::bigint[],null,null,null,1::smallint,1::numeric,30::numeric,2::smallint,5::smallint,'unfurnished',2::smallint)"
    result = sql(auth(q,user)).stdout.splitlines()
    return json.loads(next(x for x in result if x.startswith('{')))['property_id']

prop = create()
check(scalar(f"select landlord_id from public.properties where id='{prop}'") == owner, 'role-free creation binds actual caller ownership')
check(bool(create(tenant)), 'legacy tenant creates first property')
check(bool(create(landlord)), 'legacy landlord creation remains compatible')
check(scalar(f"select count(*) from public.user_roles where user_id='{owner}'") == '0', 'ownership never grants role membership')

def draft(property_id=prop, user=owner):
    r = sql(auth(f"select listing_id from public.save_listing_draft('{property_id}','Fixture listing',repeat('x',40),9000,null,'long_term',1,1,null,current_date)",user))
    return next(x for x in r.stdout.splitlines() if len(x)==36)

listing = draft()
check(bool(listing), 'role-free owned draft creation')
check('0' in sql(auth(f"select count(*) from public.listings where id='{listing}'",other)).stdout.splitlines(),'draft hidden from unrelated account')
check('0' in sql(auth(f"select count(*) from public.property_private_locations where property_id='{prop}'",other)).stdout.splitlines(),'exact private location hidden from unrelated account')
deny(auth(f"select * from public.save_listing_draft('{prop}','Other','Other',9000)",other),'42501','non-owner draft creation denied')
deny(auth(f"select public.get_owned_property_edit_context('{prop}')",other),'42501','non-owner edit context denied')
deny(auth(f"select * from public.get_owned_property_identity_statuses(array['{prop}'::uuid])",other),'42501','non-owner batch identity read denied')
deny(auth(f"select * from public.publish_listing('{listing}')"),'42501','publication without exact-property approval denied')
deny(auth(f"select * from public.publish_listing('{listing}')",other),'42501','non-owner publication denied')

revision = scalar(f"select revision_id from rentlease_property_identity.current_identity where property_id='{prop}'")
deny(auth(f"select public.begin_property_identity_verification('{prop}','{revision}')",other),'42501','non-owner Tier 3 denied')
submission = json.loads(next(x for x in sql(auth(f"select public.begin_property_identity_verification('{prop}','{revision}')")).stdout.splitlines() if x.startswith('{')))
sid = submission['id']
check(bool(sid), 'role-free owner begins revision-bound Tier 3')
deny(auth(f"insert into public.verification_submissions(user_id,property_id,tier) values('{owner}','{prop}','tier_3_property')"),'42501','direct Tier 3 bypass still denied')
path = f'{owner}/{sid}/proof.pdf'
sql(auth(f"insert into storage.objects(bucket_id,name) values('verification-documents','{path}')"))
deny(auth(f"select public.attach_property_identity_document('{sid}','land_title','{path}','Proof.pdf','application/pdf')",other),'42501','non-owner proof attachment denied')
sql(auth(f"select public.attach_property_identity_document('{sid}','land_title','{path}','Proof.pdf','application/pdf')"))
check(scalar(f"select ready_for_review_at is not null from public.verification_submissions where id='{sid}'")=='t','qualifying evidence finalizes Tier 3')
check('0' in sql(auth(f"select count(*) from storage.objects where name='{path}'",other)).stdout.splitlines(),'private proof hidden from unrelated user')
check('0' in sql(auth(f"select count(*) from public.verification_documents where submission_id='{sid}'",other)).stdout.splitlines(),'private document metadata hidden from unrelated user')
check('1' in sql(auth(f"select count(*) from storage.objects where name='{path}'",admin)).stdout.splitlines(),'Admin can inspect private proof')
deny(auth(f"insert into storage.objects(bucket_id,name) values('verification-documents','{other}/{sid}/forged.pdf')"),'42501','forged document namespace denied')
sql(auth(f"delete from storage.objects where name='{path}'"))
check(scalar(f"select count(*) from storage.objects where name='{path}'")=='1','RLS preserves finalized proof on DELETE')

def review(status, user=admin):
    context = json.loads(next(x for x in sql(auth(f"select public.get_admin_property_identity_review('{sid}')",admin)).stdout.splitlines() if x.startswith('{')))
    q = f"select public.review_property_identity_verification('{sid}','{context['submission_version']}','{context['property_version']}',null,'{status}',false,null,null)"
    return auth(q,user)

deny(review('under_review',owner),'42501','ordinary owner cannot review Tier 3')
sql(review('under_review'));sql(review('approved'))
check(scalar(f"select rentlease_property_identity.verified('{prop}')")=='t','Admin approves exact-property evidence for role-free owner')
deny(auth(f"select public.begin_property_identity_verification('{legacy}')"),'22023','historical repair exception remains excluded')
check(scalar(f"select status from public.verification_submissions where property_id='{legacy}' order by submitted_at limit 1")=='approved','historical legacy approval preserved')

version = scalar(f"select edit_version from public.listings where id='{listing}'")
sql(auth(f"select * from public.update_listing_draft('{listing}','{version}','Updated fixture',repeat('y',40),9000,null,'long_term',1,1,null,current_date)"))
check(scalar(f"select title from public.listings where id='{listing}'")=='Updated fixture','role-free versioned draft editing')
deny(auth(f"select * from public.update_listing_draft('{listing}','{version}','Stale',repeat('y',40),9000,null,'long_term',1,1,null,current_date)"),'40001','stale draft edit still rejected')
sql(auth(f"select * from public.publish_listing('{listing}')"))
check(scalar(f"select status from public.listings where id='{listing}'")=='active','role-free publication with exact approved evidence')
version = scalar(f"select edit_version from public.listings where id='{listing}'")
sql(auth(f"select * from public.update_published_listing_content('{listing}','{version}','Published update',repeat('z',40),9500,null,'long_term',1,1,null,current_date)"))
check(scalar(f"select title from public.listings where id='{listing}'")=='Published update','role-free published content edit')
deny(auth(f"select * from public.update_published_listing_content('{listing}','{version}','Forged',repeat('z',40),9500,null,'long_term',1,1,null,current_date)",other),'42501','non-owner content update denied')
deny(auth(f"select * from public.pause_listing('{listing}')",other),'42501','non-owner pause denied')
sql(auth(f"insert into public.saved_listings(tenant_id,listing_id) values('{other}','{listing}')",other))
check(scalar(f"select count(*) from public.saved_listings where tenant_id='{other}' and listing_id='{listing}'")=='1','role-free user saves listing')
deny(auth(f"insert into public.saved_listings(tenant_id,listing_id) values('{tenant}','{listing}')",other),'42501','saved listing cannot impersonate another account')
sql(auth(f"insert into public.tenant_preferences(tenant_id) values('{other}')",other))
check('1' in sql(auth(f"select count(*) from public.tenant_preferences where tenant_id='{other}'",other)).stdout.splitlines(),'role-free user writes own matching preferences')
deny(auth(f"insert into public.tenant_preferences(tenant_id) values('{tenant}')",other),'42501','matching preferences cannot impersonate another account')
sql(auth(f"select * from public.pause_listing('{listing}')"))
check(scalar(f"select status from public.listings where id='{listing}'")=='paused','role-free pause')
sql(auth(f"select * from public.reactivate_listing('{listing}')"))
check(scalar(f"select status from public.listings where id='{listing}'")=='active','existing reactivation contract preserved; no UI added')

sql(auth(f"insert into public.conversations(listing_id,tenant_id,landlord_id) values('{listing}','{other}','{owner}')",other))
check(scalar(f"select count(*) from public.conversations where listing_id='{listing}'")=='1','role-free inquiry uses listing relationship')
deny(auth(f"insert into public.conversations(listing_id,tenant_id,landlord_id) values('{listing}','{other}','{tenant}')",other),'P0001','forged listing-owner relationship denied')
deny(auth(f"insert into public.conversations(listing_id,tenant_id,landlord_id) values('{listing}','{owner}','{owner}')"),'P0001','self-inquiry denied')
check('0' in sql(auth('select count(*) from public.conversations',tenant)).stdout.splitlines(),'unrelated account cannot read conversation')
sql(auth(f"select * from public.archive_listing('{listing}')"))
check(scalar(f"select status from public.listings where id='{listing}'")=='archived','role-free archive')

# Exercise the shared owner gate after approval without altering correction logic.
context = json.loads(next(x for x in sql(auth(f"select public.get_property_identity_context('{prop}')")).stdout.splitlines() if x.startswith('{')))
sql(auth(f"select public.update_property_details('{prop}','{context['edit_version']}',gen_random_uuid(),2::smallint,1::numeric,30::numeric,2::smallint,5::smallint,'furnished',array[1]::bigint[],'Fixture entrance')"))
check(scalar(f"select rentlease_property_identity.verified('{prop}')")=='t','role-free routine edit preserves property verification')
media_version = scalar(f"select media_version from public.properties where id='{prop}'")
reservation = json.loads(next(x for x in sql(auth(f"select public.manage_property_media('{prop}','{media_version}',gen_random_uuid(),'reserve','{{\"mime\":\"image/jpeg\"}}')")).stdout.splitlines() if x.startswith('{')))
sql(f"insert into storage.objects(bucket_id,name,metadata) values('property-media','{reservation['path']}',jsonb_build_object('mimetype','image/jpeg','size',24))")
sql(auth(f"select public.manage_property_media('{prop}','{reservation['media_version']}',gen_random_uuid(),'register','{{\"photo_id\":\"{reservation['photo_id']}\"}}')"))
check(scalar(f"select count(*) from public.property_photos where property_id='{prop}'")=='1','role-free media workflow retains owner and intent guards')
check(scalar(f"select rentlease_property_identity.verified('{prop}')")=='t','media mutation preserves exact identity evidence')

unapproved = create()
unapproved_listing = draft(unapproved)
deny(auth(f"select * from public.publish_listing('{unapproved_listing}')"),'42501','approval on another owned property does not permit publication')
# An approved property still cannot publish incomplete content.
incomplete = draft(prop)
sql(f"update public.listings set description='x',available_from=null where id='{incomplete}';delete from public.property_amenities where property_id='{prop}';delete from public.property_photos where property_id='{prop}'")
deny(auth(f"select * from public.publish_listing('{incomplete}')"),'P0001','completeness gate survives exact-property approval')

for user,field,value in [(owner,'account_status',"'suspended'"),(owner,'tier1_verified_at','null')]:
    sql(f"update public.profiles set {field}={value} where id='{user}'")
    deny(auth('select count(*) from public.search_nearby_listings(14.4,120.9,3)',user),'42501',field+' fails closed for GPS')
    deny(auth("select public.create_property_setup('apartment','imus','Fixture',14.4,120.9,'Fixture',14.4,120.9)",user),'42501',field+' fails closed for creation')
    deny(auth(f"select public.begin_property_identity_verification('{unapproved}')",user),'42501',field+' fails closed for Tier 3')
    deny(auth(f"select * from public.save_listing_draft('{unapproved}','Denied','Denied',9000)",user),'42501',field+' fails closed for draft writes')
    sql(f"update public.profiles set account_status='active',tier1_verified_at=now() where id='{user}'")
deny(auth("select * from public.set_user_roles(array['admin'])"),'22023','set_user_roles cannot escalate to Admin')
deny(auth(f"insert into public.user_roles(user_id,role) values('{owner}','admin')"),'42501','direct Admin membership write denied')
deny(auth(f"update public.profiles set tier1_verified_at=now() where id='{owner}'"),'42501','profile verification timestamp write denied')
deny(auth(f"update public.profiles set trust_score=1 where id='{owner}'"),'42501','trust score write denied')
sql(auth(f"update public.profiles set experience_preference='both' where id='{owner}'"))
check(scalar(f"select experience_preference from public.profiles where id='{owner}'")=='both','own optional preference editable')
deny(auth(f"update public.profiles set experience_preference='admin' where id='{owner}'"),'23514','invalid preference rejected')
sql(auth(f"update public.profiles set experience_preference='list' where id='{other}'"))
check(scalar(f"select experience_preference is null from public.profiles where id='{other}'")=='t','preference update cannot cross owner')
check(roles_before==scalar('select md5(string_agg(user_id::text||role::text,\',\' order by user_id,role)) from public.user_roles'),'preference never changes membership')
sql(auth("select * from public.set_user_roles(array['tenant','landlord'])",admin))
check(scalar(f"select count(*) from public.user_roles where user_id='{admin}' and role='admin'")=='1','legacy role endpoint preserves Admin membership')
check(scalar("select count(*) from storage.buckets where id='verification-documents' and public=false")=='1','verification bucket stays private')
deny("begin;set local role anon;select * from public.search_nearby_listings(14.4,120.9,3);commit;",'42501','anonymous GPS execution denied')
check(protected_before==scalar(protected_sql),'protected function bodies remain unchanged after all workflows')
# Reversible migration: restore contracts, retain user data, and reapply safely.
preference_before = scalar(f"select experience_preference from public.profiles where id='{owner}'")
load('supabase/test-support/unified_account_rollback.sql')
check(scalar(f"select experience_preference from public.profiles where id='{owner}'")==preference_before,'rollback preserves preference data')
deny(auth('select count(*) from public.search_nearby_listings(14.4,120.9,3)'),'42501','rollback restores original membership gate')
check(scalar("select has_column_privilege('authenticated','public.profiles','experience_preference','UPDATE')")=='f','rollback removes new preference write grant')
load(migration.relative_to(root))
check(sql(auth('select count(*) from public.search_nearby_listings(14.4,120.9,3)')).returncode==0,'forward migration reapplies after rollback')
check(scalar(f"select experience_preference from public.profiles where id='{owner}'")==preference_before,'reapplication preserves chosen preference')
# A late source mismatch must roll back earlier rewrites in the same migration.
drift_db = 'unified_drift_' + uuid.uuid4().hex[:8]
subprocess.run(['docker','exec',a.container,'createdb','-U','postgres','-T',db,drift_db], check=True, capture_output=True)
original_base = base
try:
    base = [drift_db if v==db else v for v in base]
    load('supabase/test-support/unified_account_rollback.sql')
    sql("do $$declare d text;begin select pg_get_functiondef('public.publish_listing(uuid)'::regprocedure) into d;execute replace(d,'Owned listing required','Owned listing required (drift fixture)');end$$")
    create_before = scalar("select md5(prosrc) from pg_proc where oid='public.create_property_setup(public.property_type,public.cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,smallint)'::regprocedure")
    result = subprocess.run(base + ['-f','/tmp/'+migration.name], text=True, capture_output=True)
    check(result.returncode!=0 and 'Authorization source drift: publish_listing' in result.stderr,'unexpected source drift aborts migration')
    check(create_before==scalar("select md5(prosrc) from pg_proc where proname='create_property_setup'"),'drift failure rolls back earlier authorization rewrites')
finally:
    base = original_base
    subprocess.run(['docker','exec',a.container,'dropdb','-U','postgres',drift_db],check=True,capture_output=True)
print(f'FINAL: {checks} unified-account PostgreSQL checks passed / 0 failed', flush=True)
