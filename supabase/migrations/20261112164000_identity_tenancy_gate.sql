-- LOCAL ONLY. NOT APPLIED. Prepared 2026-11-12 for review; do not apply without explicit authorization, a backup retaken immediately before
-- applying (tenancy rows change constantly) and live-source reconfirmation. Apply directly (db query --linked -f), then
-- `migration repair --status applied 20261112164000`; never db push (see the HOSTED_MIGRATION ledger entry on known history drift).
--
-- Enforces "no identity change while a tenancy is open" on the server, in both directions. Open tenancy = status in
-- ('proposed','pending_confirmation','active'), the same definition rentlease_property_identity.promote uses (promote is left UNCHANGED).
--   1. Submission gate: manage_property_identity (only the 'same_property_correction' action, which starts a correction) and
--      begin_property_identity_verification (only before it would create a NEW submission) raise 22023 when the property has an open tenancy.
--      Reading, an exact retry that returns an existing submission, and withdrawing/cancelling a correction stay allowed.
--   2. Reverse gate: establish_tenancy refuses to propose a tenancy while a correction for the property is submitted, under review, or has
--      begun verification (its verification submission is pending or under review). 'Begun' is included on purpose: a correction becomes
--      'submitted' only when evidence is finalized, so without it a proposal could slip between begin and finalize and the two gates
--      could not be mutually exclusive.
--   3. Additive: get_admin_property_identity_review also returns open_tenancy (boolean). Existing keys are untouched.
-- Locking: every new check first takes pg_advisory_xact_lock(hashtextextended(<property_id>::text,0)), the lock the existing identity,
-- reservation and tenancy guards use (see request_rental_reservation), before evaluating its condition. See the lock-order note in
-- supabase/test-support/IDENTITY_TENANCY_GATE.md.
-- Guards: each patch asserts the pinned md5(prosrc) of the untouched function, the expected text exactly once, an exactly reversible edit,
-- and unchanged owner/ACL/security-definer/search_path/volatility; promote must be unchanged. Any drift raises and the transaction aborts.
-- Rollback: supabase/test-support/identity_tenancy_gate_rollback.sql (restores byte-identical bodies).
begin;
set local lock_timeout='10s';

do $migration$
begin
 if to_regprocedure('rentlease_property_edit.lock_owner(uuid)') is null or to_regprocedure('rentlease_tenancy_setup.context(uuid)') is null or to_regprocedure('rentlease_property_identity.promote(uuid,uuid)') is null then raise exception 'Expected identity/tenancy helpers are missing';end if;
 if to_regclass('rentlease_property_identity.corrections') is null or to_regclass('public.verification_submissions') is null or to_regclass('public.tenancies') is null then raise exception 'Expected identity/tenancy tables are missing';end if;
 if (select md5(prosrc) from pg_proc where oid='rentlease_property_identity.promote(uuid,uuid)'::regprocedure) is distinct from 'e4de0578032cae920f8f73b3a6f20b92' then raise exception 'Unexpected promote contract: source differs from the reviewed definition; review migration before proceeding';end if;
end$migration$;

do $migration$
declare
 spec record;src text;patched text;n integer;before_state jsonb;after_state jsonb;
 state constant text:='select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''owner'',pg_get_userbyid(p.proowner),''acl'',p.proacl::text[],''secdef'',p.prosecdef,''config'',p.proconfig,''volatile'',p.provolatile,''lang'',p.prolang)) from pg_proc p where p.oid in(''public.manage_property_identity(uuid,uuid,uuid,text,jsonb,uuid,uuid)''::regprocedure,''public.begin_property_identity_verification(uuid,uuid)''::regprocedure,''public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer)''::regprocedure,''public.get_admin_property_identity_review(uuid)''::regprocedure,''rentlease_property_identity.promote(uuid,uuid)''::regprocedure)';
begin
 execute state into before_state;
 for spec in select * from (values
  (1,'public.manage_property_identity(uuid,uuid,uuid,text,jsonb,uuid,uuid)','c11e5b963e27ffd7601fb161def042fe',
   $q$elsif p_action='same_property_correction' then$q$,
   $q$elsif p_action='same_property_correction' then perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));if exists(select 1 from public.tenancies where property_id=p_property_id and status in('proposed','pending_confirmation','active')) then raise exception 'Identity cannot change while a tenancy is open' using errcode='22023';end if;$q$),
  (2,'public.begin_property_identity_verification(uuid,uuid)','79d82e9403a5f04511b53b25ed8b695d',
   $q$insert into public.verification_submissions(user_id,tier,property_id,identity_revision_id,identity_correction_id)$q$,
   $q$perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));if exists(select 1 from public.tenancies where property_id=p_property_id and status in('proposed','pending_confirmation','active')) then raise exception 'Identity cannot change while a tenancy is open' using errcode='22023';end if; insert into public.verification_submissions(user_id,tier,property_id,identity_revision_id,identity_correction_id)$q$),
  (3,'public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer)','975614f0e93a64eda006f25af4b1e7b3',
   $q$select * into r from public.rental_reservations where id=p_reservation_id;$q$,
   $q$select * into r from public.rental_reservations where id=p_reservation_id; perform pg_advisory_xact_lock(hashtextextended(r.property_id::text,0));if exists(select 1 from rentlease_property_identity.corrections q where q.property_id=r.property_id and (q.status='submitted' or exists(select 1 from public.verification_submissions s where s.id=q.submission_id and s.status in('pending','under_review')))) then raise exception 'Resolve the pending identity review first.' using errcode='22023';end if;$q$),
  (4,'public.get_admin_property_identity_review(uuid)','2f59d5579001d78cb2a8b8d40003d96a',
   $q$'requires_repair',exists(select 1 from rentlease_property_identity.repairs z where z.property_id=p.id)) into result$q$,
   $q$'requires_repair',exists(select 1 from rentlease_property_identity.repairs z where z.property_id=p.id),'open_tenancy',exists(select 1 from public.tenancies t where t.property_id=p.id and t.status in('proposed','pending_confirmation','active'))) into result$q$)
 ) as t(step,sig,base_md5,old_text,new_text) order by step loop
  if to_regprocedure(spec.sig) is null then raise exception 'Unexpected contract: % is missing',spec.sig;end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure(spec.sig)) is distinct from spec.base_md5 then raise exception 'Unexpected % contract: source differs from the reviewed definition; review migration before proceeding',spec.sig;end if;
  src:=pg_get_functiondef(to_regprocedure(spec.sig));
  n:=(length(src)-length(replace(src,spec.old_text,'')))/length(spec.old_text);
  if n<>1 then raise exception 'Unexpected % contract: expected text found % times (step %); review migration before proceeding',spec.sig,n,spec.step;end if;
  patched:=replace(src,spec.old_text,spec.new_text);
  if patched is null or patched=src or replace(patched,spec.new_text,spec.old_text)<>src then raise exception 'Unexpected % patch result (step %)',spec.sig,spec.step;end if;
  execute patched;
  if position(spec.new_text in pg_get_functiondef(to_regprocedure(spec.sig)))=0 then raise exception 'Patch for % (step %) did not apply',spec.sig,spec.step;end if;
 end loop;
 execute state into after_state;
 if after_state is distinct from before_state then raise exception 'Function owner, ACL, security or configuration changed unexpectedly';end if;
 if (select md5(prosrc) from pg_proc where oid='rentlease_property_identity.promote(uuid,uuid)'::regprocedure) is distinct from 'e4de0578032cae920f8f73b3a6f20b92' then raise exception 'promote must remain unchanged';end if;
end$migration$;
commit;
