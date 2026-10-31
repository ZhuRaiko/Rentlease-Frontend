-- PREPARED FOR REVIEW. Do not apply to live without separate authorization.
-- Existing score weights/status rules stay unchanged. No indexes or client grants.
begin;
create schema if not exists rentlease_completeness authorization postgres;
revoke all on schema rentlease_completeness from public, anon, authenticated;

-- One formula. Invoker-only, callable by the trusted trigger/helper owner, not clients.
create or replace function rentlease_completeness.calculate_listing_completeness(
  p_property_id uuid, p_title text, p_description text,
  p_asking_rent_monthly numeric, p_available_from date
) returns numeric
language sql stable security invoker set search_path = pg_catalog
as $function$
  select least(1.0,
    case when nullif(btrim(p_title), '') is not null then 0.10 else 0 end
    + case when length(btrim(coalesce(p_description, ''))) >= 30 then 0.15 else 0 end
    + case when p_asking_rent_monthly > 0 then 0.10 else 0 end
    + case when p_available_from is not null then 0.05 else 0 end
    + case when p.floor_area_sqm is not null then 0.10 else 0 end
    + case when p.max_occupants is not null then 0.05 else 0 end
    + case when exists(select 1 from public.property_private_locations pl where pl.property_id=p.id) then 0.15 else 0 end
    + case when exists(select 1 from public.property_photos pp where pp.property_id=p.id) then 0.20 else 0 end
    + case when exists(select 1 from public.property_amenities pa where pa.property_id=p.id) then 0.10 else 0 end
  )::numeric(5,4)
  from public.properties p where p.id=p_property_id;
$function$;

-- Preserve existing ownership, draft-first, active >=80%, and publication time rules.
create or replace function public.validate_listing_owner()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $function$
begin
  if not exists(select 1 from public.properties p where p.id=new.property_id and p.landlord_id=new.landlord_id) then
    raise exception 'Listing landlord must own the referenced property';
  end if;
  new.completeness_score := rentlease_completeness.calculate_listing_completeness(
    new.property_id,new.title,new.description,new.asking_rent_monthly,new.available_from);
  if new.status='active' then
    if tg_op='INSERT' then raise exception 'Create the listing as a draft before publishing'; end if;
    if new.completeness_score < 0.80 then raise exception 'Listing must reach at least 80%% completeness before publishing'; end if;
    new.published_at := coalesce(new.published_at,now());
  end if;
  return new;
end;
$function$;

-- Definer is needed because related-row writers do NOT have listings UPDATE privilege.
-- Only trusted triggers/migration owner may invoke this; it is not a refresh RPC.
create or replace function rentlease_completeness.refresh_listing_completeness_for_property(p_property_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog
as $function$
declare v_listing record; v_score numeric;
begin
  if p_property_id is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
  -- Parent deletion cascades retain their existing semantics; no orphan refresh.
  if not exists(select 1 from public.properties where id=p_property_id) then return; end if;
  -- All statuses are current-property completeness, not frozen publication snapshots.
  -- Lock rows before calculation, in stable order; preserve status and other fields.
  for v_listing in select l.id,l.title,l.description,l.asking_rent_monthly,l.available_from
    from public.listings l where l.property_id=p_property_id order by l.id for update
  loop
    select rentlease_completeness.calculate_listing_completeness(p_property_id,
      v_listing.title,v_listing.description,v_listing.asking_rent_monthly,v_listing.available_from) into v_score;
    update public.listings set completeness_score=v_score
      where id=v_listing.id and completeness_score is distinct from v_score;
    -- Normal listing validation still fires. An invalid active score aborts the
    -- entire related mutation; no automatic pause/archive or stale active score.
  end loop;
end;
$function$;

-- Serialize related writes BEFORE they change their rows. AFTER-only locks allow
-- cross-table concurrent removals to each validate against the other's old data.
-- Reuse the property advisory-lock namespace already used by save/publish/photo RPCs.
create or replace function rentlease_completeness.lock_related_property()
returns trigger language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare old_id uuid; new_id uuid; target uuid;
begin
  -- Volatile SPI reads refresh snapshots under the normal RPC isolation level.
  -- A pre-existing REPEATABLE READ snapshot cannot observe a waited-for commit.
  if current_setting('transaction_isolation') not in ('read committed','read uncommitted') then
    raise exception 'Completeness-affecting changes require READ COMMITTED isolation' using errcode='25001';
  end if;
  if tg_table_name='properties' then old_id:=old.id; new_id:=new.id;
  else
    if tg_op <> 'INSERT' then old_id:=old.property_id; end if;
    if tg_op <> 'DELETE' then new_id:=new.property_id; end if;
  end if;
  for target in select distinct id from unnest(array[old_id,new_id]) as ids(id) where id is not null order by id
  loop perform pg_advisory_xact_lock(hashtextextended(target::text,0)); end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;
create or replace function rentlease_completeness.refresh_related_property()
returns trigger language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare old_id uuid; new_id uuid; target uuid;
begin
  if tg_table_name='properties' then old_id:=old.id; new_id:=new.id;
  else
    if tg_op <> 'INSERT' then old_id:=old.property_id; end if;
    if tg_op <> 'DELETE' then new_id:=new.property_id; end if;
  end if;
  for target in select distinct id from unnest(array[old_id,new_id]) as ids(id) where id is not null order by id
  loop perform rentlease_completeness.refresh_listing_completeness_for_property(target); end loop;
  return null;
end;
$function$;

revoke all on function rentlease_completeness.calculate_listing_completeness(uuid,text,text,numeric,date) from public,anon,authenticated;
revoke all on function rentlease_completeness.refresh_listing_completeness_for_property(uuid) from public,anon,authenticated;
revoke all on function rentlease_completeness.lock_related_property() from public,anon,authenticated;
revoke all on function rentlease_completeness.refresh_related_property() from public,anon,authenticated;
revoke all on function public.validate_listing_owner() from public,anon,authenticated;

-- INSERT/DELETE affect existence. UPDATE only matters when the parent is reassigned.
drop trigger if exists trg_property_photos_completeness_lock_rows on public.property_photos;
create trigger trg_property_photos_completeness_lock_rows before insert or delete on public.property_photos
for each row execute function rentlease_completeness.lock_related_property();
drop trigger if exists trg_property_photos_completeness_lock_parent on public.property_photos;
create trigger trg_property_photos_completeness_lock_parent before update of property_id on public.property_photos
for each row when (old.property_id is distinct from new.property_id) execute function rentlease_completeness.lock_related_property();
drop trigger if exists trg_property_photos_completeness_refresh_rows on public.property_photos;
create trigger trg_property_photos_completeness_refresh_rows after insert or delete on public.property_photos
for each row execute function rentlease_completeness.refresh_related_property();
drop trigger if exists trg_property_photos_completeness_refresh_parent on public.property_photos;
create trigger trg_property_photos_completeness_refresh_parent after update of property_id on public.property_photos
for each row when (old.property_id is distinct from new.property_id) execute function rentlease_completeness.refresh_related_property();
drop trigger if exists trg_property_amenities_completeness_lock_rows on public.property_amenities;
create trigger trg_property_amenities_completeness_lock_rows before insert or delete on public.property_amenities
for each row execute function rentlease_completeness.lock_related_property();
drop trigger if exists trg_property_amenities_completeness_lock_parent on public.property_amenities;
create trigger trg_property_amenities_completeness_lock_parent before update of property_id on public.property_amenities
for each row when (old.property_id is distinct from new.property_id) execute function rentlease_completeness.lock_related_property();
drop trigger if exists trg_property_amenities_completeness_refresh_rows on public.property_amenities;
create trigger trg_property_amenities_completeness_refresh_rows after insert or delete on public.property_amenities
for each row execute function rentlease_completeness.refresh_related_property();
drop trigger if exists trg_property_amenities_completeness_refresh_parent on public.property_amenities;
create trigger trg_property_amenities_completeness_refresh_parent after update of property_id on public.property_amenities
for each row when (old.property_id is distinct from new.property_id) execute function rentlease_completeness.refresh_related_property();
drop trigger if exists trg_property_private_locations_completeness_lock_rows on public.property_private_locations;
create trigger trg_property_private_locations_completeness_lock_rows before insert or delete on public.property_private_locations
for each row execute function rentlease_completeness.lock_related_property();
drop trigger if exists trg_property_private_locations_completeness_lock_parent on public.property_private_locations;
create trigger trg_property_private_locations_completeness_lock_parent before update of property_id on public.property_private_locations
for each row when (old.property_id is distinct from new.property_id) execute function rentlease_completeness.lock_related_property();
drop trigger if exists trg_property_private_locations_completeness_refresh_rows on public.property_private_locations;
create trigger trg_property_private_locations_completeness_refresh_rows after insert or delete on public.property_private_locations
for each row execute function rentlease_completeness.refresh_related_property();
drop trigger if exists trg_property_private_locations_completeness_refresh_parent on public.property_private_locations;
create trigger trg_property_private_locations_completeness_refresh_parent after update of property_id on public.property_private_locations
for each row when (old.property_id is distinct from new.property_id) execute function rentlease_completeness.refresh_related_property();
drop trigger if exists trg_properties_completeness_lock on public.properties;
create trigger trg_properties_completeness_lock before update of floor_area_sqm,max_occupants on public.properties
for each row when (old.floor_area_sqm is distinct from new.floor_area_sqm or old.max_occupants is distinct from new.max_occupants)
execute function rentlease_completeness.lock_related_property();
drop trigger if exists trg_properties_completeness_refresh on public.properties;
create trigger trg_properties_completeness_refresh after update of floor_area_sqm,max_occupants on public.properties
for each row when (old.floor_area_sqm is distinct from new.floor_area_sqm or old.max_occupants is distinct from new.max_occupants)
execute function rentlease_completeness.refresh_related_property();

-- Reconcile existing stored scores once. If an existing active listing is already
-- below 80%, normal validation aborts this entire migration. The operator must
-- resolve it via existing authorized lifecycle actions, never silently auto-pause.
do $backfill$
declare target uuid;
begin
  -- Also reject already-current invalid active scores: no-op avoidance must not
  -- let an existing invalid public listing bypass deployment validation.
  if exists(select 1 from public.listings l where l.status='active'
    and rentlease_completeness.calculate_listing_completeness(l.property_id,
      l.title,l.description,l.asking_rent_monthly,l.available_from) < 0.80) then
    raise exception 'Existing active listing is below 80%% completeness; resolve through the existing lifecycle before applying this migration';
  end if;
  for target in select distinct property_id from public.listings order by property_id
  loop perform rentlease_completeness.refresh_listing_completeness_for_property(target); end loop;
end;
$backfill$;
commit;
