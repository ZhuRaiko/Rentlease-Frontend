-- READ ONLY. Deployed follow-up 20261102021812 (preparation version 20261101183628).
begin read only;
select strpos(pg_get_functiondef('public.manage_property_media(uuid,uuid,uuid,text,jsonb)'::regprocedure),'reorder_cover')>0 atomic_grid_contract_present;
select count(*) first_cover_violations from (select property_id,is_cover,row_number() over(partition by property_id order by sort_order,created_at,id) position from public.property_photos) p where position=1 and not is_cover;
select count(*) duplicate_covers from (select property_id from public.property_photos where is_cover group by property_id having count(*)>1) p;
select has_function_privilege('authenticated','public.manage_property_media(uuid,uuid,uuid,text,jsonb)','EXECUTE') authenticated_execute,has_function_privilege('anon','public.manage_property_media(uuid,uuid,uuid,text,jsonb)','EXECUTE') anon_execute;
select version,name from supabase_migrations.schema_migrations where name='property_photo_order_cover_atomic';
commit;
