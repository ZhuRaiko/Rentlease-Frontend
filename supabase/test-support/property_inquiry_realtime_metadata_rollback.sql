-- Coordinated rollback only; authorization required. Preserves UC-08 RPCs/records.
-- Migration preflight requires conversations absent from the original publication.
begin;
revoke select(id,conversation_id) on public.messages from authenticated;
revoke select(id,tenant_id,landlord_id) on public.conversations from authenticated;
drop policy inquiry_event_participant_scope on public.messages;
drop policy inquiry_conversation_event_scope on public.conversations;
drop function public.can_receive_property_inquiry_events(uuid);
alter publication supabase_realtime drop table public.conversations;
commit;
