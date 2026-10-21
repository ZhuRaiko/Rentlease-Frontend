-- Narrow Admin summary endpoint; profiles SELECT remains self-only.
create function public.get_admin_verification_queue()
returns table (
  submission_id uuid,
  user_id uuid,
  display_name text,
  tier public.verification_tier,
  property_id uuid,
  status public.verification_status,
  submitted_note text,
  submitted_at timestamptz,
  updated_at timestamptz,
  trust_score numeric,
  tier1_verified_at timestamptz,
  tier2_verified_at timestamptz,
  tier3_verified_at timestamptz,
  document_count bigint,
  document_id uuid,
  document_type public.verification_document_type,
  file_name text,
  mime_type text,
  storage_path text,
  document_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if public.is_admin() is not true then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select v.id, v.user_id, p.display_name, v.tier, v.property_id,
    v.status, v.submitted_note, v.submitted_at, v.updated_at,
    p.trust_score, p.tier1_verified_at, p.tier2_verified_at, p.tier3_verified_at,
    (select count(*) from public.verification_documents counted where counted.submission_id = v.id),
    d.id, d.document_type, d.file_name, d.mime_type, d.storage_path, d.created_at
  from public.verification_submissions v
  join public.profiles p on p.id = v.user_id
  left join lateral (
    select doc.id, doc.document_type, doc.file_name, doc.mime_type, doc.storage_path, doc.created_at
    from public.verification_documents doc
    where doc.submission_id = v.id
    order by doc.created_at desc, doc.id desc
    limit 1
  ) d on true
  where v.status in ('pending'::public.verification_status, 'under_review'::public.verification_status)
  order by v.submitted_at asc, v.id asc;
end;
$function$;

revoke all on function public.get_admin_verification_queue() from public, anon, authenticated;
grant execute on function public.get_admin_verification_queue() to authenticated;
comment on function public.get_admin_verification_queue() is
  'Admin-only active verification queue. One row per submission; primary document is newest created_at, then greatest id. No status mutations.';
