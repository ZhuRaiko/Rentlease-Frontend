-- DISPOSABLE LOCAL FIXTURE ONLY; no production data.
create extension postgis with schema extensions;
alter table public.properties alter column public_location drop default;
alter table public.properties alter column public_location type extensions.geography(point,4326) using null::extensions.geography;
alter table public.property_private_locations alter column exact_location drop default;
alter table public.property_private_locations alter column exact_location type extensions.geography(point,4326) using null::extensions.geography;
alter table public.property_private_locations add column address_line_2 text,add column postal_code text;
alter table public.listings add column paused_at timestamptz,add column archived_at timestamptz;
create type public.verification_tier as enum('tier_2_identity','tier_3_property');
create type public.verification_status as enum('pending','under_review','approved','rejected','cancelled','revoked');
create type public.verification_document_type as enum('passport','drivers_license','umid','philsys_id','land_title','tax_declaration','hoa_document','authorization_to_lease','other');
alter table public.verification_submissions alter column status type public.verification_status using status::public.verification_status,alter column status set default 'pending';
alter table public.verification_submissions add column user_id uuid,add column tier public.verification_tier not null default 'tier_3_property',add column submitted_note text,add column reviewed_by uuid,add column review_note text,add column rejection_reason text,add column submitted_at timestamptz default now(),add column reviewed_at timestamptz,add column updated_at timestamptz default now();
create table public.verification_documents(id uuid primary key default gen_random_uuid(),submission_id uuid references public.verification_submissions(id),document_type public.verification_document_type,storage_path text,file_name text,mime_type text,created_at timestamptz default now());
create table public.profiles(id uuid primary key,display_name text,trust_score numeric,tier1_verified_at timestamptz,tier2_verified_at timestamptz,tier3_verified_at timestamptz);
create function public.is_admin() returns boolean language sql stable as $$select current_setting('test.role',true)='admin'$$;
alter table public.verification_submissions enable row level security;
alter table public.verification_documents enable row level security;
grant select,insert,update,delete on public.verification_submissions,public.verification_documents to authenticated;
create policy fixture_submissions on public.verification_submissions to authenticated using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy fixture_documents on public.verification_documents to authenticated using(exists(select 1 from public.verification_submissions s where s.id=submission_id)) with check(exists(select 1 from public.verification_submissions s where s.id=submission_id));
insert into storage.buckets values('verification-documents',false,10485760,array['image/jpeg','image/png','application/pdf']);
CREATE OR REPLACE FUNCTION "public"."publish_listing"("p_listing_id" "uuid") RETURNS TABLE("listing_id" "uuid", "listing_status" "public"."listing_status", "completeness_score" numeric, "published_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;
CREATE OR REPLACE FUNCTION "public"."reactivate_listing"("p_listing_id" "uuid") RETURNS TABLE("listing_id" "uuid", "listing_status" "public"."listing_status", "completeness_score" numeric, "published_at" timestamp with time zone, "paused_at" timestamp with time zone, "archived_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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

  if v_listing.status <> 'paused'::public.listing_status then
    raise exception 'Only a paused listing can be reactivated' using errcode = '22023';
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
    raise exception 'Approved Tier 3 verification for this property is required before reactivating'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.tenancies t
    where t.listing_id = v_listing.id
      and t.status = 'active'::public.tenancy_status
  ) then
    raise exception 'Listing status is controlled by an active tenancy' using errcode = '22023';
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
    raise exception 'This property already has a live listing' using errcode = '23505';
  end if;

  update public.listings l
  set status = 'active'::public.listing_status,
      paused_at = null
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = 'paused'::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception 'Listing changed before reactivation could complete' using errcode = '40001';
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
$$;

create or replace function public.has_app_role(public.app_role,uuid) returns boolean language sql stable as $$select ($2='90000000-0000-4000-8000-000000000001'::uuid and $1='landlord') or ($1::text=current_setting('test.role',true) and $1<>'landlord')$$;

alter table public.profiles add column updated_at timestamptz default now();
CREATE OR REPLACE FUNCTION "public"."validate_verification_submission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.tier = 'tier_3_property' then
    if not public.has_app_role('landlord', new.user_id) then
      raise exception 'Tier 3 verification is available only to landlords';
    end if;

    if new.property_id is null then
      raise exception 'Tier 3 verification must reference a property';
    end if;

    if not exists (
      select 1
      from public.properties p
      where p.id = new.property_id
        and p.landlord_id = new.user_id
    ) then
      raise exception 'Tier 3 property must belong to the submitting landlord';
    end if;
  else
    new.property_id := null;
  end if;

  return new;
end;
$$;
CREATE OR REPLACE FUNCTION "public"."refresh_profile_verification_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_user uuid;
begin
  if tg_op = 'DELETE' then
    target_user := old.user_id;
  else
    target_user := new.user_id;
  end if;

  update public.profiles p
  set
    tier2_verified_at = (
      select max(v.reviewed_at)
      from public.verification_submissions v
      where v.user_id = target_user
        and v.tier = 'tier_2_identity'
        and v.status = 'approved'
    ),
    tier3_verified_at = (
      select max(v.reviewed_at)
      from public.verification_submissions v
      where v.user_id = target_user
        and v.tier = 'tier_3_property'
        and v.status = 'approved'
    ),
    updated_at = now()
  where p.id = target_user;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
create trigger trg_validate_verification_submission before insert or update on public.verification_submissions for each row execute function public.validate_verification_submission();
create trigger trg_verification_submissions_updated_at before update on public.verification_submissions for each row execute function public.set_updated_at();
create trigger trg_refresh_profile_verification after insert or update or delete on public.verification_submissions for each row execute function public.refresh_profile_verification_timestamps();
