-- LOCAL PREPARATION ONLY. T1 owner proposal + explicit renter confirmation.
begin;
do $baseline$
begin
 if not (select relrowsecurity from pg_class where oid='public.tenancies'::regclass)
 or has_table_privilege('authenticated','public.tenancies','INSERT') or has_table_privilege('authenticated','public.tenancies','UPDATE') or has_table_privilege('authenticated','public.tenancies','DELETE') then
 raise exception 'Tenancy RLS/write privilege baseline drift';end if;
 if (select count(*) from pg_trigger where tgrelid='public.tenancies'::regclass and tgenabled='O' and not tgisinternal and tgname in('aaa_tenancy_property_gate','aab_tenancy_identity_gate','aac_reservation_tenancy_commitment','trg_sync_listing_from_tenancy','trg_tenancies_updated_at','trg_validate_tenancy'))<>6 then
 raise exception 'Existing tenancy guards must remain enabled';end if;
end $baseline$;
create schema rentlease_tenancy_setup;
revoke all on schema rentlease_tenancy_setup from public,anon,authenticated,service_role;
create table rentlease_tenancy_setup.bindings(
 reservation_id uuid primary key references public.rental_reservations(id),
 tenancy_id uuid not null unique references public.tenancies(id), revision uuid not null default gen_random_uuid()
);
create table rentlease_tenancy_setup.receipts(
 actor_id uuid not null, operation_id uuid not null, input jsonb not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id)
);
alter table rentlease_tenancy_setup.bindings enable row level security;
alter table rentlease_tenancy_setup.receipts enable row level security;
revoke all on all tables in schema rentlease_tenancy_setup from public,anon,authenticated,service_role;
-- All IDs/participants/dates derive from the actual reservation; no client participant IDs.
create function rentlease_tenancy_setup.context(p_reservation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.rental_reservations%rowtype;p public.properties%rowtype;l public.listings%rowtype;c public.conversations%rowtype;
 t public.tenancies%rowtype;b rentlease_tenancy_setup.bindings%rowtype;i uuid;reason text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Active Tier 1 required' using errcode='42501';end if;
 select * into r from public.rental_reservations where id=p_reservation_id;
 if r.id is null or auth.uid() not in(r.tenant_id,r.landlord_id) then raise exception 'Participant access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.property_id::text,0));
 select * into r from public.rental_reservations where id=p_reservation_id for share;
 select * into p from public.properties where id=r.property_id for share;
 select * into l from public.listings where id=r.listing_id for share;
 select * into c from public.conversations where id=r.conversation_id for share;
 if p.id is null or l.id is null or c.id is null or l.property_id<>p.id or l.landlord_id<>r.landlord_id or p.landlord_id<>r.landlord_id
 or c.listing_id<>r.listing_id or c.tenant_id<>r.tenant_id or c.landlord_id<>r.landlord_id then raise exception 'Rental relationship changed' using errcode='42501';end if;
 select * into b from rentlease_tenancy_setup.bindings where reservation_id=r.id;
 select * into t from public.tenancies where id=b.tenancy_id for share;
 if t.id is not null and (t.property_id<>p.id or t.listing_id<>l.id or t.tenant_id<>r.tenant_id or t.landlord_id<>r.landlord_id or t.conversation_id is distinct from c.id) then raise exception 'Tenancy relationship mismatch' using errcode='42501';end if;
 select revision_id into i from rentlease_property_identity.current_identity where property_id=p.id;
 if not p.is_active or public.is_tier1_verified(r.tenant_id) is not true or public.is_tier1_verified(r.landlord_id) is not true then reason:='Both participants and the property must remain active.';
 elsif r.status<>'approved' or r.expires_at<=clock_timestamp() then reason:='An effective approved reservation is required.';
 elsif c.status<>'open' or l.status<>'active' or l.published_at is null or (l.available_from is not null and l.available_from>r.move_in_date) then reason:='The original listing and conversation must remain available.';
 elsif i is null or rentlease_property_identity.verified(p.id) is not true then reason:='Current property identity and Tier 3 approval are required.';
 elsif t.id is null and r.move_in_date<(clock_timestamp() at time zone 'Asia/Manila')::date then reason:='Begin tenancy setup on or before the reserved move-in date.';
 elsif exists(select 1 from public.tenancies x where x.property_id=p.id and x.id is distinct from t.id and x.status in('proposed','pending_confirmation','active')
 and daterange(x.start_date,coalesce(x.actual_end_date,x.expected_end_date)+1,'[)')&&daterange(r.move_in_date,r.end_date,'[)')) then reason:='This property has an overlapping tenancy.';
 end if;
 return jsonb_build_object('reservationId',r.id,'tenantId',r.tenant_id,'landlordId',r.landlord_id,'listingTitle',l.title,
 'propertyVersion',p.edit_version,'identityRevision',i,'eligible',reason is null,'reason',reason,'askingRent',l.asking_rent_monthly,
 'startDate',r.move_in_date,'endDate',r.end_date-1,'serverNow',clock_timestamp(),
 'propertySummary',concat_ws(', ',p.property_type::text,p.city::text,p.barangay,concat(p.bedrooms,' bedrooms'),concat(p.bathrooms,' bathrooms'),concat(p.floor_area_sqm,' sqm'),p.furnishing_status::text),
 'setupRevision',b.revision,'tenancy',case when t.id is null then null else jsonb_build_object('id',t.id,'status',t.status,'rent',t.agreed_monthly_rent,'dueDay',t.rent_due_day,
 'ownerConfirmed',t.landlord_confirmed_at is not null,'tenantConfirmed',t.tenant_confirmed_at is not null,'propertyVersion',t.accepted_property_edit_version,'identityRevision',t.accepted_identity_revision_id) end);
end$$;
create function public.get_tenancy_establishment(p_reservation_id uuid) returns jsonb language sql security definer set search_path=pg_catalog as $$select rentlease_tenancy_setup.context(p_reservation_id)$$;
create function public.establish_tenancy(p_reservation_id uuid,p_operation_id uuid,p_property_version uuid,p_identity_revision uuid,p_monthly_rent numeric,p_due_day integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare ctx jsonb;body jsonb;prior rentlease_tenancy_setup.receipts%rowtype;r public.rental_reservations%rowtype;tid uuid;result jsonb;
begin
 ctx:=rentlease_tenancy_setup.context(p_reservation_id);
 body:=jsonb_build_object('kind','establish','reservation',p_reservation_id,'propertyVersion',p_property_version,'identityRevision',p_identity_revision,'rent',p_monthly_rent,'due',p_due_day);
 if p_operation_id is null then raise exception 'Operation ID required' using errcode='22023';end if;
 select * into prior from rentlease_tenancy_setup.receipts where actor_id=auth.uid() and operation_id=p_operation_id;
 if found then if prior.input is distinct from body then raise exception 'Operation reused' using errcode='22023';end if;return prior.result;end if;
 if auth.uid()<>(ctx->>'landlordId')::uuid then raise exception 'Only actual owner can propose tenancy' using errcode='42501';end if;
 if not (ctx->>'eligible')::boolean then raise exception '%',ctx->>'reason' using errcode='22023';end if;
 if ctx->'tenancy'<>'null'::jsonb then raise exception 'This reservation already has a tenancy setup. Reload it.' using errcode='23505';end if;
 if p_property_version is distinct from (ctx->>'propertyVersion')::uuid or p_identity_revision is distinct from (ctx->>'identityRevision')::uuid then raise exception 'Property changed. Review again.' using errcode='40001';end if;
 if p_monthly_rent is null or p_monthly_rent::text in('NaN','Infinity','-Infinity') or p_monthly_rent<=0 or p_monthly_rent<>round(p_monthly_rent,2) or p_monthly_rent>=10000000000 or p_due_day is null or p_due_day not between 1 and 28 then raise exception 'Check rent and due day (1-28)' using errcode='22023';end if;
 select * into r from public.rental_reservations where id=p_reservation_id;
 insert into public.tenancies(listing_id,property_id,conversation_id,tenant_id,landlord_id,status,agreed_monthly_rent,start_date,expected_end_date,rent_due_day,landlord_confirmed_at,created_by,accepted_property_edit_version,accepted_identity_revision_id)
 values(r.listing_id,r.property_id,r.conversation_id,r.tenant_id,r.landlord_id,'pending_confirmation',p_monthly_rent,r.move_in_date,r.end_date-1,p_due_day,clock_timestamp(),auth.uid(),p_property_version,p_identity_revision) returning id into tid;
 insert into rentlease_tenancy_setup.bindings(reservation_id,tenancy_id) values(r.id,tid);
 result:=rentlease_tenancy_setup.context(r.id);
 insert into rentlease_tenancy_setup.receipts(actor_id,operation_id,input,result) values(auth.uid(),p_operation_id,body,result);
 return result;
end$$;
create function public.respond_tenancy_establishment(p_reservation_id uuid,p_operation_id uuid,p_setup_revision uuid,p_property_version uuid,p_identity_revision uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare ctx jsonb;body jsonb;prior rentlease_tenancy_setup.receipts%rowtype;t public.tenancies%rowtype;b rentlease_tenancy_setup.bindings%rowtype;result jsonb;today date:=(clock_timestamp() at time zone 'Asia/Manila')::date;
begin
 ctx:=rentlease_tenancy_setup.context(p_reservation_id);
 body:=jsonb_build_object('kind','respond','reservation',p_reservation_id,'revision',p_setup_revision,'propertyVersion',p_property_version,'identityRevision',p_identity_revision,'action',p_action);
 if p_operation_id is null then raise exception 'Operation ID required' using errcode='22023';end if;
 select * into prior from rentlease_tenancy_setup.receipts where actor_id=auth.uid() and operation_id=p_operation_id;
 if found then if prior.input is distinct from body then raise exception 'Operation reused' using errcode='22023';end if;return prior.result;end if;
 select * into b from rentlease_tenancy_setup.bindings where reservation_id=p_reservation_id for update;
 if b.revision is null or b.revision is distinct from p_setup_revision then raise exception 'Setup changed. Reload.' using errcode='40001';end if;
 select * into t from public.tenancies where id=b.tenancy_id for update;
 if t.status not in('proposed','pending_confirmation') then raise exception 'This setup is no longer pending' using errcode='22023';end if;
 if p_action='cancel' then update public.tenancies set status='cancelled' where id=t.id;
 else
  if not (ctx->>'eligible')::boolean then raise exception '%',ctx->>'reason' using errcode='22023';end if;
  if p_property_version is distinct from (ctx->>'propertyVersion')::uuid or p_identity_revision is distinct from (ctx->>'identityRevision')::uuid then raise exception 'Property changed. Review again.' using errcode='40001';end if;
  if p_action='review' then
   if auth.uid()<>t.landlord_id then raise exception 'Owner review required' using errcode='42501';end if;
   if t.accepted_property_edit_version=p_property_version and t.accepted_identity_revision_id=p_identity_revision then raise exception 'Property already reviewed' using errcode='22023';end if;
   update public.tenancies set accepted_property_edit_version=p_property_version,accepted_identity_revision_id=p_identity_revision,landlord_confirmed_at=clock_timestamp(),tenant_confirmed_at=null where id=t.id;
  elsif p_action in('confirm','activate') then
   if t.accepted_property_edit_version is distinct from p_property_version or t.accepted_identity_revision_id is distinct from p_identity_revision then raise exception 'Owner must review the changed property first' using errcode='40001';end if;
   if p_action='confirm' then
    if auth.uid()<>t.tenant_id or t.tenant_confirmed_at is not null or t.landlord_confirmed_at is null then raise exception 'Renter confirmation required' using errcode='42501';end if;
    update public.tenancies set tenant_confirmed_at=clock_timestamp(),status=case when start_date<=today then 'active'::public.tenancy_status else 'pending_confirmation'::public.tenancy_status end where id=t.id;
   else
    if t.tenant_confirmed_at is null or t.landlord_confirmed_at is null or t.start_date>today then raise exception 'Both confirmations and start date are required' using errcode='22023';end if;
    update public.tenancies set status='active' where id=t.id;
   end if;
  else raise exception 'Invalid setup action' using errcode='22023';end if;
 end if;
 update rentlease_tenancy_setup.bindings set revision=gen_random_uuid() where reservation_id=p_reservation_id;
 result:=rentlease_tenancy_setup.context(p_reservation_id);
 insert into rentlease_tenancy_setup.receipts(actor_id,operation_id,input,result) values(auth.uid(),p_operation_id,body,result);
 return result;
end$$;
create function public.get_tenancy_establishment_links(p_reservation_ids uuid[]) returns table(reservation_id uuid,tenancy_id uuid)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Active Tier 1 required' using errcode='42501';end if;
 if p_reservation_ids is null or cardinality(p_reservation_ids) not between 1 and 50 or array_ndims(p_reservation_ids)<>1 or array_position(p_reservation_ids,null) is not null then raise exception 'Invalid bounded reservation batch' using errcode='22023';end if;
 return query select b.reservation_id,b.tenancy_id from rentlease_tenancy_setup.bindings b join public.rental_reservations r on r.id=b.reservation_id join public.tenancies t on t.id=b.tenancy_id
 where r.id=any(p_reservation_ids) and auth.uid() in(r.tenant_id,r.landlord_id) and t.tenant_id=r.tenant_id and t.landlord_id=r.landlord_id and t.property_id=r.property_id and t.listing_id=r.listing_id;
end$$;
revoke all on function public.get_tenancy_establishment_links(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_tenancy_establishment_links(uuid[]) to authenticated;
revoke all on all functions in schema rentlease_tenancy_setup from public,anon,authenticated,service_role;
revoke all on function public.get_tenancy_establishment(uuid),public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer),public.respond_tenancy_establishment(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_tenancy_establishment(uuid),public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer),public.respond_tenancy_establishment(uuid,uuid,uuid,uuid,uuid,text) to authenticated;
commit;
