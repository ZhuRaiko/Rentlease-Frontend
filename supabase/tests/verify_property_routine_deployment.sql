-- Read-only catalog verification after separately authorized Milestone 3 deployment.
begin read only;
select version,name from supabase_migrations.schema_migrations where name='property_routine_details_update_and_tenancy_guard';
select p.proname,pg_get_function_arguments(p.oid),pg_get_function_result(p.oid),p.prosecdef,p.proconfig,p.proacl from pg_proc p where p.oid in ('public.get_owned_property_edit_context(uuid)'::regprocedure,'public.get_property_details_operation(uuid,uuid)'::regprocedure,'public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,bigint[],text)'::regprocedure);
select count(*) null_property_versions from public.properties where edit_version is null;
select pg_get_triggerdef(oid) from pg_trigger where tgname in ('aaa_tenancy_property_gate','property_details_rotate','property_private_details_rotate','property_amenity_details_rotate');
select has_function_privilege('authenticated','public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,bigint[],text)','execute') authenticated_execute,has_function_privilege('anon','public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,bigint[],text)','execute') anon_execute;
select status,count(*) from public.listings group by status;
commit;
