-- LOCAL ONLY. NOT APPLIED. Prepared 2026-11-12 for review; do not apply without explicit authorization, a fresh predeploy backup and live-source reconfirmation.
--
-- Why: get_rental_report, get_rental_reports and moderate_rental_report require public.is_tier1_verified(caller) for EVERY caller, so an Admin
-- who is not Tier 1 verified is denied with 'Access unavailable' (observed live: the only Admin account is not Tier 1 verified).
--
-- What changes (and only this):
--   1. New public.is_active_admin(uuid): admin role AND profiles.account_status = 'active'. Not executable by clients; only the security-definer
--      reporting functions (owned by postgres) call it.
--   2. In the three functions, the ADMIN-branch caller check (is_tier1_verified AND is_admin) becomes is_active_admin. The non-admin branch still
--      requires is_tier1_verified. Unchanged: rentlease_reporting.conflicted guard, revision/versioning, operation receipts, transition rules,
--      security definer, search_path, owners and grants.
-- Guards: every patch asserts the expected live source exactly once and a pinned md5(prosrc), proves the edit is exactly reversible, and the
-- function's owner, ACL, security-definer flag, config and volatility must be identical afterward. Any drift raises and the transaction rolls back.
-- Rollback: supabase/test-support/admin_reports_access_rollback.sql.
begin;
set local lock_timeout='10s';

do $migration$
begin
 if to_regprocedure('public.is_active_admin(uuid)') is not null then raise exception 'public.is_active_admin already exists; review migration before proceeding';end if;
 if to_regprocedure('public.is_admin(uuid)') is null or to_regprocedure('public.is_tier1_verified(uuid)') is null then raise exception 'Expected role helpers are missing';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.profiles'::regclass and attname='account_status' and not attisdropped) then raise exception 'profiles.account_status is missing';end if;
 if to_regprocedure('rentlease_reporting.conflicted(uuid,uuid)') is null then raise exception 'Reporting conflict guard is missing';end if;
end$migration$;

create function public.is_active_admin(requested_user uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(requested_user is not null and public.is_admin(requested_user) is true and exists(select 1 from public.profiles p where p.id=requested_user and p.account_status='active'),false)
$$;
alter function public.is_active_admin(uuid) owner to postgres;
revoke all on function public.is_active_admin(uuid) from public,anon,authenticated,service_role;

do $migration$
declare
 spec record;src text;patched text;n integer;
 before_state jsonb;after_state jsonb;
 state constant text:='select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''owner'',pg_get_userbyid(p.proowner),''acl'',p.proacl::text[],''secdef'',p.prosecdef,''config'',p.proconfig,''volatile'',p.provolatile,''lang'',p.prolang)) from pg_proc p where p.oid in(''public.get_rental_report(uuid,boolean)''::regprocedure,''public.get_rental_reports(boolean,text,text,integer)''::regprocedure,''public.moderate_rental_report(uuid,uuid,uuid,text,text,text)''::regprocedure)';
begin
 execute state into before_state;
 for spec in select * from (values
  (1,'public.get_rental_report(uuid,boolean)','76e7d8f0bbb47ab3684a478fa25b42db',
   $q$if a is null or public.is_tier1_verified(a) is not true or p_admin is null then raise exception 'Access unavailable' using errcode='42501';end if;$q$,
   $q$if a is null or p_admin is null or (case when p_admin then public.is_active_admin(a) else public.is_tier1_verified(a) end) is not true then raise exception 'Access unavailable' using errcode='42501';end if;$q$),
  (2,'public.get_rental_report(uuid,boolean)','76e7d8f0bbb47ab3684a478fa25b42db',
   $q$(case when p_admin then public.is_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) else r.reporter_id<>a end)$q$,
   $q$(case when p_admin then public.is_active_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) else r.reporter_id<>a end)$q$),
  (3,'public.get_rental_reports(boolean,text,text,integer)','f79706e08df8c04ba17e0f78a35ce783',
   $q$if a is null or public.is_tier1_verified(a) is not true or p_admin is null or (p_admin and public.is_admin(a) is not true) then raise exception 'Access unavailable' using errcode='42501';end if;$q$,
   $q$if a is null or p_admin is null or (case when p_admin then public.is_active_admin(a) else public.is_tier1_verified(a) end) is not true then raise exception 'Access unavailable' using errcode='42501';end if;$q$),
  (4,'public.moderate_rental_report(uuid,uuid,uuid,text,text,text)','a23ae4fdb5b4b4b3fe9522864ff26bcd',
   $q$if a is null or public.is_tier1_verified(a) is not true or public.is_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) then raise exception 'Access unavailable' using errcode='42501';end if;$q$,
   $q$if a is null or public.is_active_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) then raise exception 'Access unavailable' using errcode='42501';end if;$q$)
 ) as t(step,sig,base_md5,old_text,new_text) order by step loop
  if to_regprocedure(spec.sig) is null then raise exception 'Unexpected contract: % is missing',spec.sig;end if;
  -- The md5 pin applies to the untouched function; step 2 follows step 1 on the same function, so only the first step per function is pinned.
  if spec.step in(1,3,4) and (select md5(prosrc) from pg_proc where oid=to_regprocedure(spec.sig)) is distinct from spec.base_md5 then raise exception 'Unexpected % contract: source differs from the reviewed definition; review migration before proceeding',spec.sig;end if;
  src:=pg_get_functiondef(to_regprocedure(spec.sig));
  n:=(length(src)-length(replace(src,spec.old_text,'')))/length(spec.old_text);
  if n<>1 then raise exception 'Unexpected % contract: expected Admin check found % times (step %); review migration before proceeding',spec.sig,n,spec.step;end if;
  patched:=replace(src,spec.old_text,spec.new_text);
  if patched is null or patched=src or replace(patched,spec.new_text,spec.old_text)<>src then raise exception 'Unexpected % patch result (step %)',spec.sig,spec.step;end if;
  execute patched;
  if position(spec.new_text in pg_get_functiondef(to_regprocedure(spec.sig)))=0 then raise exception 'Patch for % (step %) did not apply',spec.sig,spec.step;end if;
 end loop;
 execute state into after_state;
 if after_state is distinct from before_state then raise exception 'Function owner, ACL, security or configuration changed unexpectedly';end if;
end$migration$;

do $migration$
begin
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.is_active_admin(uuid)'::regprocedure and a.grantee<>p.proowner) then raise exception 'is_active_admin must not be executable by clients';end if;
 if public.is_active_admin(null) is not false or public.is_active_admin('00000000-0000-0000-0000-000000000000') is not false then raise exception 'is_active_admin must deny unknown callers';end if;
 if not (select every(prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig=array['search_path=pg_catalog']) from pg_proc where oid in('public.is_active_admin(uuid)'::regprocedure,'public.get_rental_report(uuid,boolean)'::regprocedure,'public.get_rental_reports(boolean,text,text,integer)'::regprocedure,'public.moderate_rental_report(uuid,uuid,uuid,text,text,text)'::regprocedure)) then raise exception 'Unexpected security configuration';end if;
end$migration$;
commit;
