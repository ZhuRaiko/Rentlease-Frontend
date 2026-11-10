-- Prepared only. Separate live deployment authorization required.
-- Signature, active Tier 1, invoker/RLS, public geography and pagination unchanged.
begin;
do $migration$
declare definition text; source text;
begin
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc
 where oid='public.search_nearby_listings(double precision,double precision,integer,integer,integer)'::regprocedure;
 if md5(replace(source,chr(13),'')) <> 'bc659fab2f6311adbba7331a29da4347' then
  raise exception 'GPS radius baseline drift. Review the current RPC before migrating';
 end if;
 definition:=replace(definition,'p_radius_km NOT IN (1, 3, 5)','p_radius_km NOT BETWEEN 1 AND 20');
 definition:=replace(definition,'Radius must be 1, 3, or 5 km','Radius must be an integer from 1 through 20 km');
 if definition not like '%p_radius_km NOT BETWEEN 1 AND 20%' then raise exception 'GPS radius rewrite failed';end if;
 execute definition;
end
$migration$;
commit;
