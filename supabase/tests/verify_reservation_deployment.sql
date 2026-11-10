-- Live READ ONLY: no fixture reservations/tenancies, private data or advisory locks.
-- Positive writes/expiry/transitions/concurrency use the disposable local suite.
begin isolation level read committed read only;
do $verify$
declare actors jsonb; threads jsonb; a jsonb; c jsonb; actor uuid; eligible boolean;
 expected boolean; result jsonb; wanted bigint; checks integer:=0; pairs integer:=0;
 denied_pairs integer:=0; denied_requests integer:=0; role_free integer:=0;
 signature text; original_role text:=current_user;
begin
 if exists(select 1 from pg_class where oid in('public.rental_reservations'::regclass,'rentlease_reservations.events'::regclass) and not relrowsecurity) then raise exception 'Reservation RLS disabled';end if;checks:=checks+1;
 foreach signature in array array['public.get_rental_reservations(uuid,integer,integer)','public.request_rental_reservation(uuid,uuid,date,integer,text)','public.respond_rental_reservation(uuid,uuid,integer,text,text)'] loop
  if not has_function_privilege('authenticated',signature,'execute') or has_function_privilege('anon',signature,'execute') then raise exception 'Reservation RPC privileges mismatch';end if;checks:=checks+1;
  if not exists(select 1 from pg_proc where oid=signature::regprocedure and prosecdef and proconfig @> array['search_path=""']) then raise exception 'Reservation RPC definer/search path mismatch';end if;checks:=checks+1;
 end loop;
 if has_schema_privilege('authenticated','rentlease_reservations','USAGE,CREATE') or has_schema_privilege('anon','rentlease_reservations','USAGE,CREATE') then raise exception 'Private reservation schema exposed';end if;checks:=checks+1;
 if has_function_privilege('authenticated','rentlease_reservations.project(uuid)','execute') or has_function_privilege('anon','rentlease_reservations.project(uuid)','execute') or has_function_privilege('authenticated','rentlease_reservations.guard_tenancy_commitment()','execute') or has_function_privilege('anon','rentlease_reservations.guard_tenancy_commitment()','execute') then raise exception 'Private helper executable';end if;checks:=checks+1;
 if has_table_privilege('authenticated','public.rental_reservations','SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','public.rental_reservations','SELECT,INSERT,UPDATE') or has_any_column_privilege('anon','public.rental_reservations','SELECT,INSERT,UPDATE') or has_table_privilege('authenticated','rentlease_reservations.events','SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege('anon','rentlease_reservations.events','SELECT,INSERT,UPDATE') then raise exception 'Unexpected direct reservation access';end if;checks:=checks+1;
 if not exists(select 1 from pg_trigger where tgrelid='public.tenancies'::regclass and tgname='aac_reservation_tenancy_commitment' and tgfoid='rentlease_reservations.guard_tenancy_commitment()'::regprocedure and tgenabled='O') then raise exception 'Tenancy commitment guard missing';end if;checks:=checks+1;
 if (select count(*) from pg_trigger where tgrelid='public.tenancies'::regclass and tgname in('aaa_tenancy_property_gate','aab_tenancy_identity_gate') and tgenabled='O')<>2 then raise exception 'Original tenancy gates missing';end if;checks:=checks+1;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'eligible',public.is_tier1_verified(p.id),'role_free',not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role in('tenant','landlord')))),'[]') into actors from public.profiles p;
 actors:=actors||jsonb_build_array(jsonb_build_object('id',null,'eligible',false),jsonb_build_object('id','ffffffff-ffff-4fff-8fff-ffffffffffff','eligible',false));
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'tenant',c.tenant_id,'owner',c.landlord_id,'reservations',(select count(*) from public.rental_reservations r where r.conversation_id=c.id))),'[]') into threads from public.conversations c;
 if exists(select 1 from public.rental_reservations where id='ffffffff-ffff-4fff-8fff-ffffffffffff') then raise exception 'Verification sentinel collision';end if;
 for a in select value from jsonb_array_elements(actors) loop
  actor:=(a->>'id')::uuid;eligible:=(a->>'eligible')::boolean;
  if eligible and coalesce((a->>'role_free')::boolean,false) then role_free:=role_free+1;end if;
  select count(*) into wanted from public.rental_reservations where actor in(tenant_id,landlord_id);
  execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  if eligible then
   result:=public.get_rental_reservations(null,0,50);
   if jsonb_array_length(result)<>least(wanted,50) then raise exception 'Participant reservation list mismatch';end if;checks:=checks+1;
   begin perform public.get_rental_reservations(null,-1);raise exception 'Invalid reservation page accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.request_rental_reservation(null,null,null,null);raise exception 'Invalid reservation request accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.respond_rental_reservation('ffffffff-ffff-4fff-8fff-ffffffffffff','ffffffff-ffff-4fff-8fff-ffffffffffff',1,'approve');raise exception 'Unknown reservation accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.respond_rental_reservation(null,null,null,'invalid');raise exception 'Invalid reservation action accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  else
   begin perform public.get_rental_reservations();raise exception 'Ineligible reservation read accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.request_rental_reservation(null,null,null,null);raise exception 'Ineligible reservation request accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.respond_rental_reservation(null,null,null,'approve');raise exception 'Ineligible reservation action accepted';exception when insufficient_privilege then checks:=checks+1;end;
  end if;
  for c in select value from jsonb_array_elements(threads) loop
   expected:=coalesce(eligible and actor in((c->>'tenant')::uuid,(c->>'owner')::uuid),false);
   if expected then
    result:=public.get_rental_reservations((c->>'id')::uuid,0,50);
    if jsonb_array_length(result)<>least((c->>'reservations')::bigint,50) then raise exception 'Conversation reservation count mismatch';end if;
    if exists(select 1 from jsonb_array_elements(result) r where r->>'conversation_id'<>c->>'id' or actor not in((r->>'tenant_id')::uuid,(r->>'landlord_id')::uuid) or r->>'applicant_label'<>'Renter' or r ?| array['display_name','email','phone','legal_name']) then raise exception 'Reservation projection scope/privacy mismatch';end if;
    checks:=checks+1;pairs:=pairs+1;
   else
    begin perform public.get_rental_reservations((c->>'id')::uuid);raise exception 'Foreign reservation read accepted';exception when insufficient_privilege then checks:=checks+1;end;
    denied_pairs:=denied_pairs+1;
   end if;
   -- A non-applicant is rejected before the request function takes any locks.
   if eligible and actor is distinct from (c->>'tenant')::uuid then
    begin perform public.request_rental_reservation((c->>'id')::uuid,'ffffffff-ffff-4fff-8fff-ffffffffffff',(statement_timestamp() at time zone 'Asia/Manila')::date+30,1);raise exception 'Owner/nonparticipant applicant impersonation accepted';exception when insufficient_privilege then checks:=checks+1;end;
    denied_requests:=denied_requests+1;
   end if;
  end loop;
  begin perform id from public.rental_reservations limit 1;raise exception 'Direct reservation read';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform snapshot from rentlease_reservations.events limit 1;raise exception 'Direct reservation history read';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform rentlease_reservations.project('ffffffff-ffff-4fff-8fff-ffffffffffff');raise exception 'Private projection accessible';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform body from public.messages limit 1;raise exception 'Direct message body access';exception when insufficient_privilege then checks:=checks+1;end;
  execute format('set local role %I',original_role);
 end loop;
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 begin perform public.get_rental_reservations();raise exception 'Anonymous reservation read';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform public.request_rental_reservation(null,null,null,null);raise exception 'Anonymous reservation request';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform public.respond_rental_reservation(null,null,null,'approve');raise exception 'Anonymous reservation response';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform id from public.rental_reservations limit 1;raise exception 'Anonymous direct reservation access';exception when insufficient_privilege then checks:=checks+1;end;
 execute format('set local role %I',original_role);
 if pairs=0 or denied_pairs=0 or denied_requests=0 or role_free=0 then raise exception 'Insufficient participant/nonparticipant/role-free evidence';end if;
 perform set_config('rentlease.reservation_verification',jsonb_build_object('checks_passed',checks,'existing_actors',jsonb_array_length(actors)-2,'existing_conversations',jsonb_array_length(threads),'participant_pairs',pairs,'denied_pairs',denied_pairs,'denied_applicant_impersonations',denied_requests,'eligible_role_free_actors',role_free,'read_only',true,'persistent_writes',0)::text,true);
end $verify$;
select current_setting('rentlease.reservation_verification')::jsonb as verification;
commit;
