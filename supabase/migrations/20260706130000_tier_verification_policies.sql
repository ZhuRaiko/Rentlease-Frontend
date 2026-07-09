alter table public.verifications
add column if not exists document_type text,
add column if not exists notes text,
add column if not exists reviewer_note text;

create or replace function public.set_my_role(next_role public.app_role)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_user public.users;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if next_role = 'admin' then
    raise exception 'Users cannot self-assign admin role';
  end if;

  update public.users
  set role = next_role
  where id = auth.uid()
  returning * into updated_user;

  return updated_user;
end;
$$;

grant execute on function public.set_my_role(public.app_role) to authenticated;

create policy "Users can submit their own tier 2 verification"
on public.verifications for insert
to authenticated
with check (
  auth.uid() = user_id
  and tier = 'tier_2'
  and status = 'pending'
);

create policy "Landlords can submit their own tier 3 verification"
on public.verifications for insert
to authenticated
with check (
  auth.uid() = user_id
  and tier = 'tier_3'
  and status = 'pending'
  and public.current_user_role() = 'landlord'
);

create policy "Users can update their own pending tier 2 verification"
on public.verifications for update
to authenticated
using (
  auth.uid() = user_id
  and tier = 'tier_2'
  and status = 'pending'
)
with check (
  auth.uid() = user_id
  and tier = 'tier_2'
  and status = 'pending'
);

create policy "Landlords can update their own pending tier 3 verification"
on public.verifications for update
to authenticated
using (
  auth.uid() = user_id
  and tier = 'tier_3'
  and status = 'pending'
  and public.current_user_role() = 'landlord'
)
with check (
  auth.uid() = user_id
  and tier = 'tier_3'
  and status = 'pending'
  and public.current_user_role() = 'landlord'
);
