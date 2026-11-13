-- ROLLBACK for 20261112164000_identity_tenancy_gate.sql. Separately authorize before running; take a fresh backup first.
-- Restores manage_property_identity, begin_property_identity_verification, establish_tenancy and get_admin_property_identity_review to their
-- previous bodies. Retains all data. Guarded: each reversal asserts the migrated text exactly once and an exactly reversible edit; owner, ACL,
-- security-definer flag, config and volatility must be unchanged; and afterward every body's md5(prosrc) must equal the pre-migration value
-- (byte-identical) or the whole transaction aborts. promote is never touched and must still equal its pinned md5.
begin;
set local lock_timeout='10s';
do $rollback$
declare
 spec record;src text;patched text;n integer;before_state jsonb;after_state jsonb;
 state constant text:='select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''owner'',pg_get_userbyid(p.proowner),''acl'',p.proacl::text[],''secdef'',p.prosecdef,''config'',p.proconfig,''volatile'',p.provolatile,''lang'',p.prolang)) from pg_proc p where p.oid in(''public.manage_property_identity(uuid,uuid,uuid,text,jsonb,uuid,uuid)''::regprocedure,''public.begin_property_identity_verification(uuid,uuid)''::regprocedure,''public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer)''::regprocedure,''public.get_admin_property_identity_review(uuid)''::regprocedure,''rentlease_property_identity.promote(uuid,uuid)''::regprocedure)';
begin
 execute state into before_state;
 for spec in select * from (values
  (1,'public.manage_property_identity(uuid,uuid,uuid,text,jsonb,uuid,uuid)','c11e5b963e27ffd7601fb161def042fe',
   $q$elsif p_action='same_property_correction' then perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));if exists(select 1 from public.tenancies where property_id=p_property_id and status in('proposed','pending_confirmation','active')) then raise exception 'Identity cannot change while a tenancy is open' using errcode='22023';end if;$q$,
   $q$elsif p_action='same_property_correction' then$q$),
  (2,'public.begin_property_identity_verification(uuid,uuid)','79d82e9403a5f04511b53b25ed8b695d',
   $q$perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));if exists(select 1 from public.tenancies where property_id=p_property_id and status in('proposed','pending_confirmation','active')) then raise exception 'Identity cannot change while a tenancy is open' using errcode='22023';end if; insert into public.verification_submissions(user_id,tier,property_id,identity_revision_id,identity_correction_id)$q$,
   $q$insert into public.verification_submissions(user_id,tier,property_id,identity_revision_id,identity_correction_id)$q$),
  (3,'public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer)','975614f0e93a64eda006f25af4b1e7b3',
   $q$select * into r from public.rental_reservations where id=p_reservation_id; perform pg_advisory_xact_lock(hashtextextended(r.property_id::text,0));if exists(select 1 from rentlease_property_identity.corrections q where q.property_id=r.property_id and (q.status='submitted' or exists(select 1 from public.verification_submissions s where s.id=q.submission_id and s.status in('pending','under_review')))) then raise exception 'Resolve the pending identity review first.' using errcode='22023';end if;$q$,
   $q$select * into r from public.rental_reservations where id=p_reservation_id;$q$),
  (4,'public.get_admin_property_identity_review(uuid)','2f59d5579001d78cb2a8b8d40003d96a',
   $q$'requires_repair',exists(select 1 from rentlease_property_identity.repairs z where z.property_id=p.id),'open_tenancy',exists(select 1 from public.tenancies t where t.property_id=p.id and t.status in('proposed','pending_confirmation','active'))) into result$q$,
   $q$'requires_repair',exists(select 1 from rentlease_property_identity.repairs z where z.property_id=p.id)) into result$q$)
 ) as t(step,sig,original_md5,migrated_text,original_text) order by step loop
  src:=pg_get_functiondef(to_regprocedure(spec.sig));
  n:=(length(src)-length(replace(src,spec.migrated_text,'')))/length(spec.migrated_text);
  if n<>1 then raise exception 'Unexpected % contract: migrated text found % times (step %); review rollback before proceeding',spec.sig,n,spec.step;end if;
  patched:=replace(src,spec.migrated_text,spec.original_text);
  if patched is null or patched=src or replace(patched,spec.original_text,spec.migrated_text)<>src then raise exception 'Unexpected % rollback result (step %)',spec.sig,spec.step;end if;
  execute patched;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure(spec.sig)) is distinct from spec.original_md5 then raise exception '% did not return to its byte-identical original body (step %)',spec.sig,spec.step;end if;
 end loop;
 execute state into after_state;
 if after_state is distinct from before_state then raise exception 'Function owner, ACL, security or configuration changed unexpectedly';end if;
 if (select md5(prosrc) from pg_proc where oid='rentlease_property_identity.promote(uuid,uuid)'::regprocedure) is distinct from 'e4de0578032cae920f8f73b3a6f20b92' then raise exception 'promote must remain unchanged';end if;
end$rollback$;
commit;
