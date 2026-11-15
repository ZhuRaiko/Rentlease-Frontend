-- ROLLBACK for 20261114200000_published_reviews_reviewer_role.sql. LOCAL ONLY. Idempotent.
-- Restores get_published_rental_reviews to its ORIGINAL source (md5 7f0847017fc4547576efd9e8eb16960a). Refuses any other source. Run with: supabase db query --linked -f <this file>, only after explicit authorization.
begin;
set local lock_timeout='10s';
do $r$
declare cur text;
begin
 select md5(prosrc) into cur from pg_proc where oid=to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)');
 if cur is null then raise exception 'get_published_rental_reviews is missing';end if;
 if cur='7f0847017fc4547576efd9e8eb16960a' then null; -- already the original
 elsif cur='e0ba690c49e865d6e8c1f33b9aa209ea' then
  execute $s$create or replace function public.get_published_rental_reviews(p_kind text,p_target_id uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_reviews.actor();result jsonb;
begin
 if p_kind is null or p_kind not in('property','user') or p_target_id is null or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid review target/page' using errcode='22023';end if;
 if p_kind='property' then
  if not exists(select 1 from public.properties p where p.id=p_target_id and (p.landlord_id=a or exists(select 1 from public.tenancies t where t.property_id=p.id and a in(t.tenant_id,t.landlord_id)) or (p.is_active and exists(select 1 from public.listings l where l.property_id=p.id and l.landlord_id=p.landlord_id and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))))) then raise exception 'Access unavailable' using errcode='42501';end if;
 else
  if not(p_target_id=a or exists(select 1 from public.tenancies t where t.status='ended' and ((t.tenant_id=a and t.landlord_id=p_target_id) or (t.landlord_id=a and t.tenant_id=p_target_id))) or exists(select 1 from public.listings l join public.properties p on p.id=l.property_id where l.landlord_id=p_target_id and p.landlord_id=p_target_id and p.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))) then raise exception 'Access unavailable' using errcode='42501';end if;
 end if;
 select jsonb_build_object('kind',p_kind,'targetId',p_target_id,'count',count(*),'average',avg(e.rating),'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'propertyId',case when q.kind='property' then q.property_id end,'rating',q.rating,'text',q.body,'revision',q.revision,'createdAt',q.created_at,'updatedAt',q.updated_at,'moderatedAt',q.moderated_at)),'[]'::jsonb) from (select x.* from rentlease_reviews.entries x join public.tenancies t on t.id=x.tenancy_id where x.kind=p_kind and x.status='approved' and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp() and (case when p_kind='property' then x.property_id else x.reviewee_id end)=p_target_id order by x.created_at desc,x.id limit 20 offset p_offset) q)) into result
 from rentlease_reviews.entries e join public.tenancies t on t.id=e.tenancy_id where e.kind=p_kind and e.status='approved' and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp() and (case when p_kind='property' then e.property_id else e.reviewee_id end)=p_target_id;
 return result;
end$$$s$;
 else raise exception 'get_published_rental_reviews has an unexpected source (%); not restoring',cur;
 end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)'))<>'7f0847017fc4547576efd9e8eb16960a' then raise exception 'Restored source does not match the original';end if;
 if not has_function_privilege('authenticated','public.get_published_rental_reviews(text,uuid,integer)','execute') or has_function_privilege('anon','public.get_published_rental_reviews(text,uuid,integer)','execute') then raise exception 'get_published_rental_reviews ACL changed';end if;
end$r$;
commit;
