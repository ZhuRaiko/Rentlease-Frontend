-- LOCAL ONLY. Explicit approval; no consent backfill, no existing RPC replacement.
begin;
create schema rentlease_rental_location;
revoke all on schema rentlease_rental_location from public,anon,authenticated,service_role;
-- No FK: this private adjunct must not obstruct existing physical deletion/evidence gates.
-- Property DELETE trigger removes it; no point/address/owner data is stored here.
create table rentlease_rental_location.approvals (
 property_id uuid primary key, location_revision uuid not null default gen_random_uuid(),
 approved_revision uuid, policy_version text, approved_at timestamptz,
 check ((approved_revision is null and policy_version is null and approved_at is null)
 or (approved_revision is not null and policy_version is not null and approved_revision=location_revision and policy_version='rental-public-location-v1' and approved_at is not null))
);
alter table rentlease_rental_location.approvals enable row level security;
revoke all on rentlease_rental_location.approvals from public,anon,authenticated,service_role;
insert into rentlease_rental_location.approvals(property_id) select id from public.properties;
create function rentlease_rental_location.invalidate() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid;
begin
 if TG_TABLE_NAME='properties' then
  if TG_OP='DELETE' then delete from rentlease_rental_location.approvals where property_id=old.id;return old;end if;
  if TG_OP='UPDATE' then
   if row(new.id,new.landlord_id,new.is_active,new.property_type,new.city,new.barangay,new.floor_number,new.public_location::text)
    is not distinct from row(old.id,old.landlord_id,old.is_active,old.property_type,old.city,old.barangay,old.floor_number,old.public_location::text) then return new;end if;
   if old.id is distinct from new.id then delete from rentlease_rental_location.approvals where property_id=old.id;end if;
  end if;
  insert into rentlease_rental_location.approvals(property_id) values(new.id)
  on conflict(property_id) do update set location_revision=gen_random_uuid(),approved_revision=null,policy_version=null,approved_at=null;
 else
  if TG_OP='UPDATE' then
   if TG_TABLE_NAME='property_private_locations' then
    -- Compare provenance fields only, never return or persist private values.
    if row(new.property_id,new.address_line_1,new.address_line_2,new.postal_code,new.exact_location::text)
     is not distinct from row(old.property_id,old.address_line_1,old.address_line_2,old.postal_code,old.exact_location::text) then return new;end if;
   elsif row(new.property_id,new.revision_id) is not distinct from row(old.property_id,old.revision_id) then return new;
   end if;
  end if;
  for target in select distinct id from unnest(case when TG_OP='INSERT' then array[new.property_id] when TG_OP='DELETE' then array[old.property_id] else array[old.property_id,new.property_id] end) ids(id) where id is not null order by id loop
   update rentlease_rental_location.approvals set location_revision=gen_random_uuid(),approved_revision=null,policy_version=null,approved_at=null where property_id=target;
  end loop;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end$$;
create trigger rental_location_revision after insert or update or delete on public.properties for each row execute function rentlease_rental_location.invalidate();
create trigger rental_location_private_invalidation after insert or update or delete on public.property_private_locations for each row execute function rentlease_rental_location.invalidate();
create trigger rental_location_identity_invalidation after insert or update or delete on rentlease_property_identity.current_identity for each row execute function rentlease_rental_location.invalidate();
-- Grid validation is additional validation, never approval evidence.
create function rentlease_rental_location.grid_valid(point extensions.geography) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case when point is null then false
 when extensions.st_srid(point::extensions.geometry)<>4326 or extensions.st_geometrytype(point::extensions.geometry)<>'ST_Point' then false
 when not (extensions.st_y(point::extensions.geometry) between -85.05112878 and 85.05112878 and extensions.st_x(point::extensions.geometry) between -180 and 180) then false
 else abs((extensions.st_x(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)-round((extensions.st_x(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)::numeric))<0.0000001
 and abs((extensions.st_y(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)-round((extensions.st_y(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)::numeric))<0.0000001 end
$$;
create function public.get_rental_location_approval(p_property_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.properties%rowtype; a rentlease_rental_location.approvals%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 select * into p from public.properties where id=p_property_id and landlord_id=auth.uid() and is_active for share;
 if p.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 select * into a from rentlease_rental_location.approvals where property_id=p.id for share;
 return jsonb_build_object('revision',a.location_revision,'approved',coalesce(a.approved_revision=a.location_revision and a.policy_version='rental-public-location-v1',false),'policy','rental-public-location-v1','eligible',rentlease_rental_location.grid_valid(p.public_location),'point',case when rentlease_rental_location.grid_valid(p.public_location) then jsonb_build_object('latitude',extensions.st_y(p.public_location::extensions.geometry),'longitude',extensions.st_x(p.public_location::extensions.geometry)) else null end);
end$$;
create function public.set_rental_location_approval(p_property_id uuid,p_revision uuid,p_approve boolean,p_policy text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.properties%rowtype; a rentlease_rental_location.approvals%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true or p_approve is null then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 select * into p from public.properties where id=p_property_id and landlord_id=auth.uid() and is_active for update;
 if p.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 select * into a from rentlease_rental_location.approvals where property_id=p.id for update;
 if a.location_revision is null or a.location_revision is distinct from p_revision or p_policy is distinct from 'rental-public-location-v1' then raise exception 'Location changed. Reload approval.' using errcode='40001';end if;
 if p_approve and not rentlease_rental_location.grid_valid(p.public_location) then raise exception 'Confirmed public grid point required' using errcode='22023';end if;
 update rentlease_rental_location.approvals set approved_revision=case when p_approve then location_revision end,policy_version=case when p_approve then p_policy end,approved_at=case when p_approve then statement_timestamp() end where property_id=p.id;
 return public.get_rental_location_approval(p.id);
end$$;
create function public.get_rental_prediction_coordinates(p_property_id uuid,p_listing_id uuid,p_edit_version uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.properties%rowtype; a rentlease_rental_location.approvals%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 select * into p from public.properties where id=p_property_id and is_active for share;
 if p.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_listing_id is not null then
  perform 1 from public.listings l where l.id=p_listing_id and l.property_id=p.id and l.landlord_id=p.landlord_id
   and (p.landlord_id=auth.uid() or (l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))) for share;
  if not found then raise exception 'Access unavailable' using errcode='42501';end if;
 elsif p.landlord_id<>auth.uid() then raise exception 'Access unavailable' using errcode='42501';end if;
 select * into a from rentlease_rental_location.approvals where property_id=p.id for share;
 if p.edit_version is distinct from p_edit_version or a.approved_revision is distinct from a.location_revision or a.approved_at is null or a.approved_at>statement_timestamp() or a.policy_version is distinct from 'rental-public-location-v1' or not rentlease_rental_location.grid_valid(p.public_location) then return null;end if;
 return jsonb_build_object('propertyId',p.id,'editVersion',p.edit_version,'locationRevision',a.location_revision,'approvedRevision',a.approved_revision,'policy',a.policy_version,'latitude',extensions.st_y(p.public_location::extensions.geometry),'longitude',extensions.st_x(p.public_location::extensions.geometry));
end$$;
revoke all on all functions in schema rentlease_rental_location from public,anon,authenticated,service_role;
revoke all on function public.get_rental_location_approval(uuid),public.set_rental_location_approval(uuid,uuid,boolean,text),public.get_rental_prediction_coordinates(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_rental_location_approval(uuid),public.set_rental_location_approval(uuid,uuid,boolean,text),public.get_rental_prediction_coordinates(uuid,uuid,uuid) to authenticated;
commit;
