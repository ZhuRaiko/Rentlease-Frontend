-- Milestone 2. Execute this complete file once in Dashboard SQL Editor after review.
-- NOT DEPLOYED by preparing this file. Coordinate client rollout: old direct photo writes stop working.
begin;
do $$begin
 if not exists(select 1 from storage.buckets where id='property-media' and public and file_size_limit=10485760
   and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
   and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]) then
 raise exception 'Unexpected property-media bucket contract; stop for review' using errcode='22023';end if;
end$$;
create schema rentlease_property_edit;
revoke all on schema rentlease_property_edit from public,anon,authenticated;
alter table public.properties add column edit_version uuid not null default gen_random_uuid(),
 add column media_version uuid not null default gen_random_uuid();
create table rentlease_property_edit.media_intents(
 photo_id uuid primary key, property_id uuid not null references public.properties(id), owner_id uuid not null,
 path text not null unique, mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
 state text not null check(state in ('reserved','registered','cleanup')), created_at timestamptz not null default now()
);
create table rentlease_property_edit.media_receipts(
 owner_id uuid not null, request_id uuid not null, property_id uuid not null references public.properties(id),
 input jsonb not null, result jsonb not null, primary key(owner_id,request_id)
);
alter table rentlease_property_edit.media_intents enable row level security;
alter table rentlease_property_edit.media_receipts enable row level security;
-- Existing metadata remains unchanged. Import only safe, owner-namespaced immutable keys.
insert into rentlease_property_edit.media_intents(photo_id,property_id,owner_id,path,mime,state)
select ph.id,ph.property_id,p.landlord_id,
 regexp_replace(ph.storage_path,'^property-media/',''),
 case when ph.storage_path ~ '\.(jpg|jpeg)$' then 'image/jpeg' when ph.storage_path ~ '\.png$' then 'image/png' else 'image/webp' end,'registered'
from public.property_photos ph join public.properties p on p.id=ph.property_id
where regexp_replace(ph.storage_path,'^property-media/','') ~
 ('^'||p.landlord_id::text||'/'||p.id::text||'/'||ph.id::text||'\.(jpg|jpeg|png|webp)$');
do $$begin
 if exists(select 1 from public.property_photos ph where not exists(select 1 from rentlease_property_edit.media_intents i where i.photo_id=ph.id)) then
 raise exception 'Unsafe legacy photo paths: review before migration' using errcode='22023';end if;
end$$;
create function rentlease_property_edit.lock_owner(p_property_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) or not public.has_app_role('landlord'::public.app_role,auth.uid()) then
 raise exception 'Tier 1 active landlord required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 if not exists(select 1 from public.properties where id=p_property_id and landlord_id=auth.uid() and is_active) then
 raise exception 'Owned active property required' using errcode='42501';end if;
end$$;
revoke all on function rentlease_property_edit.lock_owner(uuid) from public,anon,authenticated;
create function public.get_property_media_state(p_property_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
begin perform rentlease_property_edit.lock_owner(p_property_id);
 return (select media_version from public.properties where id=p_property_id);end$$;
create function public.get_property_media_operation(p_property_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin perform rentlease_property_edit.lock_owner(p_property_id);
 return (select result from rentlease_property_edit.media_receipts where owner_id=auth.uid() and property_id=p_property_id and request_id=p_request_id);end$$;
create function public.manage_property_media(p_property_id uuid,p_expected_version uuid,p_request_id uuid,p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 v uuid; ph uuid; objpath text; mime text; old rentlease_property_edit.media_receipts%rowtype;
 intent rentlease_property_edit.media_intents%rowtype; result jsonb; body jsonb; affected integer;
begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 if p_request_id is null or p_expected_version is null or p_args is null or jsonb_typeof(p_args)<>'object' then
 raise exception 'Invalid media request' using errcode='22023';end if;
 body:=jsonb_build_object('property_id',p_property_id,'version',p_expected_version,'action',p_action,'args',p_args);
 select * into old from rentlease_property_edit.media_receipts where owner_id=auth.uid() and request_id=p_request_id;
 if found then
 if old.input<>body then raise exception 'Operation ID reused' using errcode='22023';end if;return old.result;end if;
 select media_version into v from public.properties where id=p_property_id;
 if v<>p_expected_version then raise exception 'Photos changed. Reload before editing' using errcode='40001';end if;
 if p_action='reserve' then
  if p_args - 'mime'<>'{}'::jsonb then raise exception 'Unexpected fields' using errcode='22023';end if;
  mime:=p_args->>'mime';
  if mime is null or mime not in ('image/jpeg','image/png','image/webp') then raise exception 'Photo type unsupported' using errcode='22023';end if;
  if (select count(*) from rentlease_property_edit.media_intents where property_id=p_property_id and state in ('reserved','registered'))>=10 then
   raise exception 'Maximum 10 photos including pending uploads' using errcode='22023';end if;
  ph:=gen_random_uuid();objpath:=auth.uid()::text||'/'||p_property_id::text||'/'||ph::text||case mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
  insert into rentlease_property_edit.media_intents values(ph,p_property_id,auth.uid(),objpath,mime,'reserved',now());
 elsif p_action='reorder' then
  if p_args - 'photo_ids'<>'{}'::jsonb or jsonb_typeof(p_args->'photo_ids') is distinct from 'array' then raise exception 'Exact photo order required' using errcode='22023';end if;
  if (select count(*) from jsonb_array_elements_text(p_args->'photo_ids'))<>(select count(distinct value) from jsonb_array_elements_text(p_args->'photo_ids'))
   or exists(select id::text from public.property_photos where property_id=p_property_id except select value from jsonb_array_elements_text(p_args->'photo_ids'))
   or exists(select value from jsonb_array_elements_text(p_args->'photo_ids') except select id::text from public.property_photos where property_id=p_property_id) then
   raise exception 'Photo set changed' using errcode='40001';end if;
  update public.property_photos p set sort_order=(o.ordinality-1)::smallint from jsonb_array_elements_text(p_args->'photo_ids') with ordinality o where p.property_id=p_property_id and p.id::text=o.value;
 else
  if p_args - array['photo_id','alt_text']<>'{}'::jsonb then raise exception 'Unexpected fields' using errcode='22023';end if;
  ph:=(p_args->>'photo_id')::uuid;
  select * into intent from rentlease_property_edit.media_intents where photo_id=ph and property_id=p_property_id and owner_id=auth.uid();
  if not found then raise exception 'Owned photo required' using errcode='42501';end if;
  objpath:=intent.path;
  if p_action='register' then
   if intent.state<>'reserved' then raise exception 'Photo intent consumed' using errcode='40001';end if;
   if not exists(select 1 from storage.objects where bucket_id='property-media' and name=intent.path and metadata->>'mimetype'=intent.mime and (metadata->>'size')::bigint between 1 and 10485760) then
    raise exception 'Uploaded JPEG PNG or WebP required within 10 MB' using errcode='22023';end if;
   insert into public.property_photos(id,property_id,storage_path,alt_text,sort_order,is_cover)
    select ph,p_property_id,'property-media/'||intent.path,nullif(btrim(p_args->>'alt_text'),''),least(32767,coalesce(max(sort_order),-1)+1),count(*)=0 from public.property_photos where property_id=p_property_id;
   update rentlease_property_edit.media_intents set state='registered' where photo_id=ph;
  elsif p_action='cancel' then
   if intent.state='registered' then raise exception 'Registered photo cannot be canceled' using errcode='40001';end if;
   update rentlease_property_edit.media_intents set state='cleanup' where photo_id=ph;
  elsif p_action in ('remove','cover','alt') then
   if intent.state<>'registered' or not exists(select 1 from public.property_photos where id=ph and property_id=p_property_id) then raise exception 'Photo changed' using errcode='40001';end if;
   if p_action='remove' then
    delete from public.property_photos where id=ph and property_id=p_property_id;
    update rentlease_property_edit.media_intents set state='cleanup' where photo_id=ph;
    if not exists(select 1 from public.property_photos where property_id=p_property_id and is_cover) then
     update public.property_photos set is_cover=true where id=(select id from public.property_photos where property_id=p_property_id order by sort_order,created_at,id limit 1);end if;
   elsif p_action='cover' then
    update public.property_photos set is_cover=false where property_id=p_property_id and is_cover;
    update public.property_photos set is_cover=true where property_id=p_property_id and id=ph;
   else update public.property_photos set alt_text=nullif(btrim(p_args->>'alt_text'),'') where property_id=p_property_id and id=ph;end if;
  else raise exception 'Unknown media action' using errcode='22023';end if;
 end if;
 update public.properties set media_version=gen_random_uuid() where id=p_property_id returning media_version into v;
 result:=jsonb_build_object('property_id',p_property_id,'media_version',v,'action',p_action,'photo_id',ph,'path',objpath);
 insert into rentlease_property_edit.media_receipts values(auth.uid(),p_request_id,p_property_id,body,result);
 return result;
end$$;

-- Rotate for every metadata writer, not just the client command path.
create function rentlease_property_edit.rotate_media_version() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid:=case when tg_op='DELETE' then old.property_id else new.property_id end;
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 if tg_op='UPDATE' and new.property_id<>old.property_id then raise exception 'Photo reparenting forbidden' using errcode='22023';end if;
 update public.properties set media_version=gen_random_uuid() where id=target;
 return null;
end$$;
create trigger property_media_rotate after insert or update or delete on public.property_photos for each row execute function rentlease_property_edit.rotate_media_version();
revoke all on function rentlease_property_edit.rotate_media_version() from public,anon,authenticated;
-- Restrictive policies intersect existing bucket permissions; unrelated buckets are unchanged.
create function public.property_media_storage_guard(p_bucket text,p_name text,p_action text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare i rentlease_property_edit.media_intents%rowtype;
begin
 if p_bucket<>'property-media' then return true;end if;
 select * into i from rentlease_property_edit.media_intents where path=p_name;
 if not found or i.owner_id is distinct from auth.uid() then return false;end if;
 perform rentlease_property_edit.lock_owner(i.property_id);
 -- Fresh read AFTER acquiring the shared gate serializes registration and cleanup.
 select * into i from rentlease_property_edit.media_intents where path=p_name;
 if p_action='insert' then return i.state='reserved' and not exists(select 1 from storage.objects where bucket_id=p_bucket and name=p_name);end if;
 if p_action='delete' then return i.state='cleanup' and not exists(select 1 from public.property_photos where id=i.photo_id);end if;
 return false;
end$$;
create policy property_media_intent_insert on storage.objects as restrictive for insert to authenticated
 with check(public.property_media_storage_guard(bucket_id,name,'insert'));
create policy property_media_immutable_update on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'property-media') with check(bucket_id<>'property-media');
create policy property_media_cleanup_delete on storage.objects as restrictive for delete to authenticated
 using(public.property_media_storage_guard(bucket_id,name,'delete'));
-- Coordinated client cutover: no legacy metadata mutation or cover endpoint bypass.
revoke insert,delete,update on public.property_photos from authenticated,anon;
revoke insert(id,property_id,storage_path,alt_text,sort_order,is_cover,created_at),update(id,property_id,storage_path,alt_text,sort_order,is_cover,created_at) on public.property_photos from authenticated,anon;
revoke all on function public.set_property_cover_photo(uuid) from public,anon,authenticated;
revoke all on function public.get_property_media_state(uuid),public.get_property_media_operation(uuid,uuid),public.manage_property_media(uuid,uuid,uuid,text,jsonb),public.property_media_storage_guard(text,text,text) from public,anon;
grant execute on function public.get_property_media_state(uuid),public.get_property_media_operation(uuid,uuid),public.manage_property_media(uuid,uuid,uuid,text,jsonb),public.property_media_storage_guard(text,text,text) to authenticated;
commit;
