-- PREPARED LOCALLY ONLY. Deployment requires separate authorization.
-- Consumer messaging RPCs; no table grants, role gates, policy or identity changes.
begin;
create function public.start_property_inquiry(p_listing_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); owner_id uuid; result uuid;
begin
 if actor is null or not public.is_tier1_verified(actor) then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 select p.landlord_id into owner_id from public.listings l join public.properties p on p.id=l.property_id
 where l.id=p_listing_id and l.status='active' and l.published_at is not null and p.is_active
 and l.landlord_id=p.landlord_id and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date) for share of l,p;
 if owner_id is null or not public.is_tier1_verified(owner_id) then raise exception 'Listing unavailable' using errcode='22023'; end if;
 if owner_id=actor then raise exception 'You cannot inquire about your own listing' using errcode='22023'; end if;
 insert into public.conversations(listing_id,tenant_id,landlord_id) values(p_listing_id,actor,owner_id)
 on conflict(listing_id,tenant_id) do nothing returning id into result;
 if result is null then select id into result from public.conversations where listing_id=p_listing_id and tenant_id=actor and landlord_id=owner_id; end if;
 if result is null then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 return result;
end $$;
create function public.get_messaging_inbox(p_offset integer default 0,p_limit integer default 20,p_conversation_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not public.is_tier1_verified(actor) then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>1000 or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Invalid page' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.activity_at desc,r.id desc),'[]'::jsonb) into result from (
 select c.id,c.listing_id,c.tenant_id,c.landlord_id,c.status,c.created_at,c.last_message_at,
 coalesce(c.last_message_at,c.created_at) as activity_at,l.title as listing_title,
 case when actor=c.tenant_id then c.landlord_id else c.tenant_id end as participant_id,
 pp.display_name as participant_name,m.body as latest_body,m.message_type as latest_type
 from public.conversations c left join public.listings l on l.id=c.listing_id
 left join public.public_profiles pp on pp.id=case when actor=c.tenant_id then c.landlord_id else c.tenant_id end
 left join lateral(select body,message_type from public.messages where conversation_id=c.id and deleted_at is null order by created_at desc,id desc limit 1)m on true
 where actor in(c.tenant_id,c.landlord_id) and (p_conversation_id is null or c.id=p_conversation_id)
 order by coalesce(c.last_message_at,c.created_at) desc,c.id desc limit p_limit offset p_offset
 )r;
 return result;
end $$;
create function public.get_conversation_messages(p_conversation_id uuid,p_direction text default 'latest',p_cursor_at timestamptz default null,p_cursor_id uuid default null,p_limit integer default 50,p_known_ids uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not public.is_tier1_verified(actor) or not exists(select 1 from public.conversations where id=p_conversation_id and actor in(tenant_id,landlord_id)) then raise exception 'Conversation access denied' using errcode='42501'; end if;
 if p_direction is null or p_direction not in('latest','older','newer','reconcile') or p_limit is null or p_limit<1 or p_limit>100 or
 (p_direction in('latest','reconcile') and (p_cursor_at is not null or p_cursor_id is not null)) or
 (p_direction in('older','newer') and (p_cursor_at is null or p_cursor_id is null)) or
 (p_direction='reconcile' and (p_known_ids is null or coalesce(array_length(p_known_ids,1),0)<1 or array_length(p_known_ids,1)>100)) or
 (p_direction<>'reconcile' and p_known_ids is not null) then raise exception 'Invalid message page' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at,r.id),'[]'::jsonb) into result from (
 select id,conversation_id,sender_id,message_type,case when deleted_at is null then body else null end as body,created_at,deleted_at
 from public.messages where conversation_id=p_conversation_id and
 (p_direction='latest' or (p_direction='reconcile' and id=any(p_known_ids)) or (p_direction='older' and (created_at,id)<(p_cursor_at,p_cursor_id)) or (p_direction='newer' and (created_at,id)>(p_cursor_at,p_cursor_id)))
 order by case when p_direction='newer' then created_at end asc,case when p_direction='newer' then id end asc,
 case when p_direction<>'newer' then created_at end desc,case when p_direction<>'newer' then id end desc limit p_limit
 )r;
 return result;
end $$;
create function public.send_property_message(p_conversation_id uuid,p_message_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); conversation public.conversations%rowtype; message public.messages%rowtype; body_text text:=btrim(p_body);
begin
 if actor is null or not public.is_tier1_verified(actor) then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_message_id is null or body_text is null or length(body_text)<1 or length(body_text)>4000 then raise exception 'Use 1 to 4000 characters' using errcode='22023'; end if;
 select * into conversation from public.conversations where id=p_conversation_id for update;
 if not found or actor not in(conversation.tenant_id,conversation.landlord_id) then raise exception 'Conversation access denied' using errcode='42501'; end if;
 -- A confirmed earlier send remains reconcilable even if the thread was subsequently closed.
 select * into message from public.messages where id=p_message_id;
 if found then
  if message.conversation_id<>p_conversation_id or message.sender_id<>actor or message.body is distinct from body_text then raise exception 'Message identity mismatch' using errcode='42501'; end if;
 else
  if conversation.status<>'open' then raise exception 'Conversation is not open' using errcode='42501'; end if;
  insert into public.messages(id,conversation_id,sender_id,message_type,body,created_at)
  values(p_message_id,p_conversation_id,actor,'text',body_text,greatest(clock_timestamp(),coalesce(conversation.last_message_at,'-infinity'::timestamptz)+interval '1 microsecond')) returning * into message;
 end if;
 return jsonb_build_object('id',message.id,'conversation_id',message.conversation_id,'sender_id',message.sender_id,'message_type',message.message_type,'body',case when message.deleted_at is null then message.body else null end,'created_at',message.created_at,'deleted_at',message.deleted_at);
end $$;
revoke all on function public.start_property_inquiry(uuid),public.get_messaging_inbox(integer,integer,uuid),public.get_conversation_messages(uuid,text,timestamptz,uuid,integer,uuid[]),public.send_property_message(uuid,uuid,text) from public,anon;
grant execute on function public.start_property_inquiry(uuid),public.get_messaging_inbox(integer,integer,uuid),public.get_conversation_messages(uuid,text,timestamptz,uuid,integer,uuid[]),public.send_property_message(uuid,uuid,text) to authenticated;
commit;
