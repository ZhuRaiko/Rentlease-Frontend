create type public.report_subject_type as enum ('listing', 'user');
create type public.report_status as enum ('pending', 'upheld', 'dismissed');

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references public.users(id) on delete cascade,
  ratee_id uuid references public.users(id) on delete set null,
  listing_ref text,
  score integer not null check (score between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rater_id, ratee_id, listing_ref)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  subject_type public.report_subject_type not null,
  subject_id text not null,
  reason text not null,
  details text,
  status public.report_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ratings_ratee_idx on public.ratings (ratee_id);
create index ratings_listing_ref_idx on public.ratings (listing_ref);
create index reports_subject_idx on public.reports (subject_type, subject_id);
create index reports_status_idx on public.reports (status);

alter table public.ratings enable row level security;
alter table public.reports enable row level security;

create trigger set_ratings_updated_at
before update on public.ratings
for each row execute function public.set_updated_at();

create trigger set_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create function public.suspend_user_after_upheld_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  upheld_count integer;
  reported_user uuid;
begin
  if new.subject_type <> 'user' or new.status <> 'upheld' then
    return new;
  end if;

  begin
    reported_user := new.subject_id::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  select count(*)
  into upheld_count
  from public.reports
  where subject_type = 'user'
    and subject_id = new.subject_id
    and status = 'upheld';

  if upheld_count >= 3 then
    update public.users
    set account_status = 'suspended'
    where id = reported_user;
  end if;

  return new;
end;
$$;

create trigger suspend_user_after_upheld_reports_trigger
after insert or update of status on public.reports
for each row execute function public.suspend_user_after_upheld_reports();

create policy "Authenticated users can read listing ratings"
on public.ratings for select
to authenticated
using (listing_ref is not null or rater_id = auth.uid() or ratee_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Users can create their own ratings"
on public.ratings for insert
to authenticated
with check (rater_id = auth.uid());

create policy "Users can update their own ratings"
on public.ratings for update
to authenticated
using (rater_id = auth.uid())
with check (rater_id = auth.uid());

create policy "Admins can manage ratings"
on public.ratings for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Users can read their own reports"
on public.reports for select
to authenticated
using (reporter_id = auth.uid() or public.current_user_role() = 'admin');

create policy "Users can create reports"
on public.reports for insert
to authenticated
with check (reporter_id = auth.uid() and status = 'pending');

create policy "Admins can manage reports"
on public.reports for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
