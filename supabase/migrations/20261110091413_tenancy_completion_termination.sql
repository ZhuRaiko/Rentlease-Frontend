-- LOCAL T6 ONLY. Explicit completion or two-party same-day termination; no auto-end.
begin;
create schema rentlease_tenancy_end;
revoke all on schema rentlease_tenancy_end from public,anon,authenticated,service_role;
do $$begin
 if has_table_privilege('authenticated','public.tenancies','INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','public.tenancies','UPDATE') then raise exception 'Unexpected tenancy write grant';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.tenancies'::regclass and tgname='trg_sync_listing_from_tenancy' and tgenabled='O') then raise exception 'Required tenancy synchronization missing';end if;
end$$;
create table rentlease_tenancy_end.requests(
 id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 initiator_id uuid not null, proposed_end_date date not null,reason text not null check(length(reason) between 1 and 1000),
 base_version text not null,original_terms jsonb not null,revision uuid not null default gen_random_uuid(),
 status text not null default 'pending' check(status in('pending','accepted','rejected','withdrawn')),
 created_at timestamptz not null default statement_timestamp(),resolved_at timestamptz,resolved_by uuid,
 check((status='pending' and resolved_at is null and resolved_by is null) or (status<>'pending' and resolved_at is not null and resolved_by is not null)));
create unique index one_pending_tenancy_end on rentlease_tenancy_end.requests(tenancy_id) where status='pending';
create table rentlease_tenancy_end.events(
 id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 actor_id uuid not null,action text not null check(action in('complete','request_end','accept','reject','withdraw')),
 request_id uuid references rentlease_tenancy_end.requests(id) on delete restrict,
 end_date date,reason text not null,original_terms jsonb not null,created_at timestamptz not null default statement_timestamp());
create table rentlease_tenancy_end.receipts(actor_id uuid not null,operation_id uuid not null,input jsonb not null,result jsonb not null,created_at timestamptz not null default statement_timestamp(),primary key(actor_id,operation_id));
alter table rentlease_tenancy_end.requests enable row level security;
alter table rentlease_tenancy_end.events enable row level security;
alter table rentlease_tenancy_end.receipts enable row level security;
revoke all on all tables in schema rentlease_tenancy_end from public,anon,authenticated,service_role;
create function rentlease_tenancy_end.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'Lifecycle evidence is immutable' using errcode='42501';end$$;
create trigger end_events_immutable before update or delete on rentlease_tenancy_end.events for each row execute function rentlease_tenancy_end.immutable();
create trigger end_receipts_immutable before update or delete on rentlease_tenancy_end.receipts for each row execute function rentlease_tenancy_end.immutable();
create function rentlease_tenancy_end.guard_request() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if TG_OP='DELETE' then raise exception 'Lifecycle request cannot be deleted' using errcode='42501';end if;
 if old.status<>'pending' or new.status='pending' or (to_jsonb(new)-array['status','resolved_at','resolved_by','revision']) is distinct from (to_jsonb(old)-array['status','resolved_at','resolved_by','revision']) then raise exception 'Original lifecycle request cannot be changed' using errcode='42501';end if;return new;end$$;
create trigger end_request_guard before update or delete on rentlease_tenancy_end.requests for each row execute function rentlease_tenancy_end.guard_request();
create function rentlease_tenancy_end.relationship(p_id uuid) returns public.tenancies language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies;target uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select property_id into target from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id);
 if target is null then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into t from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id) for update;
 if t.id is null then raise exception 'Access unavailable' using errcode='42501';end if;return t;
end$$;
create function rentlease_tenancy_end.version(t public.tenancies) returns text language sql stable set search_path=pg_catalog as $$
 select md5(to_jsonb(t)::text||coalesce(p.edit_version::text,'missing')||coalesce(i.revision_id::text,'missing'))
 from public.properties p left join rentlease_property_identity.current_identity i on i.property_id=p.id where p.id=t.property_id
$$;
create function public.get_tenancy_lifecycle(p_tenancy_id uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies;
begin
 t:=rentlease_tenancy_end.relationship(p_tenancy_id);
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 return jsonb_build_object('tenancyId',t.id,'tenantId',t.tenant_id,'landlordId',t.landlord_id,'status',t.status,'today',(statement_timestamp() at time zone 'Asia/Manila')::date,
 'startDate',t.start_date,'expectedEndDate',t.expected_end_date,'actualEndDate',t.actual_end_date,'endedAt',t.ended_at,'version',rentlease_tenancy_end.version(t),
 'pending',(select jsonb_build_object('id',r.id,'revision',r.revision,'initiatorId',r.initiator_id,'date',r.proposed_end_date,'reason',r.reason,'version',r.base_version) from rentlease_tenancy_end.requests r where r.tenancy_id=t.id and r.status='pending'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'actorId',e.actor_id,'action',e.action,'requestId',e.request_id,'date',e.end_date,'reason',e.reason,'createdAt',e.created_at)) from (select * from rentlease_tenancy_end.events where tenancy_id=t.id order by created_at desc,id limit 20 offset p_offset) e),'[]'::jsonb));
end$$;
create function public.write_tenancy_lifecycle(p_tenancy_id uuid,p_operation_id uuid,p_action text,p_version text,p_request_revision uuid,p_reason text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies;r rentlease_tenancy_end.requests;c rentlease_tenancy_end.receipts;input jsonb;result jsonb;v text;d date;today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;snapshot jsonb;
begin
 t:=rentlease_tenancy_end.relationship(p_tenancy_id);
 if p_operation_id is null or p_action is null or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Reason required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation_id::text,2));
 input:=jsonb_build_object('tenancyId',t.id,'action',p_action,'version',p_version,'requestRevision',p_request_revision,'reason',p_reason);
 select * into c from rentlease_tenancy_end.receipts where actor_id=auth.uid() and operation_id=p_operation_id;
 if found then if c.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;return c.result;end if;
 v:=rentlease_tenancy_end.version(t);snapshot:=to_jsonb(t);
 if v is null or p_version is distinct from v then raise exception 'Tenancy or property changed. Reload.' using errcode='40001';end if;
 if t.status<>'active' or t.start_date>today or t.actual_end_date is not null or t.ended_at is not null then raise exception 'Active tenancy required' using errcode='42501';end if;
 select * into r from rentlease_tenancy_end.requests where tenancy_id=t.id and status='pending' for update;
 if p_action='complete' then
  if r.id is not null or t.expected_end_date is null or today<=t.expected_end_date then raise exception 'Recorded period has not ended or a request is pending' using errcode='22023';end if;
  d:=t.expected_end_date;
 elsif p_action='request_end' then
  if r.id is not null then raise exception 'An ending request is already pending' using errcode='23505';end if;
  if t.expected_end_date is not null and today>=t.expected_end_date then raise exception 'Early ending requires a date before the recorded end' using errcode='22023';end if;
  insert into rentlease_tenancy_end.requests(tenancy_id,initiator_id,proposed_end_date,reason,base_version,original_terms)
   values(t.id,auth.uid(),today,btrim(p_reason),v,snapshot) returning * into r;
 elsif p_action in('accept','reject','withdraw') then
  if r.id is null or p_request_revision is distinct from r.revision then raise exception 'Request changed. Reload.' using errcode='40001';end if;
  if (p_action='withdraw' and auth.uid()<>r.initiator_id) or (p_action<>'withdraw' and auth.uid()=r.initiator_id) then raise exception 'Other participant confirmation required' using errcode='42501';end if;
  if p_action='accept' then
   if r.base_version is distinct from v or r.proposed_end_date<>today or (t.expected_end_date is not null and today>=t.expected_end_date) then raise exception 'Request no longer current. Withdraw or reject and review again.' using errcode='40001';end if;
   d:=r.proposed_end_date;
  end if;
  update rentlease_tenancy_end.requests set status=case p_action when 'accept' then 'accepted' when 'reject' then 'rejected' else 'withdrawn' end,resolved_at=statement_timestamp(),resolved_by=auth.uid(),revision=gen_random_uuid() where id=r.id;
 else raise exception 'Action unavailable' using errcode='22023';end if;
 if d is not null then
  update public.tenancies set status='ended',actual_end_date=d,ended_at=statement_timestamp() where id=t.id;
 end if;
 insert into rentlease_tenancy_end.events(tenancy_id,actor_id,action,request_id,end_date,reason,original_terms) values(t.id,auth.uid(),p_action,r.id,coalesce(d,r.proposed_end_date),btrim(p_reason),snapshot);
 result:=public.get_tenancy_lifecycle(t.id);
 insert into rentlease_tenancy_end.receipts(actor_id,operation_id,input,result) values(auth.uid(),p_operation_id,input,result);
 return result;
end$$;
revoke all on all functions in schema rentlease_tenancy_end from public,anon,authenticated,service_role;
revoke all on function public.get_tenancy_lifecycle(uuid,integer),public.write_tenancy_lifecycle(uuid,uuid,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_tenancy_lifecycle(uuid,integer),public.write_tenancy_lifecycle(uuid,uuid,text,text,uuid,text) to authenticated;
commit;
