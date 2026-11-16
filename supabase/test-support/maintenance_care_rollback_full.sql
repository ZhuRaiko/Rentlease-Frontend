-- FULL rollback for 20261117090000_maintenance_care.sql: narrows the category check back to the five original values and removes function_backups.
-- Run maintenance_care_rollback.sql FIRST. This script refuses to run while any request uses internet or pests, or while the new functions or the patched originals are not as expected.
begin;
set local lock_timeout='10s';
do $guard$
begin
 if to_regprocedure('public.get_maintenance_inbox(integer)') is not null or to_regprocedure('public.get_maintenance_request(uuid,integer)') is not null then raise exception 'Run maintenance_care_rollback.sql first';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)')))<>'883656994c2480d657e10017886f8a1e' then raise exception 'write_tenancy_care is not the original';end if;
 if exists(select 1 from public.maintenance_requests where category in('internet','pests')) then raise exception 'Requests with the new categories exist: a full rollback would lose data';end if;
end$guard$;
alter table public.maintenance_requests drop constraint maintenance_requests_category_check;
alter table public.maintenance_requests add constraint maintenance_requests_category_check check(category in('plumbing','electrical','appliance','structural','other'));
drop table rentlease_tenancy_care.function_backups;
do $post$
begin
 if to_regclass('rentlease_tenancy_care.function_backups') is not null then raise exception 'Full rollback incomplete';end if;
 if (select md5(string_agg(conrelid::regclass::text||'.'||conname||'='||pg_get_constraintdef(oid),'|' order by conrelid::regclass::text,conname)) from pg_constraint where conrelid in('public.maintenance_requests'::regclass,'public.maintenance_updates'::regclass))<>'73cd04891da0ae4597f53109ae83eadb' then raise exception 'Constraints are not back to the pre-migration shape';end if;
end$post$;
commit;
