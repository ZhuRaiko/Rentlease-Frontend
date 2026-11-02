-- READ ONLY. Run only after separately authorized Milestone 4 deployment.
-- Eligible verification bootstrap metadata updates also run existing updated_at/profile refresh triggers.
-- Submitted/reviewed timestamps and review decisions are preserved; updated_at can change.
-- Compare hashes with a separately captured before-deployment baseline.
select count(*) as properties,md5(string_agg((to_jsonb(p)-'edit_version')::text,'' order by id)) as properties_fingerprint from public.properties p;
select count(*) as listings,md5(string_agg(to_jsonb(l)::text,'' order by id)) as listing_fingerprint from public.listings l;
select count(*) as photos,md5(string_agg(to_jsonb(p)::text,'' order by id)) as photo_fingerprint from public.property_photos p;
select count(*) as submissions,md5(string_agg((to_jsonb(v)-array['identity_revision_id','identity_correction_id','identity_review_version','ready_for_review_at','updated_at'])::text,'' order by id)) as prior_verification_fields_fingerprint from public.verification_submissions v;
select count(*) as private_locations,md5(string_agg(to_jsonb(p)::text,'' order by property_id)) as private_identity_fingerprint from public.property_private_locations p;
select count(*) as repairs from rentlease_property_identity.repairs;
select exists(select 1 from rentlease_property_identity.repairs where property_id='52897654-d4f8-405e-b11e-44e57b4b4007') as legacy_excluded,
 not exists(select 1 from rentlease_property_identity.current_identity where property_id='52897654-d4f8-405e-b11e-44e57b4b4007') as no_inferred_legacy_binding;
select count(*) as invalid_bindings from rentlease_property_identity.current_identity c join rentlease_property_identity.revisions r on r.id=c.revision_id join public.properties p on p.id=c.property_id left join public.verification_submissions v on v.id=c.approved_submission_id where r.owner_id<>p.landlord_id or (c.approved_submission_id is not null and (v.property_id is distinct from c.property_id or v.identity_revision_id is distinct from c.revision_id or v.user_id is distinct from p.landlord_id));
select p.oid::regprocedure as signature,p.prosecdef,p.proconfig,has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,has_function_privilege('anon',p.oid,'execute') as anon_execute,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) where grantee=0 and privilege_type='EXECUTE') as public_execute from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in('get_owned_property_identity_statuses','get_property_identity_context','get_property_identity_operation','manage_property_identity','get_property_identity_submission','begin_property_identity_verification','attach_property_identity_document','get_admin_property_identity_review','review_property_identity_verification');
select t.tgname,t.tgenabled from pg_trigger t where not t.tgisinternal and (t.tgname like 'identity_%' or t.tgname='aab_tenancy_identity_gate');
select tablename,policyname,permissive,cmd from pg_policies where policyname like 'identity_%';
select version,name from supabase_migrations.schema_migrations where name='property_identity_revision_verification';
