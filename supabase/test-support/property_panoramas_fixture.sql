-- DISPOSABLE LOCAL POSTGRESQL ONLY. Minimal fixture for the room tour (property panoramas) checks. Loaded by supabase/tests/run_property_panoramas.py.
-- WHAT IS REAL AND WHAT IS A STUB
--  * REAL (copied from the live definitions, read-only, same bytes): rentlease_property_edit.lock_owner(uuid) and public.is_tier1_verified(uuid).
--    The runner asserts md5(replace(prosrc,chr(13),'')) equals the migration's pins d92dbc08... and f839df2b... for them.
--  * REAL (extracted by the runner from supabase/migrations/20261109171826_unfinished_property_deletion.sql): rentlease_unfinished_posts.inspect(uuid).
--  * STUBS (their bodies are NOT in this repository, so they are semantic stand-ins and their md5 is not the live pin; the runner substitutes
--    their fixture md5 into a copy of the migration and separately asserts that the migration's literal pins are the live values):
--      public.can_view_property(uuid,uuid): owner, admin, a Tier 1 user while the property has an active listing, or a party to a tenancy of it.
--      public.can_manage_property(uuid,uuid): the property's owner.
--    If the live semantics differ, these two stubs are the only place the checks can be wrong; the policies call them, never re-implement them.
--  * Tables are minimal: only the columns the room tour and inspect() read.
do $roles$
begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;
end$roles$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon,service_role;
grant usage on schema public to authenticated,anon,service_role;

create table public.profiles(id uuid primary key,tier1_verified_at timestamptz,account_status text not null default 'active',is_admin boolean not null default false);
create table public.properties(id uuid primary key default gen_random_uuid(),landlord_id uuid not null references public.profiles(id),is_active boolean not null default true);
create table public.listings(id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id) on delete cascade,landlord_id uuid not null,status text not null default 'draft',published_at timestamptz);
create table public.tenancies(id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id),tenant_id uuid not null,landlord_id uuid not null,status text not null default 'active');
create table public.property_photos(id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id) on delete cascade,storage_path text);
create table public.admin_audit_logs(entity_id uuid);
create table public.notifications(data jsonb);
-- Supabase gives anon and authenticated default table privileges in public; production revoked them on property_photos (the migration guard asserts this).
revoke all on all tables in schema public from public,anon,authenticated,service_role;

create function public.is_tier1_verified(requested_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = requested_user
      and p.tier1_verified_at is not null
      and p.account_status = 'active'
  );
$function$;
create function public.can_view_property(p_property_id uuid,requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select requested_user is not null and exists(select 1 from public.properties p where p.id=p_property_id and (
  p.landlord_id=requested_user
  or exists(select 1 from public.profiles a where a.id=requested_user and a.is_admin)
  or (public.is_tier1_verified(requested_user) and exists(select 1 from public.listings l where l.property_id=p.id and l.status='active'))
  or exists(select 1 from public.tenancies t where t.property_id=p.id and requested_user in(t.tenant_id,t.landlord_id))))
$$;
create function public.can_manage_property(p_property_id uuid,requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select requested_user is not null and exists(select 1 from public.properties p where p.id=p_property_id and p.landlord_id=requested_user)
$$;

create schema rentlease_property_edit;
revoke all on schema rentlease_property_edit from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION rentlease_property_edit.lock_owner(p_property_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) then
 raise exception 'Tier 1 active landlord required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 if not exists(select 1 from public.properties where id=p_property_id and landlord_id=auth.uid() and is_active) then
 raise exception 'Owned active property required' using errcode='42501';end if;
end$function$;
create table rentlease_property_edit.media_intents(photo_id uuid primary key,property_id uuid not null references public.properties(id),owner_id uuid,path text,state text);

create schema rentlease_unfinished_posts;
revoke all on schema rentlease_unfinished_posts from public,anon,authenticated,service_role;
create table rentlease_unfinished_posts.records(property_id uuid primary key,owner_id uuid not null,ever_published boolean not null default false,state text not null default 'live');
-- inspect() is installed by the runner from the real migration text.

create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean default false,file_size_limit bigint,allowed_mime_types text[],created_at timestamptz default now());
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin select string_to_array(name,'/') into _parts;return _parts[1:array_length(_parts,1)-1];end$$;
grant usage on schema storage to authenticated,anon,service_role;
grant select,insert,update,delete on storage.objects to authenticated,anon;
grant select on storage.buckets to authenticated,anon;
-- Another bucket exists, with permissive policies like the live avatars bucket, so the restrictive panorama UPDATE policy has something to leave alone.
insert into storage.buckets(id,name,public) values('avatars','avatars',true);
create policy fixture_avatars_all on storage.objects as permissive for all to authenticated using(bucket_id='avatars') with check(bucket_id='avatars');
-- Hosted allows UPDATE on other buckets by a permissive policy; this one is deliberately bucket-blind so only the restrictive policy can stop a panorama update.
create policy fixture_update_any on storage.objects as permissive for update to authenticated using(true) with check(true);
