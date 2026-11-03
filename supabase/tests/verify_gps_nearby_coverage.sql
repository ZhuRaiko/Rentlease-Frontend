-- READ ONLY. Uses public points and existing eligible actors; creates no test data.
-- Counts only; does not return private coordinates or persist device coordinates.
begin read only;
do $v$
declare actors jsonb; actor jsonb; point record; radius int; results jsonb:='[]'::jsonb; uid uuid; c int; d numeric; outside extensions.geography;
begin
 select jsonb_agg(jsonb_build_object('uid',a.id,'roles',coalesce((select string_agg(r.role::text,',' order by r.role) from public.user_roles r where r.user_id=a.id),'none'))) into actors from public.profiles a where public.is_tier1_verified(a.id) and not public.is_admin(a.id);
 for actor in select value from jsonb_array_elements(actors) loop
  perform set_config('request.jwt.claim.sub',actor->>'uid',true);execute 'set local role authenticated';
  for point in select l.id,extensions.st_y(p.public_location::extensions.geometry) lat,extensions.st_x(p.public_location::extensions.geometry) lng,p.public_location g from public.listings l join public.properties p on p.id=l.property_id where l.status='active' and p.is_active and (l.available_from is null or l.available_from <= (now() at time zone 'Asia/Manila')::date) and p.public_location is not null order by l.id loop
   foreach radius in array array[1,3,5] loop
    select count(*),min(s.distance_meters) into c,d from public.search_nearby_listings(point.lat,point.lng,radius,50,0) s;
    results:=results||jsonb_build_array(jsonb_build_object('actor_roles',actor->>'roles','public_anchor_listing',point.id,'radius_km',radius,'matches',c,'nearest_m',d));
   end loop;
  end loop;
  execute 'reset role';
 end loop;
 select extensions.st_project(p.public_location,30000,0) into outside from public.listings l join public.properties p on p.id=l.property_id where l.status='active' and p.is_active and p.public_location is not null order by l.id limit 1;
 perform set_config('request.jwt.claim.sub',actors->0->>'uid',true);execute 'set local role authenticated';
 select count(*) into c from public.search_nearby_listings(extensions.st_y(outside::extensions.geometry),extensions.st_x(outside::extensions.geometry),5,50,0);
 execute 'reset role';
 perform set_config('rentlease.gps_check',jsonb_build_object('public_anchor_results',results,'outside_30km_search_radius_5km_matches',c)::text,true);
end $v$;
select current_setting('rentlease.gps_check')::jsonb evidence;
commit;
