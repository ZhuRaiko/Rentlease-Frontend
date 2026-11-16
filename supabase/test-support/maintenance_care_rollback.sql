-- Rollback for 20261117090000_maintenance_care.sql (DATA-RETAINING). Run only if the migration was applied and must be undone.
-- It puts write_tenancy_care and log_maintenance_status_change back byte for byte (from rentlease_tenancy_care.function_backups, written by the migration) and drops the two new reads.
-- It KEEPS the wider category check and the function_backups table, and changes no request, update, receipt or notification. A request created with category internet or pests,
-- a priority, or a reopened/confirmed state stays exactly as stored. Use maintenance_care_rollback_full.sql afterwards ONLY while no such category exists.
begin;
set local lock_timeout='10s';
do $guard$
begin
 if to_regclass('rentlease_tenancy_care.function_backups') is null or (select count(*) from rentlease_tenancy_care.function_backups)<>2 then raise exception 'function_backups missing or not the two pinned originals';end if;
 if to_regprocedure('public.get_maintenance_inbox(integer)') is null or to_regprocedure('public.get_maintenance_request(uuid,integer)') is null then raise exception 'The maintenance care migration is not applied (or is already rolled back)';end if;
 if exists(select 1 from rentlease_tenancy_care.function_backups where source_md5 not in('883656994c2480d657e10017886f8a1e','c9f62c2a1a54300dac5f662cd89baeda')) then raise exception 'function_backups were altered';end if;
end$guard$;
select set_config('rentlease.requests_before',(select count(*)::text from public.maintenance_requests),true);
select set_config('rentlease.updates_before',(select count(*)::text from public.maintenance_updates),true);
drop function public.get_maintenance_inbox(integer);
drop function public.get_maintenance_request(uuid,integer);
do $restore$
declare b record;
begin
 for b in select name,definition,source_md5 from rentlease_tenancy_care.function_backups order by name loop
  execute b.definition;
  if md5((select prosrc from pg_proc where oid=to_regprocedure(b.name))) is distinct from b.source_md5 then raise exception 'Restored % does not match its pinned original',b.name;end if;
 end loop;
end$restore$;
do $post$
begin
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)')))<>'883656994c2480d657e10017886f8a1e'
  or md5((select prosrc from pg_proc where oid=to_regprocedure('public.log_maintenance_status_change()')))<>'c9f62c2a1a54300dac5f662cd89baeda' then raise exception 'Originals not restored';end if;
 if (select proacl::text from pg_proc where oid=to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)'))<>'{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'write_tenancy_care ACL changed';end if;
 if to_regprocedure('public.get_maintenance_inbox(integer)') is not null or to_regprocedure('public.get_maintenance_request(uuid,integer)') is not null then raise exception 'New reads still present';end if;
 if (select count(*) from public.maintenance_requests)<>current_setting('rentlease.requests_before')::bigint or (select count(*) from public.maintenance_updates)<>current_setting('rentlease.updates_before')::bigint then raise exception 'Rows changed during rollback';end if;
end$post$;
commit;
