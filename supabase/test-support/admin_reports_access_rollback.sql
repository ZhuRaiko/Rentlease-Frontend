-- ROLLBACK for 20261112155016_admin_reports_access.sql. Separately authorize before running; take a fresh backup first.
-- Restores the three reporting functions to their previous Tier 1 + Admin checks and drops public.is_active_admin.
-- Retains reports, cases, events, receipts and RLS. Guarded: each reversal asserts the migrated text exactly once and that the edit is exactly
-- reversible; owner, ACL, security-definer flag, config and volatility must be unchanged; is_active_admin is dropped only if nothing else uses it.
-- After running, md5(prosrc) of the three functions must equal the pre-migration values recorded in the predeploy backup catalog.
begin;
set local lock_timeout='10s';
do $rollback$
declare
 spec record;src text;patched text;n integer;before_state jsonb;after_state jsonb;
 state constant text:='select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''owner'',pg_get_userbyid(p.proowner),''acl'',p.proacl::text[],''secdef'',p.prosecdef,''config'',p.proconfig,''volatile'',p.provolatile,''lang'',p.prolang)) from pg_proc p where p.oid in(''public.get_rental_report(uuid,boolean)''::regprocedure,''public.get_rental_reports(boolean,text,text,integer)''::regprocedure,''public.moderate_rental_report(uuid,uuid,uuid,text,text,text)''::regprocedure)';
begin
 if to_regprocedure('public.is_active_admin(uuid)') is null then raise exception 'public.is_active_admin is missing; migration not applied or already rolled back';end if;
 execute state into before_state;
 for spec in select * from (values
  (1,'public.get_rental_report(uuid,boolean)',
   $q$if a is null or p_admin is null or (case when p_admin then public.is_active_admin(a) else public.is_tier1_verified(a) end) is not true then raise exception 'Access unavailable' using errcode='42501';end if;$q$,
   $q$if a is null or public.is_tier1_verified(a) is not true or p_admin is null then raise exception 'Access unavailable' using errcode='42501';end if;$q$),
  (2,'public.get_rental_report(uuid,boolean)',
   $q$(case when p_admin then public.is_active_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) else r.reporter_id<>a end)$q$,
   $q$(case when p_admin then public.is_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) else r.reporter_id<>a end)$q$),
  (3,'public.get_rental_reports(boolean,text,text,integer)',
   $q$if a is null or p_admin is null or (case when p_admin then public.is_active_admin(a) else public.is_tier1_verified(a) end) is not true then raise exception 'Access unavailable' using errcode='42501';end if;$q$,
   $q$if a is null or public.is_tier1_verified(a) is not true or p_admin is null or (p_admin and public.is_admin(a) is not true) then raise exception 'Access unavailable' using errcode='42501';end if;$q$),
  (4,'public.moderate_rental_report(uuid,uuid,uuid,text,text,text)',
   $q$if a is null or public.is_active_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) then raise exception 'Access unavailable' using errcode='42501';end if;$q$,
   $q$if a is null or public.is_tier1_verified(a) is not true or public.is_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) then raise exception 'Access unavailable' using errcode='42501';end if;$q$)
 ) as t(step,sig,migrated_text,original_text) order by step loop
  src:=pg_get_functiondef(to_regprocedure(spec.sig));
  n:=(length(src)-length(replace(src,spec.migrated_text,'')))/length(spec.migrated_text);
  if n<>1 then raise exception 'Unexpected % contract: migrated Admin check found % times (step %); review rollback before proceeding',spec.sig,n,spec.step;end if;
  patched:=replace(src,spec.migrated_text,spec.original_text);
  if patched is null or patched=src or replace(patched,spec.original_text,spec.migrated_text)<>src then raise exception 'Unexpected % rollback result (step %)',spec.sig,spec.step;end if;
  execute patched;
 end loop;
 execute state into after_state;
 if after_state is distinct from before_state then raise exception 'Function owner, ACL, security or configuration changed unexpectedly';end if;
 if exists(select 1 from pg_proc where prosrc like '%is_active_admin%' and oid<>'public.is_active_admin(uuid)'::regprocedure) then raise exception 'public.is_active_admin is still referenced; not dropping';end if;
 drop function public.is_active_admin(uuid);
end$rollback$;
commit;
