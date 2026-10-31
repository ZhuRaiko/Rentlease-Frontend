-- ISOLATED TEST DATABASE ONLY. Minimal contract fixture, not a production schema.
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
create extension if not exists plpgsql_check with schema extensions;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
create type public.listing_status as enum('draft','active','paused','rented','archived','removed');
create table public.properties(id uuid primary key,landlord_id uuid not null,floor_area_sqm numeric,max_occupants smallint,updated_at timestamptz default now(),note text);
create table public.listings(id uuid primary key,property_id uuid not null references public.properties(id) on delete cascade,landlord_id uuid not null,title text,description text,asking_rent_monthly numeric check(asking_rent_monthly>0),available_from date,status public.listing_status not null default 'draft',completeness_score numeric(5,4) default 0 check(completeness_score between 0 and 1),published_at timestamptz,updated_at timestamptz default now());
create index idx_listings_property on public.listings(property_id);
create table public.property_photos(id uuid primary key,property_id uuid not null references public.properties(id) on delete cascade,sort_order integer default 0,alt_text text,is_cover boolean default false);
create index idx_property_photos_property_order on public.property_photos(property_id,sort_order);
create table public.property_amenities(property_id uuid references public.properties(id) on delete cascade,amenity_id bigint,primary key(property_id,amenity_id));
create table public.property_private_locations(property_id uuid primary key references public.properties(id) on delete cascade,address_line_1 text,updated_at timestamptz default now());
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger trg_listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger trg_properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger trg_property_private_locations_updated_at before update on public.property_private_locations for each row execute function public.set_updated_at();
-- Fixture validation before migration, used to prove migration backfill.
create function public.validate_listing_owner() returns trigger language plpgsql as $$begin return new;end$$;
create trigger trg_validate_listing_owner before insert or update on public.listings for each row execute function public.validate_listing_owner();
-- Authenticated clients can mutate allowed related rows, but cannot UPDATE listings.
revoke all on public.listings from authenticated,anon;
grant usage on schema public,extensions to authenticated,anon;
grant select on public.properties,public.listings to authenticated;
grant insert,delete,select on public.property_photos,public.property_amenities,public.property_private_locations to authenticated;
grant update(alt_text,sort_order,is_cover) on public.property_photos to authenticated;
alter table public.properties enable row level security;
alter table public.listings enable row level security;
alter table public.property_photos enable row level security;
alter table public.property_amenities enable row level security;
alter table public.property_private_locations enable row level security;
create policy properties_owner on public.properties for select to authenticated using (landlord_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid));
create policy listings_owner on public.listings for select to authenticated using (landlord_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid));
create policy photos_owner on public.property_photos to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.landlord_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)));
create policy amenities_owner on public.property_amenities to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.landlord_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)));
create policy location_owner on public.property_private_locations to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.landlord_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)));
-- Deliberately stale draft to exercise the one-time migration backfill.
insert into public.properties(id,landlord_id) values('10000000-0000-4000-8000-000000000099','90000000-0000-4000-8000-000000000001');
insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,completeness_score) values('20000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000099','90000000-0000-4000-8000-000000000001','Backfill','Short',1,0);
