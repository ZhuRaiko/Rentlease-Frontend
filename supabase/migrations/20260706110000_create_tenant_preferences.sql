alter table public.listings
add column if not exists safety_rating integer not null default 3 check (safety_rating between 1 and 5);

create table public.tenant_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  budget numeric(12, 2) not null default 12000 check (budget > 0),
  city text not null check (city in ('Imus', 'Dasmarinas', 'Tagaytay')),
  min_bedrooms integer not null default 1 check (min_bedrooms >= 0),
  min_bathrooms integer not null default 1 check (min_bathrooms >= 0),
  min_size_sqm numeric(10, 2) not null default 20 check (min_size_sqm >= 0),
  min_safety_rating integer not null default 3 check (min_safety_rating between 0 and 5),
  amenities jsonb not null default '[]'::jsonb,
  priority_ranking jsonb not null default '[]'::jsonb,
  spec_ranking jsonb not null default '[]'::jsonb,
  amenity_ranking jsonb not null default '[]'::jsonb,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index tenant_preferences_user_idx on public.tenant_preferences (user_id);
create index tenant_preferences_city_idx on public.tenant_preferences (city);

alter table public.tenant_preferences enable row level security;

create trigger set_tenant_preferences_updated_at
before update on public.tenant_preferences
for each row execute function public.set_updated_at();

create policy "Users can read their tenant preferences"
on public.tenant_preferences for select
to authenticated
using (user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Users can create their tenant preferences"
on public.tenant_preferences for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their tenant preferences"
on public.tenant_preferences for update
to authenticated
using (user_id = auth.uid() or public.current_user_role() = 'admin')
with check (user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Users can delete their tenant preferences"
on public.tenant_preferences for delete
to authenticated
using (user_id = auth.uid() or public.current_user_role() = 'admin');
