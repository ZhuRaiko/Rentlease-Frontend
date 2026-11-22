-- PREPARED LOCAL ONLY. When a tenancy ends, close the reservation it came from. NOT APPLIED.
-- Problem: write_tenancy_lifecycle sets tenancies.status='ended' and never touches public.rental_reservations, so the approved reservation of a finished stay stays
-- "approved" (it keeps showing as upcoming and keeps holding its dates). Nothing else sets a tenancy to 'ended' (checked on the linked project: one function, no pg_cron, no pg_net).
-- This migration only ADDS objects. No existing function, trigger or grant is replaced. rental_reservations has no triggers; tenancies keeps its 7.
-- Rule (trigger and one-time cleanup use the same function): the APPROVED reservations of the SAME conversation and the SAME tenant become 'cancelled' with the note 'Stay ended',
-- unless that conversation still has another tenancy in pending_confirmation or active. Reservations of other tenants or other conversations are never touched.
-- Each change follows what a normal cancel does (respond_rental_reservation): revision+1, responded_by, updated_at, and one rentlease_reservations.events row (action 'cancel'). It creates NO notification (see the delete below).
-- Rollback: supabase/test-support/end_closes_reservation_rollback.sql (removes the trigger and functions; cancelled reservations stay cancelled, and can be listed from the events).
begin;

do $guard$
begin
 if to_regclass('public.tenancies') is null or to_regclass('public.rental_reservations') is null or to_regclass('rentlease_reservations.events') is null then raise exception 'Required tables missing';end if;
 if (select count(*) from pg_attribute where attrelid='public.rental_reservations'::regclass and not attisdropped and attname=any(array['id','conversation_id','tenant_id','landlord_id','status','revision','response_note','responded_by','updated_at']))<>9 then raise exception 'rental_reservations columns drifted';end if;
 if (select count(*) from pg_attribute where attrelid='rentlease_reservations.events'::regclass and not attisdropped and attname=any(array['operation_id','reservation_id','actor_id','action','input','snapshot']))<>6 then raise exception 'reservation events columns drifted';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.rental_reservations'::regclass and not tgisinternal) then raise exception 'rental_reservations now has triggers';end if;
 if (select count(*) from pg_trigger where tgrelid='public.tenancies'::regclass and tgenabled='O' and not tgisinternal)<>7 then raise exception 'tenancy triggers drifted';end if;
 if to_regnamespace('rentlease_tenancy_close') is not null or exists(select 1 from pg_trigger where tgname='trg_end_closes_reservation') then raise exception 'End-closes-reservation objects already exist';end if;
end$guard$;

create schema rentlease_tenancy_close;
revoke all on schema rentlease_tenancy_close from public,anon,authenticated,service_role;

-- Closes the approved reservations of an ended tenancy. Idempotent: it only touches rows that are still approved, so a second call changes nothing. Returns how many rows it closed.
create function rentlease_tenancy_close.close_reservations(p_tenancy uuid,p_actor uuid) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; r public.rental_reservations; n integer:=0; who uuid; op uuid;
begin
 select * into t from public.tenancies where id=p_tenancy;
 if t.id is null or t.status<>'ended' then return 0;end if;
 -- Another stay still open on this conversation keeps the reservation relationship alive.
 if exists(select 1 from public.tenancies o where o.conversation_id=t.conversation_id and o.id<>t.id and o.status in('pending_confirmation','active')) then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended(t.property_id::text,0));
 for r in select * from public.rental_reservations x where x.conversation_id=t.conversation_id and x.tenant_id=t.tenant_id and x.status='approved' order by x.created_at,x.id for update loop
  who:=coalesce(p_actor,t.landlord_id);op:=gen_random_uuid();
  update public.rental_reservations set status='cancelled',response_note='Stay ended',responded_by=who,revision=revision+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  insert into rentlease_reservations.events(operation_id,reservation_id,actor_id,action,input,snapshot) values(op,r.id,who,'cancel',jsonb_build_object('reason','stay_ended','tenancy',t.id),to_jsonb(r));
  -- The event is the audit record, as for any cancel. Its insert fires inapp_reservation, which would notify people about a reservation they no longer see; the tenancy-ended notice already exists, so this one row is removed (its key is exactly 'reservation:'||operation id).
  delete from public.notifications where event_key='reservation:'||op;
  n:=n+1;
 end loop;
 return n;
end$$;

create function rentlease_tenancy_close.after_end() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform rentlease_tenancy_close.close_reservations(new.id,auth.uid());
 return null;
end$$;
create trigger trg_end_closes_reservation after update of status on public.tenancies for each row
 when (new.status='ended' and old.status is distinct from new.status) execute function rentlease_tenancy_close.after_end();

-- No client role can run any of it: the trigger runs as its owner when a tenancy ends.
revoke all on all functions in schema rentlease_tenancy_close from public,anon,authenticated,service_role;

-- One-time cleanup: stays that already ended. Same rule, same function. (The rows it changes, listed before applying, are in the dry-run report.)
do $cleanup$
declare t record; n integer:=0;
begin
 for t in select id from public.tenancies where status='ended' order by ended_at,id loop n:=n+rentlease_tenancy_close.close_reservations(t.id,null);end loop;
 raise notice 'Closed % approved reservation(s) of ended stays',n;
end$cleanup$;

do $post$
begin
 if exists(select 1 from pg_proc p where p.pronamespace='rentlease_tenancy_close'::regnamespace and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE') or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'])) then raise exception 'Close functions are not locked down';end if;
 if has_schema_privilege('authenticated','rentlease_tenancy_close','USAGE') or has_schema_privilege('anon','rentlease_tenancy_close','USAGE') then raise exception 'Close schema exposed';end if;
 if exists(select 1 from public.rental_reservations r join public.tenancies t on t.conversation_id=r.conversation_id and t.tenant_id=r.tenant_id and t.status='ended' where r.status='approved' and not exists(select 1 from public.tenancies o where o.conversation_id=t.conversation_id and o.id<>t.id and o.status in('pending_confirmation','active'))) then raise exception 'An ended stay still has an approved reservation';end if;
end$post$;
commit;
