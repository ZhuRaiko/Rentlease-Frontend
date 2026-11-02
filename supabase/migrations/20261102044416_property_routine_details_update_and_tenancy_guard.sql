-- Milestone 3: PREPARED LOCALLY, NOT DEPLOYED. Requires deployed media/version infrastructure.
begin;
do $$begin
 if to_regprocedure('rentlease_property_edit.lock_owner(uuid)') is null then raise exception 'Versioned property infrastructure required';end if;
end$$;
create table rentlease_property_edit.detail_receipts(
 owner_id uuid not null,request_id uuid not null,property_id uuid not null references public.properties(id),
 input jsonb not null,result jsonb not null,primary key(owner_id,request_id)
);
alter table rentlease_property_edit.detail_receipts enable row level security;
revoke all on rentlease_property_edit.detail_receipts from public,anon,authenticated;
-- Existing tenancies are not assigned fabricated historical consent. A new/reconfirmed
-- open tenancy must carry the version explicitly accepted by its authorized caller.
alter table public.tenancies add column accepted_property_edit_version uuid;
create function rentlease_property_edit.guard_tenancy_property_version() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare v uuid;target uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if tg_op='UPDATE' and (new.property_id<>old.property_id or new.listing_id<>old.listing_id) then
  raise exception 'Tenancy property and listing cannot be reassigned' using errcode='22023';end if;
 if tg_op='DELETE' then target:=old.property_id;else target:=new.property_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 if tg_op='DELETE' then return old;end if;
 if new.status in ('proposed','pending_confirmation','active') and
  (tg_op='INSERT' or new.status is distinct from old.status
   or new.tenant_confirmed_at is distinct from old.tenant_confirmed_at
   or new.landlord_confirmed_at is distinct from old.landlord_confirmed_at
   or new.accepted_property_edit_version is distinct from old.accepted_property_edit_version) then
  select edit_version into v from public.properties where id=target;
  if new.accepted_property_edit_version is null or new.accepted_property_edit_version is distinct from v then
   raise exception 'Property changed. Both parties must review the current property before confirming' using errcode='40001';end if;
 end if;
 return new;
end$$;
revoke all on function rentlease_property_edit.guard_tenancy_property_version() from public,anon,authenticated;
create trigger aaa_tenancy_property_gate before insert or update or delete on public.tenancies
for each row execute function rentlease_property_edit.guard_tenancy_property_version();

-- Rotate only physical details/identity, never unrelated media tokens or timestamps.
create function rentlease_property_edit.rotate_property_details() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if (to_jsonb(old)-array['updated_at','media_version','edit_version']) is distinct from (to_jsonb(new)-array['updated_at','media_version','edit_version']) then
  perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
  new.edit_version:=gen_random_uuid();
 end if;return new;
end$$;
create trigger property_details_rotate before update on public.properties for each row execute function rentlease_property_edit.rotate_property_details();
create function rentlease_property_edit.rotate_related_details() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid;
begin
 if tg_op='UPDATE' and (to_jsonb(old)-'updated_at') is not distinct from (to_jsonb(new)-'updated_at') then return null;end if;
 for target in select distinct p from unnest(case when tg_op='INSERT' then array[new.property_id] when tg_op='DELETE' then array[old.property_id] else array[old.property_id,new.property_id] end) p order by p loop
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  update public.properties set edit_version=gen_random_uuid() where id=target;
 end loop;return null;
end$$;
create trigger property_private_details_rotate after insert or update or delete on public.property_private_locations for each row execute function rentlease_property_edit.rotate_related_details();
create trigger property_amenity_details_rotate after insert or update or delete on public.property_amenities for each row execute function rentlease_property_edit.rotate_related_details();
revoke all on function rentlease_property_edit.rotate_property_details(),rentlease_property_edit.rotate_related_details() from public,anon,authenticated;

create function public.get_owned_property_edit_context(p_property_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 select jsonb_build_object('owner_id',p.landlord_id,'property_id',p.id,'edit_version',p.edit_version,'property_type',p.property_type,'city',p.city,'barangay',p.barangay,'floor_number',p.floor_number,
  'bedrooms',p.bedrooms,'bathrooms',p.bathrooms,'floor_area_sqm',p.floor_area_sqm,'max_occupants',p.max_occupants,'total_floors',p.total_floors,'furnishing_status',p.furnishing_status,
  'access_instructions',pl.access_instructions,
  'amenity_ids',coalesce((select jsonb_agg(amenity_id order by amenity_id) from public.property_amenities where property_id=p.id),'[]'::jsonb),
  'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'is_active',a.is_active) order by a.id) from public.amenities a where a.is_active or exists(select 1 from public.property_amenities pa where pa.property_id=p.id and pa.amenity_id=a.id)),'[]'::jsonb),
  'open_tenancy',exists(select 1 from public.tenancies t where t.property_id=p.id and t.status in ('proposed','pending_confirmation','active')))
 into result from public.properties p join public.property_private_locations pl on pl.property_id=p.id where p.id=p_property_id;
 if result is null then raise exception 'Saved private property context is missing' using errcode='22023';end if;
 return result;
end$$;
create function public.get_property_details_operation(p_property_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 return (select result from rentlease_property_edit.detail_receipts where owner_id=auth.uid() and property_id=p_property_id and request_id=p_request_id);
end$$;
create function public.update_property_details(
 p_property_id uuid,p_expected_edit_version uuid,p_request_id uuid,
 p_bedrooms smallint,p_bathrooms numeric,p_floor_area_sqm numeric,p_max_occupants smallint,
 p_total_floors smallint,p_furnishing_status public.furnishing_status,p_amenity_ids bigint[],p_access_instructions text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare current_property public.properties%rowtype;receipt rentlease_property_edit.detail_receipts%rowtype;body jsonb;result jsonb;
begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 if p_request_id is null or p_expected_edit_version is null then raise exception 'Edit version and request ID required' using errcode='22023';end if;
 body:=jsonb_build_object('version',p_expected_edit_version,'property_id',p_property_id,'bedrooms',p_bedrooms,'bathrooms',p_bathrooms,'floor_area_sqm',p_floor_area_sqm,'max_occupants',p_max_occupants,'total_floors',p_total_floors,'furnishing_status',p_furnishing_status,'amenity_ids',p_amenity_ids,'access_instructions',nullif(btrim(p_access_instructions),''));
 select * into receipt from rentlease_property_edit.detail_receipts where owner_id=auth.uid() and request_id=p_request_id;
 if found then
  if receipt.input is distinct from body then raise exception 'Operation ID reused' using errcode='22023';end if;
  return receipt.result;
 end if;
 select * into current_property from public.properties where id=p_property_id;
 if current_property.edit_version is distinct from p_expected_edit_version then raise exception 'Property changed. Reload before saving' using errcode='40001';end if;
 if p_bedrooms is null or p_bedrooms<0 or p_bathrooms is null or p_bathrooms::text in ('NaN','Infinity','-Infinity') or p_bathrooms<0 or round(p_bathrooms,1)>=1000
  or (p_floor_area_sqm is not null and (p_floor_area_sqm::text in ('NaN','Infinity','-Infinity') or round(p_floor_area_sqm,2)<=0 or round(p_floor_area_sqm,2)>=100000000))
  or (p_max_occupants is not null and p_max_occupants<=0) or (p_total_floors is not null and p_total_floors<=0) or p_furnishing_status is null
  or (current_property.floor_number is not null and p_total_floors is not null and current_property.floor_number>p_total_floors) then
  raise exception 'Check property measurements, capacity and building floors' using errcode='22023';end if;
 if p_amenity_ids is null or exists(select 1 from unnest(p_amenity_ids) id where id is null)
  or cardinality(p_amenity_ids)<>(select count(distinct id) from unnest(p_amenity_ids) id)
  or exists(select 1 from unnest(p_amenity_ids) candidate(amenity_id) where not exists(select 1 from public.amenities a where a.id=candidate.amenity_id and a.is_active)) then
  raise exception 'Choose valid current amenities' using errcode='22023';end if;
 if (current_property.bedrooms is distinct from p_bedrooms or current_property.bathrooms is distinct from round(p_bathrooms,1)
   or current_property.floor_area_sqm is distinct from round(p_floor_area_sqm,2) or current_property.max_occupants is distinct from p_max_occupants)
  and exists(select 1 from public.tenancies where property_id=p_property_id and status in ('proposed','pending_confirmation','active')) then
  raise exception 'Bedrooms, bathrooms, floor area and capacity cannot change during an open tenancy' using errcode='22023';end if;
 -- Existing related triggers refresh active completeness; inserts precede removals so
 -- a full-set amenity replacement never transiently removes all amenity contribution.
 insert into public.property_amenities(property_id,amenity_id) select p_property_id,id from unnest(p_amenity_ids) id on conflict(property_id,amenity_id) do nothing;
 update public.properties set bedrooms=p_bedrooms,bathrooms=p_bathrooms,floor_area_sqm=p_floor_area_sqm,max_occupants=p_max_occupants,total_floors=p_total_floors,furnishing_status=p_furnishing_status where id=p_property_id;
 update public.property_private_locations set access_instructions=nullif(btrim(p_access_instructions),'') where property_id=p_property_id;
 if not found then raise exception 'Saved private property context is missing' using errcode='22023';end if;
 delete from public.property_amenities where property_id=p_property_id and not(amenity_id=any(p_amenity_ids));
 perform rentlease_completeness.refresh_listing_completeness_for_property(p_property_id);
 if exists(select 1 from public.listings where property_id=p_property_id and status in ('active','paused') and completeness_score<.80) then
  raise exception 'These changes would put a published or paused listing below 80%% completeness' using errcode='22023';end if;
 result:=jsonb_build_object('property_id',p_property_id,'edit_version',(select edit_version from public.properties where id=p_property_id));
 insert into rentlease_property_edit.detail_receipts values(auth.uid(),p_request_id,p_property_id,body,result);
 return result;
end$$;
revoke all on function public.get_owned_property_edit_context(uuid),public.get_property_details_operation(uuid,uuid),public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,bigint[],text) from public,anon;
grant execute on function public.get_owned_property_edit_context(uuid),public.get_property_details_operation(uuid,uuid),public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,bigint[],text) to authenticated;
commit;
