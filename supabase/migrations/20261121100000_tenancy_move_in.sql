-- PREPARED LOCAL ONLY. Tenancy early move-in. NOT APPLIED.
-- Either participant of a tenancy that is waiting for its start date asks to start EARLIER; the OTHER participant accepts or declines; the requester can
-- withdraw. The start date moves only on accept. It follows the hardening of write_tenancy_extension (rentlease_tenancy_extension): participant-only access
-- with active Tier 1, the property advisory lock then the tenancy row lock, operation_id receipts for idempotent retries, a revision uuid checked on
-- accept/decline/withdraw, immutable event history, one open request per tenancy, and everything re-checked on accept.
-- A separate private schema (rentlease_tenancy_movein) and its own three RPCs. NO existing function, trigger, policy or grant is replaced or patched, and
-- storage.objects is not touched. The only existing object this calls is rentlease_tenancy_extension.first_conflict (reused as is; guarded below).
-- No notifications are created: the inapp_tenancy trigger returns early when status and both confirmations are unchanged (a start-date-only update).
-- Rollback: supabase/test-support/tenancy_move_in_rollback.sql (entry points only, data retained)
--           supabase/test-support/tenancy_move_in_rollback_full.sql (only while every table is empty).
begin;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Baseline guards: stop unless the live objects this migration depends on are what it was written against.
-- md5 values are of prosrc with CR characters removed (hosted bodies may hold CRs from CRLF files), read from the linked project on 2026-11-21.
-- ---------------------------------------------------------------------------------------------------------------------------
do $guard$
declare tcols int; trg int;
begin
 if to_regclass('public.tenancies') is null or to_regclass('rentlease_tenancy_end.requests') is null or to_regclass('rentlease_tenancy_extension.requests') is null then raise exception 'Required tables missing';end if;
 select count(*) into tcols from pg_attribute where attrelid='public.tenancies'::regclass and not attisdropped and attname=any(array['id','property_id','tenant_id','landlord_id','status','start_date','expected_end_date','actual_end_date','ended_at','tenant_confirmed_at','landlord_confirmed_at']);
 if tcols<>11 then raise exception 'tenancies columns drifted';end if;
 if (select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid=t.oid where t.oid='public.tenancy_status'::regtype) is distinct from 'proposed,pending_confirmation,active,ended,cancelled' then raise exception 'tenancy_status drifted';end if;
 if has_table_privilege('authenticated','public.tenancies','INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','public.tenancies','UPDATE') then raise exception 'Unexpected tenancy write grant';end if;
 -- The triggers an accept fires on public.tenancies. A start-date-only update must pass all of them (verified: none reads start_date except aac, which re-runs the reservation overlap check).
 select count(*) into trg from pg_trigger where tgrelid='public.tenancies'::regclass and tgenabled='O' and not tgisinternal
  and tgname in('aaa_tenancy_property_gate','aab_tenancy_identity_gate','aac_reservation_tenancy_commitment','trg_sync_listing_from_tenancy','trg_tenancies_updated_at','trg_validate_tenancy','inapp_tenancy');
 if trg<>7 then raise exception 'tenancy triggers drifted (% of 7)',trg;end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.is_tier1_verified(uuid)')),chr(13),'')) is distinct from 'f839df2bff48c4b5880a1794b6d101d5' then raise exception 'is_tier1_verified drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_reservations.guard_tenancy_commitment()')),chr(13),'')) is distinct from '7f3420d0026e508c25b240f0bae7e96c' then raise exception 'guard_tenancy_commitment drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_notifications.generate()')),chr(13),'')) is distinct from '08b686c7868662747ec9bf3f119c6177' then raise exception 'notifications generate drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_tenancy_extension.first_conflict(public.tenancies,date,date)')),chr(13),'')) is distinct from 'e4e987c1e289db3017b5b8ff4209e113' then raise exception 'extension first_conflict drifted';end if;
 -- Nothing of this feature may exist yet.
 if to_regnamespace('rentlease_tenancy_movein') is not null or to_regprocedure('public.write_tenancy_move_in(uuid,uuid,text,jsonb)') is not null
  or to_regprocedure('public.get_tenancy_move_in(uuid)') is not null or to_regprocedure('public.get_pending_tenancy_move_ins()') is not null then raise exception 'Tenancy move-in objects already exist';end if;
end$guard$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Private schema: no client role has any access. The three public RPCs below are the only entry points.
-- ---------------------------------------------------------------------------------------------------------------------------
create schema rentlease_tenancy_movein;
revoke all on schema rentlease_tenancy_movein from public,anon,authenticated,service_role;

create table rentlease_tenancy_movein.requests(
 id uuid primary key default gen_random_uuid(),
 tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 requester_id uuid not null,
 requested_start_date date not null,
 -- The tenancy's start date when the request was made. Accept refuses (40001) if the tenancy's start date is no longer this value.
 base_start_date date not null,
 request_note text check(request_note is null or length(request_note) between 1 and 1000),
 status text not null default 'pending' check(status in('pending','accepted','declined','withdrawn')),
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 decided_at timestamptz,decided_by uuid,
 decision_note text check(decision_note is null or length(decision_note) between 1 and 1000),
 check(requested_start_date<base_start_date),
 check((status='pending' and decided_at is null and decided_by is null and decision_note is null) or (status<>'pending' and decided_at is not null and decided_by is not null)));
-- One open request per tenancy (backstop: the property advisory lock already serializes writers).
create unique index one_pending_tenancy_move_in on rentlease_tenancy_movein.requests(tenancy_id) where status='pending';
create index tenancy_move_in_requests_tenancy on rentlease_tenancy_movein.requests(tenancy_id,created_at desc,id);
-- Immutable record of who did what and when. RESTRICT on both parents: a tenancy with move-in history cannot be deleted.
create table rentlease_tenancy_movein.events(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references rentlease_tenancy_movein.requests(id) on delete restrict,
 tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 actor_id uuid not null,
 action text not null check(action in('request','accept','decline','withdraw')),
 from_status text,to_status text not null check(to_status in('pending','accepted','declined','withdrawn')),
 start_date date not null,note text,operation_id uuid not null,
 created_at timestamptz not null default clock_timestamp());
create index tenancy_move_in_events_tenancy on rentlease_tenancy_movein.events(tenancy_id,created_at desc);
create table rentlease_tenancy_movein.receipts(
 actor_id uuid not null,operation_id uuid not null,input jsonb not null,result jsonb not null,
 created_at timestamptz not null default statement_timestamp(),primary key(actor_id,operation_id));
alter table rentlease_tenancy_movein.requests enable row level security;
alter table rentlease_tenancy_movein.events enable row level security;
alter table rentlease_tenancy_movein.receipts enable row level security;
revoke all on all tables in schema rentlease_tenancy_movein from public,anon,authenticated,service_role;

create function rentlease_tenancy_movein.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Move-in evidence is immutable' using errcode='42501';end$$;
create trigger move_in_events_immutable before update or delete on rentlease_tenancy_movein.events for each row execute function rentlease_tenancy_movein.immutable();
create trigger move_in_receipts_immutable before update or delete on rentlease_tenancy_movein.receipts for each row execute function rentlease_tenancy_movein.immutable();
-- A request can only leave 'pending' once, never be deleted, and its original fields never change. Every update rotates the revision token.
create function rentlease_tenancy_movein.guard_request() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'Move-in request cannot be deleted' using errcode='42501';end if;
 if old.status<>'pending' or new.status='pending'
  or (to_jsonb(new)-array['status','decided_at','decided_by','decision_note','revision']) is distinct from (to_jsonb(old)-array['status','decided_at','decided_by','decision_note','revision']) then
  raise exception 'Original move-in request cannot be changed' using errcode='42501';end if;
 new.revision:=gen_random_uuid();return new;
end$$;
create trigger move_in_request_guard before update or delete on rentlease_tenancy_movein.requests for each row execute function rentlease_tenancy_movein.guard_request();

-- ---------------------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------------------
-- Write entry: active Tier 1, participant only, property advisory lock (same key as the tenancy gate triggers), then the tenancy row FOR UPDATE.
create function rentlease_tenancy_movein.relationship(p_id uuid) returns public.tenancies
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; target uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select property_id into target from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id);
 if target is null then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into t from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id) for update;
 if t.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 return t;
end$$;
-- Read entry: the same access rules, no locks.
create function rentlease_tenancy_movein.participant(p_id uuid) returns public.tenancies
language plpgsql stable security definer set search_path=pg_catalog as $$
declare t public.tenancies;
begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select * into t from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id);
 if t.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 return t;
end$$;
-- A pending early-end request on the same tenancy (rentlease_tenancy_end.requests).
create function rentlease_tenancy_movein.early_end_pending(p_tenancy uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from rentlease_tenancy_end.requests r where r.tenancy_id=p_tenancy and r.status='pending') $$;
-- Why a start date cannot be moved now, or null when it can. The tenancy must be waiting for its start date: both participants have confirmed and the start date is
-- still ahead (Asia/Manila). Status 'pending_confirmation' is the real state of such a tenancy (confirmation makes it 'active' only on or after the start date);
-- 'active' with a future start date is accepted too, in case such a row exists. Stable codes the client maps to words.
create function rentlease_tenancy_movein.schedule_block(t public.tenancies,p_today date) returns text
language sql stable security definer set search_path=pg_catalog as $$
 select case
  when t.status not in('pending_confirmation','active') then 'not_scheduled'
  when t.tenant_confirmed_at is null or t.landlord_confirmed_at is null then 'not_confirmed'
  when t.actual_end_date is not null or t.ended_at is not null then 'ended'
  when t.start_date<=p_today then 'already_started'
  when rentlease_tenancy_movein.early_end_pending(t.id) then 'early_end_pending'
  else null end $$;
create function rentlease_tenancy_movein.request_block(t public.tenancies,p_today date) returns text
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(rentlease_tenancy_movein.schedule_block(t,p_today),
  case when exists(select 1 from rentlease_tenancy_movein.requests r where r.tenancy_id=t.id and r.status='pending') then 'request_pending' end) $$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- write_tenancy_move_in: request (either participant), withdraw (the requester), accept / decline (the other participant)
-- Errors the client maps:  42501 not allowed | 22023 move_in_unavailable:<reason> / move_in_date_invalid:<why> / invalid input
--                          23P01 move_in_conflict:YYYY-MM-DD | 40001 changed, reload
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.write_tenancy_move_in(p_tenancy_id uuid,p_operation_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; r rentlease_tenancy_movein.requests; cached rentlease_tenancy_movein.receipts;
 me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 input jsonb; result jsonb; req date; note text; rid uuid; rrev uuid; block text; conflict date; new_rev uuid; allowed text[]; uuid_re constant text:='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
 t:=rentlease_tenancy_movein.relationship(p_tenancy_id);
 if p_operation_id is null or p_action is null or p_action not in('request','accept','decline','withdraw') then raise exception 'Invalid operation' using errcode='22023';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid payload' using errcode='22023';end if;
 allowed:=case p_action when 'request' then array['requestedStartDate','note'] when 'decline' then array['requestId','revision','note'] else array['requestId','revision'] end;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(allowed)) then raise exception 'Unexpected fields' using errcode='22023';end if;
 -- The optional note: absent or null means none; present means 1 to 1000 characters after trimming.
 if p_payload->'note' is not null and jsonb_typeof(p_payload->'note')<>'null' then
  if jsonb_typeof(p_payload->'note')<>'string' then raise exception 'Note must be text' using errcode='22023';end if;
  note:=btrim(p_payload->>'note');
  if length(note) not between 1 and 1000 then raise exception 'Note must be 1 to 1000 characters' using errcode='22023';end if;
 end if;
 if p_action='request' then
  if jsonb_typeof(p_payload->'requestedStartDate') is distinct from 'string' or p_payload->>'requestedStartDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'move_in_date_invalid:missing' using errcode='22023';end if;
  begin req:=(p_payload->>'requestedStartDate')::date;exception when others then raise exception 'move_in_date_invalid:malformed' using errcode='22023';end;
  input:=jsonb_build_object('tenancy',t.id,'action',p_action,'requestedStartDate',req,'note',note);
 else
  if jsonb_typeof(p_payload->'requestId') is distinct from 'string' or jsonb_typeof(p_payload->'revision') is distinct from 'string'
   or p_payload->>'requestId' !~ uuid_re or p_payload->>'revision' !~ uuid_re then raise exception 'Invalid operation' using errcode='22023';end if;
  rid:=(p_payload->>'requestId')::uuid;rrev:=(p_payload->>'revision')::uuid;
  input:=jsonb_build_object('tenancy',t.id,'action',p_action,'requestId',rid,'revision',rrev,'note',note);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text||p_operation_id::text,7));
 select * into cached from rentlease_tenancy_movein.receipts where actor_id=me and operation_id=p_operation_id;
 if found then
  if cached.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;
  return cached.result;
 end if;

 if p_action='request' then
  block:=rentlease_tenancy_movein.request_block(t,today);
  if block is not null then raise exception 'move_in_unavailable:%',block using errcode='22023';end if;
  if req<today then raise exception 'move_in_date_invalid:in_past' using errcode='22023';end if;
  if req>=t.start_date then raise exception 'move_in_date_invalid:not_before_start' using errcode='22023';end if;
  conflict:=rentlease_tenancy_extension.first_conflict(t,req,t.start_date-1);
  if conflict is not null then raise exception 'move_in_conflict:%',to_char(conflict,'YYYY-MM-DD') using errcode='23P01';end if;
  insert into rentlease_tenancy_movein.requests(tenancy_id,requester_id,requested_start_date,base_start_date,request_note) values(t.id,me,req,t.start_date,note) returning * into r;
  insert into rentlease_tenancy_movein.events(request_id,tenancy_id,actor_id,action,from_status,to_status,start_date,note,operation_id) values(r.id,t.id,me,'request',null,'pending',req,note,p_operation_id);
  result:=jsonb_build_object('requestId',r.id,'status','pending','requestedStartDate',req,'currentStartDate',t.start_date,'revision',r.revision);
 else
  select * into r from rentlease_tenancy_movein.requests where id=rid and tenancy_id=t.id for update;
  if r.id is null then raise exception 'Move-in request changed. Reload.' using errcode='40001';end if;
  -- Who may act is a fact about the request, so it is checked before its state: the requester withdraws, only the OTHER participant decides.
  if p_action='withdraw' and me is distinct from r.requester_id then raise exception 'Requester required' using errcode='42501';end if;
  if p_action in('accept','decline') and me is not distinct from r.requester_id then raise exception 'The other participant must decide' using errcode='42501';end if;
  if r.status<>'pending' or r.revision is distinct from rrev then raise exception 'Move-in request changed. Reload.' using errcode='40001';end if;
  if p_action='accept' then
   -- Everything is checked again: the tenancy, the dates, an early-end request and the calendar may all have changed since the request.
   block:=rentlease_tenancy_movein.schedule_block(t,today);
   if block is not null then raise exception 'move_in_unavailable:%',block using errcode='22023';end if;
   if t.start_date is distinct from r.base_start_date then raise exception 'Tenancy changed. Reload.' using errcode='40001';end if;
   if r.requested_start_date<today then raise exception 'move_in_date_invalid:in_past' using errcode='22023';end if;
   conflict:=rentlease_tenancy_extension.first_conflict(t,r.requested_start_date,t.start_date-1);
   if conflict is not null then raise exception 'move_in_conflict:%',to_char(conflict,'YYYY-MM-DD') using errcode='23P01';end if;
   update public.tenancies set start_date=r.requested_start_date where id=t.id;
   update rentlease_tenancy_movein.requests set status='accepted',decided_at=clock_timestamp(),decided_by=me where id=r.id returning revision into new_rev;
   insert into rentlease_tenancy_movein.events(request_id,tenancy_id,actor_id,action,from_status,to_status,start_date,note,operation_id) values(r.id,t.id,me,'accept','pending','accepted',r.requested_start_date,null,p_operation_id);
   result:=jsonb_build_object('requestId',r.id,'status','accepted','requestedStartDate',r.requested_start_date,'currentStartDate',r.requested_start_date,'revision',new_rev);
  elsif p_action='decline' then
   update rentlease_tenancy_movein.requests set status='declined',decided_at=clock_timestamp(),decided_by=me,decision_note=note where id=r.id returning revision into new_rev;
   insert into rentlease_tenancy_movein.events(request_id,tenancy_id,actor_id,action,from_status,to_status,start_date,note,operation_id) values(r.id,t.id,me,'decline','pending','declined',r.requested_start_date,note,p_operation_id);
   result:=jsonb_build_object('requestId',r.id,'status','declined','requestedStartDate',r.requested_start_date,'currentStartDate',t.start_date,'revision',new_rev);
  else
   update rentlease_tenancy_movein.requests set status='withdrawn',decided_at=clock_timestamp(),decided_by=me where id=r.id returning revision into new_rev;
   insert into rentlease_tenancy_movein.events(request_id,tenancy_id,actor_id,action,from_status,to_status,start_date,note,operation_id) values(r.id,t.id,me,'withdraw','pending','withdrawn',r.requested_start_date,null,p_operation_id);
   result:=jsonb_build_object('requestId',r.id,'status','withdrawn','requestedStartDate',r.requested_start_date,'currentStartDate',t.start_date,'revision',new_rev);
  end if;
 end if;
 insert into rentlease_tenancy_movein.receipts(actor_id,operation_id,input,result) values(me,p_operation_id,input,result);
 return result;
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- get_tenancy_move_in: the pending request, else the latest finished one, what the caller can do, and the recent history (for the timeline).
-- Roles ('tenant' / 'landlord'), never user ids.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.get_tenancy_move_in(p_tenancy_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare t public.tenancies; r rentlease_tenancy_movein.requests; me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 is_owner boolean; block text; conflict date; can_accept boolean:=false; responder boolean:=false; request_json jsonb; history_json jsonb;
begin
 t:=rentlease_tenancy_movein.participant(p_tenancy_id);
 is_owner:=me=t.landlord_id;
 select * into r from rentlease_tenancy_movein.requests where tenancy_id=t.id order by (status='pending') desc,created_at desc,id desc limit 1;
 block:=rentlease_tenancy_movein.request_block(t,today);
 if r.id is not null and r.status='pending' then
  responder:=me is distinct from r.requester_id;
  if responder and r.requested_start_date<t.start_date then
   conflict:=rentlease_tenancy_extension.first_conflict(t,r.requested_start_date,t.start_date-1);
   can_accept:=rentlease_tenancy_movein.schedule_block(t,today) is null and t.start_date is not distinct from r.base_start_date and today<=r.requested_start_date and conflict is null;
  end if;
 end if;
 if r.id is not null then
  request_json:=jsonb_build_object('id',r.id,'status',r.status,'requestedStartDate',r.requested_start_date,'baseStartDate',r.base_start_date,'note',r.request_note,
   'decisionNote',r.decision_note,'requestedBy',case when r.requester_id=t.tenant_id then 'tenant' else 'landlord' end,'requestedByMe',r.requester_id=me,
   'whoDecided',case when r.decided_by is null then null when r.decided_by=t.tenant_id then 'tenant' else 'landlord' end,
   'revision',r.revision,'createdAt',r.created_at,'decidedAt',r.decided_at,
   'conflictDate',case when responder and r.status='pending' then conflict else null end,
   'canAccept',can_accept,'canDecline',responder and r.status='pending','canWithdraw',r.status='pending' and r.requester_id=me);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'by',case when e.actor_id=t.tenant_id then 'tenant' else 'landlord' end,'byMe',e.actor_id=me,
   'startDate',e.start_date,'note',e.note,'at',e.created_at) order by e.created_at desc,e.id desc),'[]'::jsonb) into history_json
  from (select * from rentlease_tenancy_movein.events where tenancy_id=t.id order by created_at desc,id desc limit 20) e;
 return jsonb_build_object('tenancyId',t.id,'role',case when is_owner then 'landlord' else 'tenant' end,'currentStartDate',t.start_date,'earliestDate',today,
  'canRequest',block is null,'cannotRequestReason',block,'request',request_json,'history',history_json);
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- get_pending_tenancy_move_ins: the signed-in participant's open requests made BY THE OTHER SIDE (the "Needs your attention" feed). Oldest first, at most 50.
-- Only requests that can still matter: the tenancy is still waiting for its start date and the requested date has not passed.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.get_pending_tenancy_move_ins() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; rows_json jsonb; more boolean;
begin
 if me is null or public.is_tier1_verified(me) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('tenancyId',p.tenancy_id,'propertyId',p.property_id,'requestId',p.rid,'requestedStartDate',p.requested_start_date,
   'currentStartDate',p.start_date,'requestedBy',p.requested_by,'createdAt',p.created_at,'conflictDate',p.conflict) order by p.created_at,p.rid) filter(where p.n<=50),'[]'::jsonb),coalesce(max(p.n)>50,false)
  into rows_json,more
 from (select r.id as rid,r.tenancy_id,t.property_id,r.requested_start_date,t.start_date,r.created_at,
        case when r.requester_id=t.tenant_id then 'tenant' else 'landlord' end as requested_by,
        rentlease_tenancy_extension.first_conflict(t,r.requested_start_date,t.start_date-1) as conflict,
        row_number() over(order by r.created_at,r.id) as n
       from rentlease_tenancy_movein.requests r join public.tenancies t on t.id=r.tenancy_id
       where r.status='pending' and me in(t.tenant_id,t.landlord_id) and r.requester_id<>me and rentlease_tenancy_movein.schedule_block(t,today) is null
        and r.requested_start_date>=today and r.requested_start_date<t.start_date
       order by r.created_at,r.id limit 51) p;
 return jsonb_build_object('rows',rows_json,'hasMore',more);
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Grants: authenticated only, never anon, PUBLIC or service_role. The private schema stays closed.
-- ---------------------------------------------------------------------------------------------------------------------------
revoke all on all functions in schema rentlease_tenancy_movein from public,anon,authenticated,service_role;
revoke all on function public.write_tenancy_move_in(uuid,uuid,text,jsonb),public.get_tenancy_move_in(uuid),public.get_pending_tenancy_move_ins() from public,anon,authenticated,service_role;
grant execute on function public.write_tenancy_move_in(uuid,uuid,text,jsonb),public.get_tenancy_move_in(uuid),public.get_pending_tenancy_move_ins() to authenticated;

-- Post-conditions: stop (and roll everything back) if the final state is not what was designed.
do $post$
declare f regprocedure;
begin
 foreach f in array array['public.write_tenancy_move_in(uuid,uuid,text,jsonb)'::regprocedure,'public.get_tenancy_move_in(uuid)'::regprocedure,'public.get_pending_tenancy_move_ins()'::regprocedure] loop
  if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'Move-in RPC grants are wrong: %',f;end if;
  if exists(select 1 from pg_proc p where p.oid=f and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres')) then raise exception 'Move-in RPC is not security definer with a fixed search_path: %',f;end if;
 end loop;
 if exists(select 1 from pg_proc p where p.pronamespace='rentlease_tenancy_movein'::regnamespace and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'Private move-in function is executable by a client role';end if;
 if has_schema_privilege('authenticated','rentlease_tenancy_movein','USAGE') or has_schema_privilege('anon','rentlease_tenancy_movein','USAGE')
  or has_table_privilege('authenticated','rentlease_tenancy_movein.requests','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','rentlease_tenancy_movein.requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Move-in tables or schema exposed';end if;
 if exists(select 1 from pg_tables where schemaname='rentlease_tenancy_movein' and not rowsecurity) then raise exception 'Move-in table without RLS';end if;
end$post$;
commit;
