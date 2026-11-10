-- PREPARED LOCAL ONLY. T3/T4 caller-scoped reads, in-app reminders and maintenance.
-- No obligation/payment mutation, push delivery, cron, or existing RPC replacement.
begin;
create schema rentlease_tenancy_care;
revoke all on schema rentlease_tenancy_care from public,anon,authenticated,service_role;
do $$begin
 if has_table_privilege('authenticated','public.maintenance_requests','INSERT,UPDATE,DELETE')
 or has_any_column_privilege('authenticated','public.maintenance_requests','INSERT')
 or has_any_column_privilege('authenticated','public.maintenance_requests','UPDATE')
 or has_table_privilege('authenticated','public.maintenance_updates','INSERT,UPDATE,DELETE') then
 raise exception 'Unexpected direct maintenance write grant';end if;
end$$;
alter table public.maintenance_requests add column category text check(category in ('plumbing','electrical','appliance','structural','other'));
alter table public.maintenance_requests add column care_revision uuid not null default gen_random_uuid();
-- Rotate on every update, including privileged existing maintenance paths.
create function rentlease_tenancy_care.rotate_revision() returns trigger language plpgsql set search_path=pg_catalog as $$
begin new.care_revision:=gen_random_uuid();return new;end$$;
create trigger care_request_revision before update on public.maintenance_requests for each row execute function rentlease_tenancy_care.rotate_revision();
create table rentlease_tenancy_care.receipts(
 actor_id uuid not null, operation_id uuid not null, input jsonb not null, result jsonb not null,
 created_at timestamptz not null default statement_timestamp(),primary key(actor_id,operation_id));
create table rentlease_tenancy_care.reminders(
 actor_id uuid not null,tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 due_date date not null,created_at timestamptz not null default statement_timestamp(),
 primary key(actor_id,tenancy_id,due_date));
alter table rentlease_tenancy_care.receipts enable row level security;
alter table rentlease_tenancy_care.reminders enable row level security;
revoke all on all tables in schema rentlease_tenancy_care from public,anon,authenticated,service_role;
-- Same property advisory lock order as T1. Shared tenancy row lock serializes lifecycle changes.
create function rentlease_tenancy_care.relationship(p_id uuid) returns public.tenancies
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; target uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select property_id into target from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id);
 if target is null then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into t from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id) for share;
 if t.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 return t;
end$$;
create function rentlease_tenancy_care.dates(p_start date,p_end date,p_day integer,p_today date)
returns table(due_date date) language sql immutable set search_path=pg_catalog as $$
 select d::date from (
 select (date_trunc('month',greatest(p_today,p_start)) + make_interval(months=>i) + make_interval(days=>p_day-1))::date d
 from generate_series(0,3) i where p_day between 1 and 28
 ) q where d>=greatest(p_today,p_start) and (p_end is null or d<=p_end) order by d limit 3
$$;
create function public.get_tenancy_care(p_tenancy_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
begin
 t:=rentlease_tenancy_care.relationship(p_tenancy_id);
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 return jsonb_build_object('tenancyId',t.id,'tenantId',t.tenant_id,'landlordId',t.landlord_id,'status',t.status,'today',today,
 'schedule',coalesce((select jsonb_agg(jsonb_build_object('date',d.due_date,'amount',t.agreed_monthly_rent)) from rentlease_tenancy_care.dates(t.start_date,coalesce(t.actual_end_date,t.expected_end_date),t.rent_due_day,today) d where t.status='active'),'[]'::jsonb),
 'obligations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'date',o.due_date,'amount',o.amount_due,'status',o.status)) from (select * from public.rent_obligations where tenancy_id=t.id order by due_date desc,id limit 50) o),'[]'::jsonb),
 'obligationsLimited',(select count(*)>50 from public.rent_obligations where tenancy_id=t.id),
 'reminders',coalesce((select jsonb_agg(jsonb_build_object('date',r.due_date,'createdAt',r.created_at)) from (select * from rentlease_tenancy_care.reminders where actor_id=auth.uid() and tenancy_id=t.id order by due_date desc limit 6) r),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,'category',m.category,'priority',m.priority,'status',m.status,'response',m.landlord_response,'revision',m.care_revision,'createdAt',m.created_at,'updatedAt',m.updated_at)) from (select * from public.maintenance_requests where tenancy_id=t.id order by created_at desc,id limit 20 offset p_offset) m),'[]'::jsonb));
end$$;
create function public.get_tenancy_maintenance_history(p_request_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid;
begin
 select tenancy_id into target from public.maintenance_requests where id=p_request_id;
 perform rentlease_tenancy_care.relationship(target);
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'actorId',h.actor_id,'fromStatus',h.from_status,'status',h.to_status,'note',h.note,'createdAt',h.created_at)) from (select * from public.maintenance_updates where maintenance_request_id=p_request_id order by created_at desc,id limit 20 offset p_offset) h),'[]'::jsonb);
end$$;
create function public.write_tenancy_care(p_tenancy_id uuid,p_operation_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; m public.maintenance_requests; cached rentlease_tenancy_care.receipts; result jsonb;
 input jsonb; target public.maintenance_status; note text; new_id uuid; d date; today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
begin
 t:=rentlease_tenancy_care.relationship(p_tenancy_id);
 if p_operation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_action is null then raise exception 'Invalid operation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation_id::text,1));
 input:=jsonb_build_object('tenancy',t.id,'action',p_action,'payload',p_payload);
 select * into cached from rentlease_tenancy_care.receipts where actor_id=auth.uid() and operation_id=p_operation_id;
 if found then
  if cached.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;
  return cached.result;
 end if;
 if t.status<>'active' or t.start_date>today or (coalesce(t.actual_end_date,t.expected_end_date) is not null and coalesce(t.actual_end_date,t.expected_end_date)<today) then raise exception 'Active tenancy required' using errcode='42501';end if;
 if p_action='check_reminder' then
  if p_payload<>'{}'::jsonb then raise exception 'Invalid reminder input' using errcode='22023';end if;
  select due_date into d from rentlease_tenancy_care.dates(t.start_date,coalesce(t.actual_end_date,t.expected_end_date),t.rent_due_day,today) limit 1;
  if d<=today+3 then insert into rentlease_tenancy_care.reminders(actor_id,tenancy_id,due_date) values(auth.uid(),t.id,d) on conflict do nothing;end if;
  result:=jsonb_build_object('requestId',null,'reminderDate',case when d<=today+3 then d end);
 elsif p_action='create' then
  if auth.uid()<>t.tenant_id then raise exception 'Tenant required' using errcode='42501';end if;
  if p_payload-array['title','description','category']<>'{}'::jsonb
   or jsonb_typeof(p_payload->'title') is distinct from 'string' or length(btrim(p_payload->>'title')) not between 3 and 100
   or jsonb_typeof(p_payload->'description') is distinct from 'string' or length(btrim(p_payload->>'description')) not between 10 and 2000
   or (p_payload->>'category') is null or (p_payload->>'category') not in('plumbing','electrical','appliance','structural','other') then raise exception 'Check request fields' using errcode='22023';end if;
  insert into public.maintenance_requests(tenancy_id,requested_by,title,description,category,priority,status)
   values(t.id,auth.uid(),btrim(p_payload->>'title'),btrim(p_payload->>'description'),p_payload->>'category','normal','submitted') returning * into m;
  insert into public.maintenance_updates(maintenance_request_id,actor_id,to_status,note) values(m.id,auth.uid(),'submitted','Request submitted');
  result:=jsonb_build_object('requestId',m.id,'revision',m.care_revision);
 elsif p_action='respond' then
  if auth.uid()<>t.landlord_id then raise exception 'Landlord required' using errcode='42501';end if;
  if p_payload-array['requestId','revision','status','note']<>'{}'::jsonb or jsonb_typeof(p_payload->'note') is distinct from 'string' or length(btrim(p_payload->>'note')) not between 1 and 2000 then raise exception 'Response required' using errcode='22023';end if;
  select * into m from public.maintenance_requests where id=(p_payload->>'requestId')::uuid and tenancy_id=t.id for update;
  if m.id is null then raise exception 'Request unavailable' using errcode='42501';end if;
  if m.care_revision is distinct from (p_payload->>'revision')::uuid then raise exception 'Request changed. Reload.' using errcode='40001';end if;
  target:=(p_payload->>'status')::public.maintenance_status;note:=btrim(p_payload->>'note');
  if target is null or m.status in('resolved','rejected','cancelled') or not (
   target=m.status or (target='acknowledged' and m.status in('submitted','reopened','needs_information'))
   or (target='in_progress' and m.status in('acknowledged','scheduled'))
   or (target='resolved' and m.status in('acknowledged','in_progress','scheduled'))
  ) then raise exception 'Transition unavailable' using errcode='22023';end if;
  update public.maintenance_requests set status=target,landlord_response=note,last_updated_by=auth.uid(),care_revision=gen_random_uuid(),resolved_at=case when target='resolved' then statement_timestamp() else resolved_at end where id=m.id returning care_revision into new_id;
  -- Existing trigger records changed statuses; same-status response needs its own history entry.
  if target=m.status then insert into public.maintenance_updates(maintenance_request_id,actor_id,from_status,to_status,note) values(m.id,auth.uid(),m.status,target,note);end if;
  result:=jsonb_build_object('requestId',m.id,'revision',new_id);
 else raise exception 'Action unavailable' using errcode='22023';end if;
 insert into rentlease_tenancy_care.receipts(actor_id,operation_id,input,result) values(auth.uid(),p_operation_id,input,result);
 return result;
end$$;
revoke all on all functions in schema rentlease_tenancy_care from public,anon,authenticated,service_role;
revoke all on function public.get_tenancy_care(uuid,integer), public.get_tenancy_maintenance_history(uuid,integer),public.write_tenancy_care(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.get_tenancy_care(uuid,integer),public.get_tenancy_maintenance_history(uuid,integer),public.write_tenancy_care(uuid,uuid,text,jsonb) to authenticated;
commit;
