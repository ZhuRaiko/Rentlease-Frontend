-- LOCAL ONLY. Existing notification storage, transactional event generation; no push.
begin;
do $$begin
 if not (select relrowsecurity from pg_class where oid='public.notifications'::regclass) then raise exception 'Notifications RLS drift';end if;
 if has_table_privilege('authenticated','public.notifications','INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.notifications','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unexpected notification grants';end if;
end$$;
create schema rentlease_notifications;
revoke all on schema rentlease_notifications from public,anon,authenticated,service_role;
alter table public.notifications add column event_key text;
create unique index notifications_event_unique on public.notifications(user_id,event_key) where event_key is not null;
create index notifications_owner_page on public.notifications(user_id,created_at desc,id desc);
create index notifications_unread on public.notifications(user_id) where read_at is null and event_key is not null;
create policy notifications_rpc_only on public.notifications as restrictive for all to authenticated using(false) with check(false);
create function rentlease_notifications.emit(recipient uuid,event text,typ public.notification_type,label text,kind text,target uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if recipient is null or target is null then return;end if;
 insert into public.notifications(user_id,type,title,body,data,event_key) values(recipient,typ,label,'Open RentLease to review this update.',jsonb_build_object('kind',kind,'id',target),event) on conflict(user_id,event_key) where event_key is not null do nothing;
end$$;
create function rentlease_notifications.generate() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid(); tenant uuid;landlord uuid;target uuid;actor uuid;kind text;typ public.notification_type;label text;event text;context uuid;
begin
 if TG_TABLE_NAME='messages' then
  if new.deleted_at is not null or new.message_type::text='system' then return new;end if;
  select tenant_id,landlord_id into tenant,landlord from public.conversations where id=new.conversation_id;
  actor:=new.sender_id;context:=new.conversation_id;kind:='conversation';typ:='new_message';label:='New message';event:='message:'||new.id;
 elsif TG_TABLE_NAME='viewing_schedules' then
  if TG_OP='UPDATE' and row(new.status,new.starts_at,new.ends_at) is not distinct from row(old.status,old.starts_at,old.ends_at) then return new;end if;
  tenant:=new.tenant_id;landlord:=new.landlord_id;actor:=case when TG_OP='INSERT' then new.proposed_by else coalesce(new.cancelled_by,new.responded_by,a) end;
  context:=new.conversation_id;kind:='conversation';typ:='viewing_update';label:='Viewing update';event:='viewing:'||new.id||':'||new.revision;
 elsif TG_TABLE_SCHEMA='rentlease_reservations' then
  select r.tenant_id,r.landlord_id,r.conversation_id into tenant,landlord,context from public.rental_reservations r where r.id=new.reservation_id;
  actor:=new.actor_id;kind:='conversation';typ:='viewing_update';label:='Reservation update';event:='reservation:'||new.operation_id;
 elsif TG_TABLE_NAME='tenancies' then
  if TG_OP='UPDATE' and row(new.status,new.tenant_confirmed_at,new.landlord_confirmed_at) is not distinct from row(old.status,old.tenant_confirmed_at,old.landlord_confirmed_at) then return new;end if;
  tenant:=new.tenant_id;landlord:=new.landlord_id;actor:=case when TG_OP='INSERT' then new.created_by else a end;
  context:=new.id;kind:='tenancy';typ:='tenancy_update';label:='Tenancy update';event:='tenancy:'||new.id||':'||md5(jsonb_build_array(new.status,new.tenant_confirmed_at,new.landlord_confirmed_at,new.ended_at)::text);
 elsif TG_TABLE_NAME='maintenance_updates' then
  select t.tenant_id,t.landlord_id,t.id into tenant,landlord,context from public.maintenance_requests m join public.tenancies t on t.id=m.tenancy_id where m.id=new.maintenance_request_id;
  actor:=new.actor_id;kind:='tenancy';typ:='maintenance_update';label:='Maintenance update';event:='maintenance:'||new.id;
 elsif TG_TABLE_NAME='reminders' then
  perform rentlease_notifications.emit(new.actor_id,'reminder:'||new.actor_id||':'||new.tenancy_id||':'||new.due_date,'rent_due','Scheduled rent reminder','tenancy',new.tenancy_id);return new;
 elsif TG_TABLE_SCHEMA='rentlease_reporting' then
  if new.status not in('upheld','dismissed') then return new;end if;
  select reporter_id into target from public.reports where id=new.report_id;
  perform rentlease_notifications.emit(target,'report:'||new.id,'report_update','Your report has been reviewed','report',new.report_id);return new;
 else raise exception 'Unsupported notification source';end if;
 if tenant is distinct from actor then perform rentlease_notifications.emit(tenant,event,typ,label,kind,context);end if;
 if landlord is distinct from actor and landlord is distinct from tenant then perform rentlease_notifications.emit(landlord,event,typ,label,kind,context);end if;
 return new;
end$$;
create trigger inapp_message after insert on public.messages for each row execute function rentlease_notifications.generate();
create trigger inapp_viewing after insert or update on public.viewing_schedules for each row execute function rentlease_notifications.generate();
create trigger inapp_reservation after insert on rentlease_reservations.events for each row execute function rentlease_notifications.generate();
create trigger inapp_tenancy after insert or update on public.tenancies for each row execute function rentlease_notifications.generate();
create trigger inapp_maintenance after insert on public.maintenance_updates for each row execute function rentlease_notifications.generate();
create trigger inapp_reminder after insert on rentlease_tenancy_care.reminders for each row execute function rentlease_notifications.generate();
create trigger inapp_report after insert on rentlease_reporting.events for each row execute function rentlease_notifications.generate();
create function rentlease_notifications.caller() returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;return auth.uid();
end$$;
create function public.get_in_app_notifications(p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_notifications.caller();result jsonb;begin
 if (p_before is null)<>(p_before_id is null) or p_before>statement_timestamp() then raise exception 'Invalid cursor' using errcode='22023';end if;
 with page as(select * from public.notifications where user_id=a and event_key is not null and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 21), visible as(select * from page order by created_at desc,id desc limit 20)
 select jsonb_build_object('through',statement_timestamp(),'unread',(select count(*) from public.notifications where user_id=a and event_key is not null and read_at is null),'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'body',body,'type',type,'createdAt',created_at,'readAt',read_at) order by created_at desc,id desc),'[]'::jsonb) from visible),'next',case when (select count(*) from page)>20 then (select jsonb_build_object('createdAt',created_at,'id',id) from visible order by created_at,id limit 1) else null end) into result;
 return result;
end$$;
create function public.read_in_app_notifications(p_id uuid default null,p_through timestamptz default null) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_notifications.caller();begin
 if (p_id is null)=(p_through is null) or p_through>statement_timestamp() then raise exception 'Choose one read operation' using errcode='22023';end if;
 if p_id is not null and not exists(select 1 from public.notifications where id=p_id and user_id=a and event_key is not null) then raise exception 'Notification unavailable' using errcode='42501';end if;
 update public.notifications set read_at=statement_timestamp() where user_id=a and event_key is not null and read_at is null and (case when p_id is not null then id=p_id else created_at<=p_through end);
end$$;
create function public.get_in_app_notification_target(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_notifications.caller();n public.notifications%rowtype;target uuid;kind text;begin
 select * into n from public.notifications where id=p_id and user_id=a and event_key is not null;
 if n.id is null then raise exception 'Notification unavailable' using errcode='42501';end if;
 target:=(n.data->>'id')::uuid;kind:=n.data->>'kind';
 if kind='conversation' and exists(select 1 from public.conversations where id=target and a in(tenant_id,landlord_id))
 or kind='tenancy' and exists(select 1 from public.tenancies where id=target and a in(tenant_id,landlord_id))
 or kind='report' and exists(select 1 from public.reports where id=target and reporter_id=a) then return jsonb_build_object('kind',kind,'id',target);end if;
 return null;
end$$;
alter function public.get_in_app_notifications(timestamptz,uuid) owner to postgres;
alter function public.read_in_app_notifications(uuid,timestamptz) owner to postgres;
alter function public.get_in_app_notification_target(uuid) owner to postgres;
revoke all on all functions in schema rentlease_notifications from public,anon,authenticated,service_role;
revoke all on function public.get_in_app_notifications(timestamptz,uuid),public.read_in_app_notifications(uuid,timestamptz),public.get_in_app_notification_target(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_in_app_notifications(timestamptz,uuid),public.read_in_app_notifications(uuid,timestamptz),public.get_in_app_notification_target(uuid) to authenticated;
commit;
