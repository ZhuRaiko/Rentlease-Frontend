create type public.viewing_status as enum ('pending', 'approved', 'declined', 'rescheduled');
create type public.maintenance_status as enum ('open', 'in_progress', 'resolved');
create type public.maintenance_urgency as enum ('low', 'normal', 'urgent');

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  listing_ref text,
  tenant_id uuid not null references public.users(id) on delete cascade,
  landlord_id uuid references public.users(id) on delete set null,
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_ref, tenant_id, landlord_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.viewing_schedules (
  id uuid primary key default gen_random_uuid(),
  listing_ref text not null,
  tenant_id uuid not null references public.users(id) on delete cascade,
  landlord_id uuid references public.users(id) on delete set null,
  requested_at timestamptz not null,
  message text,
  status public.viewing_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  listing_ref text,
  tenant_id uuid not null references public.users(id) on delete cascade,
  landlord_id uuid references public.users(id) on delete set null,
  title text not null,
  description text,
  urgency public.maintenance_urgency not null default 'normal',
  status public.maintenance_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rent_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  listing_ref text,
  rent_due_day integer not null check (rent_due_day between 1 and 28),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.viewing_schedules enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.rent_reminders enable row level security;

create trigger set_chat_threads_updated_at before update on public.chat_threads
for each row execute function public.set_updated_at();
create trigger set_viewing_schedules_updated_at before update on public.viewing_schedules
for each row execute function public.set_updated_at();
create trigger set_maintenance_requests_updated_at before update on public.maintenance_requests
for each row execute function public.set_updated_at();
create trigger set_rent_reminders_updated_at before update on public.rent_reminders
for each row execute function public.set_updated_at();

create policy "Thread participants can read threads" on public.chat_threads for select to authenticated
using (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin');
create policy "Users can create their own threads" on public.chat_threads for insert to authenticated
with check (tenant_id = auth.uid() or landlord_id = auth.uid());
create policy "Thread participants can update threads" on public.chat_threads for update to authenticated
using (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin')
with check (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Thread participants can read messages" on public.chat_messages for select to authenticated
using (
  exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and (t.tenant_id = auth.uid() or t.landlord_id = auth.uid() or public.current_user_role() = 'admin')
  )
);
create policy "Thread participants can send messages" on public.chat_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and (t.tenant_id = auth.uid() or t.landlord_id = auth.uid())
  )
);

create policy "Participants can read viewing schedules" on public.viewing_schedules for select to authenticated
using (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin');
create policy "Tenants can request viewings" on public.viewing_schedules for insert to authenticated
with check (tenant_id = auth.uid());
create policy "Participants can update viewing schedules" on public.viewing_schedules for update to authenticated
using (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin')
with check (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Participants can read maintenance requests" on public.maintenance_requests for select to authenticated
using (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin');
create policy "Tenants can create maintenance requests" on public.maintenance_requests for insert to authenticated
with check (tenant_id = auth.uid());
create policy "Participants can update maintenance requests" on public.maintenance_requests for update to authenticated
using (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin')
with check (tenant_id = auth.uid() or landlord_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Users can manage their reminders" on public.rent_reminders for all to authenticated
using (user_id = auth.uid() or public.current_user_role() = 'admin')
with check (user_id = auth.uid() or public.current_user_role() = 'admin');
