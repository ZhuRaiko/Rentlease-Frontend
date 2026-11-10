-- LOCAL ONLY: caller-scoped bookmarks over the existing table; no client table grants.
begin;
do $$begin
 if not (select relrowsecurity from pg_class where oid='public.saved_listings'::regclass) then raise exception 'Saved listings RLS drift';end if;
 if has_table_privilege('authenticated','public.saved_listings','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.saved_listings','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unexpected direct bookmark grants';end if;
end$$;
create index saved_listings_recent_idx on public.saved_listings(tenant_id,created_at desc,listing_id);
create function public.get_saved_listing_states(p_listing_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();begin
 if a is null or public.is_tier1_verified(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_listing_ids is null or cardinality(p_listing_ids)>100 or array_position(p_listing_ids,null) is not null then raise exception 'Invalid bookmark batch' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('listingId',x.id,'saved',exists(select 1 from public.saved_listings s where s.tenant_id=a and s.listing_id=x.id))) from (select distinct unnest(p_listing_ids) id) x),'[]'::jsonb);
end$$;
create function public.set_saved_listing(p_listing_id uuid,p_saved boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p uuid;begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if a is null or public.is_tier1_verified(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_listing_id is null or p_saved is null then raise exception 'Invalid bookmark' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('saved:'||a::text||':'||p_listing_id::text,0));
 if p_saved then
  select property_id into p from public.listings where id=p_listing_id;
  if p is null then raise exception 'Listing unavailable' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(p::text,0));
  perform 1 from public.properties where id=p and is_active for share;
  if not found then raise exception 'Listing unavailable' using errcode='42501';end if;
  perform 1 from public.listings l where l.id=p_listing_id and l.property_id=p and l.landlord_id=(select landlord_id from public.properties where id=p) and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(statement_timestamp() at time zone 'Asia/Manila')::date) for share;
  if not found then raise exception 'Listing unavailable' using errcode='42501';end if;
  insert into public.saved_listings(tenant_id,listing_id) values(a,p_listing_id) on conflict(tenant_id,listing_id) do nothing;
 else delete from public.saved_listings where tenant_id=a and listing_id=p_listing_id;
 end if;
 return jsonb_build_object('listingId',p_listing_id,'saved',p_saved);
end$$;
create function public.get_saved_listings(p_offset integer default 0,p_sort text default 'recent') returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();result jsonb;begin
 if a is null or public.is_tier1_verified(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>10000 or p_sort is null or p_sort not in('recent','price_low','price_high') then raise exception 'Invalid saved page' using errcode='22023';end if;
 with eligible as (
 select s.listing_id,s.created_at,
 case when l.status='active' and l.published_at is not null and p.is_active and l.landlord_id=p.landlord_id and (l.available_from is null or l.available_from<=(statement_timestamp() at time zone 'Asia/Manila')::date) then
 jsonb_build_object('id',l.id,'property_id',l.property_id,'title',l.title,'description',l.description,'asking_rent_monthly',l.asking_rent_monthly,'available_from',l.available_from,'house_rules',l.house_rules,'rental_term',l.rental_term,'minimum_stay_months',l.minimum_stay_months,'security_deposit_months',l.security_deposit_months,'advance_rent_months',l.advance_rent_months,'status',l.status,'properties',jsonb_build_object('id',p.id,'landlord_id',p.landlord_id,'city',p.city,'barangay',p.barangay,'property_type',p.property_type,'bedrooms',p.bedrooms,'bathrooms',p.bathrooms,'floor_area_sqm',p.floor_area_sqm,'furnishing_status',p.furnishing_status,'is_active',p.is_active)) else null end listing
 from public.saved_listings s left join public.listings l on l.id=s.listing_id left join public.properties p on p.id=l.property_id where s.tenant_id=a
 ),page as(select * from eligible order by
 case when p_sort='price_low' then (listing->>'asking_rent_monthly')::numeric end asc nulls last,
 case when p_sort='price_high' then (listing->>'asking_rent_monthly')::numeric end desc nulls last,
 created_at desc,listing_id limit 20 offset p_offset)
 select jsonb_build_object('count',(select count(*) from eligible),'rows',coalesce(jsonb_agg(jsonb_build_object('listingId',listing_id,'savedAt',created_at,'listing',listing)),'[]'::jsonb)) into result from page;
 return result;
end$$;
alter function public.get_saved_listing_states(uuid[]) owner to postgres;
alter function public.set_saved_listing(uuid,boolean) owner to postgres;
alter function public.get_saved_listings(integer,text) owner to postgres;
revoke all on function public.get_saved_listing_states(uuid[]),public.set_saved_listing(uuid,boolean),public.get_saved_listings(integer,text) from public,anon,authenticated,service_role;
grant execute on function public.get_saved_listing_states(uuid[]),public.set_saved_listing(uuid,boolean),public.get_saved_listings(integer,text) to authenticated;
commit;
