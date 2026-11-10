-- Live read-only verification: existing identities/conversations only, aggregate output.
-- Positive writes and transition/concurrency tests belong to the disposable local suite.
begin isolation level repeatable read read only;
do $verify$
declare actors jsonb; threads jsonb; a jsonb; c jsonb; actor uuid; eligible boolean;
 expected boolean; result jsonb; wanted bigint; checks integer:=0; participants integer:=0;
 denied_pairs integer:=0; role_free integer:=0; signature text; original_role text:=current_user;
begin
 if exists(select 1 from pg_class where oid in('public.viewing_schedules'::regclass,'public.viewing_schedule_events'::regclass) and not relrowsecurity) then raise exception 'Viewing RLS disabled';end if;checks:=checks+1;
 foreach signature in array array['public.get_property_viewings(uuid,integer,integer)','public.request_property_viewing(uuid,uuid,timestamptz,timestamptz,text)','public.respond_property_viewing(uuid,uuid,integer,text,timestamptz,timestamptz,text)'] loop
  if not has_function_privilege('authenticated',signature,'execute') or has_function_privilege('anon',signature,'execute') then raise exception 'RPC privileges mismatch';end if;checks:=checks+1;
  if not exists(select 1 from pg_proc where oid=signature::regprocedure and prosecdef and proconfig @> array['search_path=""']) then raise exception 'RPC definer/search path mismatch';end if;checks:=checks+1;
 end loop;
 if has_table_privilege('authenticated','public.viewing_schedules','SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','public.viewing_schedules','SELECT,INSERT,UPDATE') or has_table_privilege('authenticated','public.viewing_schedule_events','SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','public.viewing_schedule_events','SELECT,INSERT,UPDATE') then raise exception 'Unexpected direct viewing privilege';end if;checks:=checks+1;
 if has_any_column_privilege('anon','public.viewing_schedules','SELECT,INSERT,UPDATE') or has_any_column_privilege('anon','public.viewing_schedule_events','SELECT,INSERT,UPDATE') then raise exception 'Anonymous viewing privilege';end if;checks:=checks+1;
 if (select count(*) from pg_policies where schemaname='public' and tablename='viewing_schedules' and permissive='RESTRICTIVE' and roles=array['authenticated']::name[] and ((policyname='viewing_rpc_insert_only' and cmd='INSERT' and with_check='false') or (policyname='viewing_rpc_update_only' and cmd='UPDATE' and qual='false' and with_check='false')))<>2 then raise exception 'RPC-only write policies missing';end if;checks:=checks+1;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'eligible',public.is_tier1_verified(p.id),'role_free',not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role in('tenant','landlord')))),'[]') into actors from public.profiles p;
 actors:=actors||jsonb_build_array(jsonb_build_object('id',null,'eligible',false),jsonb_build_object('id','ffffffff-ffff-4fff-8fff-ffffffffffff','eligible',false));
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'tenant',c.tenant_id,'owner',c.landlord_id,'viewings',(select count(*) from public.viewing_schedules v where v.conversation_id=c.id))),'[]') into threads from public.conversations c;
 if exists(select 1 from public.viewing_schedules where id='ffffffff-ffff-4fff-8fff-ffffffffffff') then raise exception 'Verification sentinel collision';end if;
 for a in select value from jsonb_array_elements(actors) loop
  actor:=(a->>'id')::uuid;eligible:=(a->>'eligible')::boolean;
  if eligible and coalesce((a->>'role_free')::boolean,false) then role_free:=role_free+1;end if;
  select count(*) into wanted from public.viewing_schedules where actor in(tenant_id,landlord_id);
  execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  if eligible then
   result:=public.get_property_viewings(null,0,50);
   if jsonb_array_length(result)<>least(wanted,50) then raise exception 'Participant list mismatch';end if;checks:=checks+1;
   begin perform public.get_property_viewings(null,-1);raise exception 'Invalid page accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.request_property_viewing(null,null,null,null);raise exception 'Invalid request accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.respond_property_viewing('ffffffff-ffff-4fff-8fff-ffffffffffff','ffffffff-ffff-4fff-8fff-ffffffffffff',1,'approve');raise exception 'Unknown viewing accepted';exception when insufficient_privilege then checks:=checks+1;end;
  else
   begin perform public.get_property_viewings();raise exception 'Ineligible read accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.request_property_viewing(null,null,null,null);raise exception 'Ineligible request accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.respond_property_viewing(null,null,null,'approve');raise exception 'Ineligible response accepted';exception when insufficient_privilege then checks:=checks+1;end;
  end if;
  for c in select value from jsonb_array_elements(threads) loop
   expected:=coalesce(eligible and actor in((c->>'tenant')::uuid,(c->>'owner')::uuid),false);
   if expected then
    result:=public.get_property_viewings((c->>'id')::uuid,0,50);
    if jsonb_array_length(result)<>least((c->>'viewings')::bigint,50) then raise exception 'Conversation appointment count mismatch';end if;
    if exists(select 1 from jsonb_array_elements(result) r where r->>'conversation_id'<>c->>'id' or actor not in((r->>'tenant_id')::uuid,(r->>'landlord_id')::uuid)) then raise exception 'Participant projection mismatch';end if;
    checks:=checks+1;participants:=participants+1;
   else
    begin perform public.get_property_viewings((c->>'id')::uuid);raise exception 'Foreign viewing read accepted';exception when insufficient_privilege then checks:=checks+1;end;
    denied_pairs:=denied_pairs+1;
   end if;
  end loop;
  begin perform id from public.viewing_schedules limit 1;raise exception 'Direct appointment access';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform snapshot from public.viewing_schedule_events limit 1;raise exception 'Direct event access';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform body from public.messages limit 1;raise exception 'Direct message body access';exception when insufficient_privilege then checks:=checks+1;end;
  execute format('set local role %I',original_role);
 end loop;
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 begin perform public.get_property_viewings();raise exception 'Anonymous read accepted';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform public.request_property_viewing(null,null,null,null);raise exception 'Anonymous request accepted';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform public.respond_property_viewing(null,null,null,'approve');raise exception 'Anonymous response accepted';exception when insufficient_privilege then checks:=checks+1;end;
 execute format('set local role %I',original_role);
 if participants=0 or denied_pairs=0 or role_free=0 then raise exception 'Insufficient eligible participant/nonparticipant/role-free evidence';end if;
 perform set_config('rentlease.viewing_verification',jsonb_build_object('checks_passed',checks,'existing_actors',jsonb_array_length(actors)-2,'existing_conversations',jsonb_array_length(threads),'participant_pairs',participants,'denied_pairs',denied_pairs,'eligible_role_free_actors',role_free,'read_only',true,'persistent_writes',0)::text,true);
end $verify$;
select current_setting('rentlease.viewing_verification')::jsonb as verification;
commit;
