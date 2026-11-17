-- PREPARED LOCAL ONLY. Tenancy extension ("stay longer"). NOT APPLIED. See docs/design/f1c-extension-backend-design.md.
-- A tenant of an ACTIVE tenancy asks to move the end date later; the owner accepts or declines; the end date moves only on accept.
-- Option A of the design: a separate private schema (rentlease_tenancy_extension) and its own RPCs. write_tenancy_lifecycle,
-- get_tenancy_lifecycle and rentlease_tenancy_end.* are NOT touched, so their pinned fingerprints stay valid. No existing function,
-- policy, grant or trigger is replaced or patched, so no anchor-replace patching is needed. No notifications are created (the
-- inapp_tenancy trigger returns early when status and confirmations are unchanged, which is the case for an end-date-only update).
-- Rollback: supabase/test-support/tenancy_extension_rollback.sql (entry points only, data retained) and
--           supabase/test-support/tenancy_extension_rollback_full.sql (only while every table is empty).
-- Checks:   supabase/test-support/tenancy_extension_checks.sql (ends in a deliberate exception; nothing can commit).
begin;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Baseline guards: stop unless the live objects this migration depends on are exactly what the design was written against.
-- ---------------------------------------------------------------------------------------------------------------------------
do $guard$
declare tcols int; rcols int; ecols int; tenum text; trg int;
begin
 if to_regclass('public.tenancies') is null or to_regclass('public.rental_reservations') is null or to_regclass('rentlease_tenancy_end.requests') is null then raise exception 'Required tables missing';end if;
 select count(*) into tcols from pg_attribute where attrelid='public.tenancies'::regclass and not attisdropped and attname=any(array['id','property_id','tenant_id','landlord_id','status','start_date','expected_end_date','actual_end_date','ended_at']);
 if tcols<>9 then raise exception 'tenancies columns drifted';end if;
 select count(*) into rcols from pg_attribute where attrelid='public.rental_reservations'::regclass and not attisdropped and attname=any(array['id','property_id','tenant_id','landlord_id','status','move_in_date','end_date','expires_at']);
 if rcols<>8 then raise exception 'rental_reservations columns drifted';end if;
 select count(*) into ecols from pg_attribute where attrelid='rentlease_tenancy_end.requests'::regclass and not attisdropped and attname=any(array['id','tenancy_id','status']);
 if ecols<>3 then raise exception 'early-end requests columns drifted';end if;
 select string_agg(e.enumlabel,',' order by e.enumsortorder) into tenum from pg_type t join pg_enum e on e.enumtypid=t.oid where t.oid='public.tenancy_status'::regtype;
 if tenum is distinct from 'proposed,pending_confirmation,active,ended,cancelled' then raise exception 'tenancy_status drifted: %',tenum;end if;
 if has_table_privilege('authenticated','public.tenancies','INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','public.tenancies','UPDATE') then raise exception 'Unexpected tenancy write grant';end if;
 if has_table_privilege('anon','public.rental_reservations','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.rental_reservations','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unexpected reservation grant';end if;
 -- The triggers an accept will fire on public.tenancies. An end-date-only update must pass all of them; the design relies on that.
 select count(*) into trg from pg_trigger where tgrelid='public.tenancies'::regclass and tgenabled='O' and not tgisinternal
  and tgname in('aaa_tenancy_property_gate','aab_tenancy_identity_gate','aac_reservation_tenancy_commitment','trg_sync_listing_from_tenancy','trg_tenancies_updated_at','trg_validate_tenancy','inapp_tenancy');
 if trg<>7 then raise exception 'tenancy triggers drifted (% of 7)',trg;end if;
 -- Functions this migration relies on, and does not replace. The hosted bodies of the three tenancy-lifecycle / ledger functions contain CR characters (they
 -- were applied from CRLF files), so they are compared with the CRs removed; the values are the verified hosted values with CRs stripped.
 -- guard_tenancy_commitment and is_tier1_verified have no CRs and are compared as stored.
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.is_tier1_verified(uuid)'))) is distinct from 'ddd2c8ed28b61e30e23e4f3ddefe4590' then raise exception 'is_tier1_verified drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.write_tenancy_lifecycle(uuid,uuid,text,text,uuid,text)')),chr(13),'')) is distinct from '312e8bdaee38ba3b762a55b1635b2c63' then raise exception 'write_tenancy_lifecycle drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_lifecycle(uuid,integer)')),chr(13),'')) is distinct from 'c0eacfc87a52d0731a2e0eab2b34baee' then raise exception 'get_tenancy_lifecycle drifted';end if;
 if md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_rent_ledger.due_dates(date,date,integer,date)')),chr(13),'')) is distinct from '8d82e44cbc7b94bf538608aefe1b48ce' then raise exception 'rent ledger due_dates drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('rentlease_reservations.guard_tenancy_commitment()'))) is distinct from '7f3420d0026e508c25b240f0bae7e96c' then raise exception 'guard_tenancy_commitment drifted';end if;
 -- Nothing of this feature may exist yet.
 if to_regnamespace('rentlease_tenancy_extension') is not null or to_regprocedure('public.write_tenancy_extension(uuid,uuid,text,jsonb)') is not null
  or to_regprocedure('public.get_tenancy_extension(uuid)') is not null or to_regprocedure('public.get_pending_tenancy_extensions()') is not null then raise exception 'Tenancy extension objects already exist';end if;
end$guard$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Private schema: no client role has any access. The three public RPCs below are the only entry points.
-- ---------------------------------------------------------------------------------------------------------------------------
create schema rentlease_tenancy_extension;
revoke all on schema rentlease_tenancy_extension from public,anon,authenticated,service_role;

create table rentlease_tenancy_extension.requests(
 id uuid primary key default gen_random_uuid(),
 tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 requester_id uuid not null,
 requested_end_date date not null,
 -- The tenancy's end date when the request was made. Accept refuses (40001) if the tenancy's end date is no longer this value.
 base_end_date date not null,
 request_note text check(request_note is null or length(request_note) between 1 and 1000),
 status text not null default 'pending' check(status in('pending','accepted','declined','withdrawn')),
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 decided_at timestamptz,decided_by uuid,
 decision_note text check(decision_note is null or length(decision_note) between 1 and 1000),
 check(requested_end_date>base_end_date),
 check((status='pending' and decided_at is null and decided_by is null and decision_note is null) or (status<>'pending' and decided_at is not null and decided_by is not null)));
-- One open request per tenancy (backstop: the property advisory lock already serializes writers).
create unique index one_pending_tenancy_extension on rentlease_tenancy_extension.requests(tenancy_id) where status='pending';
create index tenancy_extension_requests_tenancy on rentlease_tenancy_extension.requests(tenancy_id,created_at desc,id);
-- Immutable record of who did what and when. RESTRICT on both parents: a tenancy with extension history cannot be deleted.
create table rentlease_tenancy_extension.events(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references rentlease_tenancy_extension.requests(id) on delete restrict,
 tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 actor_id uuid not null,
 action text not null check(action in('request','accept','decline','withdraw')),
 from_status text,to_status text not null check(to_status in('pending','accepted','declined','withdrawn')),
 end_date date not null,note text,operation_id uuid not null,
 created_at timestamptz not null default clock_timestamp());
create index tenancy_extension_events_tenancy on rentlease_tenancy_extension.events(tenancy_id,created_at desc);
create table rentlease_tenancy_extension.receipts(
 actor_id uuid not null,operation_id uuid not null,input jsonb not null,result jsonb not null,
 created_at timestamptz not null default statement_timestamp(),primary key(actor_id,operation_id));
alter table rentlease_tenancy_extension.requests enable row level security;
alter table rentlease_tenancy_extension.events enable row level security;
alter table rentlease_tenancy_extension.receipts enable row level security;
revoke all on all tables in schema rentlease_tenancy_extension from public,anon,authenticated,service_role;

create function rentlease_tenancy_extension.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Extension evidence is immutable' using errcode='42501';end$$;
create trigger extension_events_immutable before update or delete on rentlease_tenancy_extension.events for each row execute function rentlease_tenancy_extension.immutable();
create trigger extension_receipts_immutable before update or delete on rentlease_tenancy_extension.receipts for each row execute function rentlease_tenancy_extension.immutable();
-- A request can only leave 'pending' once, never be deleted, and its original fields never change. Every update rotates the revision token.
create function rentlease_tenancy_extension.guard_request() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'Extension request cannot be deleted' using errcode='42501';end if;
 if old.status<>'pending' or new.status='pending'
  or (to_jsonb(new)-array['status','decided_at','decided_by','decision_note','revision']) is distinct from (to_jsonb(old)-array['status','decided_at','decided_by','decision_note','revision']) then
  raise exception 'Original extension request cannot be changed' using errcode='42501';end if;
 new.revision:=gen_random_uuid();return new;
end$$;
create trigger extension_request_guard before update or delete on rentlease_tenancy_extension.requests for each row execute function rentlease_tenancy_extension.guard_request();

-- ---------------------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------------------
-- Write entry: same rules and lock order as the T1/T3/T6 and ledger helpers (active Tier 1, participant only, property advisory lock,
-- then the tenancy row). FOR UPDATE because accept updates the tenancy.
create function rentlease_tenancy_extension.relationship(p_id uuid) returns public.tenancies
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
create function rentlease_tenancy_extension.participant(p_id uuid) returns public.tenancies
language plpgsql stable security definer set search_path=pg_catalog as $$
declare t public.tenancies;
begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select * into t from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id);
 if t.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 return t;
end$$;
-- The latest allowed end date: new_end = (current_end + 1 day) + 6 months - 1 day. The month rule the reservation end date uses.
create function rentlease_tenancy_extension.latest_end(p_current date) returns date
language sql immutable set search_path=pg_catalog as $$ select ((p_current+1)::timestamp+make_interval(months=>6))::date-1 $$;
-- A pending early-end request on the same tenancy (rentlease_tenancy_end.requests).
create function rentlease_tenancy_extension.early_end_pending(p_tenancy uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from rentlease_tenancy_end.requests r where r.tenancy_id=p_tenancy and r.status='pending') $$;
-- The first day in [p_from, p_to] that is already committed to someone else on the same property, or null. Committed means:
--  - an APPROVED, unexpired reservation by another party (a different tenant or landlord than this tenancy's). A reservation that is only
--    pending does not block: it holds nothing until the owner approves it, and approving it re-checks the tenancy (which then ends later), or
--  - another tenancy in proposed, pending_confirmation or active whose dates overlap (an open-ended one overlaps everything after its start).
-- Only the date leaves this function: no ids, names or amounts.
create function rentlease_tenancy_extension.first_conflict(t public.tenancies,p_from date,p_to date) returns date
language sql stable security definer set search_path=pg_catalog as $$
 select min(c.d) from (
  select greatest(r.move_in_date,p_from) as d from public.rental_reservations r
   where r.property_id=t.property_id and r.status='approved' and r.expires_at>clock_timestamp()
    and (r.tenant_id<>t.tenant_id or r.landlord_id<>t.landlord_id)
    and daterange(r.move_in_date,r.end_date,'[)')&&daterange(p_from,p_to+1,'[)')
  union all
  select greatest(x.start_date,p_from) from public.tenancies x
   where x.property_id=t.property_id and x.id<>t.id and x.status in('proposed','pending_confirmation','active')
    and daterange(x.start_date,coalesce(x.actual_end_date,x.expected_end_date)+1,'[)')&&daterange(p_from,p_to+1,'[)')
 ) c $$;
-- Why a tenant cannot ask now, or null when they can. Stable codes the client maps to words.
create function rentlease_tenancy_extension.request_block(t public.tenancies,p_me uuid,p_today date) returns text
language sql stable security definer set search_path=pg_catalog as $$
 select case
  when p_me is distinct from t.tenant_id then 'not_tenant'
  when t.status<>'active' then 'not_active'
  when t.actual_end_date is not null or t.expected_end_date is null then 'no_end_date'
  when p_today>t.expected_end_date then 'past_end_date'
  when rentlease_tenancy_extension.early_end_pending(t.id) then 'early_end_pending'
  when exists(select 1 from rentlease_tenancy_extension.requests r where r.tenancy_id=t.id and r.status='pending') then 'request_pending'
  else null end $$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- write_tenancy_extension: request (tenant), withdraw (tenant), accept (owner), decline (owner)
-- Errors the client maps:  42501 not allowed | 22023 extension_unavailable:<reason> / extension_date_invalid:<why> / invalid input
--                          23P01 extension_conflict:YYYY-MM-DD | 40001 changed, reload
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.write_tenancy_extension(p_tenancy_id uuid,p_operation_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; r rentlease_tenancy_extension.requests; cached rentlease_tenancy_extension.receipts;
 me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 input jsonb; result jsonb; cur date; req date; note text; rid uuid; rrev uuid; block text; conflict date; new_rev uuid; allowed text[]; uuid_re constant text:='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
 t:=rentlease_tenancy_extension.relationship(p_tenancy_id);
 if p_operation_id is null or p_action is null or p_action not in('request','accept','decline','withdraw') then raise exception 'Invalid operation' using errcode='22023';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid payload' using errcode='22023';end if;
 allowed:=case p_action when 'request' then array['requestedEndDate','note'] when 'decline' then array['requestId','revision','note'] when 'accept' then array['requestId','revision'] else array['requestId','revision'] end;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(allowed)) then raise exception 'Unexpected fields' using errcode='22023';end if;
 -- The optional note: absent or null means none; present means 1 to 1000 characters after trimming.
 if p_payload->'note' is not null and jsonb_typeof(p_payload->'note')<>'null' then
  if jsonb_typeof(p_payload->'note')<>'string' then raise exception 'Note must be text' using errcode='22023';end if;
  note:=btrim(p_payload->>'note');
  if length(note) not between 1 and 1000 then raise exception 'Note must be 1 to 1000 characters' using errcode='22023';end if;
 end if;
 if p_action='request' then
  if jsonb_typeof(p_payload->'requestedEndDate') is distinct from 'string' or p_payload->>'requestedEndDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'extension_date_invalid:missing' using errcode='22023';end if;
  begin req:=(p_payload->>'requestedEndDate')::date;exception when others then raise exception 'extension_date_invalid:malformed' using errcode='22023';end;
  input:=jsonb_build_object('tenancy',t.id,'action',p_action,'requestedEndDate',req,'note',note);
 else
  if jsonb_typeof(p_payload->'requestId') is distinct from 'string' or jsonb_typeof(p_payload->'revision') is distinct from 'string'
   or p_payload->>'requestId' !~ uuid_re or p_payload->>'revision' !~ uuid_re then raise exception 'Invalid operation' using errcode='22023';end if;
  rid:=(p_payload->>'requestId')::uuid;rrev:=(p_payload->>'revision')::uuid;
  input:=jsonb_build_object('tenancy',t.id,'action',p_action,'requestId',rid,'revision',rrev,'note',note);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text||p_operation_id::text,5));
 select * into cached from rentlease_tenancy_extension.receipts where actor_id=me and operation_id=p_operation_id;
 if found then
  if cached.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;
  return cached.result;
 end if;
 if p_action in('request','withdraw') and me is distinct from t.tenant_id then raise exception 'Tenant required' using errcode='42501';end if;
 if p_action in('accept','decline') and me is distinct from t.landlord_id then raise exception 'Owner required' using errcode='42501';end if;

 if p_action='request' then
  block:=rentlease_tenancy_extension.request_block(t,me,today);
  if block is not null then raise exception 'extension_unavailable:%',block using errcode='22023';end if;
  cur:=t.expected_end_date;
  if req<=cur then raise exception 'extension_date_invalid:not_after_end' using errcode='22023';end if;
  if req>rentlease_tenancy_extension.latest_end(cur) then raise exception 'extension_date_invalid:beyond_limit' using errcode='22023';end if;
  conflict:=rentlease_tenancy_extension.first_conflict(t,cur+1,req);
  if conflict is not null then raise exception 'extension_conflict:%',to_char(conflict,'YYYY-MM-DD') using errcode='23P01';end if;
  insert into rentlease_tenancy_extension.requests(tenancy_id,requester_id,requested_end_date,base_end_date,request_note) values(t.id,me,req,cur,note) returning * into r;
  insert into rentlease_tenancy_extension.events(request_id,tenancy_id,actor_id,action,from_status,to_status,end_date,note,operation_id) values(r.id,t.id,me,'request',null,'pending',req,note,p_operation_id);
  result:=jsonb_build_object('requestId',r.id,'status','pending','requestedEndDate',req,'currentEndDate',cur,'revision',r.revision);
 else
  select * into r from rentlease_tenancy_extension.requests where id=rid and tenancy_id=t.id for update;
  if r.id is null or r.status<>'pending' or r.revision is distinct from rrev then raise exception 'Extension request changed. Reload.' using errcode='40001';end if;
  if p_action='accept' then
   -- Everything is checked again: the tenancy, the dates, an early-end request and the calendar may all have changed since the request.
   if t.status<>'active' then raise exception 'extension_unavailable:not_active' using errcode='22023';end if;
   if t.actual_end_date is not null or t.expected_end_date is distinct from r.base_end_date then raise exception 'Tenancy changed. Reload.' using errcode='40001';end if;
   if today>t.expected_end_date then raise exception 'extension_unavailable:past_end_date' using errcode='22023';end if;
   if rentlease_tenancy_extension.early_end_pending(t.id) then raise exception 'extension_unavailable:early_end_pending' using errcode='22023';end if;
   conflict:=rentlease_tenancy_extension.first_conflict(t,t.expected_end_date+1,r.requested_end_date);
   if conflict is not null then raise exception 'extension_conflict:%',to_char(conflict,'YYYY-MM-DD') using errcode='23P01';end if;
   update public.tenancies set expected_end_date=r.requested_end_date where id=t.id;
   update rentlease_tenancy_extension.requests set status='accepted',decided_at=clock_timestamp(),decided_by=me where id=r.id returning revision into new_rev;
   insert into rentlease_tenancy_extension.events(request_id,tenancy_id,actor_id,action,from_status,to_status,end_date,note,operation_id) values(r.id,t.id,me,'accept','pending','accepted',r.requested_end_date,null,p_operation_id);
   result:=jsonb_build_object('requestId',r.id,'status','accepted','requestedEndDate',r.requested_end_date,'currentEndDate',r.requested_end_date,'revision',new_rev);
  elsif p_action='decline' then
   update rentlease_tenancy_extension.requests set status='declined',decided_at=clock_timestamp(),decided_by=me,decision_note=note where id=r.id returning revision into new_rev;
   insert into rentlease_tenancy_extension.events(request_id,tenancy_id,actor_id,action,from_status,to_status,end_date,note,operation_id) values(r.id,t.id,me,'decline','pending','declined',r.requested_end_date,note,p_operation_id);
   result:=jsonb_build_object('requestId',r.id,'status','declined','requestedEndDate',r.requested_end_date,'currentEndDate',coalesce(t.actual_end_date,t.expected_end_date),'revision',new_rev);
  else
   update rentlease_tenancy_extension.requests set status='withdrawn',decided_at=clock_timestamp(),decided_by=me where id=r.id returning revision into new_rev;
   insert into rentlease_tenancy_extension.events(request_id,tenancy_id,actor_id,action,from_status,to_status,end_date,note,operation_id) values(r.id,t.id,me,'withdraw','pending','withdrawn',r.requested_end_date,null,p_operation_id);
   result:=jsonb_build_object('requestId',r.id,'status','withdrawn','requestedEndDate',r.requested_end_date,'currentEndDate',coalesce(t.actual_end_date,t.expected_end_date),'revision',new_rev);
  end if;
 end if;
 insert into rentlease_tenancy_extension.receipts(actor_id,operation_id,input,result) values(me,p_operation_id,input,result);
 return result;
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- get_tenancy_extension: the pending request, else the latest finished one, plus what the caller can do. Roles, never user ids.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.get_tenancy_extension(p_tenancy_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare t public.tenancies; r rentlease_tenancy_extension.requests; me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 cur date; is_owner boolean; block text; conflict date; early boolean; can_accept boolean:=false; request_json jsonb;
begin
 t:=rentlease_tenancy_extension.participant(p_tenancy_id);
 is_owner:=me=t.landlord_id;cur:=coalesce(t.actual_end_date,t.expected_end_date);
 select * into r from rentlease_tenancy_extension.requests where tenancy_id=t.id order by (status='pending') desc,created_at desc,id desc limit 1;
 block:=rentlease_tenancy_extension.request_block(t,me,today);
 if r.id is not null and r.status='pending' and is_owner and cur is not null and r.requested_end_date>cur then
  conflict:=rentlease_tenancy_extension.first_conflict(t,cur+1,r.requested_end_date);
  early:=rentlease_tenancy_extension.early_end_pending(t.id);
  can_accept:=t.status='active' and today<=cur and t.expected_end_date is not distinct from r.base_end_date and not early and conflict is null;
 end if;
 if r.id is not null then
  request_json:=jsonb_build_object('id',r.id,'status',r.status,'requestedEndDate',r.requested_end_date,'baseEndDate',r.base_end_date,'note',r.request_note,
   'decisionNote',r.decision_note,'whoDecided',case when r.decided_by is null then null when r.decided_by=t.tenant_id then 'tenant' else 'landlord' end,
   'revision',r.revision,'createdAt',r.created_at,'decidedAt',r.decided_at,
   'conflictDate',case when is_owner and r.status='pending' then conflict else null end,
   'canAccept',can_accept,'canDecline',is_owner and r.status='pending','canWithdraw',me=t.tenant_id and r.status='pending');
 end if;
 return jsonb_build_object('tenancyId',t.id,'role',case when is_owner then 'landlord' else 'tenant' end,'currentEndDate',cur,
  'latestEndDate',case when cur is not null then rentlease_tenancy_extension.latest_end(cur) end,
  'canRequest',block is null,'cannotRequestReason',block,'request',request_json);
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- get_pending_tenancy_extensions: the signed-in owner's open requests (the "Needs your attention" feed). Oldest first, at most 50.
-- Only requests that can still matter: the tenancy is active and today is not past its end date.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.get_pending_tenancy_extensions() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; rows_json jsonb; more boolean;
begin
 if me is null or public.is_tier1_verified(me) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('tenancyId',p.tenancy_id,'propertyId',p.property_id,'requestId',p.rid,'requestedEndDate',p.requested_end_date,
   'currentEndDate',p.cur,'createdAt',p.created_at,'conflictDate',p.conflict) order by p.created_at,p.rid) filter(where p.n<=50),'[]'::jsonb),coalesce(max(p.n)>50,false)
  into rows_json,more
 from (select r.id as rid,r.tenancy_id,t.property_id,r.requested_end_date,coalesce(t.actual_end_date,t.expected_end_date) as cur,r.created_at,
        rentlease_tenancy_extension.first_conflict(t,coalesce(t.actual_end_date,t.expected_end_date)+1,r.requested_end_date) as conflict,
        row_number() over(order by r.created_at,r.id) as n
       from rentlease_tenancy_extension.requests r join public.tenancies t on t.id=r.tenancy_id
       where r.status='pending' and t.landlord_id=me and t.status='active' and today<=coalesce(t.actual_end_date,t.expected_end_date)
        and r.requested_end_date>coalesce(t.actual_end_date,t.expected_end_date)
       order by r.created_at,r.id limit 51) p;
 return jsonb_build_object('rows',rows_json,'hasMore',more);
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Grants: authenticated only, never anon, PUBLIC or service_role. The private schema stays closed.
-- ---------------------------------------------------------------------------------------------------------------------------
revoke all on all functions in schema rentlease_tenancy_extension from public,anon,authenticated,service_role;
revoke all on function public.write_tenancy_extension(uuid,uuid,text,jsonb),public.get_tenancy_extension(uuid),public.get_pending_tenancy_extensions() from public,anon,authenticated,service_role;
grant execute on function public.write_tenancy_extension(uuid,uuid,text,jsonb),public.get_tenancy_extension(uuid),public.get_pending_tenancy_extensions() to authenticated;

-- Post-conditions: stop (and roll everything back) if the final state is not what was designed.
do $post$
declare f regprocedure;
begin
 foreach f in array array['public.write_tenancy_extension(uuid,uuid,text,jsonb)'::regprocedure,'public.get_tenancy_extension(uuid)'::regprocedure,'public.get_pending_tenancy_extensions()'::regprocedure] loop
  if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'Extension RPC grants are wrong: %',f;end if;
  if exists(select 1 from pg_proc p where p.oid=f and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres')) then raise exception 'Extension RPC is not security definer with a fixed search_path: %',f;end if;
 end loop;
 if exists(select 1 from pg_proc p where p.pronamespace='rentlease_tenancy_extension'::regnamespace and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'Private extension function is executable by a client role';end if;
 if has_schema_privilege('authenticated','rentlease_tenancy_extension','USAGE') or has_schema_privilege('anon','rentlease_tenancy_extension','USAGE')
  or has_table_privilege('authenticated','rentlease_tenancy_extension.requests','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','rentlease_tenancy_extension.requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Extension tables or schema exposed';end if;
 if exists(select 1 from pg_tables where schemaname='rentlease_tenancy_extension' and not rowsecurity) then raise exception 'Extension table without RLS';end if;
end$post$;
commit;
