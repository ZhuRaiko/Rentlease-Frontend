-- DISPOSABLE LOCAL DATABASE ONLY; not a production schema or migration.
\ir listing_completeness_schema.sql
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create type public.app_role as enum('landlord','tenant','admin');
create type public.rental_term_type as enum('short_term','long_term','either');
create function public.is_tier1_verified(requested_user uuid default auth.uid()) returns boolean language sql stable as $$select coalesce(requested_user=auth.uid() and current_setting('test.tier1',true)='true',false)$$;
create function public.has_app_role(requested_role public.app_role,requested_user uuid default auth.uid()) returns boolean language sql stable as $$select coalesce(requested_user=auth.uid() and current_setting('test.role',true)=requested_role::text,false)$$;
alter table public.properties add column is_active boolean not null default true;
alter table public.listings alter column id set default pg_catalog.gen_random_uuid();
alter table public.listings add column created_at timestamptz not null default now(),
 add column house_rules text,add column rental_term public.rental_term_type default 'long_term',
 add column security_deposit_months numeric default 1,add column advance_rent_months numeric default 1,
 add column minimum_stay_months smallint;
grant usage on schema auth to authenticated,anon;

-- Historical baseline RPC copied from the recorded inspected contract.
create or replace function public.save_listing_draft(
  p_property_id uuid,
  p_title text,
  p_description text,
  p_asking_rent_monthly numeric,
  p_house_rules text default null,
  p_rental_term public.rental_term_type default 'long_term',
  p_security_deposit_months numeric default 1,
  p_advance_rent_months numeric default 1,
  p_minimum_stay_months smallint default null,
  p_available_from date default null
)
returns table (
  listing_id uuid,
  listing_status public.listing_status,
  completeness_score numeric,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception 'Tier 1 verified active account required' using errcode = '42501';
  end if;

  if not public.has_app_role('landlord'::public.app_role, v_user_id) then
    raise exception 'Landlord role required' using errcode = '42501';
  end if;

  if p_property_id is null then
    raise exception 'Property is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = p_property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception 'Owned active property required' using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_title), '') is null then
    raise exception 'Listing title is required' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(p_description), '') is null then
    raise exception 'Listing description is required' using errcode = '22023';
  end if;

  if p_asking_rent_monthly is null or p_asking_rent_monthly <= 0 then
    raise exception 'Monthly asking rent must be greater than zero' using errcode = '22023';
  end if;

  if p_security_deposit_months is null or p_security_deposit_months < 0 then
    raise exception 'Security deposit months must be zero or greater' using errcode = '22023';
  end if;

  if p_advance_rent_months is null or p_advance_rent_months < 0 then
    raise exception 'Advance rent months must be zero or greater' using errcode = '22023';
  end if;

  if p_minimum_stay_months is not null and p_minimum_stay_months <= 0 then
    raise exception 'Minimum stay months must be greater than zero when provided' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_property_id::text, 0)
  );

  select l.*
  into v_listing
  from public.listings l
  where l.property_id = p_property_id
    and l.landlord_id = v_user_id
    and l.status = 'draft'::public.listing_status
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
      nullif(pg_catalog.btrim(p_house_rules), ''),
      p_rental_term,
      p_asking_rent_monthly,
      p_security_deposit_months,
      p_advance_rent_months,
      p_minimum_stay_months,
      p_available_from,
      'draft'::public.listing_status
    )
    returning * into v_listing;
  else
    update public.listings l
    set title = pg_catalog.btrim(p_title),
        description = pg_catalog.btrim(p_description),
        house_rules = nullif(pg_catalog.btrim(p_house_rules), ''),
        rental_term = p_rental_term,
        asking_rent_monthly = p_asking_rent_monthly,
        security_deposit_months = p_security_deposit_months,
        advance_rent_months = p_advance_rent_months,
        minimum_stay_months = p_minimum_stay_months,
        available_from = p_available_from
    where l.id = v_listing.id
      and l.status = 'draft'::public.listing_status
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
$function$;

revoke all on function public.save_listing_draft(
  uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date
) from public;

revoke all on function public.save_listing_draft(
  uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date
) from anon;

grant execute on function public.save_listing_draft(
  uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date
) to authenticated;


create type public.verification_tier as enum('tier_3_property');
create type public.verification_status as enum('pending','approved','rejected');
create table public.verification_submissions(user_id uuid,property_id uuid,tier public.verification_tier,status public.verification_status);
CREATE OR REPLACE FUNCTION public.publish_listing(p_listing_id uuid)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, published_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_probe public.listings%rowtype;
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception 'Tier 1 verified active account required' using errcode = '42501';
  end if;

  if not public.has_app_role('landlord'::public.app_role, v_user_id) then
    raise exception 'Landlord role required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'Listing is required' using errcode = '22023';
  end if;

  select l.*
  into v_probe
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id;

  if v_probe.id is null then
    raise exception 'Owned listing required' using errcode = '42501';
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
    raise exception 'Owned listing required' using errcode = '42501';
  end if;

  if v_listing.status <> 'draft'::public.listing_status then
    raise exception 'Only a draft listing can be published' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = v_listing.property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception 'Owned active property required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.verification_submissions vs
    where vs.user_id = v_user_id
      and vs.property_id = v_listing.property_id
      and vs.tier = 'tier_3_property'::public.verification_tier
      and vs.status = 'approved'::public.verification_status
  ) then
    raise exception 'Approved Tier 3 verification for this property is required before publishing'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.listings other
    where other.property_id = v_listing.property_id
      and other.id <> v_listing.id
      and other.status in (
        'active'::public.listing_status,
        'paused'::public.listing_status,
        'rented'::public.listing_status
      )
  ) then
    raise exception 'This property already has a live listing'
      using errcode = '23505';
  end if;

  update public.listings l
  set status = 'active'::public.listing_status
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = 'draft'::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception 'Listing changed before publication could complete'
      using errcode = '40001';
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


