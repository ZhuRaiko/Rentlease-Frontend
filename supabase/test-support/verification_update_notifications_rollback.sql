-- ROLLBACK for 20261114180000_verification_update_notifications.sql. LOCAL ONLY. Idempotent.
-- Drops the trigger and its function, and restores get_in_app_notification_target to its ORIGINAL source (md5 535a95ee46f7060e6adeaea28509ef8c).
-- Notifications already written stay (they are ordinary rows). Run with: supabase db query --linked -f <this file>, only after explicit authorization.
begin;
set local lock_timeout='10s';
drop trigger if exists inapp_verification on public.verification_submissions;
drop function if exists rentlease_notifications.generate_verification();
do $r$
declare cur text;
begin
 select md5(prosrc) into cur from pg_proc where oid=to_regprocedure('public.get_in_app_notification_target(uuid)');
 if cur is null then raise exception 'get_in_app_notification_target is missing';end if;
 if cur='535a95ee46f7060e6adeaea28509ef8c' then null; -- already the original
 elsif cur='bb9c3744ea4547026a49c027bb1e8525' then
  execute $s$create or replace function public.get_in_app_notification_target(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_notifications.caller();n public.notifications%rowtype;target uuid;kind text;begin
 select * into n from public.notifications where id=p_id and user_id=a and event_key is not null;
 if n.id is null then raise exception 'Notification unavailable' using errcode='42501';end if;
 target:=(n.data->>'id')::uuid;kind:=n.data->>'kind';
 if kind='conversation' and exists(select 1 from public.conversations where id=target and a in(tenant_id,landlord_id))
 or kind='tenancy' and exists(select 1 from public.tenancies where id=target and a in(tenant_id,landlord_id))
 or kind='report' and exists(select 1 from public.reports where id=target and reporter_id=a) then return jsonb_build_object('kind',kind,'id',target);end if;
 return null;
end$$$s$;
 else raise exception 'get_in_app_notification_target has an unexpected source (%); not restoring',cur;
 end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.get_in_app_notification_target(uuid)'))<>'535a95ee46f7060e6adeaea28509ef8c' then raise exception 'Restored source does not match the original';end if;
 if not has_function_privilege('authenticated','public.get_in_app_notification_target(uuid)','execute') or has_function_privilege('anon','public.get_in_app_notification_target(uuid)','execute') then raise exception 'get_in_app_notification_target ACL changed';end if;
end$r$;
commit;
