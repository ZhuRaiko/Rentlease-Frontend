-- PREPARED LOCAL ONLY. Feature 5: close the nine non-trigger functions in public that anonymous users can call. Not applied.
-- The grant is to PUBLIC (acl "=X/postgres"), so "revoke from anon" would change nothing; this revokes from PUBLIC and re-grants exactly what is needed.
-- Audit (hosted, read-only, 2026-11-16): every ACL has only PUBLIC, authenticated and postgres as grantees; every RLS policy that calls them is TO authenticated; anon has no SELECT on any
-- public table or view; no view, default, constraint, index, event trigger or cron/pg_net job depends on them; the only callers outside public are definer functions in rentlease_* schemas
-- (they run as postgres); invoker callers are search_nearby_listings (authenticated, which keeps its explicit grant) and set_property_cover_photo (no client grant); the only Edge Function
-- use is estimate-rental-price calling rpc("is_admin") with the user's JWT (authenticated); no built-in role (supabase_auth_admin, storage, auth hooks) is a grantee or a caller.
-- Result: authenticated keeps EXECUTE (its explicit grant is repeated), service_role gets EXECUTE (nothing uses it today; it is the conventional server-side role), PUBLIC and anon lose it.
-- Trigger functions and default privileges are not touched. Rollback: supabase/test-support/revoke_public_execute_rollback.sql (one grant to PUBLIC).
begin;
set local lock_timeout='10s';

do $guard$
declare f text;got text;n int;
begin
 for f,got in select * from (values
  ('public.can_access_conversation(uuid,uuid)','918e0e98871c2f10ac04a9348500e18b'),('public.can_access_tenancy(uuid,uuid)','1965f59a0c719a0c3bcfe6445632a818'),
  ('public.can_manage_property(uuid,uuid)','be4b5c71eadaa342130552e68fe5d408'),('public.can_view_property(uuid,uuid)','ac5db762b32191446827e83478ae2829'),
  ('public.has_app_role(app_role,uuid)','355cf83d72dfa40bb5f7cb3fdc1b38ca'),('public.is_admin(uuid)','325d23bcbdd5ef807e1d4161aecedb12'),
  ('public.is_tier1_verified(uuid)','ddd2c8ed28b61e30e23e4f3ddefe4590'),('public.refresh_my_tier1_verification()','76ac23b952f93547cc62da5b96f0467d'),
  ('public.update_my_profile(text,text,text)','676ab99211a46a1d8a6c727c23b3a9ed')) v(a,b)
 loop
  if to_regprocedure(f) is null then raise exception 'Function missing: %',f;end if;
  if md5((select prosrc from pg_proc where oid=to_regprocedure(f))) is distinct from got then raise exception 'Function drifted: %',f;end if;
  -- ACL exactly PUBLIC, authenticated and the owner, all plain EXECUTE.
  select string_agg(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end||':'||a.privilege_type||':'||a.is_grantable::text,',' order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end) into got
   from pg_proc p cross join lateral aclexplode(p.proacl) a where p.oid=to_regprocedure(f);
  if got is distinct from 'PUBLIC:EXECUTE:false,authenticated:EXECUTE:false,postgres:EXECUTE:false' then raise exception 'ACL drifted for %: %',f,got;end if;
 end loop;
 -- The set of anon-callable non-trigger functions in public is exactly these nine.
 select string_agg(p.proname,',' order by p.proname) into got from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f' and p.prorettype<>'trigger'::regtype and has_function_privilege('anon',p.oid,'EXECUTE');
 if got is distinct from 'can_access_conversation,can_access_tenancy,can_manage_property,can_view_property,has_app_role,is_admin,is_tier1_verified,refresh_my_tier1_verification,update_my_profile' then raise exception 'The anon-callable set drifted: %',got;end if;
 -- No policy for anon or PUBLIC (or a view, rule, default, constraint or trigger) depends on them.
 select count(*) into n from pg_depend d join pg_policy pol on d.classid='pg_policy'::regclass and pol.oid=d.objid
  where d.refobjid in(to_regprocedure('public.can_access_conversation(uuid,uuid)'),to_regprocedure('public.can_access_tenancy(uuid,uuid)'),to_regprocedure('public.can_manage_property(uuid,uuid)'),to_regprocedure('public.can_view_property(uuid,uuid)'),
   to_regprocedure('public.has_app_role(app_role,uuid)'),to_regprocedure('public.is_admin(uuid)'),to_regprocedure('public.is_tier1_verified(uuid)'),to_regprocedure('public.refresh_my_tier1_verification()'),to_regprocedure('public.update_my_profile(text,text,text)'))
   and exists(select 1 from unnest(pol.polroles) r where r=0 or pg_get_userbyid(r)='anon');
 if n<>0 then raise exception 'A policy for anon or PUBLIC calls one of the functions (%)',n;end if;
 select count(*) into n from pg_depend d where d.deptype='n' and d.classid<>'pg_policy'::regclass
  and d.refobjid in(to_regprocedure('public.can_access_conversation(uuid,uuid)'),to_regprocedure('public.can_access_tenancy(uuid,uuid)'),to_regprocedure('public.can_manage_property(uuid,uuid)'),to_regprocedure('public.can_view_property(uuid,uuid)'),
   to_regprocedure('public.has_app_role(app_role,uuid)'),to_regprocedure('public.is_admin(uuid)'),to_regprocedure('public.is_tier1_verified(uuid)'),to_regprocedure('public.refresh_my_tier1_verification()'),to_regprocedure('public.update_my_profile(text,text,text)'));
 if n<>0 then raise exception 'A view, default, constraint or trigger depends on one of the functions (%)',n;end if;
 if exists(select 1 from pg_class c where c.relnamespace in('public'::regnamespace) and c.relkind in('r','p','v','m') and has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')) then raise exception 'anon has a table privilege in public';end if;
end$guard$;

revoke execute on function public.can_access_conversation(uuid,uuid),public.can_access_tenancy(uuid,uuid),public.can_manage_property(uuid,uuid),public.can_view_property(uuid,uuid),public.has_app_role(app_role,uuid),
 public.is_admin(uuid),public.is_tier1_verified(uuid),public.refresh_my_tier1_verification(),public.update_my_profile(text,text,text) from public;
revoke execute on function public.can_access_conversation(uuid,uuid),public.can_access_tenancy(uuid,uuid),public.can_manage_property(uuid,uuid),public.can_view_property(uuid,uuid),public.has_app_role(app_role,uuid),
 public.is_admin(uuid),public.is_tier1_verified(uuid),public.refresh_my_tier1_verification(),public.update_my_profile(text,text,text) from anon;
grant execute on function public.can_access_conversation(uuid,uuid),public.can_access_tenancy(uuid,uuid),public.can_manage_property(uuid,uuid),public.can_view_property(uuid,uuid),public.has_app_role(app_role,uuid),
 public.is_admin(uuid),public.is_tier1_verified(uuid),public.refresh_my_tier1_verification(),public.update_my_profile(text,text,text) to authenticated,service_role;

do $post$
declare p record;got text;
begin
 for p in select pr.oid,pr.oid::regprocedure::text as sig from pg_proc pr where pr.oid in(to_regprocedure('public.can_access_conversation(uuid,uuid)'),to_regprocedure('public.can_access_tenancy(uuid,uuid)'),to_regprocedure('public.can_manage_property(uuid,uuid)'),
   to_regprocedure('public.can_view_property(uuid,uuid)'),to_regprocedure('public.has_app_role(app_role,uuid)'),to_regprocedure('public.is_admin(uuid)'),to_regprocedure('public.is_tier1_verified(uuid)'),to_regprocedure('public.refresh_my_tier1_verification()'),to_regprocedure('public.update_my_profile(text,text,text)'))
 loop
  select string_agg(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,',' order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end) into got from pg_proc x cross join lateral aclexplode(x.proacl) a where x.oid=p.oid;
  if got is distinct from 'authenticated,postgres,service_role' then raise exception 'Grants are wrong for %: %',p.sig,got;end if;
  if has_function_privilege('anon',p.oid,'EXECUTE') or not has_function_privilege('authenticated',p.oid,'EXECUTE') then raise exception 'Effective access is wrong for %',p.sig;end if;
 end loop;
 select string_agg(pr.proname,',' order by pr.proname) into got from pg_proc pr where pr.pronamespace='public'::regnamespace and pr.prokind='f' and pr.prorettype<>'trigger'::regtype and has_function_privilege('anon',pr.oid,'EXECUTE');
 if got is not null then raise exception 'Anon can still call: %',got;end if;
 if (select count(*) from pg_proc pr where pr.pronamespace='public'::regnamespace and pr.prokind='f' and pr.prorettype='trigger'::regtype and has_function_privilege('anon',pr.oid,'EXECUTE'))<>18 then raise exception 'Trigger function privileges changed';end if;
end$post$;
commit;
