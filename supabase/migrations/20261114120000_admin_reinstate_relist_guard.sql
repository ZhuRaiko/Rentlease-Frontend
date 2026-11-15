-- LOCAL ONLY. NOT APPLIED. Prepared 2026-11-14 for review; do not apply without explicit authorization, a fresh predeploy backup and live-source
-- reconfirmation. Apply directly (db query --linked -f), then `migration repair --status applied 20261114120000`; never db push.
--
-- Why: an Admin can remove a listing (remove_listing) but today nothing stops the owner from creating or publishing a new listing for the same
-- property, and an Admin has no way to undo a removal made in error.
--
-- What changes (and only this):
--   A. save_listing_draft and publish_listing refuse to work on a property that has a REMOVED listing: 'Property has a removed listing' (22023).
--      The check runs after the per-property advisory lock both functions already take, which is the same lock the Admin removal takes, so a
--      removal and a draft save on one property are serialized. reactivate_listing and update_listing_draft are NOT touched.
--   B. apply_admin_moderation_action gains 'reinstate_listing' (removed -> paused, removal fields cleared, one audit row, same receipt/idempotency
--      shape). It does NOT use public.moderation_actions: no enum value is added and apply_moderation_action() is not changed; the branch applies
--      its own effect and writes its own audit row in the same transaction. The owner then reactivates with the existing reactivate_listing.
--      New read-only RPC public.get_admin_removed_listings() lists removed listings for the Admin UI. Its rows and count leave out any listing the
--      calling Admin is conflicted on (a report about the listing or about its owner), and reinstate_listing refuses the same case.
--   C. get_admin_audit_log adds 'actorId', names the subject of verification_submission and report rows, and lists 'reinstate_listing' under the
--      actions filter. The two existing conflicted-Admin filters, count and paging are unchanged; a third filter inside the same CTE hides
--      'reinstate_listing' rows from an Admin who is conflicted on a report about that listing or its owner. Nothing private is added (public nickname or short id; listing title).
-- Patch technique (same as 20261112155016_admin_reports_access): each existing function is NOT retyped. Its live source must match a pinned md5,
-- each anchor must occur EXACTLY ONCE in pg_get_functiondef, the edit must be exactly reversible, the patched source must match the md5 recorded
-- below, and owner, ACL, security-definer flag, config and volatility must be identical afterward. Any drift raises and the migration rolls back.
-- Pins (hosted, read 2026-11-14):
--   save_listing_draft            260ffe2c338beb57840aa761072e2b82  ->  d237ba50f916e5bed50cd374b642dd5f
--   publish_listing               11e9d42b4ff2cdec8bd2148557beb92a  ->  2f4cfbd538be5d760256995ec01ce7a7
--   apply_admin_moderation_action 7cb33c1bc86c374a0761049ecfcfc879  ->  13167370320a77a820ace658be778f04
--   get_admin_audit_log           08481f61304cb7498c51ea359af2bbef  ->  43458893456015aa7738c5f2dbeec02b
--   unchanged and asserted before and after: reactivate_listing 8eb305fd08f1edfebd2b66b21aff22e9, get_admin_restrictions
--   96da176a5c89402a1390c25ac4c816f5, apply_moderation_action() 311afeb3c10eef8dd2b1b5a965377f21, update_listing_draft
--   1cbc01da840fe61e6465e1c6c0f8f61b, validate_listing_owner 986f1672c657ac3f6d4bfc77620ba094, rotate_listing_edit_version
--   29523f51f58611aea3403a30f3310e8d, rentlease_unfinished_posts.remember_publication 0a2eafe977a03f73ab65be10c445f2c8.
-- Interaction with listing triggers (read 2026-11-14): trg_validate_listing_owner (owner must own the property; recomputes completeness; no status
-- rule for paused), unfinished_post_publication (marks the property record as ever published; harmless for removed -> paused), trg_listings_edit_version
-- (rotates edit_version on status change, so a stale editor token is rejected) and trg_listings_updated_at do not block or corrupt removed -> paused.
-- Authenticated holds only SELECT on public.listings (no direct writes), so owners cannot bypass these RPCs; this migration asserts that.
-- Audit failure policy is unchanged: strict, same transaction. A reinstatement whose audit row is not there is refused and rolled back.
-- Lock order (reinstate): operation lock, receipt lookup, then the per-property lock, then listings ... FOR UPDATE (same as remove_listing).
-- Rollback: supabase/test-support/admin_reinstate_relist_guard_rollback.sql (restores the four sources to the pinned originals; retains audit rows,
-- receipts and any reinstated listing).
begin;
set local lock_timeout='10s';

do $migration$
declare p record;
begin
 -- Pins on everything this migration patches, and on everything it relies on and must leave alone.
 for p in select * from (values
  ('public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)','260ffe2c338beb57840aa761072e2b82'),
  ('public.publish_listing(uuid)','11e9d42b4ff2cdec8bd2148557beb92a'),
  ('public.reactivate_listing(uuid)','8eb305fd08f1edfebd2b66b21aff22e9'),
  ('public.update_listing_draft(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)','1cbc01da840fe61e6465e1c6c0f8f61b'),
  ('public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)','7cb33c1bc86c374a0761049ecfcfc879'),
  ('public.get_admin_audit_log(text,integer)','08481f61304cb7498c51ea359af2bbef'),
  ('public.get_admin_restrictions()','96da176a5c89402a1390c25ac4c816f5'),
  ('public.apply_moderation_action()','311afeb3c10eef8dd2b1b5a965377f21'),
  ('public.validate_listing_owner()','986f1672c657ac3f6d4bfc77620ba094'),
  ('public.rotate_listing_edit_version()','29523f51f58611aea3403a30f3310e8d'),
  ('rentlease_unfinished_posts.remember_publication()','0a2eafe977a03f73ab65be10c445f2c8')) as t(sig,pin) loop
  if to_regprocedure(p.sig) is null then raise exception 'Expected function % is missing; review migration before proceeding',p.sig;end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure(p.sig)) is distinct from p.pin then raise exception '% source differs from the reviewed definition; review migration before proceeding',p.sig;end if;
 end loop;
 if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='get_admin_removed_listings') then raise exception 'public.get_admin_removed_listings already exists; review migration before proceeding';end if;
 if exists(select 1 from pg_proc where oid in('public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'::regprocedure,'public.publish_listing(uuid)'::regprocedure,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)'::regprocedure,'public.get_admin_audit_log(text,integer)'::regprocedure) and (prosrc like '%removed listing%' or prosrc like '%reinstate_listing%')) then raise exception 'A patched function already mentions the new rules; review migration before proceeding';end if;
 -- The listing triggers this relies on must exist and be enabled.
 if (select count(*) from pg_trigger where tgrelid='public.listings'::regclass and not tgisinternal and tgenabled='O' and tgname in('trg_validate_listing_owner','unfinished_post_publication','trg_listings_edit_version','trg_listings_updated_at'))<>4 then raise exception 'Expected listing triggers are missing or not enabled';end if;
 if not exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='listing_status' and e.enumlabel='removed') then raise exception 'listing_status has no removed value';end if;
 if to_regclass('rentlease_admin_actions.receipts') is null or to_regclass('public.admin_audit_logs') is null or to_regclass('public.verification_submissions') is null or to_regclass('public.reports') is null then raise exception 'Expected tables are missing';end if;
 -- Owners must not be able to write listings directly (that would bypass every RPC rule above).
 if has_table_privilege('authenticated','public.listings','insert,update,delete,truncate') or has_table_privilege('anon','public.listings','insert,update,delete,truncate,select') then raise exception 'Clients unexpectedly hold write privileges on public.listings; review before proceeding';end if;
 if has_table_privilege('authenticated','public.moderation_actions','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','public.admin_audit_logs','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','rentlease_admin_actions.receipts','select,insert,update,delete,truncate,references,trigger') then raise exception 'Clients unexpectedly hold privileges on the moderation, audit or receipt tables; review before proceeding';end if;
end$migration$;

do $migration$
declare
 spec record;src text;patched text;n integer;before_state jsonb;after_state jsonb;
 state constant text:='select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''owner'',pg_get_userbyid(p.proowner),''acl'',p.proacl::text[],''secdef'',p.prosecdef,''config'',p.proconfig,''volatile'',p.provolatile,''lang'',p.prolang)) from pg_proc p where p.oid in(''public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)''::regprocedure,''public.publish_listing(uuid)''::regprocedure,''public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)''::regprocedure,''public.get_admin_audit_log(text,integer)''::regprocedure)';
begin
 execute state into before_state;
 -- base_md5 is set on the first step of each function (the untouched source); final_md5 on its last step (the reviewed result).
 for spec in select * from (values
  -- A1. save_listing_draft: after the property lock, before the select-for-update/insert (blocks a new draft and an update of an existing one).
  (1,'public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)','260ffe2c338beb57840aa761072e2b82'::text,
   $q$  select l.*$q$,
   $q$  if exists (select 1 from public.listings r where r.property_id = p_property_id and r.status = 'removed'::public.listing_status) then raise exception 'Property has a removed listing' using errcode = '22023'; end if;$q$||chr(10)||chr(10)||$q$  select l.*$q$,
   'd237ba50f916e5bed50cd374b642dd5f'::text),
  -- A2. publish_listing: after the draft-status check, still under the property lock.
  (2,'public.publish_listing(uuid)','11e9d42b4ff2cdec8bd2148557beb92a',
   $q$    raise exception 'Only a draft listing can be published' using errcode = '22023';$q$,
   $q$    raise exception 'Only a draft listing can be published' using errcode = '22023';$q$||chr(10)||$q$  end if;$q$||chr(10)||chr(10)||$q$  if exists (select 1 from public.listings r where r.property_id = v_listing.property_id and r.id <> v_listing.id and r.status = 'removed'::public.listing_status) then$q$||chr(10)||$q$    raise exception 'Property has a removed listing' using errcode = '22023';$q$,
   '2f4cfbd538be5d760256995ec01ce7a7'),
  -- B1. allowed actions.
  (3,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)','7cb33c1bc86c374a0761049ecfcfc879',
   $q$p_action not in('suspend_account','restore_account','remove_listing')$q$,
   $q$p_action not in('suspend_account','restore_account','remove_listing','reinstate_listing')$q$,null),
  -- B2. a report is never used for a reinstatement (static input shape, before any state-dependent check).
  (4,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',null,
   $q$then raise exception 'A report is required for this action' using errcode='22023';end if;$q$,
   $q$then raise exception 'A report is required for this action' using errcode='22023';end if;$q$||chr(10)||$q$ if p_report_id is not null and p_action='reinstate_listing' then raise exception 'A report is not used for this action' using errcode='22023';end if;$q$,null),
  -- B3. state checks, after the operation lock, receipt lookup, property lock and listing row lock (the listing branch already ran the owner checks).
  (5,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',null,
   $q$then raise exception 'Listing cannot be removed while a tenancy is open' using errcode='22023';end if;$q$,
   $q$then raise exception 'Listing cannot be removed while a tenancy is open' using errcode='22023';end if;$q$||chr(10)||$q$  elsif p_action='reinstate_listing' then$q$||chr(10)||
   $q$   if l.status<>'removed' then raise exception 'Listing is not removed' using errcode='22023';end if;$q$||chr(10)||
   $q$   if exists(select 1 from public.listings o where o.property_id=l.property_id and o.id<>l.id and o.status in('active','paused','rented')) then raise exception 'This property already has a live listing' using errcode='22023';end if;$q$||chr(10)||
   $q$   if exists(select 1 from public.reports rr where (rr.reported_listing_id=l.id or rr.reported_user_id=l.landlord_id) and rentlease_reporting.conflicted(rr.id,a)) then raise exception 'Access unavailable' using errcode='42501';end if;$q$,null),
  -- B4. the effect and its own audit row (no moderation_actions row for this action); the other actions still run the original insert unchanged.
  -- One step: the function is only valid with the if and its end if together, so the anchor spans the two lines of the original insert.
  (6,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',null,
   $q$insert into public.moderation_actions(report_id,admin_id,action_type,target_user_id,target_listing_id,reason,ends_at)$q$||chr(10)||$q$ values(p_report_id,a,p_action::public.moderation_action_type,p_target_user_id,p_target_listing_id,reason,p_ends_at) returning id into mid;$q$,
   $q$if p_action='reinstate_listing' then$q$||chr(10)||$q$  mid:=p_operation_id;$q$||chr(10)||
   $q$  update public.listings set status='paused',paused_at=now(),removed_at=null,removal_reason=null where id=p_target_listing_id and status='removed';$q$||chr(10)||
   $q$  insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values(a,'reinstate_listing','listing',p_target_listing_id,jsonb_build_object('reason',reason,'previous_status','removed','status','paused'));$q$||chr(10)||
   $q$ else$q$||chr(10)||$q$ insert into public.moderation_actions(report_id,admin_id,action_type,target_user_id,target_listing_id,reason,ends_at)$q$||chr(10)||$q$ values(p_report_id,a,p_action::public.moderation_action_type,p_target_user_id,p_target_listing_id,reason,p_ends_at) returning id into mid;$q$||chr(10)||$q$ end if;$q$,null),
  -- B5. the resulting status the RPC insists on.
  (7,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',null,
   $q$when 'restore_account' then 'active' else 'removed' end$q$,
   $q$when 'restore_account' then 'active' when 'reinstate_listing' then 'paused' else 'removed' end$q$,
   '13167370320a77a820ace658be778f04'),
  -- C1. the actions filter lists reinstatements.
  (8,'public.get_admin_audit_log(text,integer)','08481f61304cb7498c51ea359af2bbef',
   $q$'remove_listing','restrict_account','warning') end$q$,
   $q$'remove_listing','reinstate_listing','restrict_account','warning') end$q$,null),
  -- C2. actor id.
  (9,'public.get_admin_audit_log(text,integer)',null,
   $q$'entityId',g.entity_id,$q$,
   $q$'entityId',g.entity_id,'actorId',g.admin_id,$q$,null),
  -- C3. subject for verification submissions (applicant) and reports (the reported target). Public nickname only; short id otherwise.
  (10,'public.get_admin_audit_log(text,integer)',null,
   $q$else null end,$q$,
   $q$when 'verification_submission' then coalesce(case when vp.public_nickname_confirmed_at is not null then nullif(btrim(vp.public_nickname),'') end,'User '||left(vs.user_id::text,8))$q$||chr(10)||
   $q$        when 'report' then case when sr.reported_listing_id is not null then coalesce(nullif(btrim(rl.title),''),'Listing '||left(sr.reported_listing_id::text,8)) else coalesce(case when rp.public_nickname_confirmed_at is not null then nullif(btrim(rp.public_nickname),'') end,'User '||left(sr.reported_user_id::text,8)) end$q$||chr(10)||
   $q$        else null end,$q$,null),
  -- C4. the joins behind those subjects (all left joins keyed on the audit row or on the report row already joined).
  (11,'public.get_admin_audit_log(text,integer)',null,
   $q$left join public.reports sr on g.entity_type='report' and sr.id=g.entity_id$q$,
   $q$left join public.reports sr on g.entity_type='report' and sr.id=g.entity_id$q$||chr(10)||
   $q$     left join public.verification_submissions vs on g.entity_type='verification_submission' and vs.id=g.entity_id$q$||chr(10)||
   $q$     left join public.profiles vp on vp.id=vs.user_id$q$||chr(10)||
   $q$     left join public.listings rl on rl.id=sr.reported_listing_id$q$||chr(10)||
   $q$     left join public.profiles rp on rp.id=sr.reported_user_id$q$,null),
  -- C5. a reinstatement row is hidden from an Admin who is conflicted on any report about that listing or about its owner. Inside CTE f, so
  -- 'count' and the pages stay consistent. The two existing conflicted filters are not touched.
  (12,'public.get_admin_audit_log(text,integer)',null,
   $q$(l.metadata->>'report_id')::uuid,a))),$q$,
   $q$(l.metadata->>'report_id')::uuid,a))$q$||chr(10)||$q$    and not (l.action='reinstate_listing' and l.entity_type='listing' and exists(select 1 from public.listings rl0 join public.reports rx on (rx.reported_listing_id=rl0.id or rx.reported_user_id=rl0.landlord_id) where rl0.id=l.entity_id and rentlease_reporting.conflicted(rx.id,a)))),$q$,
   '43458893456015aa7738c5f2dbeec02b')
 ) as t(step,sig,base_md5,old_text,new_text,final_md5) order by step loop
  if to_regprocedure(spec.sig) is null then raise exception 'Unexpected contract: % is missing',spec.sig;end if;
  if spec.base_md5 is not null and (select md5(prosrc) from pg_proc where oid=to_regprocedure(spec.sig)) is distinct from spec.base_md5 then raise exception 'Unexpected % contract: source differs from the reviewed definition; review migration before proceeding',spec.sig;end if;
  src:=pg_get_functiondef(to_regprocedure(spec.sig));
  n:=(length(src)-length(replace(src,spec.old_text,'')))/length(spec.old_text);
  if n<>1 then raise exception 'Unexpected % contract: anchor found % times (step %); review migration before proceeding',spec.sig,n,spec.step;end if;
  patched:=replace(src,spec.old_text,spec.new_text);
  if patched is null or patched=src or replace(patched,spec.new_text,spec.old_text)<>src then raise exception 'Unexpected % patch result (step %)',spec.sig,spec.step;end if;
  execute patched;
  if position(spec.new_text in pg_get_functiondef(to_regprocedure(spec.sig)))=0 then raise exception 'Patch for % (step %) did not apply',spec.sig,spec.step;end if;
  if spec.final_md5 is not null and (select md5(prosrc) from pg_proc where oid=to_regprocedure(spec.sig)) is distinct from spec.final_md5 then raise exception 'Patched % differs from the reviewed result (md5)',spec.sig;end if;
 end loop;
 execute state into after_state;
 if after_state is distinct from before_state then raise exception 'Function owner, ACL, security or configuration changed unexpectedly';end if;
end$migration$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- Removed listings for the Admin UI. Same posture as get_admin_restrictions: security definer, owner postgres, search_path=pg_catalog, active Admin
-- required before anything is read. Owner name is the confirmed public nickname only (never the private display name); short id fallback.
-- Conflict rule (same as reinstate_listing): a listing is left out ENTIRELY, from 'count' and 'rows' alike (one CTE), when the calling Admin is
-- conflicted (rentlease_reporting.conflicted) on a report about the listing or about its owner.
-- reinstatable is false whenever the RPC would refuse for a reason other than the conflict, which is now excluded above: the owner is an Admin, or
-- the property has another active, paused or rented listing.
create function public.get_admin_removed_listings() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare a uuid:=auth.uid();
begin
 if a is null or public.is_active_admin(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 return(
  with f as(
   select lr.* from public.listings lr where lr.status='removed'
    and not exists(select 1 from public.reports rr where (rr.reported_listing_id=lr.id or rr.reported_user_id=lr.landlord_id) and rentlease_reporting.conflicted(rr.id,a))),
  page as(select * from f order by removed_at desc nulls last,id limit 100)
  select jsonb_build_object(
   'count',(select count(*) from f),
   'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'listingId',g.id,
      'title',coalesce(nullif(btrim(g.title),''),'Listing '||left(g.id::text,8)),
      'ownerName',coalesce(case when o.public_nickname_confirmed_at is not null then nullif(btrim(o.public_nickname),'') end,'User '||left(g.landlord_id::text,8)),
      'removedAt',g.removed_at,
      'reason',g.removal_reason,
      'reinstatable',(public.is_admin(g.landlord_id) is not true and not exists(select 1 from public.listings ol where ol.property_id=g.property_id and ol.id<>g.id and ol.status in('active','paused','rented')))) order by g.removed_at desc nulls last,g.id)
     from page g left join public.profiles o on o.id=g.landlord_id),'[]'::jsonb)));
end
$fn$;
alter function public.get_admin_removed_listings() owner to postgres;
revoke all on function public.get_admin_removed_listings() from public,anon,authenticated,service_role;
grant execute on function public.get_admin_removed_listings() to authenticated;

-- Final self-check: any deviation raises and rolls the whole migration back.
do $migration$
declare
 patched regprocedure[]:=array['public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'::regprocedure,'public.publish_listing(uuid)'::regprocedure,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)'::regprocedure,'public.get_admin_audit_log(text,integer)'::regprocedure];
 rpc regprocedure:='public.get_admin_removed_listings()'::regprocedure;
begin
 -- New sources (recorded in the header) and untouched sources.
 if (select md5(prosrc) from pg_proc where oid=patched[1]) is distinct from 'd237ba50f916e5bed50cd374b642dd5f' or (select md5(prosrc) from pg_proc where oid=patched[2]) is distinct from '2f4cfbd538be5d760256995ec01ce7a7' or (select md5(prosrc) from pg_proc where oid=patched[3]) is distinct from '13167370320a77a820ace658be778f04' or (select md5(prosrc) from pg_proc where oid=patched[4]) is distinct from '43458893456015aa7738c5f2dbeec02b' then raise exception 'A patched function does not match the reviewed result';end if;
 if (select count(*) from pg_proc where oid in('public.reactivate_listing(uuid)'::regprocedure,'public.update_listing_draft(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'::regprocedure,'public.get_admin_restrictions()'::regprocedure,'public.apply_moderation_action()'::regprocedure,'public.validate_listing_owner()'::regprocedure,'public.rotate_listing_edit_version()'::regprocedure,'rentlease_unfinished_posts.remember_publication()'::regprocedure) and md5(prosrc) in('8eb305fd08f1edfebd2b66b21aff22e9','1cbc01da840fe61e6465e1c6c0f8f61b','96da176a5c89402a1390c25ac4c816f5','311afeb3c10eef8dd2b1b5a965377f21','986f1672c657ac3f6d4bfc77620ba094','29523f51f58611aea3403a30f3310e8d','0a2eafe977a03f73ab65be10c445f2c8'))<>7 then raise exception 'A function this migration must not change was changed';end if;
 if not (select every(p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and p.proconfig=array['search_path=pg_catalog']) from pg_proc p where p.oid=any(patched) or p.oid=rpc) then raise exception 'Patched and new functions must be security definer, owned by postgres, with search_path=pg_catalog';end if;
 if (select count(*) from pg_proc p where p.oid=any(patched) or p.oid=rpc)<>5 or (select count(*) from pg_proc p where (p.oid=any(patched) or p.oid=rpc) and has_function_privilege('authenticated',p.oid,'execute') and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('service_role',p.oid,'execute'))<>5 then raise exception 'The RPCs must be executable by authenticated only';end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where (p.oid=any(patched) or p.oid=rpc) and x.grantee not in(p.proowner,'authenticated'::regrole)) then raise exception 'Unexpected grantee on a patched or new RPC';end if;
 if (select provolatile from pg_proc where oid=rpc)<>'s' then raise exception 'get_admin_removed_listings must be stable';end if;
 -- Clients keep no table privileges where it matters.
 if has_table_privilege('authenticated','public.moderation_actions','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','public.admin_audit_logs','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','rentlease_admin_actions.receipts','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','public.listings','insert,update,delete,truncate') or has_schema_privilege('authenticated','rentlease_admin_actions','usage') then raise exception 'Clients must not hold write privileges on listings or any privileges on the moderation, audit or receipt tables';end if;
 if (select count(*) from pg_trigger where tgrelid='public.listings'::regclass and not tgisinternal and tgenabled='O' and tgname in('trg_validate_listing_owner','unfinished_post_publication','trg_listings_edit_version','trg_listings_updated_at'))<>4 then raise exception 'Listing triggers changed';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.moderation_actions'::regclass and tgname='trg_apply_moderation_action' and tgenabled='O') then raise exception 'trg_apply_moderation_action changed';end if;
end$migration$;
commit;
