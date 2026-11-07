-- PREPARED ONLY. No automatic publication/backfill of legacy display names/photos.
begin;
do $$ begin
 if not exists(select 1 from storage.buckets where id='avatars' and public and file_size_limit is null and allowed_mime_types is null)
 or not exists(select 1 from pg_policies where schemaname='storage' and policyname='storage_avatars_insert_own')
 or has_table_privilege('authenticated','public.profiles','UPDATE') then raise exception 'Public identity baseline drift';end if;
end $$;
alter table public.profiles add column public_nickname text,
 add column public_nickname_confirmed_at timestamptz,
 add column avatar_public_confirmed_at timestamptz,
 add column public_identity_version uuid not null default gen_random_uuid(),
 add column public_identity_request_id uuid,
 add column public_identity_request_hash text,
 add constraint public_nickname_valid check(public_nickname is null or (char_length(public_nickname) between 2 and 30 and public_nickname ~ '^[[:alnum:]][[:alnum:] ._''-]*[[:alnum:]]$')),
 add constraint public_nickname_consent check((public_nickname is null)=(public_nickname_confirmed_at is null));
-- New registrations only. The Auth row and profile are created in the same
-- transaction; no client session, local journal, or post-verification retry is needed.
-- User metadata expresses consent to optional presentation, NEVER authorization.
create function public.initialize_registration_public_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare metadata jsonb; nick text;
begin
 select raw_user_meta_data into metadata from auth.users where id=new.id;
 nick:=nullif(regexp_replace(btrim(metadata->>'public_display_name'),'\s+',' ','g'),'');
 if metadata->>'public_identity_source'='registration_v1'
 and metadata->'public_display_name_acknowledged'='true'::jsonb
 and nick is not null and char_length(nick) between 2 and 30
 and nick ~ '^[[:alnum:]][[:alnum:] ._''-]*[[:alnum:]]$' then
  new.public_nickname:=nick;
  new.public_nickname_confirmed_at:=clock_timestamp();
 end if;
 return new;
end $$;
revoke all on function public.initialize_registration_public_identity() from public,anon,authenticated;
create trigger initialize_registration_public_identity before insert on public.profiles
for each row execute function public.initialize_registration_public_identity();

revoke update(avatar_path) on public.profiles from authenticated;
update storage.buckets set file_size_limit=3145728,allowed_mime_types=array['image/jpeg','image/png'] where id='avatars';

create function public.can_read_public_identity(p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_target and p.account_status='active' and exists(select 1 from public.profiles a where a.id=auth.uid() and a.account_status='active') and
 (p.id=auth.uid() or (public.is_tier1_verified(auth.uid()) and (
 exists(select 1 from public.listings l join public.properties pr on pr.id=l.property_id where l.landlord_id=p.id and pr.landlord_id=p.id and pr.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))
 or exists(select 1 from public.conversations c where auth.uid() in(c.tenant_id,c.landlord_id) and p.id in(c.tenant_id,c.landlord_id))))));
$$;
create function public.get_public_identities(p_user_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'Active account required' using errcode='42501';end if;
 if p_user_ids is null or cardinality(p_user_ids)<1 or cardinality(p_user_ids)>50 or array_position(p_user_ids,null) is not null then raise exception 'Invalid identity batch' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',case when p.public_nickname_confirmed_at is not null then p.public_nickname end,
 'avatar_path',case when p.avatar_public_confirmed_at is not null and p.avatar_path ~ ('^'||p.id::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then p.avatar_path end)),'[]') into result from public.profiles p where p.id=any(p_user_ids) and public.can_read_public_identity(p.id);
 return result;
end $$;
create function public.get_own_public_identity() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles;
begin
 select * into p from public.profiles where id=auth.uid() and account_status='active';if not found then raise exception 'Active account required' using errcode='42501';end if;
 return jsonb_build_object('id',p.id,'nickname',p.public_nickname,'avatar_path',case when p.avatar_public_confirmed_at is not null then p.avatar_path end,'version',p.public_identity_version);
end $$;
create function public.get_own_avatar_upload(p_path text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare obj storage.objects;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') or p_path is null or p_path !~ ('^'||auth.uid()::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then raise exception 'Invalid own avatar path' using errcode='42501';end if;
 select * into obj from storage.objects where bucket_id='avatars' and name=p_path and owner_id=auth.uid()::text;
 return case when found then jsonb_build_object('exists',true,'mime',obj.metadata->>'mimetype','size',obj.metadata->>'size') else jsonb_build_object('exists',false) end;
end $$;
create function public.set_own_public_identity(p_request_id uuid,p_expected_version uuid,p_nickname text,p_avatar_path text,p_confirm_public boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; nick text:=nullif(regexp_replace(btrim(p_nickname),'\s+',' ','g'),''); digest text; obj storage.objects;
begin
 if auth.uid() is null or p_request_id is null or p_expected_version is null then raise exception 'Invalid identity request' using errcode='42501';end if;
 if nick is not null and (char_length(nick) not between 2 and 30 or nick !~ '^[[:alnum:]][[:alnum:] ._''-]*[[:alnum:]]$') then raise exception 'Invalid public nickname' using errcode='22023';end if;
 select * into p from public.profiles where id=auth.uid() and account_status='active' for update;if not found then raise exception 'Active account required' using errcode='42501';end if;
 digest:=md5(jsonb_build_array(p_expected_version,nick,p_avatar_path,p_confirm_public)::text);
 if p.public_identity_request_id=p_request_id then
 if p.public_identity_request_hash<>digest then raise exception 'Request ID reused' using errcode='23505';end if;return public.get_own_public_identity();end if;
 if p.public_identity_version<>p_expected_version then raise exception 'Public identity changed; reload' using errcode='40001';end if;
 if ((nick is not null and nick is distinct from p.public_nickname) or (p_avatar_path is not null and (p_avatar_path is distinct from p.avatar_path or p.avatar_public_confirmed_at is null))) and p_confirm_public is not true then raise exception 'Explicit public visibility confirmation required' using errcode='22023';end if;
 if p_avatar_path is not null then
 if p_avatar_path !~ ('^'||p.id::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then raise exception 'Invalid avatar path' using errcode='22023';end if;
 select * into obj from storage.objects where bucket_id='avatars' and name=p_avatar_path and owner_id=p.id::text;
 if not found or coalesce(obj.metadata->>'mimetype','') not in('image/jpeg','image/png') or coalesce(obj.metadata->>'size','') !~ '^[0-9]+$' then raise exception 'Avatar upload unavailable' using errcode='22023';end if;
 if (obj.metadata->>'size')::numeric not between 1 and 3145728 or (obj.metadata->>'mimetype'='image/jpeg' and p_avatar_path not like '%.jpg') or (obj.metadata->>'mimetype'='image/png' and p_avatar_path not like '%.png') then raise exception 'Invalid avatar upload' using errcode='22023';end if;
 end if;
 update public.profiles set public_nickname=nick,public_nickname_confirmed_at=case when nick is null then null else coalesce(public_nickname_confirmed_at,clock_timestamp()) end,
 avatar_path=p_avatar_path,avatar_public_confirmed_at=case when p_avatar_path is null then null else clock_timestamp() end,public_identity_version=gen_random_uuid(),public_identity_request_id=p_request_id,public_identity_request_hash=digest where id=p.id;
 return public.get_own_public_identity();
end $$;
create function public.can_delete_own_public_avatar(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and p_path ~ ('^'||auth.uid()::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active' and (p.avatar_path is distinct from p_path or p.avatar_public_confirmed_at is null));
$$;
create policy avatars_read_own_public_objects on storage.objects for select to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatars_insert_public_scope on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'avatars' or (name ~ ('^'||auth.uid()::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') and exists(select 1 from public.profiles where id=auth.uid() and account_status='active')));
create policy avatars_no_overwrite on storage.objects as restrictive for update to authenticated using(bucket_id<>'avatars') with check(bucket_id<>'avatars');
create policy avatars_delete_unlinked_only on storage.objects as restrictive for delete to authenticated using(bucket_id<>'avatars' or public.can_delete_own_public_avatar(name));
-- Same column names/types for legacy RPC compatibility; ambiguous names/avatars and
-- unrelated profile fields are no longer returned by the legacy public view.
create or replace view public.public_profiles as select p.id,
 case when p.public_nickname_confirmed_at is not null then p.public_nickname end as display_name,
 case when p.avatar_public_confirmed_at is not null and p.avatar_path ~ ('^'||p.id::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then p.avatar_path end as avatar_path,
 null::text as bio,p.account_status,null::numeric(3,2) as trust_score,null::text as trust_badge,null::timestamptz as created_at
 from public.profiles p where public.can_read_public_identity(p.id);
revoke all on function public.can_read_public_identity(uuid),public.get_public_identities(uuid[]),public.get_own_public_identity(),public.get_own_avatar_upload(text),public.set_own_public_identity(uuid,uuid,text,text,boolean),public.can_delete_own_public_avatar(text) from public,anon,authenticated;
grant execute on function public.can_read_public_identity(uuid),public.get_public_identities(uuid[]),public.get_own_public_identity(),public.get_own_avatar_upload(text),public.set_own_public_identity(uuid,uuid,text,text,boolean),public.can_delete_own_public_avatar(text) to authenticated;
commit;
