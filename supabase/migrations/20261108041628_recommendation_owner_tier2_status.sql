-- PREPARED ONLY. No deployment authorized. Catalog baseline: 2026-11-08.
-- No tables, existing functions, RLS policies, verification state or data changed.
begin;
do $guard$
begin
 if (select md5(replace(prosrc,chr(13),'')) from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.can_view_property(uuid,uuid)')) is distinct from 'a871fda6e96411b0bfa2c4c68f78c6ab' then raise exception 'Recommendation baseline drift: can_view_property(uuid,uuid)'; end if;
 if (select md5(replace(prosrc,chr(13),'')) from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.is_tier1_verified(uuid)')) is distinct from 'f839df2bff48c4b5880a1794b6d101d5' then raise exception 'Recommendation baseline drift: is_tier1_verified(uuid)'; end if;
 if (select md5(replace(prosrc,chr(13),'')) from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.refresh_profile_verification_timestamps()')) is distinct from 'e829b12e2921ef48149752387b918651' then raise exception 'Recommendation baseline drift: refresh_profile_verification_timestamps()'; end if;
 if not exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='listings' and policyname='listings_read_allowed' and cmd='SELECT' and roles=array['authenticated']::name[] and permissive='PERMISSIVE' and replace(qual,chr(13),'')=replace($policy$(((status = 'active'::listing_status) AND is_tier1_verified()) OR (landlord_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM tenancies t
  WHERE ((t.listing_id = listings.id) AND ((auth.uid() = t.tenant_id) OR (auth.uid() = t.landlord_id))))))$policy$,chr(13),'')) or (select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename='listings' and cmd in ('SELECT','ALL'))<>1 then raise exception 'Recommendation visibility policy drift: listings';end if;
 if not exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='properties' and policyname='properties_read_allowed' and cmd='SELECT' and roles=array['authenticated']::name[] and permissive='PERMISSIVE' and replace(qual,chr(13),'')=replace($policy$((landlord_id = ( SELECT auth.uid() AS uid)) OR can_view_property(id))$policy$,chr(13),'')) or (select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename='properties' and cmd in ('SELECT','ALL'))<>1 then raise exception 'Recommendation visibility policy drift: properties';end if;
 if exists(select 1 from pg_catalog.pg_class where oid in ('public.profiles'::regclass,'public.verification_submissions'::regclass,'public.listings'::regclass,'public.properties'::regclass) and not relrowsecurity)
 or pg_catalog.has_column_privilege('authenticated','public.profiles','tier2_verified_at','UPDATE')
 or not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.verification_submissions'::regclass and tgname='trg_refresh_profile_verification' and tgenabled='O' and pg_catalog.pg_get_triggerdef(oid)=$trigger$CREATE TRIGGER trg_refresh_profile_verification AFTER INSERT OR DELETE OR UPDATE ON public.verification_submissions FOR EACH ROW EXECUTE FUNCTION refresh_profile_verification_timestamps()$trigger$)
 or pg_catalog.pg_get_indexdef(pg_catalog.to_regclass('public.uq_tier2_single_open_or_approved_per_user')) is distinct from $index$CREATE UNIQUE INDEX uq_tier2_single_open_or_approved_per_user ON public.verification_submissions USING btree (user_id) WHERE ((tier = 'tier_2_identity'::verification_tier) AND (status = ANY (ARRAY['pending'::verification_status, 'under_review'::verification_status, 'approved'::verification_status])))$index$
 then raise exception 'Recommendation verification baseline drift';end if;
end $guard$;

create function public.get_recommendation_owner_verification(p_listing_ids uuid[])
returns table(listing_id uuid,listing_owner_id uuid,owner_tier2_verified boolean)
language plpgsql stable security definer set search_path=''
as $function$
begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then
  raise exception 'Active Tier 1 account required' using errcode='42501';
 end if;
 -- Check supplied cardinality before deduplication. Reject non-vector arrays too.
 if p_listing_ids is null or cardinality(p_listing_ids)<1 or cardinality(p_listing_ids)>50
 or array_ndims(p_listing_ids)<>1 or array_position(p_listing_ids,null) is not null then
  raise exception 'Invalid listing batch' using errcode='22023';
 end if;
 return query
 select l.id,l.landlord_id,
  case
   when p.id is null or public.is_tier1_verified(l.landlord_id) is not true then null::boolean
   when v.approvals=0 and p.tier2_verified_at is null then false
   when v.approvals=1 and v.trusted=1 and p.tier2_verified_at=v.approved_at then true
   else null::boolean
  end
 from public.listings l
 join public.properties pr on pr.id=l.property_id and pr.landlord_id=l.landlord_id
 left join public.profiles p on p.id=l.landlord_id
 left join lateral (
  select count(*) as approvals,
   count(*) filter(where s.property_id is null and s.reviewed_by is not null
    and s.reviewed_at is not null and s.reviewed_at<=statement_timestamp()) as trusted,
   max(s.reviewed_at) as approved_at
  from public.verification_submissions s
  where s.user_id=l.landlord_id and s.tier='tier_2_identity'::public.verification_tier
   and s.status='approved'::public.verification_status
 ) v on true
 where l.id=any(p_listing_ids)
  and l.status='active'::public.listing_status and l.published_at is not null
  and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date)
  and pr.is_active is true and public.can_view_property(pr.id,auth.uid()) is true
 order by l.id;
end $function$;
revoke all on function public.get_recommendation_owner_verification(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_recommendation_owner_verification(uuid[]) to authenticated;
comment on function public.get_recommendation_owner_verification(uuid[]) is
 'Bounded public-listing owner Tier 2 credibility signal only; NULL means indeterminate. No identity documents or review history. No expiry policy.';
commit;
