-- PREPARED ONLY. Separate deployment authorization and backup required.
-- Metadata notifications only; message bodies/history stay behind UC-08 RPCs.
begin;
do $guard$
begin
 if not exists(select 1 from pg_class where oid='public.messages'::regclass and relrowsecurity)
 or not exists(select 1 from pg_class where oid='public.conversations'::regclass and relrowsecurity)
 or has_any_column_privilege('authenticated','public.messages','SELECT')
 or has_any_column_privilege('authenticated','public.conversations','SELECT')
 or has_any_column_privilege('anon','public.messages','SELECT')
 or has_any_column_privilege('anon','public.conversations','SELECT') then raise exception 'Messaging metadata baseline drift';end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then raise exception 'Messages publication missing';end if;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then raise exception 'Conversation publication baseline drift';end if;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.send_property_message(uuid,uuid,text)')) is distinct from '9272d7097f4f19139945883ff53d16e2' then raise exception 'UC-08 send source drift';end if;
end $guard$;
create function public.can_receive_property_inquiry_events(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path='' as $function$
 select public.is_tier1_verified(auth.uid()) and exists(
  select 1 from public.conversations c where c.id=p_conversation_id and auth.uid() in(c.tenant_id,c.landlord_id)
 );
$function$;
revoke all on function public.can_receive_property_inquiry_events(uuid) from public,anon;
grant execute on function public.can_receive_property_inquiry_events(uuid) to authenticated;
-- Restrict the new metadata read path; existing definer RPC/Admin paths are unchanged.
create policy inquiry_event_participant_scope on public.messages as restrictive for select to authenticated
using(public.can_receive_property_inquiry_events(conversation_id));
create policy inquiry_conversation_event_scope on public.conversations as restrictive for select to authenticated
using(public.is_tier1_verified(auth.uid()) and auth.uid() in(tenant_id,landlord_id));
grant select(id,conversation_id) on public.messages to authenticated;
grant select(id,tenant_id,landlord_id) on public.conversations to authenticated;
do $publication$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then
  alter publication supabase_realtime add table public.conversations;
 end if;
end $publication$;
commit;
