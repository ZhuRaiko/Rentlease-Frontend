-- PREPARED ONLY. Phase 2A nullable model attributes; no backfill or inference rollout.
begin;
do $guard$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_property_setup_v2','update_property_details_v2','get_owned_property_edit_context_v2')) then raise exception 'Unexpected existing Phase 2A RPC; reconcile before apply';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.create_property_setup(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint)') and md5(replace(prosrc,chr(13),''))='c4301641683a1305ff370b9ba846148e' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=pg_catalog']) then raise exception 'Phase 2A baseline mismatch: create_property_setup';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,furnishing_status,bigint[],text)') and md5(replace(prosrc,chr(13),''))='259be4708df7eada91f6cd5a06452001' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=pg_catalog']) then raise exception 'Phase 2A baseline mismatch: update_property_details';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.get_owned_property_edit_context(uuid)') and md5(replace(prosrc,chr(13),''))='1f4c7bccb193bc4558b48073f3318c13' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=pg_catalog']) then raise exception 'Phase 2A baseline mismatch: get_owned_property_edit_context';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('rentlease_property_edit.lock_owner(uuid)') and md5(replace(prosrc,chr(13),''))='d92dbc08d296168776d7fa49e96b321c' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=pg_catalog']) then raise exception 'Phase 2A baseline mismatch: lock_owner';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('rentlease_property_edit.rotate_property_details()') and md5(replace(prosrc,chr(13),''))='dad8b80613bcd33bd81a66ada44c92a8' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=pg_catalog']) then raise exception 'Phase 2A baseline mismatch: rotate_property_details';end if;
 if has_table_privilege('authenticated','public.properties','INSERT') or has_table_privilege('authenticated','public.properties','UPDATE') then raise exception 'Unexpected broad property write grant';end if;
end $guard$;
alter table public.properties add column property_subtype text,add column lot_area_sqm numeric(10,2),add column parking_spaces integer;
alter table public.properties add constraint properties_model_subtype_check check(property_subtype is null or
 (property_type='house' and property_subtype in ('house','townhouse','beach_house','villa')) or
 (property_type in ('apartment','condominium') and property_subtype in ('apartment','room','condominium','studio','loft','penthouse','condotel'))),
 add constraint properties_model_lot_check check(lot_area_sqm is null or (lot_area_sqm::text not in ('NaN','Infinity','-Infinity') and lot_area_sqm>=0)),
 add constraint properties_model_parking_check check(parking_spaces is null or parking_spaces>=0);
-- No grants on the new columns: existing caller RLS SELECT applies; writes use v2 RPCs.

CREATE OR REPLACE FUNCTION public.create_property_setup_v2(p_property_type property_type, p_city cavite_city, p_barangay text, p_public_lat double precision, p_public_lng double precision, p_address_line_1 text, p_exact_lat double precision, p_exact_lng double precision, p_amenity_ids bigint[] DEFAULT '{}'::bigint[], p_address_line_2 text DEFAULT NULL::text, p_postal_code text DEFAULT NULL::text, p_access_instructions text DEFAULT NULL::text, p_bedrooms smallint DEFAULT 0, p_bathrooms numeric DEFAULT 0, p_floor_area_sqm numeric DEFAULT NULL::numeric, p_floor_number smallint DEFAULT NULL::smallint, p_total_floors smallint DEFAULT NULL::smallint, p_furnishing_status furnishing_status DEFAULT 'unfurnished'::furnishing_status, p_max_occupants smallint DEFAULT NULL::smallint, p_property_subtype text DEFAULT NULL, p_lot_area_sqm numeric DEFAULT NULL, p_parking_spaces integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
    v_user_id uuid;
    v_property_id uuid;
begin
    -- 1. AUTHENTICATION
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;


    -- 2. ACTIVE ACCOUNT
    if not exists (
        select 1
        from public.profiles p
        where p.id = v_user_id
          and p.account_status = 'active'::public.account_status
    ) then
        raise exception 'Active account required'
            using errcode = '42501';
    end if;


    -- 4. TIER 1 VERIFICATION
    if not public.is_tier1_verified(v_user_id) then
        raise exception 'Tier 1 verification required'
            using errcode = '42501';
    end if;


    -- 5. REQUIRED TEXT
    if p_barangay is null
       or pg_catalog.btrim(p_barangay) = '' then
        raise exception 'Barangay is required'
            using errcode = '22023';
    end if;

    if p_address_line_1 is null
       or pg_catalog.btrim(p_address_line_1) = '' then
        raise exception 'Address line 1 is required'
            using errcode = '22023';
    end if;


    -- 6. REQUIRED COORDINATES
    if p_public_lat is null
       or p_public_lng is null
       or p_exact_lat is null
       or p_exact_lng is null then
        raise exception 'Property coordinates are required'
            using errcode = '22023';
    end if;


    -- 7. COORDINATE RANGES
    if p_public_lat < -90
       or p_public_lat > 90
       or p_exact_lat < -90
       or p_exact_lat > 90 then
        raise exception 'Invalid latitude'
            using errcode = '22023';
    end if;

    if p_public_lng < -180
       or p_public_lng > 180
       or p_exact_lng < -180
       or p_exact_lng > 180 then
        raise exception 'Invalid longitude'
            using errcode = '22023';
    end if;


    -- 8. AMENITY VALIDATION
    if exists (
        select 1
        from pg_catalog.unnest(
            coalesce(
                p_amenity_ids,
                '{}'::bigint[]
            )
        ) as selected(amenity_id)

        left join public.amenities a
            on a.id = selected.amenity_id

        where a.id is null
           or a.is_active = false
    ) then
        raise exception 'One or more amenities are invalid or inactive'
            using errcode = '22023';
    end if;


    if p_lot_area_sqm is not null and (p_lot_area_sqm::text in ('NaN','Infinity','-Infinity') or p_lot_area_sqm<0 or round(p_lot_area_sqm,2)>=100000000) then raise exception 'Check optional lot area' using errcode='22023';end if;
    if p_parking_spaces is not null and p_parking_spaces<0 then raise exception 'Check optional parking spaces' using errcode='22023';end if;
    -- 9. CREATE PROPERTY
    insert into public.properties (
        landlord_id,
        property_type,
        city,
        barangay,
        public_location,
        bedrooms,
        bathrooms,
        floor_area_sqm,
        floor_number,
        total_floors,
        furnishing_status,
        max_occupants, property_subtype, lot_area_sqm, parking_spaces
    )
    values (
        v_user_id,
        p_property_type,
        p_city,
        pg_catalog.btrim(p_barangay),

        extensions.st_setsrid(
            extensions.st_makepoint(
                p_public_lng,
                p_public_lat
            ),
            4326
        )::extensions.geography,

        p_bedrooms,
        p_bathrooms,
        p_floor_area_sqm,
        p_floor_number,
        p_total_floors,
        p_furnishing_status,
        p_max_occupants, p_property_subtype, p_lot_area_sqm, p_parking_spaces
    )
    returning id into v_property_id;


    -- 10. CREATE PRIVATE LOCATION
    insert into public.property_private_locations (
        property_id,
        address_line_1,
        address_line_2,
        postal_code,
        exact_location,
        access_instructions
    )
    values (
        v_property_id,

        pg_catalog.btrim(p_address_line_1),

        nullif(
            pg_catalog.btrim(p_address_line_2),
            ''
        ),

        nullif(
            pg_catalog.btrim(p_postal_code),
            ''
        ),

        extensions.st_setsrid(
            extensions.st_makepoint(
                p_exact_lng,
                p_exact_lat
            ),
            4326
        )::extensions.geography,

        nullif(
            pg_catalog.btrim(p_access_instructions),
            ''
        )
    );


    -- 11. ATTACH AMENITIES
    insert into public.property_amenities (
        property_id,
        amenity_id
    )
    select
        v_property_id,
        selected.amenity_id
    from (
        select distinct
            pg_catalog.unnest(
                coalesce(
                    p_amenity_ids,
                    '{}'::bigint[]
                )
            ) as amenity_id
    ) selected;


    -- 12. RETURN RESULT
    return pg_catalog.jsonb_build_object(
        'property_id', v_property_id,
        'status', 'created'
    );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_property_details_v2(p_property_id uuid, p_expected_edit_version uuid, p_request_id uuid, p_bedrooms smallint, p_bathrooms numeric, p_floor_area_sqm numeric, p_max_occupants smallint, p_total_floors smallint, p_furnishing_status furnishing_status, p_amenity_ids bigint[], p_access_instructions text, p_property_subtype text DEFAULT NULL, p_lot_area_sqm numeric DEFAULT NULL, p_parking_spaces integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare current_property public.properties%rowtype;receipt rentlease_property_edit.detail_receipts%rowtype;body jsonb;result jsonb;
begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 if p_request_id is null or p_expected_edit_version is null then raise exception 'Edit version and request ID required' using errcode='22023';end if;
 body:=jsonb_build_object('schema_version',2,'property_subtype',p_property_subtype,'lot_area_sqm',p_lot_area_sqm,'parking_spaces',p_parking_spaces,'version',p_expected_edit_version,'property_id',p_property_id,'bedrooms',p_bedrooms,'bathrooms',p_bathrooms,'floor_area_sqm',p_floor_area_sqm,'max_occupants',p_max_occupants,'total_floors',p_total_floors,'furnishing_status',p_furnishing_status,'amenity_ids',p_amenity_ids,'access_instructions',nullif(btrim(p_access_instructions),''));
 select * into receipt from rentlease_property_edit.detail_receipts where owner_id=auth.uid() and request_id=p_request_id;
 if found then
  if receipt.input is distinct from body then raise exception 'Operation ID reused' using errcode='22023';end if;
  return receipt.result;
 end if;
 select * into current_property from public.properties where id=p_property_id;
 if current_property.edit_version is distinct from p_expected_edit_version then raise exception 'Property changed. Reload before saving' using errcode='40001';end if;
    if p_lot_area_sqm is not null and (p_lot_area_sqm::text in ('NaN','Infinity','-Infinity') or p_lot_area_sqm<0 or round(p_lot_area_sqm,2)>=100000000) then raise exception 'Check optional lot area' using errcode='22023';end if;
    if p_parking_spaces is not null and p_parking_spaces<0 then raise exception 'Check optional parking spaces' using errcode='22023';end if;
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
   or current_property.floor_area_sqm is distinct from round(p_floor_area_sqm,2) or current_property.max_occupants is distinct from p_max_occupants or current_property.property_subtype is distinct from p_property_subtype or current_property.lot_area_sqm is distinct from round(p_lot_area_sqm,2) or current_property.parking_spaces is distinct from p_parking_spaces)
  and exists(select 1 from public.tenancies where property_id=p_property_id and status in ('proposed','pending_confirmation','active')) then
  raise exception 'Property size, subtype, parking and capacity cannot change during an open tenancy' using errcode='22023';end if;
 -- Existing related triggers refresh active completeness; inserts precede removals so
 -- a full-set amenity replacement never transiently removes all amenity contribution.
 insert into public.property_amenities(property_id,amenity_id) select p_property_id,id from unnest(p_amenity_ids) id on conflict(property_id,amenity_id) do nothing;
 update public.properties set bedrooms=p_bedrooms,bathrooms=p_bathrooms,floor_area_sqm=p_floor_area_sqm,max_occupants=p_max_occupants,total_floors=p_total_floors,furnishing_status=p_furnishing_status,property_subtype=p_property_subtype,lot_area_sqm=p_lot_area_sqm,parking_spaces=p_parking_spaces where id=p_property_id;
 update public.property_private_locations set access_instructions=nullif(btrim(p_access_instructions),'') where property_id=p_property_id;
 if not found then raise exception 'Saved private property context is missing' using errcode='22023';end if;
 delete from public.property_amenities where property_id=p_property_id and not(amenity_id=any(p_amenity_ids));
 perform rentlease_completeness.refresh_listing_completeness_for_property(p_property_id);
 if exists(select 1 from public.listings where property_id=p_property_id and status in ('active','paused') and completeness_score<.80) then
  raise exception 'These changes would put a published or paused listing below 80%% completeness' using errcode='22023';end if;
 result:=jsonb_build_object('property_id',p_property_id,'edit_version',(select edit_version from public.properties where id=p_property_id));
 insert into rentlease_property_edit.detail_receipts values(auth.uid(),p_request_id,p_property_id,body,result);
 return result;
end$function$
;
create function public.get_owned_property_edit_context_v2(p_property_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 result:=public.get_owned_property_edit_context(p_property_id);
 return result||(select jsonb_build_object('model_attributes_version',2,'property_subtype',p.property_subtype,'lot_area_sqm',p.lot_area_sqm,'parking_spaces',p.parking_spaces) from public.properties p where p.id=p_property_id);
end$$;
alter function public.create_property_setup_v2(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint,text,numeric,integer) owner to postgres;
revoke all on function public.create_property_setup_v2(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint,text,numeric,integer) from public,anon;
grant execute on function public.create_property_setup_v2(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint,text,numeric,integer) to authenticated;
alter function public.update_property_details_v2(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,furnishing_status,bigint[],text,text,numeric,integer) owner to postgres;
revoke all on function public.update_property_details_v2(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,furnishing_status,bigint[],text,text,numeric,integer) from public,anon;
grant execute on function public.update_property_details_v2(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,furnishing_status,bigint[],text,text,numeric,integer) to authenticated;
alter function public.get_owned_property_edit_context_v2(uuid) owner to postgres;
revoke all on function public.get_owned_property_edit_context_v2(uuid) from public,anon;
grant execute on function public.get_owned_property_edit_context_v2(uuid) to authenticated;
commit;
