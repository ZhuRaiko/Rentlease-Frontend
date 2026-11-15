-- LOCAL ONLY. NOT APPLIED. Prepared 2026-11-14 for review; do not apply without explicit authorization, a fresh predeploy backup and live-source
-- reconfirmation. Apply directly (db query --linked -f), then `migration repair --status applied 20261114180000`; never db push.
--
-- Why: when an Admin approves or rejects a verification submission, the owner is told nothing. The app already has the notification type
-- 'verification_update' but nothing creates one (hosted counts, read 2026-11-14: verification_update 0).
--
-- What changes (and only this):
--   A. rentlease_notifications.generate_verification(): a trigger function. When a verification submission becomes 'approved' or 'rejected' it
--      writes ONE in-app notification for the submission's owner through the existing rentlease_notifications.emit(). Tier 3 (property) points at
--      the property id (kind 'property_verification'), Tier 2 (identity) at the submission id (kind 'identity_verification'), any other tier is
--      ignored. Titles: "Property verification approved" / "Property verification needs changes" / "Identity verification approved" /
--      "Identity verification needs changes". The reviewer's rejection_reason and review_note are never read, so they cannot reach the
--      notification. emit() supplies the generic body ('Open RentLease to review this update.').
--   B. Trigger inapp_verification on public.verification_submissions: AFTER UPDATE OF status, only when the status really changed to
--      approved or rejected. It fires for every path that updates the status (review_verification_submission, its delegated Tier 2 path and
--      review_property_identity_verification all run UPDATE ... SET status).
--   C. public.get_in_app_notification_target(uuid) is patched so the two new kinds can be opened: the caller must own the property
--      (properties.landlord_id) or the Tier 2 submission (verification_submissions.user_id). Anything else returns null, exactly like today's
--      unknown-kind behavior. Nothing else in that function changes.
-- generate() is NOT modified. emit() is not modified.
-- Patch technique (same as 20261114120000): the live source of get_in_app_notification_target must match its pinned md5, the anchor must occur
-- EXACTLY ONCE in pg_get_functiondef, the edit must be exactly reversible, the patched source must match the md5 recorded below, and owner, ACL,
-- security-definer flag, config and volatility must be identical afterward. Any drift raises and the migration rolls back.
-- Pins (hosted, read-only, 2026-11-14):
--   public.get_in_app_notification_target(uuid)  535a95ee46f7060e6adeaea28509ef8c  ->  bb9c3744ea4547026a49c027bb1e8525
--   unchanged and asserted before and after: rentlease_notifications.emit 81a5f1b377e0a5c57ccca6d23a0374bb,
--   rentlease_notifications.generate 08b686c7868662747ec9bf3f119c6177.
-- Rollback: supabase/test-support/verification_update_notifications_rollback.sql (drops the trigger and function, restores the original
-- get_in_app_notification_target source; notifications already written are retained).
begin;
set local lock_timeout='10s';
do $m$
declare
 target_oid oid:=to_regprocedure('public.get_in_app_notification_target(uuid)');
 emit_oid oid:=to_regprocedure('rentlease_notifications.emit(uuid,text,public.notification_type,text,text,uuid)');
 gen_oid oid:=to_regprocedure('rentlease_notifications.generate()');
 anchor constant text:=$a$reporter_id=a) then return$a$;
 addition constant text:=$a$reporter_id=a)
 or kind='property_verification' and exists(select 1 from public.properties where id=target and landlord_id=a)
 or kind='identity_verification' and exists(select 1 from public.verification_submissions where id=target and user_id=a and tier='tier_2_identity') then return$a$;
 old_src text; old_def text; new_def text; new_src text; before_meta text; after_meta text; hits int;
begin
 -- Preconditions: the three live sources are the ones reviewed. Any difference aborts.
 if target_oid is null or emit_oid is null or gen_oid is null then raise exception 'A notification function this migration depends on is missing';end if;
 if (select md5(prosrc) from pg_proc where oid=emit_oid)<>'81a5f1b377e0a5c57ccca6d23a0374bb' then raise exception 'emit source drift';end if;
 if (select md5(prosrc) from pg_proc where oid=gen_oid)<>'08b686c7868662747ec9bf3f119c6177' then raise exception 'generate source drift';end if;
 select prosrc,pg_get_functiondef(oid) into old_src,old_def from pg_proc where oid=target_oid;
 if md5(old_src)<>'535a95ee46f7060e6adeaea28509ef8c' then raise exception 'get_in_app_notification_target source drift';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.verification_submissions'::regclass and tgname='inapp_verification' and not tgisinternal) then raise exception 'Trigger inapp_verification already exists';end if;
 if to_regprocedure('rentlease_notifications.generate_verification()') is not null then raise exception 'generate_verification already exists';end if;
 if not exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typnamespace='public'::regnamespace and t.typname='notification_type' and e.enumlabel='verification_update') then raise exception 'notification_type verification_update is missing';end if;
 if has_table_privilege('authenticated','public.notifications','INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.notifications','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unexpected notification grants';end if;
 -- Patch get_in_app_notification_target: anchor exactly once, CREATE OR REPLACE keeps owner and ACL.
 hits:=(length(old_def)-length(replace(old_def,anchor,'')))/length(anchor);
 if hits<>1 then raise exception 'Anchor must occur exactly once in get_in_app_notification_target, found %',hits;end if;
 select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text,proisstrict::text,prorettype::regtype::text) into before_meta from pg_proc where oid=target_oid;
 new_def:=replace(old_def,anchor,addition);
 execute new_def;
 select prosrc into new_src from pg_proc where oid=target_oid;
 select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text,proisstrict::text,prorettype::regtype::text) into after_meta from pg_proc where oid=target_oid;
 if md5(new_src)<>'bb9c3744ea4547026a49c027bb1e8525' then raise exception 'Patched source does not match the reviewed result (%)',md5(new_src);end if;
 if replace(new_src,addition,anchor)<>old_src then raise exception 'The edit is not exactly reversible';end if;
 if before_meta<>after_meta then raise exception 'Owner, ACL or settings changed: % vs %',before_meta,after_meta;end if;
 if (select md5(prosrc) from pg_proc where oid=emit_oid)<>'81a5f1b377e0a5c57ccca6d23a0374bb' or (select md5(prosrc) from pg_proc where oid=gen_oid)<>'08b686c7868662747ec9bf3f119c6177' then raise exception 'emit or generate changed';end if;
end$m$;

create function rentlease_notifications.generate_verification() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare label text; kind text; target uuid;
begin
 if new.status not in('approved','rejected') then return new;end if;
 -- Only the owner (new.user_id) is told. The reviewer is never a recipient, and no reviewer text (rejection_reason, review_note) is read here.
 if new.tier='tier_3_property' then
  kind:='property_verification';target:=new.property_id;
  label:=case when new.status='approved' then 'Property verification approved' else 'Property verification needs changes' end;
 elsif new.tier='tier_2_identity' then
  kind:='identity_verification';target:=new.id;
  label:=case when new.status='approved' then 'Identity verification approved' else 'Identity verification needs changes' end;
 else return new;
 end if;
 perform rentlease_notifications.emit(new.user_id,'verification:'||new.id::text||':'||new.status::text,'verification_update',label,kind,target);
 return new;
end$$;
alter function rentlease_notifications.generate_verification() owner to postgres;
revoke all on function rentlease_notifications.generate_verification() from public,anon,authenticated,service_role;

create trigger inapp_verification after update of status on public.verification_submissions for each row
 when (old.status is distinct from new.status and new.status in('approved','rejected'))
 execute function rentlease_notifications.generate_verification();

-- Postconditions.
do $m$begin
 if has_function_privilege('authenticated','rentlease_notifications.generate_verification()','execute') or has_function_privilege('anon','rentlease_notifications.generate_verification()','execute') or has_function_privilege('service_role','rentlease_notifications.generate_verification()','execute') then raise exception 'generate_verification must not be executable by clients';end if;
 if not (select prosecdef from pg_proc where oid='rentlease_notifications.generate_verification()'::regprocedure) or (select proconfig::text from pg_proc where oid='rentlease_notifications.generate_verification()'::regprocedure)<>'{search_path=pg_catalog}' then raise exception 'generate_verification must be security definer with search_path=pg_catalog';end if;
 if (select count(*) from pg_trigger where tgrelid='public.verification_submissions'::regclass and tgname='inapp_verification' and tgenabled='O' and not tgisinternal)<>1 then raise exception 'inapp_verification missing or disabled';end if;
 if not has_function_privilege('authenticated','public.get_in_app_notification_target(uuid)','execute') or has_function_privilege('anon','public.get_in_app_notification_target(uuid)','execute') then raise exception 'get_in_app_notification_target ACL changed';end if;
 if has_table_privilege('authenticated','public.notifications','INSERT,UPDATE,DELETE') then raise exception 'Unexpected notification grants';end if;
end$m$;
commit;
