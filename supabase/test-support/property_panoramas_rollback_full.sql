-- Room tour rollback, FULL REMOVAL (database objects only). Stops unless public.property_panoramas is empty AND the property-panoramas bucket holds no objects.
-- Removes: the two public RPCs, the Storage policies, the read policy and table, the helper schema, and restores rentlease_unfinished_posts.inspect(uuid) to its
-- original body (md5 05d843208715e6122ea53beec8165989; the patched body is fd1bc6691ce65b03ae723d94a2d8a7c9).
-- It does NOT remove the bucket and NEVER deletes from storage.objects (that would orphan real files). Emptying or removing the bucket is a MANUAL step. To remove the bucket, first empty it by hand: in the
-- Supabase Dashboard (Storage > property-panoramas) select all files and delete them, or delete them with the Storage API; then delete the bucket there.
-- If panoramas exist, use property_panoramas_rollback.sql (data-retaining) instead.
begin;
do $guard$
begin
 if to_regclass('public.property_panoramas') is not null and exists(select 1 from public.property_panoramas) then raise exception 'panorama rows exist; use property_panoramas_rollback.sql (data-retaining)';end if;
 if exists(select 1 from storage.objects where bucket_id='property-panoramas') then raise exception 'the property-panoramas bucket still holds files; empty it in the Dashboard or Storage API first (never with SQL)';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_unfinished_posts.inspect(uuid)')),chr(13),'')) is distinct from 'fd1bc6691ce65b03ae723d94a2d8a7c9' then raise exception 'inspect is not the patched body; review before rolling back';end if;
end$guard$;
drop function if exists public.set_property_panorama(uuid,text,text,integer,integer);
drop function if exists public.remove_property_panorama(uuid,text);
drop policy if exists storage_property_panoramas_insert_owner on storage.objects;
drop policy if exists storage_property_panoramas_select_owner on storage.objects;
drop policy if exists storage_property_panoramas_delete_owner on storage.objects;
drop policy if exists property_panoramas_immutable_update on storage.objects;
drop table if exists public.property_panoramas;
drop schema if exists rentlease_property_panorama cascade;
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
  if ref.confrelid='public.properties'::regclass and ref.nspname='public' and ref.relname in ('listings','property_photos','property_private_locations','property_amenities','property_nearby_places','price_estimates') then continue;end if;
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
do $post$
begin
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_unfinished_posts.inspect(uuid)')),chr(13),'')) is distinct from '05d843208715e6122ea53beec8165989' then raise exception 'inspect was not restored to its original body';end if;
 if to_regclass('public.property_panoramas') is not null or to_regnamespace('rentlease_property_panorama') is not null then raise exception 'Room tour objects remain';end if;
end$post$;
commit;
