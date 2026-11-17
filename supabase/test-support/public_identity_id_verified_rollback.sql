-- Rollback for 20261118100000_public_identity_id_verified.sql. Restores the exact previous body of public.get_public_identities (md5 ef1a0176b11b9fe926b121fe4a79d8b3).
-- Data-retaining: no table, column or row is touched; only that one function body is replaced. The frontend treats 'id_verified' as optional, so it
-- keeps working with the old response. Apply with LF line endings (CRs are ignored by the fingerprint comparison either way).
begin;
set local lock_timeout='10s';
do $guard$
begin
 if to_regprocedure('public.get_public_identities(uuid[])') is null then raise exception 'get_public_identities is missing';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])')),chr(13),'')) is distinct from '78cf58cd42aa0df1611bd21f9dfa6d72' then raise exception 'get_public_identities is not the body this rollback expects (already rolled back or changed)';end if;
end$guard$;
create or replace function public.get_public_identities(p_user_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'Active account required' using errcode='42501';end if;
 if p_user_ids is null or cardinality(p_user_ids)<1 or cardinality(p_user_ids)>50 or array_position(p_user_ids,null) is not null then raise exception 'Invalid identity batch' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',case when p.public_nickname_confirmed_at is not null then p.public_nickname end,
 'avatar_path',case when p.avatar_public_confirmed_at is not null and p.avatar_path ~ ('^'||p.id::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then p.avatar_path end)),'[]') into result from public.profiles p where p.id=any(p_user_ids) and public.can_read_public_identity(p.id);
 return result;
end $$;
revoke all on function public.get_public_identities(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_public_identities(uuid[]) to authenticated;
do $post$
begin
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])')),chr(13),'')) is distinct from 'ef1a0176b11b9fe926b121fe4a79d8b3' then raise exception 'previous body was not restored exactly';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])') and prosecdef and provolatile='s' and proconfig=array['search_path=""']::text[] and prorettype='jsonb'::regtype) then raise exception 'get_public_identities attributes changed';end if;
 if not has_function_privilege('authenticated','public.get_public_identities(uuid[])','EXECUTE') or has_function_privilege('anon','public.get_public_identities(uuid[])','EXECUTE') or has_function_privilege('service_role','public.get_public_identities(uuid[])','EXECUTE')
  or exists(select 1 from pg_proc p,aclexplode(p.proacl) a where p.oid=to_regprocedure('public.get_public_identities(uuid[])') and a.grantee=0) then raise exception 'get_public_identities grants wrong';end if;
 if has_function_privilege('authenticated','rentlease_profiles.id_verified(uuid)','EXECUTE') then raise exception 'id_verified became executable by authenticated';end if;
end$post$;
do $idv$
begin
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_profiles.id_verified(uuid)')),chr(13),'')) is distinct from 'a201389104dcd2ec35e3f97d7f667c91' then raise exception 'id_verified changed';end if;
end$idv$;
commit;
