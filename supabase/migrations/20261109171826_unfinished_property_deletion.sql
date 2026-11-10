-- PREPARED ONLY. Isolated reviewed apply required; never blanket db push.
begin;
create schema rentlease_unfinished_posts;
revoke all on schema rentlease_unfinished_posts from public,anon,authenticated;
-- Durable identity/operation evidence keeps a real FK target after physical deletion.
create table rentlease_unfinished_posts.records(
 property_id uuid primary key, owner_id uuid not null,
 ever_published boolean not null default false,
 state text not null default 'live' check(state in ('live','cleanup_pending','completed')),
 paths text[] not null default '{}', deleted_at timestamptz, completed_at timestamptz
);
alter table rentlease_unfinished_posts.records enable row level security;
revoke all on rentlease_unfinished_posts.records from public,anon,authenticated;
insert into rentlease_unfinished_posts.records(property_id,owner_id,ever_published)
 select p.id,p.landlord_id,exists(select 1 from public.listings l where l.property_id=p.id and (l.status<>'draft' or l.published_at is not null)) from public.properties p;
-- Retain original immutable rows and their relationships, never disable their triggers.
alter table rentlease_property_identity.revisions drop constraint revisions_property_id_fkey,
 add constraint revisions_property_id_fkey foreign key(property_id) references rentlease_unfinished_posts.records(property_id);
alter table rentlease_property_identity.current_identity drop constraint current_identity_property_id_fkey,
 add constraint current_identity_property_id_fkey foreign key(property_id) references rentlease_unfinished_posts.records(property_id);
alter table rentlease_property_edit.detail_receipts drop constraint detail_receipts_property_id_fkey,
 add constraint detail_receipts_property_id_fkey foreign key(property_id) references rentlease_unfinished_posts.records(property_id);
alter table rentlease_property_edit.media_receipts drop constraint media_receipts_property_id_fkey,
 add constraint media_receipts_property_id_fkey foreign key(property_id) references rentlease_unfinished_posts.records(property_id);
create function rentlease_unfinished_posts.register_property() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin insert into rentlease_unfinished_posts.records(property_id,owner_id) values(new.id,new.landlord_id);return new;end$$;
create trigger unfinished_post_register after insert on public.properties for each row execute function rentlease_unfinished_posts.register_property();
create function rentlease_unfinished_posts.remember_publication() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.status<>'draft' or new.published_at is not null or (tg_op='UPDATE' and (old.status<>'draft' or old.published_at is not null)) then
 update rentlease_unfinished_posts.records set ever_published=true where property_id=new.property_id;
 end if;return new;
end$$;
create trigger unfinished_post_publication before insert or update on public.listings for each row execute function rentlease_unfinished_posts.remember_publication();
-- Keep the original live-parent insertion invariant on retained audit tables.
create function rentlease_unfinished_posts.require_live_parent() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform 1 from public.properties where id=new.property_id for key share;
 if not found then raise exception 'Live property required' using errcode='23503';end if;return new;
end$$;
create trigger unfinished_revision_live before insert on rentlease_property_identity.revisions for each row execute function rentlease_unfinished_posts.require_live_parent();
create trigger unfinished_identity_live before insert on rentlease_property_identity.current_identity for each row execute function rentlease_unfinished_posts.require_live_parent();
create trigger unfinished_detail_receipt_live before insert on rentlease_property_edit.detail_receipts for each row execute function rentlease_unfinished_posts.require_live_parent();
create trigger unfinished_media_receipt_live before insert on rentlease_property_edit.media_receipts for each row execute function rentlease_unfinished_posts.require_live_parent();

create function rentlease_unfinished_posts.inspect(p_property_id uuid) returns text language plpgsql security definer set search_path=pg_catalog as $$
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
create function public.get_unfinished_post_deletion(p_property_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r rentlease_unfinished_posts.records%rowtype;reason text;
begin
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) then raise exception 'Active Tier 1 account required' using errcode='42501';end if;
 select * into r from rentlease_unfinished_posts.records where property_id=p_property_id and owner_id=auth.uid();
 if not found then raise exception 'Owned property required' using errcode='42501';end if;
 if r.state<>'live' then return jsonb_build_object('propertyId',p_property_id,'state',r.state,'eligible',false,'reason',null);end if;
 reason:=rentlease_unfinished_posts.inspect(p_property_id);
 return jsonb_build_object('propertyId',p_property_id,'state','live','eligible',reason is null,'reason',reason);
end$$;
create function public.list_unfinished_post_cleanup() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) then raise exception 'Active Tier 1 account required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('propertyId',property_id,'state',state,'eligible',false,'reason',null)),'[]'::jsonb) from rentlease_unfinished_posts.records where owner_id=auth.uid() and state='cleanup_pending');
end$$;
create function public.delete_unfinished_post(p_property_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare reason text;v_paths text[];r rentlease_unfinished_posts.records%rowtype;
begin
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) then raise exception 'Active Tier 1 account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 select * into r from rentlease_unfinished_posts.records where property_id=p_property_id and owner_id=auth.uid();
 if not found then raise exception 'Owned property required' using errcode='42501';end if;
 if r.state<>'live' then return jsonb_build_object('propertyId',p_property_id,'state',r.state);end if;
 reason:=rentlease_unfinished_posts.inspect(p_property_id);
 if reason is not null then raise exception '%',reason using errcode='22023';end if;
 select coalesce(array_agg(path),'{}') into v_paths from rentlease_property_edit.media_intents where property_id=p_property_id;
 -- No Storage SQL deletes: bytes are removed only by the named Edge's Storage API.
 delete from rentlease_property_edit.media_intents where property_id=p_property_id;
 delete from public.properties where id=p_property_id and landlord_id=auth.uid();
 update rentlease_unfinished_posts.records set state=case when cardinality(v_paths)=0 then 'completed' else 'cleanup_pending' end,paths=v_paths,deleted_at=now(),completed_at=case when cardinality(v_paths)=0 then now() end where property_id=p_property_id;
 return jsonb_build_object('propertyId',p_property_id,'state',case when cardinality(v_paths)=0 then 'completed' else 'cleanup_pending' end);
end$$;
-- Privileged worker endpoints: owner is derived from the verified JWT by the Edge.
create function public.get_unfinished_post_cleanup(p_property_id uuid,p_owner_id uuid) returns jsonb language sql security definer set search_path=pg_catalog as $$
 select jsonb_build_object('paths',paths,'state',state) from rentlease_unfinished_posts.records where property_id=p_property_id and owner_id=p_owner_id and state='cleanup_pending'
$$;
create function public.finish_unfinished_post_cleanup(p_property_id uuid,p_owner_id uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare r rentlease_unfinished_posts.records%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 select * into r from rentlease_unfinished_posts.records where property_id=p_property_id and owner_id=p_owner_id for update;
 if not found then raise exception 'Unknown deletion' using errcode='42501';end if;
 if r.state='completed' then return;end if;
 if r.state<>'cleanup_pending' or exists(select 1 from storage.objects where bucket_id='property-media' and name=any(r.paths)) then raise exception 'Media cleanup remains pending' using errcode='40001';end if;
 update rentlease_unfinished_posts.records set state='completed',completed_at=now() where property_id=p_property_id;
end$$;
revoke all on all functions in schema rentlease_unfinished_posts from public,anon,authenticated;
revoke all on function public.get_unfinished_post_deletion(uuid),public.list_unfinished_post_cleanup(),public.delete_unfinished_post(uuid),public.get_unfinished_post_cleanup(uuid,uuid),public.finish_unfinished_post_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_unfinished_post_deletion(uuid),public.list_unfinished_post_cleanup(),public.delete_unfinished_post(uuid) to authenticated;
grant execute on function public.get_unfinished_post_cleanup(uuid,uuid),public.finish_unfinished_post_cleanup(uuid,uuid) to service_role;
commit;
