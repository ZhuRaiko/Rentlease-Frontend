-- PREPARED LOCAL ONLY. Feature 3 rent ledger. Not applied. See docs/design/f3-rent-ledger-backend-design.md.
-- The ledger records what each person says; it does not move money. Month rows are virtual (computed from the tenancy) and a
-- public.rent_obligations row is inserted only when someone acts on that month. No chat, no notifications and no scheduler: the
-- dispute chat message is sent by the client after write_rent_ledger('dispute') succeeds, and upcoming/due/past_due are derived at read time.
-- No existing function, policy, grant or trigger is replaced or patched, so no anchor-replace patching is needed.
-- Rollback: supabase/test-support/rent_ledger_rollback.sql (entry points only, data retained) and rent_ledger_rollback_full.sql (empty tables only).
begin;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Baseline guards: stop unless the live objects this migration depends on are exactly what the design was written against.
-- ---------------------------------------------------------------------------------------------------------------------------
do $guard$
declare cols text; notnulls text; cons text; pols text; trg text; enum_labels text; tcols int; tenum text;
begin
 if to_regclass('public.rent_obligations') is null or to_regclass('public.tenancies') is null then raise exception 'Required tables missing';end if;
 select string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod),',' order by a.attnum) into cols
  from pg_attribute a where a.attrelid='public.rent_obligations'::regclass and a.attnum>0 and not a.attisdropped;
 if cols is distinct from 'id:uuid,tenancy_id:uuid,due_date:date,amount_due:numeric(12,2),status:rent_obligation_status,tenant_marked_paid_at:timestamp with time zone,landlord_acknowledged_at:timestamp with time zone,note:text,reminder_sent_at:timestamp with time zone,overdue_notified_at:timestamp with time zone,created_at:timestamp with time zone,updated_at:timestamp with time zone' then
  raise exception 'rent_obligations columns drifted: %',cols;end if;
 select string_agg(a.attname,',' order by a.attnum) into notnulls from pg_attribute a where a.attrelid='public.rent_obligations'::regclass and a.attnum>0 and not a.attisdropped and a.attnotnull;
 if notnulls is distinct from 'id,tenancy_id,due_date,amount_due,status,created_at,updated_at' then raise exception 'rent_obligations nullability drifted: %',notnulls;end if;
 select string_agg(e.enumlabel,',' order by e.enumsortorder) into enum_labels from pg_type t join pg_enum e on e.enumtypid=t.oid where t.oid='public.rent_obligation_status'::regtype;
 if enum_labels is distinct from 'upcoming,due,overdue,tenant_marked_paid,landlord_acknowledged,waived,disputed' then raise exception 'rent_obligation_status drifted: %',enum_labels;end if;
 select string_agg(conname||'='||pg_get_constraintdef(oid),'|' order by conname) into cons from pg_constraint where conrelid='public.rent_obligations'::regclass;
 if cons is distinct from 'rent_obligations_amount_due_check=CHECK ((amount_due > (0)::numeric))|rent_obligations_pkey=PRIMARY KEY (id)|rent_obligations_tenancy_id_due_date_key=UNIQUE (tenancy_id, due_date)|rent_obligations_tenancy_id_fkey=FOREIGN KEY (tenancy_id) REFERENCES tenancies(id) ON DELETE CASCADE' then
  raise exception 'rent_obligations constraints drifted: %',cons;end if;
 if not (select relrowsecurity from pg_class where oid='public.rent_obligations'::regclass) then raise exception 'rent_obligations RLS drift';end if;
 select string_agg(policyname,',' order by policyname) into pols from pg_policies where schemaname='public' and tablename='rent_obligations';
 if pols is distinct from 'rent_obligations_admin_manage,rent_obligations_read_parties_admin' then raise exception 'rent_obligations policies drifted: %',pols;end if;
 select string_agg(tgname,',' order by tgname) into trg from pg_trigger where tgrelid='public.rent_obligations'::regclass and not tgisinternal;
 if trg is distinct from 'trg_rent_obligations_updated_at' then raise exception 'rent_obligations triggers drifted: %',trg;end if;
 -- No client role may reach the table directly; every client path is a security-definer RPC.
 if has_table_privilege('anon','public.rent_obligations','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.rent_obligations','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role','public.rent_obligations','SELECT,INSERT,UPDATE,DELETE')
  or has_any_column_privilege('anon','public.rent_obligations','SELECT,INSERT,UPDATE') or has_any_column_privilege('authenticated','public.rent_obligations','SELECT,INSERT,UPDATE') then
  raise exception 'Unexpected rent_obligations grant';end if;
 if exists(select 1 from public.rent_obligations) then raise exception 'rent_obligations is no longer empty; review before deploying';end if;
 -- Tenancy columns the schedule is computed from, and the tenancy status labels the write gate uses.
 select count(*) into tcols from pg_attribute where attrelid='public.tenancies'::regclass and not attisdropped and attname=any(array['id','property_id','tenant_id','landlord_id','status','start_date','expected_end_date','actual_end_date','agreed_monthly_rent','rent_due_day']);
 if tcols<>10 then raise exception 'tenancies columns drifted';end if;
 select string_agg(e.enumlabel,',' order by e.enumsortorder) into tenum from pg_type t join pg_enum e on e.enumtypid=t.oid where t.oid='public.tenancy_status'::regtype;
 if tenum is distinct from 'proposed,pending_confirmation,active,ended,cancelled' then raise exception 'tenancy_status drifted: %',tenum;end if;
 if has_table_privilege('authenticated','public.tenancies','INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated','public.tenancies','UPDATE') then raise exception 'Unexpected tenancy write grant';end if;
 -- Functions this migration calls or sits beside. Neither is replaced.
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.is_tier1_verified(uuid)'))) is distinct from 'ddd2c8ed28b61e30e23e4f3ddefe4590' then raise exception 'is_tier1_verified drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_care(uuid,integer)'))) is distinct from '624c3bf0ce0f129f504c674330466c72' then raise exception 'get_tenancy_care drifted';end if;
 -- Nothing of this feature may exist yet.
 if to_regnamespace('rentlease_rent_ledger') is not null or to_regprocedure('public.get_rent_ledger(uuid,integer)') is not null or to_regprocedure('public.write_rent_ledger(uuid,uuid,text,date,uuid)') is not null
  or exists(select 1 from pg_attribute where attrelid='public.rent_obligations'::regclass and attname='ledger_revision' and not attisdropped) then raise exception 'Rent ledger objects already exist';end if;
end$guard$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Private schema: no client role has any access. Public RPCs below are the only entry points.
-- ---------------------------------------------------------------------------------------------------------------------------
create schema rentlease_rent_ledger;
revoke all on schema rentlease_rent_ledger from public,anon,authenticated,service_role;

-- Optimistic-concurrency token, rotated on every update (including privileged paths), same pattern as care_revision. Table is empty.
alter table public.rent_obligations add column ledger_revision uuid not null default gen_random_uuid();
-- A paid or acknowledged status must carry its timestamp. Empty table, so no NOT VALID is needed.
alter table public.rent_obligations add constraint rent_obligations_status_timestamps check(
 (status<>'tenant_marked_paid' or tenant_marked_paid_at is not null) and (status<>'landlord_acknowledged' or landlord_acknowledged_at is not null));
create function rentlease_rent_ledger.rotate_revision() returns trigger language plpgsql set search_path=pg_catalog as $$
begin new.ledger_revision:=gen_random_uuid();return new;end$$;
create trigger rent_ledger_revision before update on public.rent_obligations for each row execute function rentlease_rent_ledger.rotate_revision();

create table rentlease_rent_ledger.receipts(
 actor_id uuid not null,operation_id uuid not null,input jsonb not null,result jsonb not null,
 created_at timestamptz not null default statement_timestamp(),primary key(actor_id,operation_id));
-- Immutable record of who said what and when. RESTRICT on both parents: a tenancy with ledger history cannot be deleted.
create table rentlease_rent_ledger.events(
 id uuid primary key default gen_random_uuid(),
 obligation_id uuid not null references public.rent_obligations(id) on delete restrict,
 tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 actor_id uuid not null,
 action text not null check(action in('mark_paid','acknowledge','dispute')),
 from_status text not null,
 to_status public.rent_obligation_status not null,
 operation_id uuid not null,
 -- clock_timestamp, not statement_timestamp: two statements in one transaction must still order strictly.
 created_at timestamptz not null default clock_timestamp());
create index rent_ledger_events_tenancy on rentlease_rent_ledger.events(tenancy_id,created_at desc);
alter table rentlease_rent_ledger.receipts enable row level security;
alter table rentlease_rent_ledger.events enable row level security;
revoke all on all tables in schema rentlease_rent_ledger from public,anon,authenticated,service_role;
create function rentlease_rent_ledger.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Rent ledger evidence is immutable' using errcode='42501';end$$;
create trigger rent_ledger_receipts_immutable before update or delete on rentlease_rent_ledger.receipts for each row execute function rentlease_rent_ledger.immutable();
create trigger rent_ledger_events_immutable before update or delete on rentlease_rent_ledger.events for each row execute function rentlease_rent_ledger.immutable();

-- Same entry rules and lock order as the T1/T3/T6 relationship helpers: active Tier 1, participant only, property advisory lock, then the tenancy row.
create function rentlease_rent_ledger.relationship(p_id uuid) returns public.tenancies
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; target uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 select property_id into target from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id);
 if target is null then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into t from public.tenancies where id=p_id and auth.uid() in(tenant_id,landlord_id) for share;
 if t.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
 return t;
end$$;

-- The ledger's month set: every scheduled due date from the start through the horizon (the first due date after today), never past the end.
create function rentlease_rent_ledger.due_dates(p_start date,p_end date,p_day integer,p_today date)
returns table(due_date date) language sql immutable set search_path=pg_catalog as $$
 with candidates as (
  select (date_trunc('month',p_start::timestamp)+make_interval(months=>i)+make_interval(days=>p_day-1))::date as d
  from generate_series(0,719) i where p_day between 1 and 28
 ), scheduled as (
  select d from candidates where d>=p_start and (p_end is null or d<=p_end)
 )
 select d from scheduled where d<=coalesce((select min(d) from scheduled where d>p_today),'infinity'::date)
$$;

-- upcoming / due / past_due are never stored by the RPCs: they are derived from the dates. Stored paid, confirmed, disputed and waived pass through.
create function rentlease_rent_ledger.display_status(p_stored public.rent_obligation_status,p_due date,p_today date)
returns text language sql immutable set search_path=pg_catalog as $$
 select case
  when p_stored is not null and p_stored::text not in('upcoming','due','overdue') then p_stored::text
  when p_today>p_due then 'past_due'
  when p_today>=p_due-3 then 'due'
  else 'upcoming' end
$$;

create function public.get_rent_ledger(p_tenancy_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 rows_json jsonb; more boolean; waiting jsonb; usable boolean;
begin
 t:=rentlease_rent_ledger.relationship(p_tenancy_id);
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 usable:=t.status in('active','ended');
 with sched as (
   select d.due_date from rentlease_rent_ledger.due_dates(t.start_date,coalesce(t.actual_end_date,t.expected_end_date),t.rent_due_day,today) d where usable
 ), joined as (
   select s.due_date,o.status as stored,o.amount_due,o.ledger_revision,o.tenant_marked_paid_at,o.landlord_acknowledged_at,o.updated_at,
    rentlease_rent_ledger.display_status(o.status,s.due_date,today) as shown
   from sched s left join public.rent_obligations o on o.tenancy_id=t.id and o.due_date=s.due_date
 )
 select
  (select coalesce(jsonb_agg(x.item order by x.due_date desc),'[]'::jsonb) from (
    select j.due_date,jsonb_build_object('dueDate',j.due_date,'amount',coalesce(j.amount_due,t.agreed_monthly_rent),'storedStatus',j.stored,'displayStatus',j.shown,
     'revision',j.ledger_revision,'tenantMarkedPaidAt',j.tenant_marked_paid_at,'landlordAcknowledgedAt',j.landlord_acknowledged_at,
     'changedAt',case when j.stored is null then null else j.updated_at end,
     'canMarkPaid',me=t.tenant_id and j.shown in('upcoming','due','past_due','disputed'),
     'canAcknowledge',me=t.landlord_id and j.shown in('upcoming','due','past_due','tenant_marked_paid','disputed'),
     'canDispute',me=t.landlord_id and j.shown='tenant_marked_paid') as item
    from joined j order by j.due_date desc limit 12 offset p_offset) x),
  exists(select 1 from joined order by due_date desc limit 1 offset p_offset+12),
  (select jsonb_build_object('dueDate',w.due_date,'revision',w.ledger_revision) from joined w where me=t.landlord_id and w.shown='tenant_marked_paid' order by w.due_date desc limit 1)
 into rows_json,more,waiting;
 return jsonb_build_object('tenancyId',t.id,'tenantId',t.tenant_id,'landlordId',t.landlord_id,'status',t.status,'today',today,
  'monthlyRent',t.agreed_monthly_rent,'dueDay',t.rent_due_day,'rows',rows_json,'hasMore',more,'awaiting',waiting);
end$$;

create function public.write_rent_ledger(p_tenancy_id uuid,p_operation_id uuid,p_action text,p_due_date date,p_revision uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies; o public.rent_obligations; cached rentlease_rent_ledger.receipts; result jsonb; input jsonb;
 me uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 shown text; target public.rent_obligation_status; created integer; new_rev uuid;
begin
 t:=rentlease_rent_ledger.relationship(p_tenancy_id);
 if p_operation_id is null or p_action is null or p_due_date is null then raise exception 'Invalid operation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text||p_operation_id::text,1));
 input:=jsonb_build_object('tenancy',t.id,'action',p_action,'due_date',p_due_date,'revision',p_revision);
 select * into cached from rentlease_rent_ledger.receipts where actor_id=me and operation_id=p_operation_id;
 if found then
  if cached.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;
  return cached.result;
 end if;
 -- waive is reserved: rejected in this version.
 if p_action not in('mark_paid','acknowledge','dispute') then raise exception 'Action unavailable' using errcode='22023';end if;
 if t.status not in('active','ended') then raise exception 'Rent ledger unavailable' using errcode='42501';end if;
 if p_action='mark_paid' and me is distinct from t.tenant_id then raise exception 'Tenant required' using errcode='42501';end if;
 if p_action in('acknowledge','dispute') and me is distinct from t.landlord_id then raise exception 'Landlord required' using errcode='42501';end if;
 if not exists(select 1 from rentlease_rent_ledger.due_dates(t.start_date,coalesce(t.actual_end_date,t.expected_end_date),t.rent_due_day,today) d where d.due_date=p_due_date) then
  raise exception 'Rent date unavailable' using errcode='22023';end if;
 -- The row is created only for a refused-free action: any later exception rolls this insert back with the whole call.
 insert into public.rent_obligations(tenancy_id,due_date,amount_due,status) values(t.id,p_due_date,t.agreed_monthly_rent,'upcoming') on conflict(tenancy_id,due_date) do nothing;
 get diagnostics created=row_count;
 select * into o from public.rent_obligations where tenancy_id=t.id and due_date=p_due_date for update;
 if created=1 then
  if p_revision is not null then raise exception 'Rent record changed. Reload.' using errcode='40001';end if;
 elsif p_revision is distinct from o.ledger_revision then raise exception 'Rent record changed. Reload.' using errcode='40001';end if;
 shown:=rentlease_rent_ledger.display_status(o.status,o.due_date,today);
 if shown in('landlord_acknowledged','waived') then raise exception 'Already confirmed' using errcode='22023';end if;
 if p_action='mark_paid' then
  if shown not in('upcoming','due','past_due','disputed') then raise exception 'Transition unavailable' using errcode='22023';end if;
  target:='tenant_marked_paid';
  update public.rent_obligations set status=target,tenant_marked_paid_at=statement_timestamp(),landlord_acknowledged_at=null where id=o.id returning ledger_revision into new_rev;
 elsif p_action='acknowledge' then
  target:='landlord_acknowledged';
  update public.rent_obligations set status=target,landlord_acknowledged_at=statement_timestamp() where id=o.id returning ledger_revision into new_rev;
 else
  if shown<>'tenant_marked_paid' then raise exception 'Transition unavailable' using errcode='22023';end if;
  target:='disputed';
  update public.rent_obligations set status=target where id=o.id returning ledger_revision into new_rev;
 end if;
 insert into rentlease_rent_ledger.events(obligation_id,tenancy_id,actor_id,action,from_status,to_status,operation_id) values(o.id,t.id,me,p_action,shown,target,p_operation_id);
 result:=jsonb_build_object('dueDate',p_due_date,'status',target,'revision',new_rev);
 insert into rentlease_rent_ledger.receipts(actor_id,operation_id,input,result) values(me,p_operation_id,input,result);
 return result;
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Grants: authenticated only, never anon. Private schema stays closed.
-- ---------------------------------------------------------------------------------------------------------------------------
revoke all on all functions in schema rentlease_rent_ledger from public,anon,authenticated,service_role;
revoke all on function public.get_rent_ledger(uuid,integer),public.write_rent_ledger(uuid,uuid,text,date,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_rent_ledger(uuid,integer),public.write_rent_ledger(uuid,uuid,text,date,uuid) to authenticated;

-- Post-conditions: stop (and roll everything back) if the final state is not what was designed.
do $post$
begin
 if has_function_privilege('anon','public.get_rent_ledger(uuid,integer)','EXECUTE') or has_function_privilege('anon','public.write_rent_ledger(uuid,uuid,text,date,uuid)','EXECUTE')
  or has_function_privilege('service_role','public.get_rent_ledger(uuid,integer)','EXECUTE') or has_function_privilege('service_role','public.write_rent_ledger(uuid,uuid,text,date,uuid)','EXECUTE') then raise exception 'Rent ledger RPC executable by a non-authenticated role';end if;
 if not has_function_privilege('authenticated','public.get_rent_ledger(uuid,integer)','EXECUTE') or not has_function_privilege('authenticated','public.write_rent_ledger(uuid,uuid,text,date,uuid)','EXECUTE') then raise exception 'Rent ledger RPC not executable by authenticated';end if;
 if exists(select 1 from pg_proc p where p.pronamespace='rentlease_rent_ledger'::regnamespace and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'Private rent ledger function exposed';end if;
 if exists(select 1 from pg_proc p where p.oid in('public.get_rent_ledger(uuid,integer)'::regprocedure,'public.write_rent_ledger(uuid,uuid,text,date,uuid)'::regprocedure) and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres')) then raise exception 'Rent ledger RPC definition drifted';end if;
 if has_table_privilege('anon','public.rent_obligations','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.rent_obligations','SELECT,INSERT,UPDATE,DELETE')
  or has_schema_privilege('authenticated','rentlease_rent_ledger','USAGE') or has_schema_privilege('anon','rentlease_rent_ledger','USAGE') then raise exception 'Rent ledger table or schema exposed';end if;
end$post$;
commit;
