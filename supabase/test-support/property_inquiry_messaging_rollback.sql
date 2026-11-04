-- Coordinated rollback only, never run automatically. Preserves all conversations/messages.
begin;
drop function public.start_property_inquiry(uuid);
drop function public.get_messaging_inbox(integer,integer,uuid);
drop function public.get_conversation_messages(uuid,text,timestamptz,uuid,integer,uuid[]);
drop function public.send_property_message(uuid,uuid,text);
commit;
