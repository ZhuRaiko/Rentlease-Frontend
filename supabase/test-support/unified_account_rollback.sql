-- LOCAL-VALIDATED ONLY; separate deployment authorization required.
-- Source: read-only contract snapshot, cxfsbwbwmwmgtqfonqth, 2026-11-02.
-- No legacy role records, set_user_roles, identity transitions or Storage policies are rewritten.
begin;
do $migration$
declare f record; definition text; source text;
begin
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.create_property_setup(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint)');
 if source is null or md5(replace(source,chr(13),''))<>'c4301641683a1305ff370b9ba846148e' then raise exception 'Authorization source drift: create_property_setup';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.create_property_setup(p_property_type property_type, p_city cavite_city, p_barangay text, p_public_lat double precision, p_public_lng double precision, p_address_line_1 text, p_exact_lat double precision, p_exact_lng double precision, p_amenity_ids bigint[] DEFAULT ''{}''::bigint[], p_address_line_2 text DEFAULT NULL::text, p_postal_code text DEFAULT NULL::text, p_access_instructions text DEFAULT NULL::text, p_bedrooms smallint DEFAULT 0, p_bathrooms numeric DEFAULT 0, p_floor_area_sqm numeric DEFAULT NULL::numeric, p_floor_number smallint DEFAULT NULL::smallint, p_total_floors smallint DEFAULT NULL::smallint, p_furnishing_status furnishing_status DEFAULT ''unfurnished''::furnishing_status, p_max_occupants smallint DEFAULT NULL::smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
    v_user_id uuid;
    v_property_id uuid;
begin
    -- 1. AUTHENTICATION
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception ''Authentication required''
            using errcode = ''42501'';
    end if;


    -- 2. ACTIVE ACCOUNT
    if not exists (
        select 1
        from public.profiles p
        where p.id = v_user_id
          and p.account_status = ''active''::public.account_status
    ) then
        raise exception ''Active account required''
            using errcode = ''42501'';
    end if;


    -- 3. LANDLORD ROLE
    if not public.has_app_role(
        ''landlord''::public.app_role,
        v_user_id
    ) then
        raise exception ''Landlord role required''
            using errcode = ''42501'';
    end if;


    -- 4. TIER 1 VERIFICATION
    if not public.is_tier1_verified(v_user_id) then
        raise exception ''Tier 1 verification required''
            using errcode = ''42501'';
    end if;


    -- 5. REQUIRED TEXT
    if p_barangay is null
       or pg_catalog.btrim(p_barangay) = '''' then
        raise exception ''Barangay is required''
            using errcode = ''22023'';
    end if;

    if p_address_line_1 is null
       or pg_catalog.btrim(p_address_line_1) = '''' then
        raise exception ''Address line 1 is required''
            using errcode = ''22023'';
    end if;


    -- 6. REQUIRED COORDINATES
    if p_public_lat is null
       or p_public_lng is null
       or p_exact_lat is null
       or p_exact_lng is null then
        raise exception ''Property coordinates are required''
            using errcode = ''22023'';
    end if;


    -- 7. COORDINATE RANGES
    if p_public_lat < -90
       or p_public_lat > 90
       or p_exact_lat < -90
       or p_exact_lat > 90 then
        raise exception ''Invalid latitude''
            using errcode = ''22023'';
    end if;

    if p_public_lng < -180
       or p_public_lng > 180
       or p_exact_lng < -180
       or p_exact_lng > 180 then
        raise exception ''Invalid longitude''
            using errcode = ''22023'';
    end if;


    -- 8. AMENITY VALIDATION
    if exists (
        select 1
        from pg_catalog.unnest(
            coalesce(
                p_amenity_ids,
                ''{}''::bigint[]
            )
        ) as selected(amenity_id)

        left join public.amenities a
            on a.id = selected.amenity_id

        where a.id is null
           or a.is_active = false
    ) then
        raise exception ''One or more amenities are invalid or inactive''
            using errcode = ''22023'';
    end if;


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
        max_occupants
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
        p_max_occupants
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
            ''''
        ),

        nullif(
            pg_catalog.btrim(p_postal_code),
            ''''
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
            ''''
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
                    ''{}''::bigint[]
                )
            ) as amenity_id
    ) selected;


    -- 12. RETURN RESULT
    return pg_catalog.jsonb_build_object(
        ''property_id'', v_property_id,
        ''status'', ''created''
    );
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.create_property_setup(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint)'))<>'3ff541b9e53f4140ff52d1f8858a3c7d' then raise exception 'Authorization rewrite mismatch: create_property_setup';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)');
 if source is null or md5(replace(source,chr(13),''))<>'260ffe2c338beb57840aa761072e2b82' then raise exception 'Authorization source drift: save_listing_draft';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.save_listing_draft(p_property_id uuid, p_title text, p_description text, p_asking_rent_monthly numeric, p_house_rules text DEFAULT NULL::text, p_rental_term rental_term_type DEFAULT ''long_term''::rental_term_type, p_security_deposit_months numeric DEFAULT 1, p_advance_rent_months numeric DEFAULT 1, p_minimum_stay_months smallint DEFAULT NULL::smallint, p_available_from date DEFAULT NULL::date)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception ''Authentication required'' using errcode = ''42501'';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception ''Tier 1 verified active account required'' using errcode = ''42501'';
  end if;

  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;

  if p_property_id is null then
    raise exception ''Property is required'' using errcode = ''22023'';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = p_property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception ''Owned active property required'' using errcode = ''42501'';
  end if;

  if nullif(pg_catalog.btrim(p_title), '''') is null then
    raise exception ''Listing title is required'' using errcode = ''22023'';
  end if;

  if nullif(pg_catalog.btrim(p_description), '''') is null then
    raise exception ''Listing description is required'' using errcode = ''22023'';
  end if;

  if p_asking_rent_monthly is null or p_asking_rent_monthly <= 0 then
    raise exception ''Monthly asking rent must be greater than zero'' using errcode = ''22023'';
  end if;

  if p_security_deposit_months is null or p_security_deposit_months < 0 then
    raise exception ''Security deposit months must be zero or greater'' using errcode = ''22023'';
  end if;

  if p_advance_rent_months is null or p_advance_rent_months < 0 then
    raise exception ''Advance rent months must be zero or greater'' using errcode = ''22023'';
  end if;

  if p_minimum_stay_months is not null and p_minimum_stay_months <= 0 then
    raise exception ''Minimum stay months must be greater than zero when provided'' using errcode = ''22023'';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_property_id::text, 0)
  );

  select l.*
  into v_listing
  from public.listings l
  where l.property_id = p_property_id
    and l.landlord_id = v_user_id
    and l.status = ''draft''::public.listing_status
  order by l.created_at desc
  limit 1
  for update;

  if v_listing.id is null then
    insert into public.listings (
      property_id,
      landlord_id,
      title,
      description,
      house_rules,
      rental_term,
      asking_rent_monthly,
      security_deposit_months,
      advance_rent_months,
      minimum_stay_months,
      available_from,
      status
    )
    values (
      p_property_id,
      v_user_id,
      pg_catalog.btrim(p_title),
      pg_catalog.btrim(p_description),
      nullif(pg_catalog.btrim(p_house_rules), ''''),
      p_rental_term,
      p_asking_rent_monthly,
      p_security_deposit_months,
      p_advance_rent_months,
      p_minimum_stay_months,
      p_available_from,
      ''draft''::public.listing_status
    )
    returning * into v_listing;
  else
    update public.listings l
    set title = pg_catalog.btrim(p_title),
        description = pg_catalog.btrim(p_description),
        house_rules = nullif(pg_catalog.btrim(p_house_rules), ''''),
        rental_term = p_rental_term,
        asking_rent_monthly = p_asking_rent_monthly,
        security_deposit_months = p_security_deposit_months,
        advance_rent_months = p_advance_rent_months,
        minimum_stay_months = p_minimum_stay_months,
        available_from = p_available_from
    where l.id = v_listing.id
      and l.status = ''draft''::public.listing_status
    returning l.* into v_listing;
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.created_at,
    v_listing.updated_at;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'))<>'4e07a6768f6c61ce2690d0d1a64026b0' then raise exception 'Authorization rewrite mismatch: save_listing_draft';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.update_listing_draft(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)');
 if source is null or md5(replace(source,chr(13),''))<>'1cbc01da840fe61e6465e1c6c0f8f61b' then raise exception 'Authorization source drift: update_listing_draft';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.update_listing_draft(p_listing_id uuid, p_expected_edit_version uuid, p_title text, p_description text, p_asking_rent_monthly numeric, p_house_rules text DEFAULT NULL::text, p_rental_term rental_term_type DEFAULT ''long_term''::rental_term_type, p_security_deposit_months numeric DEFAULT 1, p_advance_rent_months numeric DEFAULT 1, p_minimum_stay_months smallint DEFAULT NULL::smallint, p_available_from date DEFAULT NULL::date)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, created_at timestamp with time zone, updated_at timestamp with time zone, edit_version uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
 v_user uuid := auth.uid();
 v_property uuid;
 v_listing public.listings%rowtype;
begin
 if v_user is null then raise exception ''Authentication required'' using errcode=''42501''; end if;
 if not public.is_tier1_verified(v_user) then raise exception ''Tier 1 verified active account required'' using errcode=''42501''; end if;
 if not public.has_app_role(''landlord''::public.app_role,v_user) then raise exception ''Landlord role required'' using errcode=''42501''; end if;
 if p_listing_id is null or p_expected_edit_version is null then raise exception ''Listing and edit version required'' using errcode=''22023''; end if;
 if current_setting(''transaction_isolation'') not in (''read committed'',''read uncommitted'') then raise exception ''Draft editing requires READ COMMITTED isolation'' using errcode=''25001''; end if;
 select l.property_id into v_property from public.listings l where l.id=p_listing_id and l.landlord_id=v_user;
 if v_property is null then raise exception ''Owned draft required'' using errcode=''42501''; end if;
 -- Same advisory key as create, publish, lifecycle and completeness operations.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_property::text,0));
 -- Recheck authorization after waiting; property ownership must remain stable.
 if not public.is_tier1_verified(v_user) or not public.has_app_role(''landlord''::public.app_role,v_user) then raise exception ''Active Tier 1 landlord required'' using errcode=''42501''; end if;
 perform 1 from public.properties p where p.id=v_property and p.landlord_id=v_user and p.is_active=true for share;
 if not found then raise exception ''Owned active property required'' using errcode=''42501''; end if;
 select l.* into v_listing from public.listings l where l.id=p_listing_id and l.landlord_id=v_user and l.property_id=v_property for update;
 if not found or v_listing.status<>''draft''::public.listing_status or v_listing.edit_version<>p_expected_edit_version then
   raise exception ''Draft changed or is no longer editable'' using errcode=''40001'';
 end if;
 if nullif(btrim(p_title),'''') is null or nullif(btrim(p_description),'''') is null then raise exception ''Title and description required'' using errcode=''22023''; end if;
 if p_asking_rent_monthly is null or p_asking_rent_monthly<=0 or p_asking_rent_monthly::text in (''NaN'',''Infinity'',''-Infinity'') then raise exception ''Positive finite rent required'' using errcode=''22023''; end if;
 if p_rental_term is null then raise exception ''Rental term required'' using errcode=''22023''; end if;
 if p_security_deposit_months is null or p_security_deposit_months<0 or p_security_deposit_months::text in (''NaN'',''Infinity'',''-Infinity'') then raise exception ''Valid deposit months required'' using errcode=''22023''; end if;
 if p_advance_rent_months is null or p_advance_rent_months<0 or p_advance_rent_months::text in (''NaN'',''Infinity'',''-Infinity'') then raise exception ''Valid advance months required'' using errcode=''22023''; end if;
 if p_minimum_stay_months is not null and p_minimum_stay_months<=0 then raise exception ''Positive minimum stay required'' using errcode=''22023''; end if;
 update public.listings l set title=btrim(p_title),description=btrim(p_description),
  asking_rent_monthly=p_asking_rent_monthly,house_rules=nullif(btrim(p_house_rules),''''),rental_term=p_rental_term,
  security_deposit_months=p_security_deposit_months,advance_rent_months=p_advance_rent_months,
  minimum_stay_months=p_minimum_stay_months,available_from=p_available_from
 where l.id=p_listing_id and l.landlord_id=v_user and l.property_id=v_property
  and l.status=''draft''::public.listing_status and l.edit_version=p_expected_edit_version
 returning l.* into v_listing;
 if not found then raise exception ''Draft changed before update'' using errcode=''40001''; end if;
 return query select v_listing.id,v_listing.status,v_listing.completeness_score,
  v_listing.created_at,v_listing.updated_at,v_listing.edit_version;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.update_listing_draft(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'))<>'5214851cd855b42253ccf3ec8c011d0a' then raise exception 'Authorization rewrite mismatch: update_listing_draft';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.update_published_listing_content(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)');
 if source is null or md5(replace(source,chr(13),''))<>'ed1e5515f0d59e7d4223b914331ae78d' then raise exception 'Authorization source drift: update_published_listing_content';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.update_published_listing_content(p_listing_id uuid, p_expected_edit_version uuid, p_title text, p_description text, p_asking_rent_monthly numeric, p_house_rules text DEFAULT NULL::text, p_rental_term rental_term_type DEFAULT ''long_term''::rental_term_type, p_security_deposit_months numeric DEFAULT 1, p_advance_rent_months numeric DEFAULT 1, p_minimum_stay_months smallint DEFAULT NULL::smallint, p_available_from date DEFAULT NULL::date)
 RETURNS SETOF listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
 v_user uuid := auth.uid();
 v_property uuid;
 v_listing public.listings%rowtype;
 v_status public.listing_status;
 v_published_at timestamptz;
begin
 if v_user is null then raise exception ''Authentication required'' using errcode=''42501''; end if;
 if not public.is_tier1_verified(v_user) then raise exception ''Tier 1 verified active account required'' using errcode=''42501''; end if;
 if not public.has_app_role(''landlord''::public.app_role,v_user) then raise exception ''Landlord role required'' using errcode=''42501''; end if;
 if p_listing_id is null or p_expected_edit_version is null then raise exception ''Listing and edit version required'' using errcode=''22023''; end if;
 if current_setting(''transaction_isolation'') not in (''read committed'',''read uncommitted'') then raise exception ''Published editing requires READ COMMITTED isolation'' using errcode=''25001''; end if;
 select l.property_id into v_property from public.listings l where l.id=p_listing_id and l.landlord_id=v_user;
 if v_property is null then raise exception ''Owned listing required'' using errcode=''42501''; end if;
 -- Same advisory key as create, publish, lifecycle and completeness operations.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_property::text,0));
 -- Recheck authorization after waiting; property ownership must remain stable.
 if not public.is_tier1_verified(v_user) or not public.has_app_role(''landlord''::public.app_role,v_user) then raise exception ''Active Tier 1 landlord required'' using errcode=''42501''; end if;
 perform 1 from public.properties p where p.id=v_property and p.landlord_id=v_user and p.is_active=true for share;
 if not found then raise exception ''Owned active property required'' using errcode=''42501''; end if;
 select l.* into v_listing from public.listings l where l.id=p_listing_id and l.landlord_id=v_user and l.property_id=v_property for update;
 if not found or v_listing.status not in (''active''::public.listing_status,''paused''::public.listing_status) or v_listing.edit_version<>p_expected_edit_version then
   raise exception ''Listing changed or is no longer editable'' using errcode=''40001'';
 end if;
 v_status:=v_listing.status;v_published_at:=v_listing.published_at;
 if nullif(btrim(p_title),'''') is null or nullif(btrim(p_description),'''') is null then raise exception ''Title and description required'' using errcode=''22023''; end if;
 if p_asking_rent_monthly is null or p_asking_rent_monthly<=0 or p_asking_rent_monthly::text in (''NaN'',''Infinity'',''-Infinity'') then raise exception ''Positive finite rent required'' using errcode=''22023''; end if;
 if p_rental_term is null then raise exception ''Rental term required'' using errcode=''22023''; end if;
 if p_security_deposit_months is null or p_security_deposit_months<0 or p_security_deposit_months::text in (''NaN'',''Infinity'',''-Infinity'') then raise exception ''Valid deposit months required'' using errcode=''22023''; end if;
 if p_advance_rent_months is null or p_advance_rent_months<0 or p_advance_rent_months::text in (''NaN'',''Infinity'',''-Infinity'') then raise exception ''Valid advance months required'' using errcode=''22023''; end if;
 if p_minimum_stay_months is not null and p_minimum_stay_months<=0 then raise exception ''Positive minimum stay required'' using errcode=''22023''; end if;
 update public.listings l set title=btrim(p_title),description=btrim(p_description),
  asking_rent_monthly=p_asking_rent_monthly,house_rules=nullif(btrim(p_house_rules),''''),rental_term=p_rental_term,
  security_deposit_months=p_security_deposit_months,advance_rent_months=p_advance_rent_months,
  minimum_stay_months=p_minimum_stay_months,available_from=p_available_from
 where l.id=p_listing_id and l.landlord_id=v_user and l.property_id=v_property
  and l.status=v_listing.status and l.edit_version=p_expected_edit_version
 returning l.* into v_listing;
 if not found then raise exception ''Listing changed before update'' using errcode=''40001''; end if;
 if v_listing.status<>v_status or v_listing.published_at is distinct from v_published_at then raise exception ''Publication state changed during edit'' using errcode=''40001''; end if;
 return next v_listing;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.update_published_listing_content(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'))<>'1816c46e41a19383380d2041faf64fe4' then raise exception 'Authorization rewrite mismatch: update_published_listing_content';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.publish_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'11e9d42b4ff2cdec8bd2148557beb92a' then raise exception 'Authorization source drift: publish_listing';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.publish_listing(p_listing_id uuid)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, published_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_probe public.listings%rowtype;
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception ''Authentication required'' using errcode = ''42501'';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception ''Tier 1 verified active account required'' using errcode = ''42501'';
  end if;

  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;

  if p_listing_id is null then
    raise exception ''Listing is required'' using errcode = ''22023'';
  end if;

  select l.*
  into v_probe
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id;

  if v_probe.id is null then
    raise exception ''Owned listing required'' using errcode = ''42501'';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_probe.property_id::text, 0)
  );

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception ''Owned listing required'' using errcode = ''42501'';
  end if;

  if v_listing.status <> ''draft''::public.listing_status then
    raise exception ''Only a draft listing can be published'' using errcode = ''22023'';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = v_listing.property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception ''Owned active property required'' using errcode = ''42501'';
  end if;

  if not rentlease_property_identity.verified(v_listing.property_id) then
    raise exception ''Approved Tier 3 verification for this property is required before publishing''
      using errcode = ''42501'';
  end if;

  if exists (
    select 1
    from public.listings other
    where other.property_id = v_listing.property_id
      and other.id <> v_listing.id
      and other.status in (
        ''active''::public.listing_status,
        ''paused''::public.listing_status,
        ''rented''::public.listing_status
      )
  ) then
    raise exception ''This property already has a live listing''
      using errcode = ''23505'';
  end if;

  update public.listings l
  set status = ''active''::public.listing_status
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = ''draft''::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception ''Listing changed before publication could complete''
      using errcode = ''40001'';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.updated_at;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.publish_listing(uuid)'))<>'d874108fe12f4a5b87e2569756e76a25' then raise exception 'Authorization rewrite mismatch: publish_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.pause_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'25cefd629526d3cadc236c4b93d4eec2' then raise exception 'Authorization source drift: pause_listing';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.pause_listing(p_listing_id uuid)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, published_at timestamp with time zone, paused_at timestamp with time zone, archived_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception ''Authentication required'' using errcode = ''42501'';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception ''Tier 1 verified active account required'' using errcode = ''42501'';
  end if;

  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;

  if p_listing_id is null then
    raise exception ''Listing is required'' using errcode = ''22023'';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception ''Owned listing required'' using errcode = ''42501'';
  end if;

  if v_listing.status <> ''active''::public.listing_status then
    raise exception ''Only an active listing can be paused'' using errcode = ''22023'';
  end if;

  if exists (
    select 1
    from public.tenancies t
    where t.listing_id = v_listing.id
      and t.status = ''active''::public.tenancy_status
  ) then
    raise exception ''Listing status is controlled by an active tenancy'' using errcode = ''22023'';
  end if;

  update public.listings l
  set status = ''paused''::public.listing_status,
      paused_at = pg_catalog.now()
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = ''active''::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception ''Listing changed before pause could complete'' using errcode = ''40001'';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.paused_at,
    v_listing.archived_at,
    v_listing.updated_at;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.pause_listing(uuid)'))<>'d697b44527232860b5b2a601c17201df' then raise exception 'Authorization rewrite mismatch: pause_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.archive_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'9e737fb547e44651d955a98cbea35be5' then raise exception 'Authorization source drift: archive_listing';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.archive_listing(p_listing_id uuid)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, published_at timestamp with time zone, paused_at timestamp with time zone, archived_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception ''Authentication required'' using errcode = ''42501'';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception ''Tier 1 verified active account required'' using errcode = ''42501'';
  end if;

  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;

  if p_listing_id is null then
    raise exception ''Listing is required'' using errcode = ''22023'';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception ''Owned listing required'' using errcode = ''42501'';
  end if;

  if v_listing.status not in (
    ''active''::public.listing_status,
    ''paused''::public.listing_status
  ) then
    raise exception ''Only an active or paused listing can be archived'' using errcode = ''22023'';
  end if;

  if exists (
    select 1
    from public.tenancies t
    where t.listing_id = v_listing.id
      and t.status = ''active''::public.tenancy_status
  ) then
    raise exception ''Listing status is controlled by an active tenancy'' using errcode = ''22023'';
  end if;

  update public.listings l
  set status = ''archived''::public.listing_status,
      archived_at = pg_catalog.now()
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status in (
      ''active''::public.listing_status,
      ''paused''::public.listing_status
    )
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception ''Listing changed before archive could complete'' using errcode = ''40001'';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.paused_at,
    v_listing.archived_at,
    v_listing.updated_at;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.archive_listing(uuid)'))<>'487a13d48065d6cff61a5f19883d3525' then raise exception 'Authorization rewrite mismatch: archive_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.reactivate_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'8eb305fd08f1edfebd2b66b21aff22e9' then raise exception 'Authorization source drift: reactivate_listing';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.reactivate_listing(p_listing_id uuid)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, published_at timestamp with time zone, paused_at timestamp with time zone, archived_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_probe public.listings%rowtype;
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception ''Authentication required'' using errcode = ''42501'';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception ''Tier 1 verified active account required'' using errcode = ''42501'';
  end if;

  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;

  if p_listing_id is null then
    raise exception ''Listing is required'' using errcode = ''22023'';
  end if;

  select l.*
  into v_probe
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id;

  if v_probe.id is null then
    raise exception ''Owned listing required'' using errcode = ''42501'';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_probe.property_id::text, 0)
  );

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception ''Owned listing required'' using errcode = ''42501'';
  end if;

  if v_listing.status <> ''paused''::public.listing_status then
    raise exception ''Only a paused listing can be reactivated'' using errcode = ''22023'';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = v_listing.property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception ''Owned active property required'' using errcode = ''42501'';
  end if;

  if not rentlease_property_identity.verified(v_listing.property_id) then
    raise exception ''Approved Tier 3 verification for this property is required before reactivating''
      using errcode = ''42501'';
  end if;

  if exists (
    select 1
    from public.tenancies t
    where t.listing_id = v_listing.id
      and t.status = ''active''::public.tenancy_status
  ) then
    raise exception ''Listing status is controlled by an active tenancy'' using errcode = ''22023'';
  end if;

  if exists (
    select 1
    from public.listings other
    where other.property_id = v_listing.property_id
      and other.id <> v_listing.id
      and other.status in (
        ''active''::public.listing_status,
        ''paused''::public.listing_status,
        ''rented''::public.listing_status
      )
  ) then
    raise exception ''This property already has a live listing'' using errcode = ''23505'';
  end if;

  update public.listings l
  set status = ''active''::public.listing_status,
      paused_at = null
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = ''paused''::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception ''Listing changed before reactivation could complete'' using errcode = ''40001'';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.paused_at,
    v_listing.archived_at,
    v_listing.updated_at;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.reactivate_listing(uuid)'))<>'185f41e733493d162d57b1e1c4c584d1' then raise exception 'Authorization rewrite mismatch: reactivate_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.search_nearby_listings(double precision,double precision,integer,integer,integer)');
 if source is null or md5(replace(source,chr(13),''))<>'bc659fab2f6311adbba7331a29da4347' then raise exception 'Authorization source drift: search_nearby_listings';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.search_nearby_listings(p_latitude double precision, p_longitude double precision, p_radius_km integer DEFAULT 3, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(listing_id uuid, property_id uuid, title text, asking_rent_monthly numeric, property_type text, city text, barangay text, available_from date, public_latitude double precision, public_longitude double precision, distance_meters numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''''
AS $function$
DECLARE
    v_tenant_location extensions.geography;
BEGIN
    IF p_latitude IS NULL
       OR p_latitude NOT BETWEEN -90 AND 90
       OR p_longitude IS NULL
       OR p_longitude NOT BETWEEN -180 AND 180
    THEN
        RAISE EXCEPTION ''Invalid GPS coordinates''
            USING ERRCODE = ''22023'';
    END IF;

    IF p_radius_km IS NULL
       OR p_radius_km NOT IN (1, 3, 5)
    THEN
        RAISE EXCEPTION ''Radius must be 1, 3, or 5 km''
            USING ERRCODE = ''22023'';
    END IF;

    IF p_limit IS NULL
       OR p_limit NOT BETWEEN 1 AND 50
       OR p_offset IS NULL
       OR p_offset NOT BETWEEN 0 AND 1000
    THEN
        RAISE EXCEPTION ''Invalid pagination parameters''
            USING ERRCODE = ''22023'';
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION ''Authentication required''
            USING ERRCODE = ''28000'';
    END IF;

    IF NOT public.has_app_role(
        ''tenant''::public.app_role, auth.uid()
    )
    OR NOT public.is_tier1_verified(auth.uid())
    THEN
        RAISE EXCEPTION ''Tenant verification required''
            USING ERRCODE = ''42501'';
    END IF;

    v_tenant_location :=
        extensions.ST_SetSRID(
            extensions.ST_MakePoint(
                p_longitude,
                p_latitude
            ),
            4326
        )::extensions.geography;

    RETURN QUERY
    SELECT
        l.id,
        p.id,
        l.title,
        l.asking_rent_monthly,
        p.property_type::text,
        p.city::text,
        p.barangay,
        l.available_from,
        extensions.ST_Y(
            p.public_location::extensions.geometry
        ),
        extensions.ST_X(
            p.public_location::extensions.geometry
        ),
        ROUND(
            extensions.ST_Distance(
                p.public_location,
                v_tenant_location
            )::numeric, 2
        )
    FROM public.listings l
    JOIN public.properties p
        ON p.id = l.property_id
    WHERE l.status = ''active''::public.listing_status
      AND p.is_active IS TRUE
      AND (
          l.available_from IS NULL
          OR l.available_from <=
              (now() AT TIME ZONE ''Asia/Manila'')::date
      )
      AND extensions.ST_DWithin(
          p.public_location,
          v_tenant_location,
          p_radius_km * 1000.0
      )
    ORDER BY
        extensions.ST_Distance(
            p.public_location,
            v_tenant_location
        ),
        l.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.search_nearby_listings(double precision,double precision,integer,integer,integer)'))<>'8110adaa0782298b4bf681e48f8f47f0' then raise exception 'Authorization rewrite mismatch: search_nearby_listings';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.validate_verification_submission()');
 if source is null or md5(replace(source,chr(13),''))<>'85a70ba345a6b70a0ebb17b9e5975be2' then raise exception 'Authorization source drift: validate_verification_submission';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.validate_verification_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
begin
  if new.tier = ''tier_3_property'' then
    if not public.has_app_role(''landlord'', new.user_id) then
      raise exception ''Tier 3 verification is available only to landlords'';
    end if;

    if new.property_id is null then
      raise exception ''Tier 3 verification must reference a property'';
    end if;

    if not exists (
      select 1
      from public.properties p
      where p.id = new.property_id
        and p.landlord_id = new.user_id
    ) then
      raise exception ''Tier 3 property must belong to the submitting landlord'';
    end if;
  else
    new.property_id := null;
  end if;

  return new;
end;
$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.validate_verification_submission()'))<>'26c0416c5a79c2f0835cb3787b79927a' then raise exception 'Authorization rewrite mismatch: validate_verification_submission';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('rentlease_property_edit.lock_owner(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'d92dbc08d296168776d7fa49e96b321c' then raise exception 'Authorization source drift: lock_owner';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION rentlease_property_edit.lock_owner(p_property_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
begin
 if current_setting(''transaction_isolation'')<>''read committed'' then raise exception ''READ COMMITTED required'' using errcode=''25001'';end if;
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) or not public.has_app_role(''landlord''::public.app_role,auth.uid()) then
 raise exception ''Tier 1 active landlord required'' using errcode=''42501'';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 if not exists(select 1 from public.properties where id=p_property_id and landlord_id=auth.uid() and is_active) then
 raise exception ''Owned active property required'' using errcode=''42501'';end if;
end$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('rentlease_property_edit.lock_owner(uuid)'))<>'d31e03403ebbd63cf747fdcd48915b85' then raise exception 'Authorization rewrite mismatch: lock_owner';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.get_owned_property_identity_statuses(uuid[])');
 if source is null or md5(replace(source,chr(13),''))<>'9dd4c79a2c61d8cdcad0a9d44f67ec9f' then raise exception 'Authorization source drift: get_owned_property_identity_statuses';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.get_owned_property_identity_statuses(p_property_ids uuid[])
 RETURNS TABLE(property_id uuid, verified boolean, requires_repair boolean, current_submission_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true or public.has_app_role(''landlord'',auth.uid()) is not true then raise exception ''Eligible owner required'' using errcode=''42501'';end if;
 if p_property_ids is null or cardinality(p_property_ids)>1000 or exists(select 1 from unnest(p_property_ids) x where not exists(select 1 from public.properties p where p.id=x and p.landlord_id=auth.uid())) then raise exception ''Owned property IDs required'' using errcode=''42501'';end if;
 return query select p.id,rentlease_property_identity.verified(p.id),(x.property_id is not null or c.property_id is null),case when rentlease_property_identity.verified(p.id) then c.approved_submission_id else null end from public.properties p left join rentlease_property_identity.current_identity c on c.property_id=p.id left join rentlease_property_identity.repairs x on x.property_id=p.id where p.id=any(p_property_ids) and p.landlord_id=auth.uid();
end$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.get_owned_property_identity_statuses(uuid[])'))<>'a7dc83059ec86d271e2af99f7455c680' then raise exception 'Authorization rewrite mismatch: get_owned_property_identity_statuses';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.review_property_identity_verification(uuid,uuid,uuid,uuid,verification_status,boolean,text,text)');
 if source is null or md5(replace(source,chr(13),''))<>'a2cc92185c9ebfd097159d06daa2f80d' then raise exception 'Authorization source drift: review_property_identity_verification';end if;
 definition:=replace(definition,chr(13),'');
 execute 'CREATE OR REPLACE FUNCTION public.review_property_identity_verification(p_submission_id uuid, p_expected_submission_version uuid, p_expected_property_version uuid, p_expected_correction_version uuid, p_status verification_status, p_same_asset_confirmed boolean, p_note text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''pg_catalog''
AS $function$
declare s public.verification_submissions%rowtype;q rentlease_property_identity.corrections%rowtype;c rentlease_property_identity.current_identity%rowtype;p public.properties%rowtype;
begin
 if auth.uid() is null or public.is_admin() is not true then raise exception ''Admin required'' using errcode=''42501'';end if;
 select * into s from public.verification_submissions where id=p_submission_id and tier=''tier_3_property'';
 if s.id is null then raise exception ''Property submission required'' using errcode=''22023'';end if;
 if current_setting(''transaction_isolation'')<>''read committed'' then raise exception ''READ COMMITTED required'' using errcode=''25001'';end if;
 perform pg_advisory_xact_lock(hashtextextended(s.property_id::text,0));
 select * into s from public.verification_submissions where id=p_submission_id for update;
 select * into p from public.properties where id=s.property_id;
 perform rentlease_property_identity.require_ready(p.id);
 select * into c from rentlease_property_identity.current_identity where property_id=p.id;
 select * into q from rentlease_property_identity.corrections where id=s.identity_correction_id for update;
 if s.identity_review_version is distinct from p_expected_submission_version or p.edit_version is distinct from p_expected_property_version or (q.id is not null and q.version is distinct from p_expected_correction_version) then raise exception ''Review context changed. Reload before deciding'' using errcode=''40001'';end if;
 if not p.is_active or p.landlord_id is distinct from s.user_id or not public.is_tier1_verified(s.user_id) or not public.has_app_role(''landlord'',s.user_id) or s.identity_revision_id is null or s.ready_for_review_at is null then raise exception ''Eligible owner and finalized evidence required'' using errcode=''42501'';end if;
 if q.id is not null and (q.status<>''submitted'' or q.submission_id<>s.id or q.base_revision_id<>c.revision_id or q.candidate_revision_id<>s.identity_revision_id) then raise exception ''Correction changed'' using errcode=''40001'';end if;
 if q.id is null and s.identity_revision_id<>c.revision_id then raise exception ''Identity changed'' using errcode=''40001'';end if;
 if not((s.status=''pending'' and p_status=''under_review'') or (s.status=''under_review'' and p_status in(''approved'',''rejected''))) then raise exception ''Invalid review transition'' using errcode=''22023'';end if;
 if p_status=''rejected'' and nullif(btrim(p_reason),'''') is null then raise exception ''Rejection reason required'' using errcode=''22023'';end if;
 if p_status=''approved'' then
  if not exists(select 1 from public.verification_documents d join storage.objects o on o.bucket_id=''verification-documents'' and o.name=d.storage_path where d.submission_id=s.id and d.document_type in(''land_title'',''tax_declaration'',''hoa_document'',''authorization_to_lease'')) then raise exception ''Qualifying private proof required'' using errcode=''22023'';end if;
  if q.id is not null then if p_same_asset_confirmed is not true then raise exception ''Confirm evidence corrects the same physical property'' using errcode=''22023'';end if;perform rentlease_property_identity.promote(p.id,s.identity_revision_id);end if;
 end if;
 update public.verification_submissions set status=p_status,reviewed_by=auth.uid(),review_note=nullif(btrim(p_note),''''),rejection_reason=case when p_status=''rejected'' then btrim(p_reason) else null end,reviewed_at=case when p_status in(''approved'',''rejected'') then now() else null end,identity_review_version=gen_random_uuid() where id=s.id;
 if p_status=''approved'' then update rentlease_property_identity.current_identity set approved_submission_id=s.id where property_id=p.id and revision_id=s.identity_revision_id;end if;
 if q.id is not null then update rentlease_property_identity.corrections set status=case when p_status=''approved'' then ''applied'' when p_status=''rejected'' then ''rejected'' else status end,version=gen_random_uuid() where id=q.id;end if;
end$function$
';
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.review_property_identity_verification(uuid,uuid,uuid,uuid,verification_status,boolean,text,text)'))<>'943973d50a79381a9db607e85e2cc2e0' then raise exception 'Authorization rewrite mismatch: review_property_identity_verification';end if;
end
$migration$;
alter policy preferences_owner_admin on public.tenant_preferences with check ((((tenant_id = auth.uid()) AND has_app_role('tenant'::app_role)) OR is_admin()));
alter policy saved_listings_owner on public.saved_listings with check ((((tenant_id = auth.uid()) AND has_app_role('tenant'::app_role)) OR is_admin()));
alter policy conversations_create_tenant on public.conversations with check (((tenant_id = auth.uid()) AND has_app_role('tenant'::app_role) AND is_tier1_verified()));
alter policy listings_create_owner on public.listings with check (((landlord_id = auth.uid()) AND has_app_role('landlord'::app_role) AND is_tier1_verified() AND can_manage_property(property_id)));
alter policy properties_create_verified_landlord on public.properties with check (((landlord_id = auth.uid()) AND has_app_role('landlord'::app_role) AND is_tier1_verified()));
alter policy verification_submissions_create_tier3_self on public.verification_submissions with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_tier1_verified() AND has_app_role('landlord'::app_role) AND (tier = 'tier_3_property'::verification_tier) AND (property_id IS NOT NULL) AND (status = 'pending'::verification_status) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_note IS NULL) AND (rejection_reason IS NULL)));
-- Coordinate client rollback first: restored legacy gates deny role-free owners.
-- Keep the nullable column and values; dropping it would break compatible clients.
revoke update(experience_preference) on public.profiles from authenticated;
commit;
