-- DISPOSABLE LOCAL POSTGRESQL ONLY. Storage rows model RLS, not actual file transport.
\ir listing_completeness_schema.sql
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create type public.app_role as enum('landlord','tenant','admin');
create function public.is_tier1_verified(uuid) returns boolean language sql stable as $$select current_setting('test.tier1',true)='true'$$;
create function public.has_app_role(public.app_role,uuid) returns boolean language sql stable as $$select current_setting('test.role',true)=$1::text$$;
grant usage on schema auth to authenticated,anon;
alter table public.properties add column is_active boolean not null default true;
alter table public.property_photos add column storage_path text,add column created_at timestamptz not null default now();
create unique index one_cover_per_property on public.property_photos(property_id) where is_cover;
create schema storage;
create table storage.buckets(id text primary key,public boolean,file_size_limit bigint,allowed_mime_types text[]);
insert into storage.buckets values('property-media',true,10485760,array['image/jpeg','image/png','image/webp']);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;
create policy fixture_storage on storage.objects to authenticated using(true) with check(true);
create function public.set_property_cover_photo(uuid) returns void language sql as $$update public.property_photos set is_cover=(id=$1) where property_id=(select property_id from public.property_photos where id=$1)$$;
