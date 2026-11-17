-- PREPARED LOCAL ONLY. NOT APPLIED. Adds one key, 'id_verified', to every object public.get_public_identities returns.
-- Why: the Messages list needs to know, for the people it already looks up in one batch call, whether each has an approved Tier 2 identity,
-- without one get_public_profile call per row. 'id_verified' is rentlease_profiles.id_verified(p.id): active account, Tier 1 verified, exactly one
-- approved Tier 2 submission that matches tier2_verified_at. It is a boolean and never NULL. Nothing else changes: same signature, same checks and
-- errors, same filter (public.can_read_public_identity), same keys (id, nickname, avatar_path), security definer, STABLE, search_path ''.
-- rentlease_profiles.id_verified has no client EXECUTE and is not changed or granted; it is called from this security definer function only.
-- Apply this file with LF line endings. The fingerprint after applying is md5 78cf58cd42aa0df1611bd21f9dfa6d72 with CRs removed
-- (d6bf98e7cee0620a1caa1c1879a48bfb if the file is applied with CRLF line endings, so compare with chr(13) removed).
-- Rollback: supabase/test-support/public_identity_id_verified_rollback.sql (restores the exact previous body; no data is touched).
-- Checks:   supabase/test-support/public_identity_id_verified_checks.sql (ends in a deliberate exception; nothing can commit).
begin;
set local lock_timeout='10s';

-- Baseline guard: stop unless the live objects are exactly what this change was written against.
do $guard$
begin
 if to_regprocedure('public.get_public_identities(uuid[])') is null or to_regprocedure('rentlease_profiles.id_verified(uuid)') is null or to_regprocedure('public.can_read_public_identity(uuid)') is null then raise exception 'Required functions missing';end if;
 -- The hosted body has no CR characters; CRs are removed before comparing so an application from a CRLF file cannot trip the guard.
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])')),chr(13),'')) is distinct from 'ef1a0176b11b9fe926b121fe4a79d8b3' then raise exception 'get_public_identities is not the expected previous body';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_profiles.id_verified(uuid)')),chr(13),'')) is distinct from 'a201389104dcd2ec35e3f97d7f667c91' then raise exception 'rentlease_profiles.id_verified drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.can_read_public_identity(uuid)'))) is distinct from 'ce7a49ff8184972232e5d000cb2135cc' then raise exception 'can_read_public_identity drifted';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])') and prosecdef and provolatile='s' and proconfig=array['search_path=""']::text[] and prorettype='jsonb'::regtype) then raise exception 'get_public_identities attributes drifted';end if;
 if (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='get_public_identities')<>1 then raise exception 'Unexpected get_public_identities overload';end if;
 if not has_function_privilege('authenticated','public.get_public_identities(uuid[])','EXECUTE') or has_function_privilege('anon','public.get_public_identities(uuid[])','EXECUTE') or has_function_privilege('service_role','public.get_public_identities(uuid[])','EXECUTE')
  or exists(select 1 from pg_proc p,aclexplode(p.proacl) a where p.oid=to_regprocedure('public.get_public_identities(uuid[])') and a.grantee=0) then raise exception 'get_public_identities grants drifted';end if;
 -- id_verified has no client EXECUTE; it is reachable only from the security definer function (owner postgres).
 if has_function_privilege('authenticated','rentlease_profiles.id_verified(uuid)','EXECUTE') or has_function_privilege('anon','rentlease_profiles.id_verified(uuid)','EXECUTE') or has_function_privilege('service_role','rentlease_profiles.id_verified(uuid)','EXECUTE') then raise exception 'id_verified must not be executable by a client role';end if;
end$guard$;
create or replace function public.get_public_identities(p_user_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'Active account required' using errcode='42501';end if;
 if p_user_ids is null or cardinality(p_user_ids)<1 or cardinality(p_user_ids)>50 or array_position(p_user_ids,null) is not null then raise exception 'Invalid identity batch' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',case when p.public_nickname_confirmed_at is not null then p.public_nickname end,
 'avatar_path',case when p.avatar_public_confirmed_at is not null and p.avatar_path ~ ('^'||p.id::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then p.avatar_path end,
 'id_verified',coalesce(rentlease_profiles.id_verified(p.id),false))),'[]') into result from public.profiles p where p.id=any(p_user_ids) and public.can_read_public_identity(p.id);
 return result;
end $$;

-- Grants are asserted again: authenticated only. PUBLIC, anon and service_role have no execute.
revoke all on function public.get_public_identities(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_public_identities(uuid[]) to authenticated;
do $post$
begin
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])')),chr(13),'')) is distinct from '78cf58cd42aa0df1611bd21f9dfa6d72' then raise exception 'get_public_identities body is not the expected body';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])') and prosecdef and provolatile='s' and proconfig=array['search_path=""']::text[] and prorettype='jsonb'::regtype) then raise exception 'get_public_identities attributes changed';end if;
 if not has_function_privilege('authenticated','public.get_public_identities(uuid[])','EXECUTE') or has_function_privilege('anon','public.get_public_identities(uuid[])','EXECUTE') or has_function_privilege('service_role','public.get_public_identities(uuid[])','EXECUTE')
  or exists(select 1 from pg_proc p,aclexplode(p.proacl) a where p.oid=to_regprocedure('public.get_public_identities(uuid[])') and a.grantee=0) then raise exception 'get_public_identities grants wrong';end if;
 if has_function_privilege('authenticated','rentlease_profiles.id_verified(uuid)','EXECUTE') then raise exception 'id_verified became executable by authenticated';end if;
end$post$;
commit;
