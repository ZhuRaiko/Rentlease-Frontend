-- Separately authorized compensating migration only. Withdraw client first.
-- Retain notification data/event keys and indexes. No history repair or destructive rollback.
begin;
drop trigger inapp_message on public.messages;
drop trigger inapp_viewing on public.viewing_schedules;
drop trigger inapp_reservation on rentlease_reservations.events;
drop trigger inapp_tenancy on public.tenancies;
drop trigger inapp_maintenance on public.maintenance_updates;
drop trigger inapp_reminder on rentlease_tenancy_care.reminders;
drop trigger inapp_report on rentlease_reporting.events;
revoke execute on function public.get_in_app_notifications(timestamptz,uuid),public.read_in_app_notifications(uuid,timestamptz),public.get_in_app_notification_target(uuid) from authenticated;
commit;
