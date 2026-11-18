-- Room tour rollback, DATA-RETAINING. Withdraws only the two client entry points. The table public.property_panoramas, its policies, the Storage policies,
-- the helper schema, the bucket and every row and file stay, so no panorama is lost. Use this first. Frontend must be withdrawn or must tolerate the RPCs
-- being absent before running this.
-- This script never touches the bucket or storage.objects. If the bucket must be emptied or removed, that is a MANUAL step: in the Supabase Dashboard
-- (Storage > property-panoramas) select the files and delete them, or delete them with the Storage API; a bucket can only be deleted once it is empty.
-- Never delete from storage.objects with SQL: that removes the rows and orphans the real files.
-- Expected md5(replace(prosrc, chr(13), '')) of the dropped functions, computed from the migration file, not read from a database:
--   set_property_panorama      445ee381083202d57bc2a5b7029b6e57
--   remove_property_panorama   2d45667038d7220f17843f562dfd0aa4
begin;
do $guard$
begin
 if to_regprocedure('public.set_property_panorama(uuid,text,text,integer,integer)') is null or to_regprocedure('public.remove_property_panorama(uuid,text)') is null then raise exception 'Room tour RPCs are not installed; nothing to withdraw';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.set_property_panorama(uuid,text,text,integer,integer)')),chr(13),'')) is distinct from '445ee381083202d57bc2a5b7029b6e57'
  or md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.remove_property_panorama(uuid,text)')),chr(13),'')) is distinct from '2d45667038d7220f17843f562dfd0aa4' then raise exception 'Room tour RPC bodies differ from the reviewed definitions; review before rolling back';end if;
end$guard$;
revoke all on function public.set_property_panorama(uuid,text,text,integer,integer),public.remove_property_panorama(uuid,text) from public,anon,authenticated,service_role;
drop function public.set_property_panorama(uuid,text,text,integer,integer);
drop function public.remove_property_panorama(uuid,text);
commit;
