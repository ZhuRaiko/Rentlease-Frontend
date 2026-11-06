-- Coordinated feature-disable rollback. Retain appointments, revisions, request notes and
-- event history for recovery/audit. No record or existing UC-08 policy is deleted.
begin;
drop policy viewing_rpc_insert_only on public.viewing_schedules;
drop policy viewing_rpc_update_only on public.viewing_schedules;
drop function public.respond_property_viewing(uuid,uuid,integer,text,timestamptz,timestamptz,text);
drop function public.request_property_viewing(uuid,uuid,timestamptz,timestamptz,text);
drop function public.get_property_viewings(uuid,integer,integer);
commit;
