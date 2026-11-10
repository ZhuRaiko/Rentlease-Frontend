-- READ ONLY. Existing active Tier 1 actors and a public property point only.
-- No listings, profiles, roles, private locations or verification records are written.
begin read only;
do $verify$
declare actor record; lat double precision; lng double precision; radius integer;
  actor_count integer:=0; valid_count integer:=0; invalid_count integer:=0;
  matches integer; previous_count integer; farthest numeric; nearest numeric;
  expected_code text; rejected boolean; call_sql text; invalid_radius text;
  samples jsonb:='[]'::jsonb;
begin
 select extensions.st_y(p.public_location::extensions.geometry),extensions.st_x(p.public_location::extensions.geometry)
 into lat,lng from public.listings l join public.properties p on p.id=l.property_id
 where l.status='active' and p.is_active and p.public_location is not null
 and (l.available_from is null or l.available_from <= (now() at time zone 'Asia/Manila')::date)
 order by l.id limit 1;
 if lat is null then raise exception 'No eligible public search anchor for live verification';end if;
 for actor in select p.id from public.profiles p where public.is_tier1_verified(p.id) and not public.is_admin(p.id) order by p.id loop
  actor_count:=actor_count+1; previous_count:=0;
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  execute 'set local role authenticated';
  for radius in 1..20 loop
   select count(*),min(distance_meters),max(distance_meters) into matches,nearest,farthest
   from public.search_nearby_listings(lat,lng,radius,50,0);
   if matches<1 or nearest<>0 or matches<previous_count or farthest>radius*1000+0.01 then
    raise exception 'Radius %, actor index % returned inconsistent public distance/results',radius,actor_count;
   end if;
   previous_count:=matches;valid_count:=valid_count+1;
   if actor_count=1 then samples:=samples||jsonb_build_array(jsonb_build_object('radius_km',radius,'matches',matches));end if;
  end loop;
  execute 'reset role';
 end loop;
 if actor_count=0 then raise exception 'No existing eligible actor for live verification';end if;
 -- Integer bounds/null must reach and fail the existing validation guard.
 foreach invalid_radius in array array['null','0','-1','21','100'] loop
  rejected:=false;
  begin
   execute format('select count(*) from public.search_nearby_listings($1,$2,%s,20,0)',invalid_radius) into matches using lat,lng;
  exception when sqlstate '22023' then rejected:=true;
  end;
  if not rejected then raise exception 'Invalid radius % accepted',invalid_radius;end if;
  invalid_count:=invalid_count+1;
 end loop;
 -- Noninteger/invalid text inputs must also fail the integer RPC signature.
 foreach invalid_radius in array array['1.5','NaN','Infinity','two'] loop
  rejected:=false;
  begin
   execute format('select count(*) from public.search_nearby_listings($1,$2,%L,20,0)',invalid_radius) into matches using lat,lng;
  exception when invalid_text_representation or numeric_value_out_of_range then rejected:=true;
  end;
  if not rejected then raise exception 'Invalid integer input % accepted',invalid_radius;end if;
  invalid_count:=invalid_count+1;
 end loop;
 -- Coordinate and pagination guards remain independent of the expanded radius.
 foreach call_sql in array array[
  'select count(*) from public.search_nearby_listings(91,$2,20,20,0)',
  'select count(*) from public.search_nearby_listings($1,181,20,20,0)',
  'select count(*) from public.search_nearby_listings($1,$2,20,0,0)',
  'select count(*) from public.search_nearby_listings($1,$2,20,51,0)',
  'select count(*) from public.search_nearby_listings($1,$2,20,20,-1)',
  'select count(*) from public.search_nearby_listings($1,$2,20,20,1001)'
 ] loop
  rejected:=false;
  begin execute call_sql into matches using lat,lng;
  exception when sqlstate '22023' then rejected:=true;
  end;
  if not rejected then raise exception 'Coordinate/pagination guard failed';end if;
  invalid_count:=invalid_count+1;
 end loop;
 -- Local JWT settings only: no test user or role membership is created.
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub','',true);
 rejected:=false;
 begin perform public.search_nearby_listings(lat,lng,20,20,0);
 exception when sqlstate '28000' then rejected:=true;
 end;
 if not rejected then raise exception 'Missing identity unexpectedly accepted';end if;
 perform set_config('request.jwt.claim.sub',pg_catalog.gen_random_uuid()::text,true);
 rejected:=false;
 begin perform public.search_nearby_listings(lat,lng,20,20,0);
 exception when insufficient_privilege then rejected:=true;
 end;
 if not rejected then raise exception 'Missing Tier 1 unexpectedly accepted';end if;
 execute 'reset role';
 perform set_config('rentlease.gps_radius_verification',jsonb_build_object(
  'eligible_actors',actor_count,'accepted_radius_calls',valid_count,
  'invalid_parameter_checks',invalid_count,'authentication_checks',2,
  'sample_counts',samples,'read_only',true)::text,true);
end
$verify$;
select current_setting('rentlease.gps_radius_verification')::jsonb as verification;
commit;
