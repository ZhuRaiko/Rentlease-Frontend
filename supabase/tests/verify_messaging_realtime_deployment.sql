-- Read-only, repeatable snapshot. Uses existing actors/threads only; prints counts.
begin isolation level repeatable read read only;
do $verify$
declare actors jsonb; threads jsonb; a jsonb; c jsonb; actor uuid; eligible boolean;
 expected boolean; actual boolean; n bigint; wanted bigint; checks integer:=0;
 participant_pairs integer:=0; nonparticipant_pairs integer:=0; role_free integer:=0;
 original_role text:=current_user;
begin
 if exists(select 1 from pg_class where oid in('public.messages'::regclass,'public.conversations'::regclass) and not relrowsecurity) then raise exception 'RLS disabled';end if;checks:=checks+1;
 if has_table_privilege('authenticated','public.messages','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.conversations','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unexpected whole-table grants';end if;checks:=checks+1;
 if has_any_column_privilege('anon','public.messages','SELECT') or has_any_column_privilege('anon','public.conversations','SELECT') then raise exception 'Anonymous metadata grant';end if;checks:=checks+1;
 if has_function_privilege('anon','public.can_receive_property_inquiry_events(uuid)','EXECUTE') or not has_function_privilege('authenticated','public.can_receive_property_inquiry_events(uuid)','EXECUTE') then raise exception 'Helper execution privilege mismatch';end if;checks:=checks+1;
 select count(*) into n from pg_policies where schemaname='public' and policyname in('inquiry_event_participant_scope','inquiry_conversation_event_scope') and permissive='RESTRICTIVE' and cmd='SELECT' and roles=array['authenticated']::name[];
 if n<>2 then raise exception 'Restrictive policies missing';end if;checks:=checks+1;
 select jsonb_agg(jsonb_build_object('id',p.id,'eligible',public.is_tier1_verified(p.id),'role_free',not exists(select 1 from public.user_roles r where r.user_id=p.id and r.role in('tenant','landlord')))) into actors from public.profiles p;
 actors:=coalesce(actors,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',null,'eligible',false,'role_free',false),jsonb_build_object('id','ffffffff-ffff-4fff-8fff-ffffffffffff','eligible',false,'role_free',false));
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'tenant',tenant_id,'owner',landlord_id,'messages',(select count(*) from public.messages m where m.conversation_id=c.id))),'[]'::jsonb) into threads from public.conversations c;
 for a in select value from jsonb_array_elements(actors) loop
  actor:=(a->>'id')::uuid;eligible:=(a->>'eligible')::boolean;
  if eligible and (a->>'role_free')::boolean then role_free:=role_free+1;end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  for c in select value from jsonb_array_elements(threads) loop
   expected:=coalesce(eligible and actor in((c->>'tenant')::uuid,(c->>'owner')::uuid),false);
   actual:=public.can_receive_property_inquiry_events((c->>'id')::uuid);
   if actual is distinct from expected then raise exception 'Helper participant/eligibility mismatch';end if;checks:=checks+1;
   select count(*) into n from (select id,tenant_id,landlord_id from public.conversations where id=(c->>'id')::uuid)s;
   if n<>(case when expected then 1 else 0 end) then raise exception 'Conversation metadata scope mismatch';end if;checks:=checks+1;
   select count(*) into n from (select id,conversation_id from public.messages where conversation_id=(c->>'id')::uuid)s;
   wanted:=case when expected then (c->>'messages')::bigint else 0 end;
   if n<>wanted then raise exception 'Message metadata scope mismatch';end if;checks:=checks+1;
   if expected then participant_pairs:=participant_pairs+1;
   else
    nonparticipant_pairs:=nonparticipant_pairs+1;
    begin perform public.get_conversation_messages((c->>'id')::uuid);raise exception 'Foreign history accepted';exception when insufficient_privilege then checks:=checks+1;end;
   end if;
  end loop;
  begin perform body from public.messages limit 1;raise exception 'Body readable directly';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform attachment_path from public.messages limit 1;raise exception 'Attachment readable directly';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform * from public.messages limit 1;raise exception 'Full message row readable';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform * from public.conversations limit 1;raise exception 'Full conversation row readable';exception when insufficient_privilege then checks:=checks+1;end;
  execute format('set local role %I',original_role);
 end loop;
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 begin perform id from public.messages limit 1;raise exception 'Anonymous message metadata accepted';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform id from public.conversations limit 1;raise exception 'Anonymous conversation metadata accepted';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform public.can_receive_property_inquiry_events('ffffffff-ffff-4fff-8fff-ffffffffffff');raise exception 'Anonymous helper accepted';exception when insufficient_privilege then checks:=checks+1;end;
 execute format('set local role %I',original_role);
 if participant_pairs=0 or nonparticipant_pairs=0 then raise exception 'Existing records insufficient for participant verification';end if;
 perform set_config('rentlease.realtime_verification',jsonb_build_object('checks_passed',checks,'existing_actors',jsonb_array_length(actors)-2,'existing_threads',jsonb_array_length(threads),'eligible_role_free_actors',role_free,'participant_pairs',participant_pairs,'nonparticipant_pairs',nonparticipant_pairs,'read_only',true,'persistent_writes',0)::text,true);
end $verify$;
select current_setting('rentlease.realtime_verification')::jsonb as verification;
commit;
