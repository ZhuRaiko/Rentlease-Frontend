create unique index if not exists uq_tier2_single_open_or_approved_per_user
on public.verification_submissions (user_id)
where tier = 'tier_2_identity'::public.verification_tier
and status in ('pending'::public.verification_status,'under_review'::public.verification_status,'approved'::public.verification_status);

create or replace function public.begin_tier2_verification_resubmission()
returns public.verification_submissions
language plpgsql security invoker set search_path = public
as $$
declare
  actor uuid := auth.uid();
  latest public.verification_submissions%rowtype;
  result_row public.verification_submissions%rowtype;
begin
  if actor is null or not public.is_tier1_verified() then
    raise exception 'Tier 1 verification and authentication required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tier2:' || actor::text, 0));

  select * into latest from public.verification_submissions
    where user_id=actor and tier='tier_2_identity'
    order by submitted_at desc,id desc limit 1 for update;

  if found then
    if latest.status = 'approved' then
      raise exception 'Tier 2 is already approved' using errcode='22023';
    elsif latest.status = 'under_review' then
      raise exception 'Tier 2 is under review' using errcode='22023';
    elsif latest.status = 'pending' then
      if exists (select 1 from public.verification_documents where submission_id=latest.id) then
        raise exception 'Tier 2 submission already has a registered document' using errcode='22023';
      end if;
      return latest; -- resume incomplete pending application, no duplicate row
    elsif latest.status <> 'rejected' then
      raise exception 'Tier 2 resubmission is not enabled for this status' using errcode='22023';
    end if;
  end if;

  -- Also protect users with an older approved or open application, even if latest is rejected.
  if exists (select 1 from public.verification_submissions where user_id=actor and tier='tier_2_identity'
      and status in ('pending','under_review','approved')) then
    raise exception 'An active or approved Tier 2 application already exists' using errcode='23505';
  end if;

  insert into public.verification_submissions(user_id,tier,status,property_id)
    values(actor,'tier_2_identity','pending',null)
    returning * into result_row;
  return result_row;
end;
$$;
revoke all on function public.begin_tier2_verification_resubmission() from public, anon;
grant execute on function public.begin_tier2_verification_resubmission() to authenticated;;
