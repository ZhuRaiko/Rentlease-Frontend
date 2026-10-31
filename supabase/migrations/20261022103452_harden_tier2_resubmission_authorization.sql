create or replace function public.begin_tier2_verification_resubmission()
returns public.verification_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  latest public.verification_submissions%rowtype;
  result_row public.verification_submissions%rowtype;
begin
  actor := auth.uid();
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not coalesce(public.is_tier1_verified(actor), false) then
    raise exception 'Tier 1 verification required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tier2:' || actor::text, 0));
  select v.* into latest
    from public.verification_submissions v
    where v.user_id = actor and v.tier = 'tier_2_identity'::public.verification_tier
    order by v.submitted_at desc, v.id desc limit 1 for update;
  if found then
    if latest.status = 'approved'::public.verification_status then
      raise exception 'Tier 2 already approved' using errcode = '22023';
    elsif latest.status = 'under_review'::public.verification_status then
      raise exception 'Tier 2 is under review' using errcode = '22023';
    elsif latest.status = 'pending'::public.verification_status then
      if exists (select 1 from public.verification_documents d where d.submission_id=latest.id) then
        raise exception 'Tier 2 application already has a document' using errcode = '22023';
      end if;
      return latest;
    elsif latest.status <> 'rejected'::public.verification_status then
      raise exception 'Resubmission is not available for this status' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from public.verification_submissions v
      where v.user_id=actor and v.tier='tier_2_identity'::public.verification_tier
        and v.status in ('pending'::public.verification_status,'under_review'::public.verification_status,'approved'::public.verification_status)) then
    raise exception 'An open or approved Tier 2 application exists' using errcode='23505';
  end if;
  insert into public.verification_submissions(user_id,tier,status,property_id)
  values (actor,'tier_2_identity'::public.verification_tier,'pending'::public.verification_status,null)
  returning * into result_row;
  return result_row;
end;
$$;
revoke all on function public.begin_tier2_verification_resubmission() from public, anon;
grant execute on function public.begin_tier2_verification_resubmission() to authenticated;;
