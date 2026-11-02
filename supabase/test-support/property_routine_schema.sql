-- DISPOSABLE LOCAL ONLY. Extends the existing media/completeness test fixture.
create type public.property_type as enum('apartment','house','room','bedspace','studio','condominium','boarding_house','dormitory','other');
create type public.cavite_city as enum('imus','dasmarinas','tagaytay');
create type public.furnishing_status as enum('unfurnished','semi_furnished','furnished');
alter table public.properties add column property_type public.property_type not null default 'apartment',add column city public.cavite_city not null default 'imus',add column barangay text not null default 'Test',add column floor_number smallint default 2,add column total_floors smallint default 5,add column bedrooms smallint not null default 1,add column bathrooms numeric(4,1) not null default 1,add column furnishing_status public.furnishing_status not null default 'unfurnished',add column public_location text default 'fixture-point';
alter table public.properties add check(floor_number is null or total_floors is null or floor_number<=total_floors);
alter table public.property_private_locations add column access_instructions text,add column exact_location text default 'private-fixture-point';
alter table public.property_amenities add column details text;
create table public.amenities(id bigint primary key,name text,is_active boolean not null default true);
insert into public.amenities values(1,'Parking',true),(2,'Garden',true),(3,'Unavailable',false);
create type public.tenancy_status as enum('proposed','pending_confirmation','active','ended','cancelled');
create table public.tenancies(id uuid primary key default gen_random_uuid(),property_id uuid references public.properties(id),listing_id uuid references public.listings(id),status public.tenancy_status not null,tenant_confirmed_at timestamptz,landlord_confirmed_at timestamptz,agreed_monthly_rent numeric default 9000);
create table public.verification_submissions(id uuid primary key default gen_random_uuid(),property_id uuid references public.properties(id),status text);
