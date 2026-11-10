-- Prepared rollback only; separate live authorization required.
-- Restores legacy 1/3/5 validation. Deploy compatible frontend first.
begin;
do $rollback$
declare source text; definition text;
begin
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc
 where oid='public.search_nearby_listings(double precision,double precision,integer,integer,integer)'::regprocedure;
 if source is null or md5(replace(source,chr(13),'')) <> 'd491c451f08bb49155a70e2b78ec59ce' then
  raise exception 'GPS radius rollback source drift';
 end if;
 definition:=replace(definition,'p_radius_km NOT BETWEEN 1 AND 20','p_radius_km NOT IN (1, 3, 5)');
 definition:=replace(definition,'Radius must be an integer from 1 through 20 km','Radius must be 1, 3, or 5 km');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.search_nearby_listings(double precision,double precision,integer,integer,integer)'::regprocedure)<>'bc659fab2f6311adbba7331a29da4347' then raise exception 'GPS radius rollback mismatch';end if;
end
$rollback$;
commit;
