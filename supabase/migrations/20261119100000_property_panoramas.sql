-- PREPARED LOCAL ONLY. NOT APPLIED. 360-degree Room tour ("Look around the room"): up to two phone panoramas per property (front, back).
-- Design: docs/design/room-tour-backend-design.md. Rollback: supabase/test-support/property_panoramas_rollback.sql (data-retaining) and
--   supabase/test-support/property_panoramas_rollback_full.sql (only while the table is empty and the bucket has no objects).
-- Checks: supabase/test-support/property_panoramas_checks.sql (ends in a deliberate exception; nothing can commit).
--
-- What this adds: Storage bucket property-panoramas, table public.property_panoramas, two RPCs (set_property_panorama, remove_property_panorama),
-- Storage policies for the owner's own folder, a private helper schema rentlease_property_panorama, and ONE patch: the allow-list of
-- rentlease_unfinished_posts.inspect(uuid) so a panorama row does not count as "protected history" when deleting an unfinished post.
-- Panoramas are NOT property_photos rows: they never change the 10-photo count or become the cover.
--
-- BUCKET CREATION. No earlier migration in this repository creates a bucket (property-media and avatars already existed and were only asserted).
-- This migration creates property-panoramas with an idempotent insert into storage.buckets (on conflict do nothing) and then asserts the contract:
-- public true, file_size_limit 15728640 (15 MiB, one setting at the top of this file), allowed_mime_types exactly image/jpeg, image/png, image/webp.
-- A bucket that already exists with any other settings stops the migration. Dashboard alternative: create the bucket by hand with those settings,
-- then run this file (the insert does nothing and the contract is still asserted). UNVERIFIED on hosted: whether this migration context may insert into
-- storage.buckets and create policies on storage.objects. If either is refused the transaction rolls back; stop and report, do not improvise.
--
-- Accepted v1 gap: deleting an unfinished post removes the rows (ON DELETE CASCADE) but leaves the files in the bucket (the edge function is not touched).
-- Hosted history has drifted: never db push. Apply directly (db query --linked -f), then a single-version migration repair, after a fresh predeploy backup.
begin;
set local lock_timeout='10s';
-- The one place the bucket size limit lives. Read by the guard, the insert and the post-conditions.
select set_config('rentlease_panorama.file_size_limit','15728640',true);

-- ---------------------------------------------------------------------------------------------------------------------------
-- Baseline guards: stop unless the live objects this migration depends on are exactly what it was written against.
-- Function fingerprints are md5(replace(prosrc,chr(13),'')): hosted bodies can contain CR characters (they were applied from CRLF files).
-- ---------------------------------------------------------------------------------------------------------------------------
do $guard$
declare b storage.buckets%rowtype;limit_bytes bigint:=current_setting('rentlease_panorama.file_size_limit')::bigint;
begin
 if to_regclass('public.properties') is null or to_regclass('public.listings') is null or to_regclass('public.tenancies') is null or to_regclass('public.property_photos') is null then raise exception 'Required tables missing';end if;
 if to_regclass('public.property_panoramas') is not null or to_regnamespace('rentlease_property_panorama') is not null
  or to_regprocedure('public.set_property_panorama(uuid,text,text,integer,integer)') is not null or to_regprocedure('public.remove_property_panorama(uuid,text)') is not null then raise exception 'Room tour objects already exist';end if;
 select * into b from storage.buckets where id='property-panoramas';
 if found and not(b.public is true and b.file_size_limit=limit_bytes and b.allowed_mime_types is not null
   and b.allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[] and b.allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[])
  then raise exception 'Unexpected property-panoramas bucket contract; stop for review' using errcode='22023';end if;
 if has_table_privilege('authenticated','public.property_photos','INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.property_photos','SELECT') then raise exception 'property_photos posture drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.can_manage_property(uuid,uuid)')),chr(13),'')) is distinct from '67764c2e0245324ba5c10b56c21eaced' then raise exception 'can_manage_property drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.can_view_property(uuid,uuid)')),chr(13),'')) is distinct from 'a871fda6e96411b0bfa2c4c68f78c6ab' then raise exception 'can_view_property drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.is_tier1_verified(uuid)')),chr(13),'')) is distinct from 'f839df2bff48c4b5880a1794b6d101d5' then raise exception 'is_tier1_verified drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_property_edit.lock_owner(uuid)')),chr(13),'')) is distinct from 'd92dbc08d296168776d7fa49e96b321c' then raise exception 'lock_owner drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_unfinished_posts.inspect(uuid)')),chr(13),'')) is distinct from '05d843208715e6122ea53beec8165989' then raise exception 'unfinished-post inspect drifted';end if;
end$guard$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Bucket (idempotent), then private helper schema: no client role has any access except the one Storage-policy helper granted below.
-- ---------------------------------------------------------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('property-panoramas','property-panoramas',true,current_setting('rentlease_panorama.file_size_limit')::bigint,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;

create schema rentlease_property_panorama;
revoke all on schema rentlease_property_panorama from public,anon,authenticated,service_role;

-- At most 6 objects per owner/property folder in this bucket: 2 slots plus replacement headroom. Bounds an owner who uploads without registering.
-- A policy that queried storage.objects directly would recurse, so the count lives in a SECURITY DEFINER helper.
create function rentlease_property_panorama.folder_has_room(p_name text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select (select count(*) from storage.objects o where o.bucket_id='property-panoramas' and starts_with(o.name,substring(p_name from '^[^/]+/[^/]+/')))<6
$$;
alter function rentlease_property_panorama.folder_has_room(text) owner to postgres;
revoke all on function rentlease_property_panorama.folder_has_room(text) from public,anon,authenticated,service_role;
-- Storage policies run as the calling role, so that role needs USAGE on the schema and EXECUTE on this one helper. The schema holds no tables.
grant usage on schema rentlease_property_panorama to authenticated;
grant execute on function rentlease_property_panorama.folder_has_room(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Table. Writes only through the two RPCs below (security definer); clients can only read, through RLS.
-- ---------------------------------------------------------------------------------------------------------------------------
create table public.property_panoramas(
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.properties(id) on delete cascade,
 side text not null check(side in('front','back')),
 storage_path text not null,
 width integer not null check(width>0),
 height integer not null check(height>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(property_id,side),
 unique(storage_path)
);
alter table public.property_panoramas enable row level security;
revoke all on public.property_panoramas from public,anon,authenticated,service_role;
grant select on public.property_panoramas to authenticated;
create policy property_panoramas_read_allowed on public.property_panoramas for select to authenticated using(public.can_view_property(property_id));

-- ---------------------------------------------------------------------------------------------------------------------------
-- RPCs. Ownership and eligibility reuse lock_owner (Tier 1 landlord, owned active property, advisory lock); the listing status does not matter.
-- Errors: 42501 not allowed (from lock_owner) | 22023 input and upload checks.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.set_property_panorama(p_property_id uuid,p_side text,p_storage_path text,p_width integer,p_height integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();prev text;
begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 if p_side is null or p_side not in('front','back') then raise exception 'Side must be front or back' using errcode='22023';end if;
 if p_storage_path is null or p_storage_path !~ ('^'||a::text||'/'||p_property_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$') then raise exception 'Invalid panorama path' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='property-panoramas' and name=p_storage_path) then raise exception 'Upload not found' using errcode='22023';end if;
 if p_width is null or p_height is null or p_width<=0 or p_height<=0 then raise exception 'Panorama size is required' using errcode='22023';end if;
 if p_width::numeric/p_height<3 then raise exception 'Panorama must be at least 3:1 wide' using errcode='22023';end if;
 if p_width>16384 then raise exception 'Panorama is too wide' using errcode='22023';end if;
 if exists(select 1 from public.property_panoramas where storage_path=p_storage_path and not(property_id=p_property_id and side=p_side)) then raise exception 'Panorama file is already in use' using errcode='22023';end if;
 select storage_path into prev from public.property_panoramas where property_id=p_property_id and side=p_side;
 insert into public.property_panoramas(property_id,side,storage_path,width,height) values(p_property_id,p_side,p_storage_path,p_width,p_height)
  on conflict(property_id,side) do update set storage_path=excluded.storage_path,width=excluded.width,height=excluded.height,updated_at=now();
 return jsonb_build_object('side',p_side,'storage_path',p_storage_path,'replaced_path',case when prev is distinct from p_storage_path then prev else null end);
end
$$;
create function public.remove_property_panorama(p_property_id uuid,p_side text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare gone text;
begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 if p_side is null or p_side not in('front','back') then raise exception 'Side must be front or back' using errcode='22023';end if;
 delete from public.property_panoramas where property_id=p_property_id and side=p_side returning storage_path into gone;
 return jsonb_build_object('side',p_side,'removed_path',gone);
end
$$;
alter function public.set_property_panorama(uuid,text,text,integer,integer) owner to postgres;
alter function public.remove_property_panorama(uuid,text) owner to postgres;
revoke all on function public.set_property_panorama(uuid,text,text,integer,integer),public.remove_property_panorama(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.set_property_panorama(uuid,text,text,integer,integer),public.remove_property_panorama(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Storage policies for the owner's own folder: <ownerId>/<propertyId>/<uuid>.<jpg|jpeg|png|webp>. The cast runs only when the name matches,
-- so a bad name returns false instead of a cast error. Updates are never allowed (the client uploads with upsert:false).
-- ---------------------------------------------------------------------------------------------------------------------------
create policy storage_property_panoramas_insert_owner on storage.objects as permissive for insert to authenticated
 with check(case when bucket_id='property-panoramas' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' and (storage.foldername(name))[1]=auth.uid()::text
  then public.can_manage_property(((storage.foldername(name))[2])::uuid) and rentlease_property_panorama.folder_has_room(name) else false end);
create policy storage_property_panoramas_select_owner on storage.objects as permissive for select to authenticated
 using(case when bucket_id='property-panoramas' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' and (storage.foldername(name))[1]=auth.uid()::text
  then public.can_manage_property(((storage.foldername(name))[2])::uuid) else false end);
create policy storage_property_panoramas_delete_owner on storage.objects as permissive for delete to authenticated
 using(case when bucket_id='property-panoramas' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' and (storage.foldername(name))[1]=auth.uid()::text
  then public.can_manage_property(((storage.foldername(name))[2])::uuid) else false end);
create policy property_panoramas_immutable_update on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'property-panoramas') with check(bucket_id<>'property-panoramas');

-- ---------------------------------------------------------------------------------------------------------------------------
-- The one patch to an existing function: rentlease_unfinished_posts.inspect(uuid) treats any foreign-key table that is not on its allow-list as
-- "protected history". Only the allow-list changes (property_panoramas added); language, security definer, search_path and grants are preserved.
-- Body pinned (CR stripped): before 05d843208715e6122ea53beec8165989, after fd1bc6691ce65b03ae723d94a2d8a7c9.
-- ---------------------------------------------------------------------------------------------------------------------------
create or replace function rentlease_unfinished_posts.inspect(p_property_id uuid) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare ref record; has_rows boolean; col text;
begin
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) then raise exception 'Active Tier 1 account required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 perform 1 from public.properties where id=p_property_id and landlord_id=auth.uid() and is_active for update;
 if not found then raise exception 'Owned active property required' using errcode='42501';end if;
 perform 1 from public.listings where property_id=p_property_id for update;
 if exists(select 1 from rentlease_unfinished_posts.records where property_id=p_property_id and (ever_published or owner_id<>auth.uid()))
 or exists(select 1 from public.listings where property_id=p_property_id and (status<>'draft' or published_at is not null)) then return 'This property has publication history and cannot be deleted.';end if;
 -- All unrecognized FK dependencies are protected, including future schema additions.
 for ref in select con.conrelid,con.confrelid,con.conkey,n.nspname,c.relname
 from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
 where con.contype='f' and con.confrelid in ('public.properties'::regclass,'public.listings'::regclass)
 loop
  if ref.confrelid='public.properties'::regclass and ref.nspname='public' and ref.relname in ('listings','property_photos','property_private_locations','property_amenities','property_nearby_places','price_estimates','property_panoramas') then continue;end if;
  if ref.confrelid='public.properties'::regclass and ref.nspname='rentlease_property_edit' and ref.relname='media_intents' then continue;end if;
  if ref.confrelid='public.listings'::regclass and ref.nspname='public' and ref.relname='price_estimates' then continue;end if;
  if array_length(ref.conkey,1)<>1 then return 'A protected reference requires review before deletion.';end if;
  select attname into col from pg_attribute where attrelid=ref.conrelid and attnum=ref.conkey[1];
  if ref.confrelid='public.properties'::regclass then
   execute format('select exists(select 1 from %s where %I=$1)',ref.conrelid::regclass,col) into has_rows using p_property_id;
  else
   execute format('select exists(select 1 from %s t join public.listings l on t.%I=l.id where l.property_id=$1)',ref.conrelid::regclass,col) into has_rows using p_property_id;
  end if;
  if has_rows then return 'This property has protected history or verification records and cannot be deleted.';end if;
 end loop;
 if exists(select 1 from public.admin_audit_logs where entity_id=p_property_id or entity_id in(select id from public.listings where property_id=p_property_id)) then return 'Security history must be retained with this property.';end if;
 if exists(select 1 from public.notifications n where n.data::text like '%'||p_property_id::text||'%' or exists(select 1 from public.listings l where l.property_id=p_property_id and n.data::text like '%'||l.id::text||'%')) then return 'A protected notification references this property.';end if;
 if exists(select 1 from rentlease_property_edit.media_intents where property_id=p_property_id and state='reserved') then return 'Finish or cancel pending photo uploads before deleting.';end if;
 if exists(select 1 from rentlease_property_edit.media_intents i where i.property_id=p_property_id and (i.owner_id<>auth.uid() or i.path !~ ('^'||auth.uid()::text||'/'||p_property_id::text||'/'||i.photo_id::text||'\.(jpg|jpeg|png|webp)$')))
 or exists(select 1 from public.property_photos ph where ph.property_id=p_property_id and not exists(select 1 from rentlease_property_edit.media_intents i where i.property_id=p_property_id and i.photo_id=ph.id and ph.storage_path='property-media/'||i.path))
 or exists(select 1 from storage.objects o where o.bucket_id='property-media' and o.name like auth.uid()::text||'/'||p_property_id::text||'/%' and not exists(select 1 from rentlease_property_edit.media_intents i where i.property_id=p_property_id and i.path=o.name))
 or exists(select 1 from public.property_photos ph join rentlease_property_edit.media_intents i on ph.storage_path='property-media/'||i.path where i.property_id=p_property_id and ph.property_id<>p_property_id) then return 'Photo ownership or references need review before deletion.';end if;
 return null;
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Post-conditions: stop (and roll everything back) if the final state is not what was designed.
-- ---------------------------------------------------------------------------------------------------------------------------
do $post$
declare f regprocedure;b storage.buckets%rowtype;
begin
 foreach f in array array['public.set_property_panorama(uuid,text,text,integer,integer)'::regprocedure,'public.remove_property_panorama(uuid,text)'::regprocedure] loop
  if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'Room tour RPC grants are wrong: %',f;end if;
  if exists(select 1 from pg_proc p where p.oid=f and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres')) then raise exception 'Room tour RPC is not security definer with a fixed search_path: %',f;end if;
 end loop;
 if md5(replace((select prosrc from pg_proc where oid='public.set_property_panorama(uuid,text,text,integer,integer)'::regprocedure),chr(13),'')) is distinct from '445ee381083202d57bc2a5b7029b6e57'
  or md5(replace((select prosrc from pg_proc where oid='public.remove_property_panorama(uuid,text)'::regprocedure),chr(13),'')) is distinct from '2d45667038d7220f17843f562dfd0aa4' then raise exception 'Room tour RPC bodies differ from the reviewed definitions';end if;
 if has_schema_privilege('anon','rentlease_property_panorama','USAGE') or has_schema_privilege('service_role','rentlease_property_panorama','USAGE') or not has_schema_privilege('authenticated','rentlease_property_panorama','USAGE') then raise exception 'Helper schema grants are wrong';end if;
 if (select count(*) from pg_proc p where p.pronamespace='rentlease_property_panorama'::regnamespace and has_function_privilege('authenticated',p.oid,'EXECUTE'))<>1
  or exists(select 1 from pg_proc p where p.pronamespace='rentlease_property_panorama'::regnamespace and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'Helper functions are exposed';end if;
 if has_table_privilege('authenticated','public.property_panoramas','INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.property_panoramas','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('service_role','public.property_panoramas','SELECT,INSERT,UPDATE,DELETE') or not has_table_privilege('authenticated','public.property_panoramas','SELECT') then raise exception 'property_panoramas grants are wrong';end if;
 if not (select relrowsecurity from pg_class where oid='public.property_panoramas'::regclass) then raise exception 'property_panoramas has no RLS';end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='property_panoramas' and policyname='property_panoramas_read_allowed' and cmd='SELECT' and roles='{authenticated}')<>1 then raise exception 'Read policy is wrong';end if;
 if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname in('storage_property_panoramas_insert_owner','storage_property_panoramas_select_owner','storage_property_panoramas_delete_owner','property_panoramas_immutable_update'))<>4 then raise exception 'Storage policies are missing';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.property_panoramas'::regclass and contype='f' and confrelid='public.properties'::regclass and confdeltype='c') then raise exception 'Cascade foreign key is missing';end if;
 select * into b from storage.buckets where id='property-panoramas';
 if not found or not(b.public is true and b.file_size_limit=current_setting('rentlease_panorama.file_size_limit')::bigint and b.allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[] and b.allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]) then raise exception 'Unexpected property-panoramas bucket contract; stop for review';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_unfinished_posts.inspect(uuid)')),chr(13),'')) is distinct from 'fd1bc6691ce65b03ae723d94a2d8a7c9'
  or exists(select 1 from pg_proc p where p.oid=to_regprocedure('rentlease_unfinished_posts.inspect(uuid)') and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres' or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then raise exception 'inspect body or posture is wrong after the patch';end if;
end$post$;
commit;
