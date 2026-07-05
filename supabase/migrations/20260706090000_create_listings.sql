create type public.listing_status as enum ('draft', 'active', 'delisted');
create type public.furnishing_status as enum ('furnished', 'semi_furnished', 'unfurnished');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  city text not null check (city in ('Imus', 'Dasmarinas', 'Tagaytay')),
  address text not null,
  price numeric(12, 2) not null check (price >= 0),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  parking_spaces integer not null default 0 check (parking_spaces >= 0),
  size_sqm numeric(10, 2) not null default 0 check (size_sqm >= 0),
  property_type text not null default 'House',
  furnishing_status public.furnishing_status not null default 'unfurnished',
  amenities jsonb not null default '[]'::jsonb,
  lat double precision,
  lng double precision,
  status public.listing_status not null default 'draft',
  payment_terms text,
  used_suggested_price boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index listings_city_status_idx on public.listings (city, status);
create index listings_owner_idx on public.listings (owner_id);
create index listings_price_idx on public.listings (price);

alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;

create trigger set_listings_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create policy "Anyone authenticated can read active listings"
on public.listings for select
to authenticated
using (status = 'active' or owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Landlords and admins can create owned listings"
on public.listings for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.current_user_role() in ('landlord', 'admin')
);

create policy "Listing owners can update their listings"
on public.listings for update
to authenticated
using (owner_id = auth.uid() or public.current_user_role() = 'admin')
with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Listing owners can delete their listings"
on public.listings for delete
to authenticated
using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Authenticated users can read photos for visible listings"
on public.listing_photos for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and (l.status = 'active' or l.owner_id = auth.uid() or public.current_user_role() = 'admin')
  )
);

create policy "Listing owners can manage listing photos"
on public.listing_photos for all
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and (l.owner_id = auth.uid() or public.current_user_role() = 'admin')
  )
)
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and (l.owner_id = auth.uid() or public.current_user_role() = 'admin')
  )
);
