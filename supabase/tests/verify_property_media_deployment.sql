-- READ ONLY. Execute separately AFTER the COMPLETE migration file commits.
-- Check all booleans/counts; this does not mutate listing content or record migration history.
begin read only;
select current_database() database_name, current_setting('server_version') postgres_version;
select count(*) total_properties,count(*) filter(where edit_version is null or media_version is null) missing_versions from public.properties;
select l.status,count(*) listings from public.listings l group by l.status order by l.status;
select p.proname,pg_get_function_identity_arguments(p.oid) signature,p.prosecdef security_definer,p.proconfig settings,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
 exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('get_property_media_state','get_property_media_operation','manage_property_media','property_media_storage_guard') order by p.proname;
select has_table_privilege('authenticated','public.property_photos','INSERT') direct_insert,
 has_table_privilege('authenticated','public.property_photos','DELETE') direct_delete,
 has_column_privilege('authenticated','public.property_photos','alt_text','UPDATE') direct_alt_update,
 has_function_privilege('authenticated','public.set_property_cover_photo(uuid)','EXECUTE') legacy_cover_execute;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
 where schemaname='storage' and policyname in ('property_media_intent_insert','property_media_immutable_update','property_media_cleanup_delete') order by policyname;
select tgname,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.property_photos'::regclass and tgname='property_media_rotate';
select count(*) unbound_photos from public.property_photos ph where not exists(select 1 from rentlease_property_edit.media_intents i where i.photo_id=ph.id and i.property_id=ph.property_id and i.state='registered');
select version,name from supabase_migrations.schema_migrations where version in ('20261101130456','20261101145623','20261101180736') order by version;
commit;
-- Already deployed through connected tools as 20261101180736.
-- Read-only verification only; do not replay SQL or repair existing migration history.
