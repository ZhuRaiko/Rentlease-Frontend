-- Read-only live verification. Uses existing accounts and relationships only.
-- Never invokes identity writes, uploads, signup, or UC-08/UC-09 mutations.
begin isolation level repeatable read read only;
do $verify$
declare actors jsonb; targets jsonb; relationships jsonb; a jsonb; t jsonb;
 actor uuid; target uuid; active boolean; eligible boolean; permitted boolean;
 result jsonb; expected_count integer; checks integer:=0; allowed_pairs integer:=0;
 denied_pairs integer:=0; signature text; path text; original_role text:=current_user;
begin
 if (select count(*) from supabase_migrations.schema_migrations where name='public_identity_nicknames_avatars')<>1 then raise exception 'Identity migration history mismatch';end if;checks:=checks+1;
 if not (select relrowsecurity from pg_class where oid='public.profiles'::regclass)
 or not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then raise exception 'Required RLS disabled';end if;checks:=checks+1;
 if has_table_privilege('authenticated','public.profiles','UPDATE') or has_column_privilege('authenticated','public.profiles','avatar_path','UPDATE')
 or has_column_privilege('authenticated','public.profiles','public_nickname','UPDATE') or has_column_privilege('authenticated','public.profiles','public_nickname_confirmed_at','UPDATE')
 or has_any_column_privilege('anon','public.profiles','SELECT,UPDATE') then raise exception 'Unexpected profile privileges';end if;checks:=checks+1;
 if (select count(*) from pg_constraint where conrelid='public.profiles'::regclass and convalidated and conname in('public_nickname_valid','public_nickname_consent'))<>2 then raise exception 'Consent constraints missing';end if;checks:=checks+1;
 if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='initialize_registration_public_identity' and tgfoid='public.initialize_registration_public_identity()'::regprocedure and tgenabled='O') then raise exception 'Signup initialization trigger missing';end if;checks:=checks+1;
 if has_function_privilege('authenticated','public.initialize_registration_public_identity()','execute') or has_function_privilege('anon','public.initialize_registration_public_identity()','execute') then raise exception 'Trigger helper callable by client';end if;checks:=checks+1;
 foreach signature in array array['public.can_read_public_identity(uuid)','public.get_public_identities(uuid[])','public.get_own_public_identity()','public.get_own_avatar_upload(text)','public.set_own_public_identity(uuid,uuid,text,text,boolean)','public.can_delete_own_public_avatar(text)'] loop
  if not has_function_privilege('authenticated',signature,'execute') or has_function_privilege('anon',signature,'execute') then raise exception 'Identity RPC grant mismatch';end if;checks:=checks+1;
  if not exists(select 1 from pg_proc where oid=signature::regprocedure and prosecdef and proconfig @> array['search_path=""']) then raise exception 'Identity RPC definer/search path mismatch';end if;checks:=checks+1;
 end loop;
 if not exists(select 1 from pg_proc where oid='public.initialize_registration_public_identity()'::regprocedure and prosecdef and proconfig @> array['search_path=""']) then raise exception 'Initialization definer mismatch';end if;checks:=checks+1;
 if not exists(select 1 from storage.buckets where id='avatars' and public and file_size_limit=3145728 and allowed_mime_types=array['image/jpeg','image/png']) then raise exception 'Avatar bucket limits mismatch';end if;checks:=checks+1;
 if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname in('avatars_read_own_public_objects','avatars_insert_public_scope','avatars_no_overwrite','avatars_delete_unlinked_only'))<>4 then raise exception 'Avatar policies missing';end if;checks:=checks+1;
 if exists(select 1 from public.profiles where public_nickname is not null or public_nickname_confirmed_at is not null or avatar_public_confirmed_at is not null) then raise exception 'Unexpected legacy publication; investigate concurrent activity';end if;checks:=checks+1;
 select jsonb_agg(jsonb_build_object('id',p.id,'active',p.account_status='active','eligible',public.is_tier1_verified(p.id))) into actors from public.profiles p;
 select jsonb_agg(jsonb_build_object('id',p.id,'active',p.account_status='active','listed',exists(select 1 from public.listings l join public.properties pr on pr.id=l.property_id where l.landlord_id=p.id and pr.landlord_id=p.id and pr.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date)))) into targets from public.profiles p;
 select coalesce(jsonb_agg(jsonb_build_object('tenant',tenant_id,'owner',landlord_id)),'[]') into relationships from public.conversations;
 if exists(select 1 from public.profiles where id='ffffffff-ffff-4fff-8fff-ffffffffffff') then raise exception 'Sentinel collision';end if;
 actors:=actors||jsonb_build_array(jsonb_build_object('id',null,'active',false,'eligible',false),jsonb_build_object('id','ffffffff-ffff-4fff-8fff-ffffffffffff','active',false,'eligible',false));
 for a in select value from jsonb_array_elements(actors) loop
  actor:=(a->>'id')::uuid;active:=(a->>'active')::boolean;eligible:=(a->>'eligible')::boolean;expected_count:=0;
  execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  if active then
   result:=public.get_own_public_identity();
   if (result->>'id')::uuid<>actor or result->>'nickname' is not null or result->>'avatar_path' is not null or (select count(*) from jsonb_object_keys(result))<>4 then raise exception 'Own identity projection mismatch';end if;checks:=checks+1;
   begin perform public.get_public_identities(array_fill(actor,array[51]));raise exception 'Oversized lookup accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.get_public_identities(array[]::uuid[]);raise exception 'Empty lookup accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   path:=actor::text||'/public/ffffffff-ffff-4fff-8fff-ffffffffffff.jpg';
   result:=public.get_own_avatar_upload(path);
   if result<>jsonb_build_object('exists',false) then raise exception 'Unexpected sentinel avatar';end if;checks:=checks+1;
  else
   begin perform public.get_own_public_identity();raise exception 'Inactive own read accepted';exception when insufficient_privilege then checks:=checks+1;end;
  end if;
  for t in select value from jsonb_array_elements(targets) loop
   target:=(t->>'id')::uuid;
   permitted:=active and (t->>'active')::boolean and (target=actor or (eligible and ((t->>'listed')::boolean or exists(select 1 from jsonb_array_elements(relationships) c where actor in((c->>'tenant')::uuid,(c->>'owner')::uuid) and target in((c->>'tenant')::uuid,(c->>'owner')::uuid)))));
   if active then
    result:=public.get_public_identities(array[target]);
    if jsonb_array_length(result)<>(case when permitted then 1 else 0 end) then raise exception 'Relationship projection mismatch';end if;
    if permitted then
     expected_count:=expected_count+1;allowed_pairs:=allowed_pairs+1;
     if (result->0->>'id')::uuid<>target or result->0->>'nickname' is not null or result->0->>'avatar_path' is not null or (select count(*) from jsonb_object_keys(result->0))<>3 then raise exception 'Private or legacy identity leaked';end if;
    else denied_pairs:=denied_pairs+1;end if;
   else
    begin perform public.get_public_identities(array[target]);raise exception 'Inactive batch read accepted';exception when insufficient_privilege then denied_pairs:=denied_pairs+1;end;
   end if;checks:=checks+1;
   if target<>actor or actor is null then
    begin perform public.get_own_avatar_upload(target::text||'/public/ffffffff-ffff-4fff-8fff-ffffffffffff.jpg');raise exception 'Foreign avatar metadata accepted';exception when insufficient_privilege then checks:=checks+1;end;
    if public.can_delete_own_public_avatar(target::text||'/public/ffffffff-ffff-4fff-8fff-ffffffffffff.jpg') is true then raise exception 'Foreign avatar deletion permitted';end if;checks:=checks+1;
   end if;
  end loop;
  if (select count(*) from public.public_profiles)<>expected_count then raise exception 'Legacy view relationship mismatch';end if;checks:=checks+1;
  if exists(select 1 from public.public_profiles where display_name is not null or avatar_path is not null or bio is not null or trust_score is not null or trust_badge is not null or created_at is not null) then raise exception 'Legacy view exposed unconfirmed/private information';end if;checks:=checks+1;
  if exists(select 1 from public.profiles where id is distinct from actor) then raise exception 'Foreign profile directly visible';end if;checks:=checks+1;
  if exists(select 1 from storage.objects where bucket_id='avatars' and (storage.foldername(name))[1] is distinct from actor::text) then raise exception 'Foreign avatar metadata directly visible';end if;checks:=checks+1;
  execute 'set local role '||quote_ident(original_role);
 end loop;
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 begin perform public.get_public_identities(array['ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid]);raise exception 'Anonymous identity RPC accepted';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform count(*) from public.public_profiles;raise exception 'Anonymous public view accepted';exception when insufficient_privilege then checks:=checks+1;end;
 execute 'set local role '||quote_ident(original_role);
 perform set_config('rentlease.public_identity_verification',jsonb_build_object('passed',checks,'failed',0,'allowed_pairs',allowed_pairs,'denied_pairs',denied_pairs,'existing_accounts',jsonb_array_length(targets),'production_writes',false)::text,true);
end $verify$;
select current_setting('rentlease.public_identity_verification')::jsonb as verification;
rollback;
