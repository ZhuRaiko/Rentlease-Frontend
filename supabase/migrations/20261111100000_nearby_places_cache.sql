-- LOCAL ONLY. Isolated public-location projection and private provider cache.
begin;
create schema rentlease_nearby;
revoke all on schema rentlease_nearby from public,anon,authenticated,service_role;
create table rentlease_nearby.cache (
 key text primary key check(key ~ '^[a-f0-9]{64}$'), rows jsonb,
 fetched_at timestamptz, expires_at timestamptz, stale_until timestamptz,
 lease uuid, lease_until timestamptz, retry_at timestamptz,
 check(rows is null or (jsonb_typeof(rows)='array' and jsonb_array_length(rows)<=80 and octet_length(rows::text)<=100000))
);
create table rentlease_nearby.limits (key text primary key, slot timestamptz not null,hits integer not null);
alter table rentlease_nearby.cache enable row level security;
alter table rentlease_nearby.limits enable row level security;
revoke all on all tables in schema rentlease_nearby from public,anon,authenticated,service_role;
create function rentlease_nearby.approved_point(point extensions.geography) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case when point is null then false when extensions.st_srid(point::extensions.geometry)<>4326 or extensions.st_geometrytype(point::extensions.geometry)<>'ST_Point' then false
 when not(extensions.st_y(point::extensions.geometry) between -85.05112878 and 85.05112878 and extensions.st_x(point::extensions.geometry) between -180 and 180) then false
 else abs((extensions.st_x(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)-round((extensions.st_x(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)::numeric))<0.0000001
 and abs((extensions.st_y(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)-round((extensions.st_y(extensions.st_transform(point::extensions.geometry,3857))/300-0.5)::numeric))<0.0000001 end
$$;
revoke all on function rentlease_nearby.approved_point(extensions.geography) from public,anon,authenticated,service_role;
create function public.get_nearby_places_context(p_listing_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 -- Match the existing active/published/available detail contract; owner draft/participant-only detail is not silently invented.
 select jsonb_build_object('listingId',l.id,'propertyId',p.id,'version',p.edit_version,'latitude',case when rentlease_nearby.approved_point(p.public_location) then extensions.st_y(p.public_location::extensions.geometry) end,'longitude',case when rentlease_nearby.approved_point(p.public_location) then extensions.st_x(p.public_location::extensions.geometry) end) into result
 from public.listings l join public.properties p on p.id=l.property_id and p.landlord_id=l.landlord_id
 where l.id=p_listing_id and l.status='active' and l.published_at is not null and p.is_active
 and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date);
 if result is null then raise exception 'Access unavailable' using errcode='42501';end if;
 return result;
end$$;
-- Service-only cache coordination. Actor is supplied only after Auth /user validation, never by mobile input.
create function public.claim_nearby_places(p_actor uuid,p_key text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c rentlease_nearby.cache%rowtype; n integer; t timestamptz:=clock_timestamp(); token uuid;
begin
 if p_actor is null or p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('nearby:quota',0));
 delete from rentlease_nearby.limits where slot<t-interval '2 days';
 delete from rentlease_nearby.cache where coalesce(stale_until,lease_until,retry_at,t)<t-interval '10 minutes';
 if (select count(*) from rentlease_nearby.limits)>=10004 and not exists(select 1 from rentlease_nearby.limits where key='user:'||p_actor) then return jsonb_build_object('status','rate_limited');end if;
 insert into rentlease_nearby.limits values('user:'||p_actor,date_trunc('minute',t),1)
 on conflict(key) do update set slot=excluded.slot,hits=case when limits.slot=excluded.slot then limits.hits+1 else 1 end returning hits into n;
 if n>20 then return jsonb_build_object('status','rate_limited');end if;
 select * into c from rentlease_nearby.cache where key=p_key for update;
 if c.expires_at>t then return jsonb_build_object('status','hit','rows',c.rows,'fetchedAt',c.fetched_at,'expiresAt',c.expires_at);end if;
 if c.lease_until>t or c.retry_at>t then
  return jsonb_build_object('status','busy','rows',case when c.stale_until>t then c.rows end,'fetchedAt',c.fetched_at,'expiresAt',c.expires_at);
 end if;
 if exists(select 1 from rentlease_nearby.limits where key='provider:blocked' and slot>t) then return jsonb_build_object('status','busy','rows',case when c.stale_until>t then c.rows end,'fetchedAt',c.fetched_at,'expiresAt',c.expires_at);end if;
 insert into rentlease_nearby.limits values('provider:second',date_trunc('second',t),1)
 on conflict(key) do update set slot=excluded.slot,hits=case when limits.slot=excluded.slot then limits.hits+1 else 1 end returning hits into n;
 if n>2 then return jsonb_build_object('status','rate_limited');end if;
 insert into rentlease_nearby.limits values('provider:day',date_trunc('day',t),1)
 on conflict(key) do update set slot=excluded.slot,hits=case when limits.slot=excluded.slot then limits.hits+1 else 1 end returning hits into n;
 if n>300 then return jsonb_build_object('status','rate_limited');end if;
 if (select count(*) from rentlease_nearby.cache)>=1000 and c.key is null then
  delete from rentlease_nearby.cache where key in(select key from rentlease_nearby.cache where lease_until is null or lease_until<=t order by coalesce(fetched_at,retry_at,t) limit 1);
  if (select count(*) from rentlease_nearby.cache)>=1000 then return jsonb_build_object('status','busy');end if;
 end if;
 token:=gen_random_uuid();
 insert into rentlease_nearby.cache(key,lease,lease_until) values(p_key,token,t+interval '30 seconds')
 on conflict(key) do update set lease=excluded.lease,lease_until=excluded.lease_until;
 return jsonb_build_object('status','refresh','lease',token,'rows',case when c.stale_until>t then c.rows end,'fetchedAt',c.fetched_at,'expiresAt',c.expires_at);
end$$;
create function public.finish_nearby_places(p_key text,p_lease uuid,p_rows jsonb,p_failure_seconds integer default 60) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_rows is not null and (jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>80 or octet_length(p_rows::text)>100000) then raise exception 'Invalid cache data' using errcode='22023';end if;
 update rentlease_nearby.cache set rows=coalesce(p_rows,rows),
 fetched_at=case when p_rows is not null then clock_timestamp() else fetched_at end,
 expires_at=case when p_rows is not null then clock_timestamp()+interval '24 hours' else expires_at end,
 stale_until=case when p_rows is not null then clock_timestamp()+interval '72 hours' else stale_until end,
 lease=null,lease_until=null,retry_at=case when p_rows is null then clock_timestamp()+make_interval(secs=>greatest(10,least(2147483647,coalesce(p_failure_seconds,60)))) end
 where key=p_key and lease=p_lease and lease_until>=clock_timestamp();
 if not found then return false;end if;
 if p_rows is null then insert into rentlease_nearby.limits values('provider:blocked',clock_timestamp()+make_interval(secs=>greatest(10,least(2147483647,coalesce(p_failure_seconds,60)))),0) on conflict(key) do update set slot=greatest(limits.slot,excluded.slot);end if;
 return true;
end$$;
revoke all on function public.get_nearby_places_context(uuid),public.claim_nearby_places(uuid,text),public.finish_nearby_places(text,uuid,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_nearby_places_context(uuid) to authenticated;
grant execute on function public.claim_nearby_places(uuid,text),public.finish_nearby_places(text,uuid,jsonb,integer) to service_role;
commit;
