-- APPROVED FOR LOCAL PREPARATION/TEST ONLY. NOT DEPLOYED.
-- Requires deployed 20261101180736. No Storage, authorization, completeness or Tier 3 changes.
-- New clients use reorder_cover, which safely rejects on the older backend.
begin;
do $$begin
 if to_regprocedure('public.manage_property_media(uuid,uuid,uuid,text,jsonb)') is null then raise exception 'Milestone 2 required';end if;
end$$;
create or replace function public.manage_property_media(p_property_id uuid,p_expected_version uuid,p_request_id uuid,p_action text,p_args jsonb default '{}'::jsonb)
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
 elsif p_action in ('reorder','reorder_cover') then
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
    update public.property_photos p set sort_order=o.position::smallint from (select id,row_number() over(order by (id=ph) desc,sort_order,created_at,id)-1 position from public.property_photos where property_id=p_property_id) o where p.id=o.id;
    update public.property_photos set is_cover=false where property_id=p_property_id and is_cover;
    update public.property_photos set is_cover=true where property_id=p_property_id and id=ph;
   else update public.property_photos set alt_text=nullif(btrim(p_args->>'alt_text'),'') where property_id=p_property_id and id=ph;end if;
  else raise exception 'Unknown media action' using errcode='22023';end if;
 end if;
 -- First in deterministic persisted order is the sole cover. Same transaction/token.
 if exists(select 1 from public.property_photos where property_id=p_property_id)
   and not (select is_cover from public.property_photos where property_id=p_property_id order by sort_order,created_at,id limit 1) then
  update public.property_photos set is_cover=false where property_id=p_property_id and is_cover;
  update public.property_photos set is_cover=true where id=(select id from public.property_photos where property_id=p_property_id order by sort_order,created_at,id limit 1);
 end if;
 update public.properties set media_version=gen_random_uuid() where id=p_property_id returning media_version into v;
 result:=jsonb_build_object('property_id',p_property_id,'media_version',v,'action',p_action,'photo_id',ph,'path',objpath);
 insert into rentlease_property_edit.media_receipts values(auth.uid(),p_request_id,p_property_id,body,result);
 return result;
end$$;

-- Normalize existing metadata only; preserve order, IDs, paths and listing statuses.
-- Existing metadata trigger rotates media_version, invalidating stale editors.
do $$declare target uuid;begin
 for target in select distinct property_id from public.property_photos order by property_id loop
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  if not (select is_cover from public.property_photos where property_id=target order by sort_order,created_at,id limit 1) then
   update public.property_photos set is_cover=false where property_id=target and is_cover;
   update public.property_photos set is_cover=true where id=(select id from public.property_photos where property_id=target order by sort_order,created_at,id limit 1);
  end if;
 end loop;
end$$;
revoke all on function public.manage_property_media(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.manage_property_media(uuid,uuid,uuid,text,jsonb) to authenticated;
commit;
