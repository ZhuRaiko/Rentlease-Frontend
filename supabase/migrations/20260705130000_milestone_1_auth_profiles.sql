create type public.app_role as enum ('tenant', 'landlord', 'admin');
create type public.account_status as enum ('tier_1_pending', 'authenticated', 'suspended');
create type public.verification_tier as enum ('tier_1', 'tier_2', 'tier_3');
create type public.verification_status as enum ('pending', 'approved', 'rejected');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'tenant',
  account_status public.account_status not null default 'tier_1_pending',
  email text,
  phone text,
  first_name text,
  last_name text,
  nickname text,
  tier_1_email_verified boolean not null default false,
  tier_1_phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tier public.verification_tier not null,
  status public.verification_status not null default 'pending',
  document_url text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tier)
);

alter table public.users enable row level security;
alter table public.verifications enable row level security;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_verifications_updated_at
before update on public.verifications
for each row execute function public.set_updated_at();

create function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    phone,
    first_name,
    last_name,
    nickname,
    tier_1_email_verified,
    tier_1_phone_verified
  )
  values (
    new.id,
    new.email,
    new.phone,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'nickname',
    new.email_confirmed_at is not null,
    new.phone_confirmed_at is not null
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone = excluded.phone,
    first_name = coalesce(excluded.first_name, public.users.first_name),
    last_name = coalesce(excluded.last_name, public.users.last_name),
    nickname = coalesce(excluded.nickname, public.users.nickname),
    tier_1_email_verified = excluded.tier_1_email_verified,
    tier_1_phone_verified = excluded.tier_1_phone_verified,
    account_status = case
      when public.users.account_status = 'suspended' then 'suspended'::public.account_status
      when excluded.tier_1_email_verified and excluded.tier_1_phone_verified
        then 'authenticated'::public.account_status
      else 'tier_1_pending'::public.account_status
    end,
    updated_at = now();

  insert into public.verifications (user_id, tier, status)
  values (new.id, 'tier_1', case when new.phone_confirmed_at is not null then 'approved' else 'pending' end)
  on conflict (user_id, tier) do update
  set
    status = excluded.status,
    updated_at = now();

  return new;
end;
$$;

create trigger sync_auth_user_profile_on_insert
after insert on auth.users
for each row execute function public.sync_auth_user_profile();

create trigger sync_auth_user_profile_on_update
after update of email, phone, email_confirmed_at, phone_confirmed_at, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_profile();

create function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create policy "Users can read their own profile"
on public.users for select
to authenticated
using (auth.uid() = id);

create policy "Admins can read all users"
on public.users for select
to authenticated
using (public.current_user_role() = 'admin');

create policy "Admins can update all users"
on public.users for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Users can read their own verification rows"
on public.verifications for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own tier 1 verification"
on public.verifications for insert
to authenticated
with check (auth.uid() = user_id and tier = 'tier_1');

create policy "Admins can manage verifications"
on public.verifications for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
