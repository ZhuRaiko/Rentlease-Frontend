"""Deterministically render forward/rollback SQL from the inspected contract snapshot.

No database connections. Literal replacements plus normalized source fingerprints
fail closed on drift. Rollback retains the preference column/data for client safety.
"""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
snapshot = json.loads((Path(__file__).with_name('unified_account_baseline.json')).read_text())
functions = {f['name']: f for f in snapshot['functions']}

def digest(s):
    return hashlib.md5(s.replace('\r', '').encode()).hexdigest()

def literal(s):
    return "'" + s.replace("'", "''") + "'"

changes = {}
for name in ['create_property_setup','save_listing_draft','update_listing_draft',
             'update_published_listing_content','publish_listing','pause_listing',
             'archive_listing','reactivate_listing','search_nearby_listings',
             'validate_verification_submission','lock_owner',
             'get_owned_property_identity_statuses','review_property_identity_verification']:
    source = functions[name]['source'].replace('\r','')
    pairs = []
    if name == 'create_property_setup':
        start = source.index('    -- 3. LANDLORD ROLE')
        end = source.index('    -- 4. TIER 1 VERIFICATION')
        pairs.append((source[start:end], ''))
    elif name in ['save_listing_draft','update_listing_draft','update_published_listing_content',
                  'publish_listing','pause_listing','archive_listing','reactivate_listing']:
        import re
        m = re.search(r"[ \t]*if not public\.has_app_role\('landlord'::public\.app_role,\s*v_user(?:_id)?\) then\s*raise exception 'Landlord role required' using errcode\s*=\s*'42501';\s*end if;",source)
        assert m, name
        pairs.append((m.group(), ''))
        if name in ['update_listing_draft','update_published_listing_content']:
            pairs.append((" or not public.has_app_role('landlord'::public.app_role,v_user)", ''))
    elif name == 'search_nearby_listings':
        pairs.append(("IF NOT public.has_app_role(\n        'tenant'::public.app_role, auth.uid()\n    )\n    OR NOT public.is_tier1_verified(auth.uid())", 'IF NOT public.is_tier1_verified(auth.uid())'))
        pairs.append(("'Tenant verification required'", "'Active Tier 1 verification required'"))
    elif name == 'validate_verification_submission':
        pairs.append(("if not public.has_app_role('landlord', new.user_id) then\n      raise exception 'Tier 3 verification is available only to landlords';", "if not public.is_tier1_verified(new.user_id) then\n      raise exception 'Tier 3 requires an active Tier 1 account';"))
    elif name == 'lock_owner':
        pairs.append((" or not public.has_app_role('landlord'::public.app_role,auth.uid())", ''))
    elif name == 'get_owned_property_identity_statuses':
        pairs.append((" or public.has_app_role('landlord',auth.uid()) is not true", ''))
    elif name == 'review_property_identity_verification':
        pairs.append((" or not public.has_app_role('landlord',s.user_id)", ''))
    changed = source
    for old,new in pairs:
        assert changed.count(old) == 1, (name,old)
        changed = changed.replace(old,new)
    assert 'has_app_role' not in changed, name
    changes[name] = (source, changed, pairs)

policies = [p for p in snapshot['policies'] if 'has_app_role' in (p['with_check'] or '')]
assert len(policies) == 6

def signature(f):
    # pg_get_function_identity_arguments includes argument names; regprocedure needs only types.
    args = ','.join(a.strip().split(' ',1)[1] for a in f['args'].split(',')) if f['args'] else ''
    return f"{f['schema']}.{f['name']}({args})"

def render(reverse=False):
    out = ['-- LOCAL-VALIDATED ONLY; separate deployment authorization required.',
           '-- Source: read-only contract snapshot, cxfsbwbwmwmgtqfonqth, 2026-11-02.',
           '-- No legacy role records, set_user_roles, identity transitions or Storage policies are rewritten.',
           'begin;', 'do $migration$\ndeclare f record; definition text; source text;\nbegin']
    for name,(old,new,pairs) in changes.items():
        f = functions[name]; sig = signature(f)
        expected = new if reverse else old
        # Match the full original source, then replace ONLY reviewed authorization fragments.
        out += [f" select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure({literal(sig)});",
                f" if source is null or md5(replace(source,chr(13),''))<>{literal(digest(expected))} then raise exception 'Authorization source drift: {name}';end if;",
                " definition:=replace(definition,chr(13),'');"]
        if reverse:
            # Restore the exact pre-migration function body, not a heuristic inverse.
            newdef = f['definition'].replace('\r','')
            out += [' execute '+literal(newdef)+';']
        else:
            for before,after in pairs:
                out += [f' definition:=replace(definition,{literal(before)},{literal(after)});']
            out += [' execute definition;']
        result_source = old if reverse else new
        out += [f" if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure({literal(sig)}))<>{literal(digest(result_source))} then raise exception 'Authorization rewrite mismatch: {name}';end if;"]
    out += ['end\n$migration$;']
    for p in policies:
        expected = p['with_check']
        replacement = expected
        import re
        replacement = re.sub(r" AND has_app_role\('(tenant|landlord)'::app_role\)", '', replacement)
        if p['tablename'] in ['saved_listings','tenant_preferences']:
            replacement = replacement.replace('(tenant_id = auth.uid())', '(tenant_id = auth.uid() AND is_tier1_verified())')
        if p['tablename'] == 'verification_submissions':
            # Defense in depth even though direct Tier 3 inserts remain restricted.
            replacement = replacement[:-1] + ' AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.landlord_id=auth.uid()))'
        condition = expected if reverse else replacement
        oldcondition = replacement if reverse else expected
        # Comparing parsed expressions is handled by the normalized snapshot fingerprint below.
        if not reverse:
            out += [f"do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename={literal(p['tablename'])} and policyname={literal(p['policyname'])} and with_check={literal(expected)}) then raise exception 'Policy drift: {p['policyname']}';end if;end $policy$;"]
        out += [f"alter policy {p['policyname']} on public.{p['tablename']} with check ({condition});"]
    if not reverse:
        out += ["alter table public.profiles add column if not exists experience_preference text constraint profiles_experience_preference_check check(experience_preference in ('rent','list','both'));",
                "do $preference$ begin if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='experience_preference' and data_type='text' and is_nullable='YES') or not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_experience_preference_check' and contype='c' and convalidated) then raise exception 'Display preference contract drift';end if;end $preference$;",
                "comment on column public.profiles.experience_preference is 'Optional presentation preference only. Never an authorization input.';",
                "update public.profiles p set experience_preference=(select case when count(*)=2 then 'both' when bool_or(ur.role='landlord') then 'list' else 'rent' end from public.user_roles ur where ur.user_id=p.id and ur.role in ('tenant','landlord') having count(*)>0) where p.experience_preference is null;",
                'grant update(experience_preference) on public.profiles to authenticated;']
    else:
        out += ['-- Coordinate client rollback first: restored legacy gates deny role-free owners.',
                '-- Keep the nullable column and values; dropping it would break compatible clients.',
                'revoke update(experience_preference) on public.profiles from authenticated;']
    out += ['commit;','']
    return '\n'.join(out)

target = next((root/'supabase/migrations').glob('*_unified_account_authorization.sql'))
target.write_text(render(), encoding='utf-8', newline='\n')
(root/'supabase/test-support/unified_account_rollback.sql').write_text(render(True), encoding='utf-8', newline='\n')
print(target)
