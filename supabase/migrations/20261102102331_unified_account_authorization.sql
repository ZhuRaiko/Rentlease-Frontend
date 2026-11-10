-- LOCAL-VALIDATED ONLY; separate deployment authorization required.
-- Source: read-only contract snapshot, cxfsbwbwmwmgtqfonqth, 2026-11-02.
-- No legacy role records, set_user_roles, identity transitions or Storage policies are rewritten.
begin;
do $migration$
declare f record; definition text; source text;
begin
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.create_property_setup(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint)');
 if source is null or md5(replace(source,chr(13),''))<>'3ff541b9e53f4140ff52d1f8858a3c7d' then raise exception 'Authorization source drift: create_property_setup';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'    -- 3. LANDLORD ROLE
    if not public.has_app_role(
        ''landlord''::public.app_role,
        v_user_id
    ) then
        raise exception ''Landlord role required''
            using errcode = ''42501'';
    end if;


','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.create_property_setup(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint)'))<>'c4301641683a1305ff370b9ba846148e' then raise exception 'Authorization rewrite mismatch: create_property_setup';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)');
 if source is null or md5(replace(source,chr(13),''))<>'4e07a6768f6c61ce2690d0d1a64026b0' then raise exception 'Authorization source drift: save_listing_draft';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'))<>'260ffe2c338beb57840aa761072e2b82' then raise exception 'Authorization rewrite mismatch: save_listing_draft';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.update_listing_draft(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)');
 if source is null or md5(replace(source,chr(13),''))<>'5214851cd855b42253ccf3ec8c011d0a' then raise exception 'Authorization source drift: update_listing_draft';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,' if not public.has_app_role(''landlord''::public.app_role,v_user) then raise exception ''Landlord role required'' using errcode=''42501''; end if;','');
 definition:=replace(definition,' or not public.has_app_role(''landlord''::public.app_role,v_user)','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.update_listing_draft(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'))<>'1cbc01da840fe61e6465e1c6c0f8f61b' then raise exception 'Authorization rewrite mismatch: update_listing_draft';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.update_published_listing_content(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)');
 if source is null or md5(replace(source,chr(13),''))<>'1816c46e41a19383380d2041faf64fe4' then raise exception 'Authorization source drift: update_published_listing_content';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,' if not public.has_app_role(''landlord''::public.app_role,v_user) then raise exception ''Landlord role required'' using errcode=''42501''; end if;','');
 definition:=replace(definition,' or not public.has_app_role(''landlord''::public.app_role,v_user)','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.update_published_listing_content(uuid,uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'))<>'ed1e5515f0d59e7d4223b914331ae78d' then raise exception 'Authorization rewrite mismatch: update_published_listing_content';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.publish_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'d874108fe12f4a5b87e2569756e76a25' then raise exception 'Authorization source drift: publish_listing';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.publish_listing(uuid)'))<>'11e9d42b4ff2cdec8bd2148557beb92a' then raise exception 'Authorization rewrite mismatch: publish_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.pause_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'d697b44527232860b5b2a601c17201df' then raise exception 'Authorization source drift: pause_listing';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.pause_listing(uuid)'))<>'25cefd629526d3cadc236c4b93d4eec2' then raise exception 'Authorization rewrite mismatch: pause_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.archive_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'487a13d48065d6cff61a5f19883d3525' then raise exception 'Authorization source drift: archive_listing';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.archive_listing(uuid)'))<>'9e737fb547e44651d955a98cbea35be5' then raise exception 'Authorization rewrite mismatch: archive_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.reactivate_listing(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'185f41e733493d162d57b1e1c4c584d1' then raise exception 'Authorization source drift: reactivate_listing';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'  if not public.has_app_role(''landlord''::public.app_role, v_user_id) then
    raise exception ''Landlord role required'' using errcode = ''42501'';
  end if;','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.reactivate_listing(uuid)'))<>'8eb305fd08f1edfebd2b66b21aff22e9' then raise exception 'Authorization rewrite mismatch: reactivate_listing';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.search_nearby_listings(double precision,double precision,integer,integer,integer)');
 if source is null or md5(replace(source,chr(13),''))<>'8110adaa0782298b4bf681e48f8f47f0' then raise exception 'Authorization source drift: search_nearby_listings';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'IF NOT public.has_app_role(
        ''tenant''::public.app_role, auth.uid()
    )
    OR NOT public.is_tier1_verified(auth.uid())','IF NOT public.is_tier1_verified(auth.uid())');
 definition:=replace(definition,'''Tenant verification required''','''Active Tier 1 verification required''');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.search_nearby_listings(double precision,double precision,integer,integer,integer)'))<>'bc659fab2f6311adbba7331a29da4347' then raise exception 'Authorization rewrite mismatch: search_nearby_listings';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.validate_verification_submission()');
 if source is null or md5(replace(source,chr(13),''))<>'26c0416c5a79c2f0835cb3787b79927a' then raise exception 'Authorization source drift: validate_verification_submission';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,'if not public.has_app_role(''landlord'', new.user_id) then
      raise exception ''Tier 3 verification is available only to landlords'';','if not public.is_tier1_verified(new.user_id) then
      raise exception ''Tier 3 requires an active Tier 1 account'';');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.validate_verification_submission()'))<>'85a70ba345a6b70a0ebb17b9e5975be2' then raise exception 'Authorization rewrite mismatch: validate_verification_submission';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('rentlease_property_edit.lock_owner(uuid)');
 if source is null or md5(replace(source,chr(13),''))<>'d31e03403ebbd63cf747fdcd48915b85' then raise exception 'Authorization source drift: lock_owner';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,' or not public.has_app_role(''landlord''::public.app_role,auth.uid())','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('rentlease_property_edit.lock_owner(uuid)'))<>'d92dbc08d296168776d7fa49e96b321c' then raise exception 'Authorization rewrite mismatch: lock_owner';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.get_owned_property_identity_statuses(uuid[])');
 if source is null or md5(replace(source,chr(13),''))<>'a7dc83059ec86d271e2af99f7455c680' then raise exception 'Authorization source drift: get_owned_property_identity_statuses';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,' or public.has_app_role(''landlord'',auth.uid()) is not true','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.get_owned_property_identity_statuses(uuid[])'))<>'9dd4c79a2c61d8cdcad0a9d44f67ec9f' then raise exception 'Authorization rewrite mismatch: get_owned_property_identity_statuses';end if;
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=to_regprocedure('public.review_property_identity_verification(uuid,uuid,uuid,uuid,verification_status,boolean,text,text)');
 if source is null or md5(replace(source,chr(13),''))<>'943973d50a79381a9db607e85e2cc2e0' then raise exception 'Authorization source drift: review_property_identity_verification';end if;
 definition:=replace(definition,chr(13),'');
 definition:=replace(definition,' or not public.has_app_role(''landlord'',s.user_id)','');
 execute definition;
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.review_property_identity_verification(uuid,uuid,uuid,uuid,verification_status,boolean,text,text)'))<>'a2cc92185c9ebfd097159d06daa2f80d' then raise exception 'Authorization rewrite mismatch: review_property_identity_verification';end if;
end
$migration$;
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='tenant_preferences' and policyname='preferences_owner_admin' and with_check='(((tenant_id = auth.uid()) AND has_app_role(''tenant''::app_role)) OR is_admin())') then raise exception 'Policy drift: preferences_owner_admin';end if;end $policy$;
alter policy preferences_owner_admin on public.tenant_preferences with check ((((tenant_id = auth.uid() AND is_tier1_verified())) OR is_admin()));
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='saved_listings' and policyname='saved_listings_owner' and with_check='(((tenant_id = auth.uid()) AND has_app_role(''tenant''::app_role)) OR is_admin())') then raise exception 'Policy drift: saved_listings_owner';end if;end $policy$;
alter policy saved_listings_owner on public.saved_listings with check ((((tenant_id = auth.uid() AND is_tier1_verified())) OR is_admin()));
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='conversations' and policyname='conversations_create_tenant' and with_check='((tenant_id = auth.uid()) AND has_app_role(''tenant''::app_role) AND is_tier1_verified())') then raise exception 'Policy drift: conversations_create_tenant';end if;end $policy$;
alter policy conversations_create_tenant on public.conversations with check (((tenant_id = auth.uid()) AND is_tier1_verified()));
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='listings' and policyname='listings_create_owner' and with_check='((landlord_id = auth.uid()) AND has_app_role(''landlord''::app_role) AND is_tier1_verified() AND can_manage_property(property_id))') then raise exception 'Policy drift: listings_create_owner';end if;end $policy$;
alter policy listings_create_owner on public.listings with check (((landlord_id = auth.uid()) AND is_tier1_verified() AND can_manage_property(property_id)));
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='properties' and policyname='properties_create_verified_landlord' and with_check='((landlord_id = auth.uid()) AND has_app_role(''landlord''::app_role) AND is_tier1_verified())') then raise exception 'Policy drift: properties_create_verified_landlord';end if;end $policy$;
alter policy properties_create_verified_landlord on public.properties with check (((landlord_id = auth.uid()) AND is_tier1_verified()));
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='verification_submissions' and policyname='verification_submissions_create_tier3_self' and with_check='((user_id = ( SELECT auth.uid() AS uid)) AND is_tier1_verified() AND has_app_role(''landlord''::app_role) AND (tier = ''tier_3_property''::verification_tier) AND (property_id IS NOT NULL) AND (status = ''pending''::verification_status) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_note IS NULL) AND (rejection_reason IS NULL))') then raise exception 'Policy drift: verification_submissions_create_tier3_self';end if;end $policy$;
alter policy verification_submissions_create_tier3_self on public.verification_submissions with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_tier1_verified() AND (tier = 'tier_3_property'::verification_tier) AND (property_id IS NOT NULL) AND (status = 'pending'::verification_status) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_note IS NULL) AND (rejection_reason IS NULL) AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.landlord_id=auth.uid())));
alter table public.profiles add column if not exists experience_preference text constraint profiles_experience_preference_check check(experience_preference in ('rent','list','both'));
do $preference$ begin if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='experience_preference' and data_type='text' and is_nullable='YES') or not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_experience_preference_check' and contype='c' and convalidated) then raise exception 'Display preference contract drift';end if;end $preference$;
comment on column public.profiles.experience_preference is 'Optional presentation preference only. Never an authorization input.';
update public.profiles p set experience_preference=(select case when count(*)=2 then 'both' when bool_or(ur.role='landlord') then 'list' else 'rent' end from public.user_roles ur where ur.user_id=p.id and ur.role in ('tenant','landlord') having count(*)>0) where p.experience_preference is null;
grant update(experience_preference) on public.profiles to authenticated;
commit;
