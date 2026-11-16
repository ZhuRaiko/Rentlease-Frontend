-- PREPARED LOCAL ONLY. Feature 6 maintenance backend. Not applied. See docs/design/f6-maintenance-transitions.md (written before this file) and docs/design/f6-maintenance-audit.md.
-- What changes: (1) the category check also allows internet and pests; (2) write_tenancy_care (patched in place, same signature) takes a priority on create and gains the actions
-- reply, confirm_resolved, reopen and cancel, lets the landlord go straight from submitted to in_progress, and may close an open request on an ended tenancy; (3) log_maintenance_status_change
-- (patched) logs the ACTING person's note instead of the landlord's stale response; (4) new reads get_maintenance_inbox(p_offset) and get_maintenance_request(p_request_id, p_offset).
-- No new table for requests, no photo object, no new status, no change to the notification trigger. Base: the HOSTED function sources read on 2026-11-17 (the repo maintenance migration has drifted).
-- Pins (hosted, read-only, 2026-11-17):
--   write_tenancy_care(uuid,uuid,text,jsonb)  883656994c2480d657e10017886f8a1e  ->  41848da54df8555e596f8f5045b6b39c
--   log_maintenance_status_change()           c9f62c2a1a54300dac5f662cd89baeda  ->  043e546a3564b5f5ba16b8dda804433f
--   get_tenancy_care(uuid,integer) 624c3bf0ce0f129f504c674330466c72 and get_tenancy_maintenance_history(uuid,integer) 78ac0cab8cd962a3a687d0501be8eeb0 stay untouched.
-- Rollback: supabase/test-support/maintenance_care_rollback.sql (restores both functions from the stored originals, keeps data and the wider category check) and maintenance_care_rollback_full.sql.
begin;
set local lock_timeout='10s';
select set_config('rentlease.requests_before',(select count(*)::text from public.maintenance_requests),true);
select set_config('rentlease.updates_before',(select count(*)::text from public.maintenance_updates),true);

-- ---------------------------------------------------------------------------------------------------------------------------
-- Baseline guards: stop unless every live object this migration touches or relies on is exactly what the design was written against.
-- ---------------------------------------------------------------------------------------------------------------------------
do $guard$
declare f text;got text;
begin
 for f,got in select * from (values
  ('public.write_tenancy_care(uuid,uuid,text,jsonb)','883656994c2480d657e10017886f8a1e'),('public.log_maintenance_status_change()','c9f62c2a1a54300dac5f662cd89baeda'),
  ('public.get_tenancy_care(uuid,integer)','624c3bf0ce0f129f504c674330466c72'),('public.get_tenancy_maintenance_history(uuid,integer)','78ac0cab8cd962a3a687d0501be8eeb0'),
  ('public.set_maintenance_update_actor()','97e5bf8d4fd3e7df24958b51e8dc8ce3'),('public.validate_maintenance_request()','e54ae30a5823efba19dface52acc4194'),
  ('rentlease_tenancy_care.relationship(uuid)','6d1dddfca6983acba8c80df87f809b32'),('rentlease_tenancy_care.rotate_revision()','f981caa6a35bdcdafb019c8a1102832b'),
  ('rentlease_notifications.generate()','08b686c7868662747ec9bf3f119c6177'),('rentlease_notifications.emit(uuid,text,notification_type,text,text,uuid)','81a5f1b377e0a5c57ccca6d23a0374bb'),
  ('public.is_tier1_verified(uuid)','ddd2c8ed28b61e30e23e4f3ddefe4590'),('public.set_updated_at()','204b9b9355e61b7541bc0633bbc9294c')) v(a,b)
 loop
  if md5((select prosrc from pg_proc where oid=to_regprocedure(f))) is distinct from got then raise exception 'Function drifted: %',f;end if;
 end loop;
 for f,got in select * from (values
  ('public.maintenance_requests','10b147fe2f5ad299dbaac04671b24198'),('public.maintenance_updates','941ba8c70bbb2b0b0501d0565c327f58'),
  ('rentlease_tenancy_care.receipts','0197d12dad8d8a633a95920746378740'),('public.tenancies','d3a6c191562c99faeb9d5ea1fda38721')) v(a,b)
 loop
  if (select md5(string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull,'|' order by a.attname)) from pg_attribute a where a.attrelid=f::regclass and a.attnum>0 and not a.attisdropped) is distinct from got then raise exception 'Columns drifted: %',f;end if;
 end loop;
 if (select md5(string_agg(tgrelid::regclass::text||'.'||tgname||'='||pg_get_triggerdef(oid),'|' order by tgrelid::regclass::text,tgname)) from pg_trigger where tgrelid in('public.maintenance_requests'::regclass,'public.maintenance_updates'::regclass) and not tgisinternal) is distinct from '1197fa2e9b88c73567b99e6c37d2e7bc' then raise exception 'Maintenance triggers drifted';end if;
 if (select md5(string_agg(conrelid::regclass::text||'.'||conname||'='||pg_get_constraintdef(oid),'|' order by conrelid::regclass::text,conname)) from pg_constraint where conrelid in('public.maintenance_requests'::regclass,'public.maintenance_updates'::regclass)) is distinct from '73cd04891da0ae4597f53109ae83eadb' then raise exception 'Maintenance constraints drifted';end if;
 if (select md5(string_agg(indexname||'='||indexdef,'|' order by indexname)) from pg_indexes where tablename in('maintenance_requests','maintenance_updates')) is distinct from '4b7532f4a3c09cfda6275c74935e0132' then raise exception 'Maintenance indexes drifted';end if;
 if (select enum_range(null::public.maintenance_status)::text||enum_range(null::public.maintenance_priority)::text) is distinct from '{submitted,acknowledged,needs_information,scheduled,in_progress,resolved,reopened,rejected,cancelled}{low,normal,high,urgent}' then raise exception 'Maintenance enums drifted';end if;
 select string_agg(proname,',' order by proname) into got from pg_proc where pronamespace='rentlease_tenancy_care'::regnamespace;
 if got is distinct from 'dates,relationship,rotate_revision' then raise exception 'rentlease_tenancy_care functions drifted: %',got;end if;
 if exists(select 1 from pg_class c,unnest(array['anon','authenticated','service_role']) r where c.oid in('public.maintenance_requests'::regclass,'public.maintenance_updates'::regclass,'rentlease_tenancy_care.receipts'::regclass) and has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE')) then raise exception 'A maintenance table is exposed';end if;
 if has_schema_privilege('anon','rentlease_tenancy_care','USAGE') or has_schema_privilege('authenticated','rentlease_tenancy_care','USAGE') or has_schema_privilege('service_role','rentlease_tenancy_care','USAGE') then raise exception 'rentlease_tenancy_care is exposed';end if;
 -- ACLs of the two functions that are patched in place must be exactly as found (patched functions keep them).
 if (select proacl::text from pg_proc where oid=to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)')) is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'write_tenancy_care ACL drifted';end if;
 -- None of this feature may exist yet.
 if to_regprocedure('public.get_maintenance_inbox(integer)') is not null or to_regprocedure('public.get_maintenance_request(uuid,integer)') is not null or to_regclass('rentlease_tenancy_care.function_backups') is not null then raise exception 'Maintenance care objects already exist';end if;
end$guard$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Byte-exact copies of the two originals, for the rollback. Same closed schema: no client role can read them.
-- ---------------------------------------------------------------------------------------------------------------------------
create table rentlease_tenancy_care.function_backups(name text primary key,definition text not null,source_md5 text not null,saved_at timestamptz not null default statement_timestamp());
alter table rentlease_tenancy_care.function_backups enable row level security;
revoke all on rentlease_tenancy_care.function_backups from public,anon,authenticated,service_role;
insert into rentlease_tenancy_care.function_backups(name,definition,source_md5)
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid),md5(p.prosrc) from pg_proc p where p.oid in(to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)'),to_regprocedure('public.log_maintenance_status_change()'));

-- ---------------------------------------------------------------------------------------------------------------------------
-- Categories: internet and pests are added; structural stays valid (the UI hides it).
-- ---------------------------------------------------------------------------------------------------------------------------
alter table public.maintenance_requests drop constraint maintenance_requests_category_check;
alter table public.maintenance_requests add constraint maintenance_requests_category_check check(category in('plumbing','electrical','appliance','structural','other','internet','pests'));

-- ---------------------------------------------------------------------------------------------------------------------------
-- Anchor patches, based on the hosted source. Each anchor must occur EXACTLY ONCE, the edit must be exactly reversible, the result must match the recorded md5,
-- and owner, ACL, security-definer flag, config, volatility and return type must be identical afterwards.
-- ---------------------------------------------------------------------------------------------------------------------------
do $patch$
declare
 w oid:=to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)');
 l oid:=to_regprocedure('public.log_maintenance_status_change()');
 a1 constant text:=$a1$new_id uuid; d date;$a1$;
 b1 constant text:=$b1$new_id uuid; d date; closed boolean; prio text;$b1$;
 a2 constant text:=$a2$if t.status<>'active' or t.start_date>today or (coalesce(t.actual_end_date,t.expected_end_date) is not null and coalesce(t.actual_end_date,t.expected_end_date)<today) then raise exception 'Active tenancy required' using errcode='42501';end if;$a2$;
 b2 constant text:=$b2$if t.status not in('active','ended') or t.start_date>today then raise exception 'Active tenancy required' using errcode='42501';end if;
 closed:=t.status='ended' or (coalesce(t.actual_end_date,t.expected_end_date) is not null and coalesce(t.actual_end_date,t.expected_end_date)<today);
 if closed and p_action not in('respond','confirm_resolved','cancel') then raise exception 'Active tenancy required' using errcode='42501';end if;$b2$;
 a3 constant text:=$a3$if p_payload-array['title','description','category']<>'{}'::jsonb$a3$;
 b3 constant text:=$b3$if p_payload-array['title','description','category','priority']<>'{}'::jsonb$b3$;
 a4 constant text:=$a4$not in('plumbing','electrical','appliance','structural','other') then raise exception 'Check request fields' using errcode='22023';end if;$a4$;
 b4 constant text:=$b4$not in('plumbing','electrical','appliance','structural','other','internet','pests') then raise exception 'Check request fields' using errcode='22023';end if;
  prio:=coalesce(p_payload->>'priority','normal');
  if prio not in('low','normal','urgent') then raise exception 'Check request fields' using errcode='22023';end if;$b4$;
 a5 constant text:=$a5$p_payload->>'category','normal','submitted') returning * into m;$a5$;
 b5 constant text:=$b5$p_payload->>'category',prio::public.maintenance_priority,'submitted') returning * into m;$b5$;
 a6 constant text:=$a6$or (target='in_progress' and m.status in('acknowledged','scheduled'))$a6$;
 b6 constant text:=$b6$or (target='in_progress' and m.status in('submitted','reopened','acknowledged','scheduled'))$b6$;
 a7 constant text:=$a7$if target is null or m.status in('resolved','rejected','cancelled') or not ($a7$;
 b7 constant text:=$b7$if target is null or m.status in('resolved','rejected','cancelled') or (closed and target<>'resolved') or not ($b7$;
 a8 constant text:=$a8$update public.maintenance_requests set status=target,landlord_response=note,last_updated_by=auth.uid(),care_revision=gen_random_uuid()$a8$;
 b8 constant text:=$b8$perform set_config('rentlease.care_note',note,true);
  update public.maintenance_requests set status=target,landlord_response=note,last_updated_by=auth.uid(),care_revision=gen_random_uuid()$b8$;
 a9 constant text:=$a9$else resolved_at end where id=m.id returning care_revision into new_id;$a9$;
 b9 constant text:=$b9$else resolved_at end where id=m.id returning care_revision into new_id;
  perform set_config('rentlease.care_note','',true);$b9$;
 a10 constant text:=$a10$else raise exception 'Action unavailable' using errcode='22023';end if;$a10$;
 b10 constant text:=$b10$elsif p_action in('reply','confirm_resolved','reopen','cancel') then
  if p_payload-array['requestId','revision','note']<>'{}'::jsonb or jsonb_typeof(p_payload->'requestId') is distinct from 'string' or jsonb_typeof(p_payload->'revision') is distinct from 'string'
   or (p_payload ? 'note' and jsonb_typeof(p_payload->'note') not in('string','null')) then raise exception 'Invalid request input' using errcode='22023';end if;
  note:=nullif(btrim(p_payload->>'note'),'');
  if note is not null and length(note)>2000 then raise exception 'Invalid request input' using errcode='22023';end if;
  if p_action in('reply','reopen') and note is null then raise exception 'A note is required' using errcode='22023';end if;
  if p_action<>'reply' and auth.uid()<>t.tenant_id then raise exception 'Tenant required' using errcode='42501';end if;
  select * into m from public.maintenance_requests where id=(p_payload->>'requestId')::uuid and tenancy_id=t.id for update;
  if m.id is null then raise exception 'Request unavailable' using errcode='42501';end if;
  if m.care_revision is distinct from (p_payload->>'revision')::uuid then raise exception 'Request changed. Reload.' using errcode='40001';end if;
  if m.status in('cancelled','rejected') or (m.status='resolved' and m.tenant_confirmed_resolved_at is not null) then raise exception 'Transition unavailable' using errcode='22023';end if;
  if p_action='reply' then
   update public.maintenance_requests set last_updated_by=auth.uid() where id=m.id returning care_revision into new_id;
   insert into public.maintenance_updates(maintenance_request_id,actor_id,from_status,to_status,note) values(m.id,auth.uid(),m.status,m.status,note);
  elsif p_action='confirm_resolved' then
   if m.status<>'resolved' then raise exception 'Transition unavailable' using errcode='22023';end if;
   update public.maintenance_requests set tenant_confirmed_resolved_at=statement_timestamp(),last_updated_by=auth.uid() where id=m.id returning care_revision into new_id;
   insert into public.maintenance_updates(maintenance_request_id,actor_id,from_status,to_status,note) values(m.id,auth.uid(),'resolved','resolved',coalesce(note,'Confirmed fixed'));
  elsif p_action='reopen' then
   if m.status<>'resolved' then raise exception 'Transition unavailable' using errcode='22023';end if;
   perform set_config('rentlease.care_note',note,true);
   update public.maintenance_requests set status='reopened',resolved_at=null,last_updated_by=auth.uid() where id=m.id returning care_revision into new_id;
   perform set_config('rentlease.care_note','',true);
  else
   if m.status not in('submitted','acknowledged','reopened') then raise exception 'Transition unavailable' using errcode='22023';end if;
   perform set_config('rentlease.care_note',coalesce(note,'Cancelled by the tenant'),true);
   update public.maintenance_requests set status='cancelled',last_updated_by=auth.uid() where id=m.id returning care_revision into new_id;
   perform set_config('rentlease.care_note','',true);
  end if;
  result:=jsonb_build_object('requestId',m.id,'revision',new_id);
 else raise exception 'Action unavailable' using errcode='22023';end if;$b10$;
 la constant text:=$la$coalesce(new.landlord_response, new.rejected_reason)$la$;
 lb constant text:=$lb$coalesce(nullif(current_setting('rentlease.care_note', true), ''), new.landlord_response, new.rejected_reason)$lb$;
 anchors text[]:=array[a1,a2,a3,a4,a5,a6,a7,a8,a9,a10];
 edits text[]:=array[b1,b2,b3,b4,b5,b6,b7,b8,b9,b10];
 old_src text;old_def text;new_def text;new_src text;before_meta text;after_meta text;i int;rev text;
 -- The edit text must not depend on the line endings of this file: the hosted source uses CRLF, so every multi-line edit is normalized to CRLF before it is used.
 meta constant text:='concat_ws(''|'',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text,proisstrict::text,prorettype::regtype::text,proargtypes::text,pronargdefaults::text)';
begin
 -- write_tenancy_care
 for i in 1..array_length(edits,1) loop edits[i]:=replace(replace(edits[i],chr(13),''),chr(10),chr(13)||chr(10));end loop;
 select prosrc,pg_get_functiondef(oid) into old_src,old_def from pg_proc where oid=w;
 if md5(old_src)<>'883656994c2480d657e10017886f8a1e' then raise exception 'write_tenancy_care source drift';end if;
 new_def:=old_def;
 for i in 1..array_length(anchors,1) loop
  if (length(old_def)-length(replace(old_def,anchors[i],'')))/length(anchors[i])<>1 then raise exception 'Anchor W% must occur exactly once',i;end if;
  if position(edits[i] in old_def)>0 then raise exception 'The write_tenancy_care edit W% is already present',i;end if;
  new_def:=replace(new_def,anchors[i],edits[i]);
 end loop;
 execute 'select '||meta||' from pg_proc where oid='||w::int into before_meta;
 execute new_def;
 select prosrc into new_src from pg_proc where oid=w;
 execute 'select '||meta||' from pg_proc where oid='||w::int into after_meta;
 if md5(new_src)<>'41848da54df8555e596f8f5045b6b39c' then raise exception 'Patched write_tenancy_care does not match the reviewed result (%)',md5(new_src);end if;
 rev:=new_src;
 for i in reverse array_length(anchors,1)..1 loop rev:=replace(rev,edits[i],anchors[i]);end loop;
 if rev<>old_src then raise exception 'The write_tenancy_care edit is not exactly reversible';end if;
 if before_meta<>after_meta then raise exception 'write_tenancy_care owner, ACL or settings changed: % vs %',before_meta,after_meta;end if;
 -- log_maintenance_status_change
 select prosrc,pg_get_functiondef(oid) into old_src,old_def from pg_proc where oid=l;
 if md5(old_src)<>'c9f62c2a1a54300dac5f662cd89baeda' then raise exception 'log_maintenance_status_change source drift';end if;
 if (length(old_def)-length(replace(old_def,la,'')))/length(la)<>1 then raise exception 'Anchor L1 must occur exactly once';end if;
 if position(lb in old_def)>0 then raise exception 'The log_maintenance_status_change edit is already present';end if;
 execute 'select '||meta||' from pg_proc where oid='||l::int into before_meta;
 new_def:=replace(old_def,la,lb);
 execute new_def;
 select prosrc into new_src from pg_proc where oid=l;
 execute 'select '||meta||' from pg_proc where oid='||l::int into after_meta;
 if md5(new_src)<>'043e546a3564b5f5ba16b8dda804433f' then raise exception 'Patched log_maintenance_status_change does not match the reviewed result (%)',md5(new_src);end if;
 if replace(new_src,lb,la)<>old_src then raise exception 'The log_maintenance_status_change edit is not exactly reversible';end if;
 if before_meta<>after_meta then raise exception 'log_maintenance_status_change owner, ACL or settings changed: % vs %',before_meta,after_meta;end if;
end$patch$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Reads. The inbox is the first cross-tenancy maintenance read: it only ever returns rows of tenancies where the caller is the LANDLORD.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.get_maintenance_inbox(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();counts jsonb;rows_json jsonb;more boolean;
begin
 if a is null or public.is_tier1_verified(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 with v as (
  select m.*,t.property_id,t.tenant_id as tenant_uid,(t.status='ended') as ended,
   (m.status not in('cancelled','rejected') and not (m.status='resolved' and m.tenant_confirmed_resolved_at is not null)) as is_open
  from public.maintenance_requests m join public.tenancies t on t.id=m.tenancy_id
  where t.landlord_id=a and (t.status='active' or (t.status='ended' and m.status not in('cancelled','rejected') and not (m.status='resolved' and m.tenant_confirmed_resolved_at is not null)))),
 ranked as (select v.*,row_number() over (order by (v.is_open and v.priority='urgent') desc,v.created_at desc,v.id) as rn from v)
 select
  jsonb_build_object('open',count(*) filter (where is_open),'inProgress',count(*) filter (where status in('in_progress','scheduled')),
   'awaitingConfirmation',count(*) filter (where status='resolved' and tenant_confirmed_resolved_at is null),'resolved',count(*) filter (where status='resolved' and tenant_confirmed_resolved_at is not null),
   'urgentOpen',count(*) filter (where is_open and priority='urgent')),
  coalesce(jsonb_agg(jsonb_build_object('id',r.id,'tenancyId',r.tenancy_id,'propertyId',r.property_id,'title',r.title,'category',r.category,'priority',r.priority,'status',r.status,
   'tenantConfirmedAt',r.tenant_confirmed_resolved_at,'createdAt',r.created_at,'updatedAt',r.updated_at,'revision',r.care_revision,'tenancyEnded',r.ended,
   'lastNote',(select jsonb_build_object('role',case when u.actor_id=r.tenant_uid then 'tenant' else 'landlord' end,'note',u.note,'at',u.created_at)
     from public.maintenance_updates u where u.maintenance_request_id=r.id and u.from_status is not null and u.note is not null order by u.created_at desc,u.id desc limit 1))
   order by r.rn) filter (where r.rn>p_offset and r.rn<=p_offset+20),'[]'::jsonb),
  coalesce(bool_or(r.rn>p_offset+20),false)
 into counts,rows_json,more from ranked r;
 return jsonb_build_object('counts',counts,'rows',rows_json,'hasMore',more);
end$$;
create function public.get_maintenance_request(p_request_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies;m public.maintenance_requests;target uuid;thread jsonb;more boolean;
begin
 select tenancy_id into target from public.maintenance_requests where id=p_request_id;
 t:=rentlease_tenancy_care.relationship(target);
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 select * into m from public.maintenance_requests where id=p_request_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'role',case when u.actor_id=t.tenant_id then 'tenant' else 'landlord' end,'fromStatus',u.from_status,'status',u.to_status,'note',u.note,'at',u.created_at) order by u.created_at,u.id),'[]'::jsonb)
  into thread from (select * from public.maintenance_updates where maintenance_request_id=m.id order by created_at,id limit 20 offset p_offset) u;
 select exists(select 1 from public.maintenance_updates where maintenance_request_id=m.id order by created_at,id offset p_offset+20 limit 1) into more;
 return jsonb_build_object('request',jsonb_build_object('id',m.id,'tenancyId',m.tenancy_id,'propertyId',t.property_id,'title',m.title,'description',m.description,'category',m.category,'priority',m.priority,'status',m.status,
   'landlordResponse',m.landlord_response,'scheduledFor',m.scheduled_for,'resolvedAt',m.resolved_at,'tenantConfirmedAt',m.tenant_confirmed_resolved_at,'createdAt',m.created_at,'updatedAt',m.updated_at,
   'revision',m.care_revision,'tenancyEnded',t.status='ended','role',case when auth.uid()=t.tenant_id then 'tenant' else 'landlord' end),'thread',thread,'hasMore',more);
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Grants: authenticated only for the two new reads. The patched functions keep their ACLs.
-- ---------------------------------------------------------------------------------------------------------------------------
revoke all on function public.get_maintenance_inbox(integer),public.get_maintenance_request(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_maintenance_inbox(integer),public.get_maintenance_request(uuid,integer) to authenticated;

do $post$
declare f oid;
begin
 foreach f in array array[to_regprocedure('public.get_maintenance_inbox(integer)'),to_regprocedure('public.get_maintenance_request(uuid,integer)'),to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)'),to_regprocedure('public.get_tenancy_care(uuid,integer)'),to_regprocedure('public.get_tenancy_maintenance_history(uuid,integer)')] loop
  if f is null or has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'Care function grants are wrong: %',f::regprocedure;end if;
  if exists(select 1 from pg_proc p where p.oid=f and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres')) then raise exception 'Care function definition drifted: %',f::regprocedure;end if;
 end loop;
 if pg_get_constraintdef((select oid from pg_constraint where conname='maintenance_requests_category_check'))<>'CHECK ((category = ANY (ARRAY[''plumbing''::text, ''electrical''::text, ''appliance''::text, ''structural''::text, ''other''::text, ''internet''::text, ''pests''::text])))' then raise exception 'Category check is wrong';end if;
 if (select count(*) from rentlease_tenancy_care.function_backups)<>2 then raise exception 'Function backups are not the two originals';end if;
 if (select count(*) from public.maintenance_requests)<>current_setting('rentlease.requests_before')::bigint or (select count(*) from public.maintenance_updates)<>current_setting('rentlease.updates_before')::bigint then raise exception 'Existing rows changed';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_care(uuid,integer)')))<>'624c3bf0ce0f129f504c674330466c72' or md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_maintenance_history(uuid,integer)')))<>'78ac0cab8cd962a3a687d0501be8eeb0' then raise exception 'An untouched read changed';end if;
 if exists(select 1 from pg_class c,unnest(array['anon','authenticated','service_role']) r where c.oid in('public.maintenance_requests'::regclass,'public.maintenance_updates'::regclass,'rentlease_tenancy_care.receipts'::regclass,'rentlease_tenancy_care.function_backups'::regclass) and has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE')) then raise exception 'A maintenance table is exposed';end if;
end$post$;
commit;
