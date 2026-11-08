-- PREPARED ONLY. Preserve sanitized projection, ACLs, RPCs and profiles RLS.
begin;
do $guard$ begin
 if (select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class where oid='public.public_profiles'::regclass)<>'postgres'
 or (select reloptions from pg_catalog.pg_class where oid='public.public_profiles'::regclass) is not null
 or replace(pg_catalog.pg_get_viewdef('public.public_profiles'::regclass,true),chr(13),'')<>replace($view$ SELECT id,
        CASE
            WHEN public_nickname_confirmed_at IS NOT NULL THEN public_nickname
            ELSE NULL::text
        END AS display_name,
        CASE
            WHEN avatar_public_confirmed_at IS NOT NULL AND avatar_path ~ (('^'::text || id::text) || '/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$'::text) THEN avatar_path
            ELSE NULL::text
        END AS avatar_path,
    NULL::text AS bio,
    account_status,
    NULL::numeric(3,2) AS trust_score,
    NULL::text AS trust_badge,
    NULL::timestamp with time zone AS created_at
   FROM profiles p
  WHERE can_read_public_identity(id);$view$,chr(13),'')
 or not (select relrowsecurity from pg_catalog.pg_class where oid='public.profiles'::regclass)
 or not pg_catalog.has_table_privilege('authenticated','public.profiles','SELECT')
 or pg_catalog.has_table_privilege('anon','public.public_profiles','SELECT')
 then raise exception 'Public profile view baseline drift';end if;
end $guard$;
alter view public.public_profiles set (security_invoker=true);
commit;
