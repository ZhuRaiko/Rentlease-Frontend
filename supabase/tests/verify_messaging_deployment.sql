-- Non-destructive live UC-08 verification. No fixtures, message sends, or inquiry creation.
begin read only;
do $verify$
declare actors uuid[]; actor uuid; unknown_id uuid:='00000000-0000-4000-8000-ffffffffffff'; checks integer:=0; role_free integer; rows jsonb; n integer; signature text;
begin
 select array_agg(id) into actors from public.profiles where public.is_tier1_verified(id);
 select count(*) into role_free from public.profiles p where public.is_tier1_verified(p.id) and not exists(select 1 from public.user_roles r where r.user_id=p.id and r.role in('tenant','landlord'));
 if coalesce(array_length(actors,1),0)=0 then raise exception 'No existing eligible actor available for read-only verification'; end if;
 foreach signature in array array['public.start_property_inquiry(uuid)','public.get_messaging_inbox(integer,integer,uuid)','public.get_conversation_messages(uuid,text,timestamptz,uuid,integer,uuid[])','public.send_property_message(uuid,uuid,text)'] loop
  if not has_function_privilege('authenticated',signature,'execute') or has_function_privilege('anon',signature,'execute') then raise exception 'RPC privilege mismatch';end if;checks:=checks+1;
 end loop;
 if has_table_privilege('authenticated','public.conversations','select,insert,update') or has_table_privilege('authenticated','public.messages','select,insert,update') then raise exception 'Unexpected direct table privileges';end if;checks:=checks+1;
 execute 'set local role authenticated';
 foreach actor in array array[null::uuid,unknown_id] loop
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  begin perform public.start_property_inquiry(unknown_id);raise exception 'Unauthorized inquiry accepted';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.get_messaging_inbox();raise exception 'Unauthorized inbox accepted';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.get_conversation_messages(unknown_id);raise exception 'Unauthorized history accepted';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.send_property_message(unknown_id,unknown_id,'Invalid identity must fail before mutation');raise exception 'Unauthorized send accepted';exception when insufficient_privilege then checks:=checks+1;end;
 end loop;
 foreach actor in array actors loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  rows:=public.get_messaging_inbox(0,20);
  if jsonb_typeof(rows)<>'array' or exists(select 1 from jsonb_array_elements(rows)e where actor::text not in(e->>'tenant_id',e->>'landlord_id')) then raise exception 'Inbox exposed nonparticipant data';end if;checks:=checks+1;
  if public.get_messaging_inbox(0,20,unknown_id)<>'[]'::jsonb then raise exception 'Unexpected unrelated conversation';end if;checks:=checks+1;
  foreach n in array array[0,51,-1] loop
   begin perform public.get_messaging_inbox(0,n);raise exception 'Invalid inbox limit accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  end loop;
  foreach n in array array[-1,1001,null::integer] loop
   begin perform public.get_messaging_inbox(n,20);raise exception 'Invalid inbox offset accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  end loop;
  begin perform public.get_conversation_messages(unknown_id);raise exception 'Unrelated history accepted';exception when insufficient_privilege then checks:=checks+1;end;
  -- Invalid text/ID fails before row locks/inserts, safe within READ ONLY.
  begin perform public.send_property_message(unknown_id,unknown_id,' ');raise exception 'Empty send accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.send_property_message(unknown_id,unknown_id,repeat('x',4001));raise exception 'Oversize send accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.send_property_message(unknown_id,null,'Invalid ID');raise exception 'Null message ID accepted';exception when invalid_parameter_value then checks:=checks+1;end;
 end loop;
 perform set_config('uc08.verify_results',jsonb_build_object('checks_passed',checks,'eligible_actors',array_length(actors,1),'eligible_without_legacy_roles',role_free,'read_only',true,'persistent_writes',0)::text,true);
end
$verify$;
select current_setting('uc08.verify_results')::jsonb as verification;
commit;
