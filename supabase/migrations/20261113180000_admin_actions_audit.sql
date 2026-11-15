-- LOCAL ONLY. NOT APPLIED. Prepared 2026-11-13 for review; do not apply without explicit authorization, a fresh predeploy backup and live-source
-- reconfirmation. Apply directly (db query --linked -f), then `migration repair --status applied 20261113180000`; never db push.
--
-- Wires the Admin Actions and Audit tabs to real data. Additive only: nothing that is already applied is modified.
--   1. public.apply_admin_moderation_action(...)  suspend_account / restore_account / remove_listing, validated and idempotent.
--      It inserts into public.moderation_actions, so the EXISTING trigger trg_apply_moderation_action applies the effect and writes the audit row.
--   2. public.get_admin_restrictions()            currently restricted or suspended accounts (public display name only).
--   3. public.get_admin_audit_log(kind, offset)   paginated (25) read of public.admin_audit_logs with display fields resolved server-side.
--   4. Three additive AFTER triggers that write audit rows for Admin decisions the existing flows already make: verification status changes to
--      under_review/approved/rejected, report decisions (rentlease_reporting.events) and review moderation decisions (rentlease_reviews.events).
-- Not wired: "warn" and "restrict" (restrict behaves like suspend today), dismiss_report (reports are dismissed through moderate_rental_report),
-- and pause_listing. pause_listing is deliberately NOT offered: the live reactivate_listing lets the owner undo any paused listing, so an Admin
-- pause would not be enforceable. FUTURE WORK: a real pause needs a moderation-hold flag that reactivate_listing (and the other lifecycle RPCs)
-- respect; add pause_listing here only together with that change. (The existing trigger and enum still support it; this RPC rejects it.)
-- Report requirement: suspend_account and remove_listing REQUIRE p_report_id (the report must exist, not be conflicted for the calling Admin,
-- be upheld and match the target). restore_account may omit it.
--
-- Authorization: every new RPC is SECURITY DEFINER, owner postgres, search_path=pg_catalog, EXECUTE for authenticated only, and requires
-- public.is_active_admin(auth.uid()) (Admin role AND an active account) before reading or writing anything. authenticated keeps NO table
-- privileges on moderation_actions, admin_audit_logs or the new private receipts table; this migration asserts that and aborts otherwise.
--
-- Audit failure policy (deliberate): audit writes are STRICT and share the decision's transaction. If an audit insert fails, the decision
-- fails and rolls back with it (no effect, no moderation_actions row, no receipt). Why: an Admin decision that cannot be accounted for is worse
-- than a decision that visibly fails and can be retried. The existing trigger already behaves this way for moderation actions; the new triggers
-- and the RPC's own audit-row assertion extend the same rule. No trigger swallows errors, so there are no silent audit gaps. Cost: while
-- admin_audit_logs is unwritable, Admin decisions of these kinds fail (the app shows a plain "try again" message); a retry with the same
-- operation id is safe because the receipt rolled back too. Covered by the harness (supabase/tests/run_admin_actions_audit.py).
--
-- Locking and ordering (see also the lock-order note in the identity-tenancy gate migration, which uses the same property lock):
--   operation lock  : pg_advisory_xact_lock(hashtextextended('admin-action-op:'||actor||operation_id,0))   taken first; serializes retries.
--   then, by target : user action    -> pg_advisory_xact_lock(hashtextextended('admin-action-user:'||target_user,0)), then profiles ... FOR UPDATE
--                     listing action -> pg_advisory_xact_lock(hashtextextended(property_id::text,0)) (the per-property lock the identity, reservation
--                                       and tenancy guards already use), then listings ... FOR UPDATE, then the open-tenancy check.
--   An action touches either a user or a listing, never both, so the user lock and the property lock are never held together by this code.
--   Every state-dependent check runs AFTER the locks and the idempotent receipt lookup, so a retry returns the stored result even if the
--   target has since changed.
-- Guards: the existing trigger function apply_moderation_action is pinned by md5(prosrc), owner, security-definer flag and trigger state; the
-- Admin helpers and reporting/review objects this relies on must exist; every new object must be absent; client privileges are re-asserted.
-- Rollback: supabase/test-support/admin_actions_audit_rollback.sql (retains audit rows and non-empty receipts, never undoes applied actions).
begin;
set local lock_timeout='10s';

do $migration$
begin
 if to_regprocedure('public.is_active_admin(uuid)') is null or to_regprocedure('public.is_admin(uuid)') is null then raise exception 'Admin helpers are missing; apply 20261112155016_admin_reports_access first';end if;
 if to_regprocedure('rentlease_reporting.conflicted(uuid,uuid)') is null then raise exception 'rentlease_reporting.conflicted is missing';end if;
 if to_regclass('public.moderation_actions') is null or to_regclass('public.admin_audit_logs') is null or to_regclass('rentlease_reporting.events') is null or to_regclass('rentlease_reviews.events') is null or to_regclass('rentlease_reviews.entries') is null or to_regclass('public.verification_submissions') is null or to_regclass('public.tenancies') is null then raise exception 'Expected tables are missing';end if;
 -- The existing trigger function is relied on for the effect AND the audit row for suspend/restore/pause/remove. Any drift stops the migration.
 if to_regprocedure('public.apply_moderation_action()') is null then raise exception 'public.apply_moderation_action is missing';end if;
 if (select md5(prosrc) from pg_proc where oid='public.apply_moderation_action()'::regprocedure) is distinct from '311afeb3c10eef8dd2b1b5a965377f21' then raise exception 'public.apply_moderation_action source differs from the reviewed definition; review migration before proceeding';end if;
 if not (select prosecdef and pg_get_userbyid(proowner)='postgres' from pg_proc where oid='public.apply_moderation_action()'::regprocedure) then raise exception 'public.apply_moderation_action owner or security mode changed';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.moderation_actions'::regclass and tgname='trg_apply_moderation_action' and tgenabled='O' and not tgisinternal and tgfoid='public.apply_moderation_action()'::regprocedure) then raise exception 'trg_apply_moderation_action is missing or not enabled';end if;
 if (select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='moderation_action_type' and e.enumlabel in('suspend_account','restore_account','remove_listing'))<>3 then raise exception 'moderation_action_type is missing expected values';end if;
 -- Clients must have no direct access to the moderation tables, before and after this migration.
 if has_table_privilege('authenticated','public.moderation_actions','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','public.admin_audit_logs','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('anon','public.moderation_actions','select,insert,update,delete') or has_table_privilege('anon','public.admin_audit_logs','select,insert,update,delete') then raise exception 'Clients unexpectedly hold privileges on the moderation tables; review before proceeding';end if;
 if exists(select 1 from pg_namespace where nspname='rentlease_admin_actions') then raise exception 'Schema rentlease_admin_actions already exists; review migration before proceeding';end if;
 if exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in('apply_admin_moderation_action','get_admin_restrictions','get_admin_audit_log')) then raise exception 'An Admin actions function already exists; review migration before proceeding';end if;
 if exists(select 1 from pg_trigger where not tgisinternal and tgname in('audit_verification_decision','audit_report_decision','audit_review_decision')) then raise exception 'An Admin audit trigger already exists; review migration before proceeding';end if;
end$migration$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- Private idempotency receipts (same conventions as rentlease_reporting.receipts: private schema, RLS on, no client privileges, immutable).
create schema rentlease_admin_actions;
revoke all on schema rentlease_admin_actions from public,anon,authenticated,service_role;
create table rentlease_admin_actions.receipts(
 actor_id uuid not null,
 operation_id uuid not null,
 input jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_id,operation_id));
alter table rentlease_admin_actions.receipts enable row level security;
revoke all on all tables in schema rentlease_admin_actions from public,anon,authenticated,service_role;
create function rentlease_admin_actions.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'Admin action receipts are immutable' using errcode='42501';end$$;
create trigger receipts_immutable before update or delete on rentlease_admin_actions.receipts for each row execute function rentlease_admin_actions.immutable();

-- Pagination order for the Audit tab. Additive; the table is empty today.
create index idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc,id desc);

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 1. The action RPC.
create function public.apply_admin_moderation_action(
 p_operation_id uuid,p_action text,p_target_user_id uuid,p_target_listing_id uuid,p_report_id uuid,p_reason text,p_ends_at timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare
 a uuid:=auth.uid();
 reason text:=btrim(p_reason);
 ends text;input jsonb;res jsonb;mid uuid;new_status text;
 c rentlease_admin_actions.receipts;rep public.reports;prof public.profiles;l public.listings;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if a is null or public.is_active_admin(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 -- Static input shape first: nothing here depends on mutable state.
 if p_operation_id is null or p_action is null or p_action not in('suspend_account','restore_account','remove_listing') then raise exception 'Action not supported' using errcode='22023';end if;
 if reason is null or char_length(reason) not between 10 and 500 then raise exception 'Reason must be 10 to 500 characters' using errcode='22023';end if;
 if p_action in('suspend_account','restore_account') then
  if p_target_user_id is null or p_target_listing_id is not null then raise exception 'Choose exactly one target' using errcode='22023';end if;
 elsif p_target_listing_id is null or p_target_user_id is not null then raise exception 'Choose exactly one target' using errcode='22023';
 end if;
 if p_ends_at is not null and p_action<>'suspend_account' then raise exception 'End date applies only to suspensions' using errcode='22023';end if;
 if p_report_id is null and p_action in('suspend_account','remove_listing') then raise exception 'A report is required for this action' using errcode='22023';end if;
 -- Canonical UTC text so a retry from another session time zone is the same input.
 ends:=case when p_ends_at is null then null else to_char(p_ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end;
 input:=jsonb_build_object('action',p_action,'user',p_target_user_id,'listing',p_target_listing_id,'report',p_report_id,'reason',reason,'endsAt',ends);
 -- Operation lock first, then the receipt: an exact retry returns the stored result; a changed retry is refused.
 perform pg_advisory_xact_lock(hashtextextended('admin-action-op:'||a::text||p_operation_id::text,0));
 select * into c from rentlease_admin_actions.receipts where actor_id=a and operation_id=p_operation_id;
 if found then
  if c.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;
  return c.result;
 end if;
 -- State-dependent checks, all after the locks below.
 if p_ends_at is not null and p_ends_at<=statement_timestamp() then raise exception 'End date must be in the future' using errcode='22023';end if;
 if p_report_id is not null then
  select * into rep from public.reports where id=p_report_id;
  if not found then raise exception 'Report unavailable' using errcode='22023';end if;
  if rentlease_reporting.conflicted(p_report_id,a) then raise exception 'Access unavailable' using errcode='42501';end if;
  if rep.status<>'upheld' then raise exception 'Report must be upheld first' using errcode='22023';end if;
 end if;
 if p_action in('suspend_account','restore_account') then
  if p_target_user_id=a then raise exception 'Admins cannot take action on their own account' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('admin-action-user:'||p_target_user_id::text,0));
  select * into prof from public.profiles where id=p_target_user_id for update;
  if not found or prof.account_status='deleted' then raise exception 'Target unavailable' using errcode='22023';end if;
  if public.is_admin(p_target_user_id) is true then raise exception 'Admin accounts cannot be targeted' using errcode='22023';end if;
  if p_report_id is not null and p_target_user_id is distinct from rep.reported_user_id and p_target_user_id is distinct from (select ll.landlord_id from public.listings ll where ll.id=rep.reported_listing_id) then raise exception 'Report does not match the target' using errcode='22023';end if;
  if p_action='suspend_account' and prof.account_status<>'active' then raise exception 'Account is already restricted or suspended' using errcode='22023';end if;
  if p_action='restore_account' and prof.account_status not in('suspended','restricted') then raise exception 'Account is not suspended or restricted' using errcode='22023';end if;
 else
  select * into l from public.listings where id=p_target_listing_id;
  if not found then raise exception 'Target unavailable' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(l.property_id::text,0));
  select * into l from public.listings where id=p_target_listing_id for update;
  if not found then raise exception 'Target unavailable' using errcode='22023';end if;
  if l.landlord_id=a then raise exception 'Admins cannot take action on their own account' using errcode='22023';end if;
  if public.is_admin(l.landlord_id) is true then raise exception 'Admin accounts cannot be targeted' using errcode='22023';end if;
  if p_report_id is not null and p_target_listing_id is distinct from rep.reported_listing_id then raise exception 'Report does not match the target' using errcode='22023';end if;
  if p_action='remove_listing' then
   if l.status not in('active','paused') then raise exception 'Listing cannot be removed from its current status' using errcode='22023';end if;
   if exists(select 1 from public.tenancies t where (t.property_id=l.property_id or t.listing_id=l.id) and t.status in('proposed','pending_confirmation','active')) then raise exception 'Listing cannot be removed while a tenancy is open' using errcode='22023';end if;
  end if;
 end if;
 -- The existing trigger applies the effect and writes the audit row in this same transaction.
 insert into public.moderation_actions(report_id,admin_id,action_type,target_user_id,target_listing_id,reason,ends_at)
 values(p_report_id,a,p_action::public.moderation_action_type,p_target_user_id,p_target_listing_id,reason,p_ends_at) returning id into mid;
 new_status:=case when p_action in('suspend_account','restore_account') then (select account_status::text from public.profiles where id=p_target_user_id) else (select status::text from public.listings where id=p_target_listing_id) end;
 if new_status is distinct from (case p_action when 'suspend_account' then 'suspended' when 'restore_account' then 'active' else 'removed' end) then raise exception 'Action was not applied' using errcode='55000';end if;
 -- Defense in depth for the strict audit policy: refuse to keep a decision whose audit row is not there.
 if not exists(select 1 from public.admin_audit_logs g where g.admin_id=a and g.action=p_action and g.entity_id=coalesce(p_target_user_id,p_target_listing_id) and g.created_at>=transaction_timestamp()) then raise exception 'Audit entry was not written' using errcode='55000';end if;
 res:=jsonb_build_object('id',mid,'action',p_action,'status',new_status,'targetUserId',p_target_user_id,'targetListingId',p_target_listing_id,'reportId',p_report_id,'endsAt',ends);
 insert into rentlease_admin_actions.receipts(actor_id,operation_id,input,result) values(a,p_operation_id,input,res);
 return res;
end
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 2. Currently restricted or suspended accounts. Public nickname only (never the private/legal display_name); short id fallback.
create function public.get_admin_restrictions() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare a uuid:=auth.uid();
begin
 if a is null or public.is_active_admin(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 return jsonb_build_object(
  'count',(select count(*) from public.profiles p where p.account_status in('restricted','suspended')),
  'rows',coalesce((select jsonb_agg(x.j order by x.sort_at desc nulls last,x.id) from (
    select p.id,coalesce(m.created_at,p.updated_at) as sort_at,jsonb_build_object(
     'userId',p.id,
     'name',coalesce(case when p.public_nickname_confirmed_at is not null then nullif(btrim(p.public_nickname),'') end,'User '||left(p.id::text,8)),
     'status',p.account_status::text,
     'reason',p.suspension_reason,
     'endsAt',p.suspended_until,
     'startedAt',m.created_at,
     'ended',(p.suspended_until is not null and p.suspended_until<=statement_timestamp()),
     'restorable',public.is_admin(p.id) is not true) as j
    from public.profiles p
    left join lateral(select ma.created_at from public.moderation_actions ma where ma.target_user_id=p.id and ma.action_type in('restrict_account','suspend_account') order by ma.created_at desc limit 1) m on true
    where p.account_status in('restricted','suspended')
    order by coalesce(m.created_at,p.updated_at) desc nulls last,p.id limit 100) x),'[]'::jsonb));
end
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 3. Audit timeline. Display fields come from the audit row plus public-only names; raw metadata is never returned.
--    Rows about a report the calling Admin is conflicted on (see rentlease_reporting.conflicted) are excluded.
create function public.get_admin_audit_log(p_kind text default 'all',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare a uuid:=auth.uid();
begin
 if a is null or public.is_active_admin(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_kind is null or p_kind not in('all','verification','reports','actions','reviews') or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid audit filter' using errcode='22023';end if;
 return(
  with f as(
   select l.* from public.admin_audit_logs l where case p_kind
    when 'all' then true
    when 'verification' then starts_with(l.action,'verification_')
    when 'reports' then starts_with(l.action,'report_') or l.action='dismiss_report'
    when 'reviews' then starts_with(l.action,'review_')
    else l.action in('suspend_account','restore_account','pause_listing','remove_listing','restrict_account','warning') end
    -- An Admin who is a party to a report (conflicted) never sees that report's audit rows: neither its own events nor actions that carry it.
    -- Filtering inside f keeps 'count' and the pages consistent.
    and not (l.entity_type='report' and rentlease_reporting.conflicted(l.entity_id,a))
    and not (nullif(l.metadata->>'report_id','') is not null and rentlease_reporting.conflicted((l.metadata->>'report_id')::uuid,a))),
  page as(select * from f order by created_at desc,id desc limit 25 offset p_offset)
  select jsonb_build_object(
   'count',(select count(*) from f),
   'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'createdAt',g.created_at,'action',g.action,'entityType',g.entity_type,'entityId',g.entity_id,
      'actor',case when g.admin_id is null then 'System' else coalesce(case when ap.public_nickname_confirmed_at is not null then nullif(btrim(ap.public_nickname),'') end,'Admin '||left(g.admin_id::text,8)) end,
      'subject',case g.entity_type
        when 'user' then coalesce(case when su.public_nickname_confirmed_at is not null then nullif(btrim(su.public_nickname),'') end,'User '||left(g.entity_id::text,8))
        when 'listing' then coalesce(nullif(btrim(sl.title),''),'Listing '||left(g.entity_id::text,8))
        else null end,
      'reportReason',sr.reason::text,
      'reason',nullif(g.metadata->>'reason',''),
      'status',g.metadata->>'status','previousStatus',g.metadata->>'previous_status','tier',g.metadata->>'tier','kind',g.metadata->>'kind',
      'endsAt',g.metadata->>'ends_at','reportId',g.metadata->>'report_id') order by g.created_at desc,g.id desc)
     from page g
     left join public.profiles ap on ap.id=g.admin_id
     left join public.profiles su on g.entity_type='user' and su.id=g.entity_id
     left join public.listings sl on g.entity_type='listing' and sl.id=g.entity_id
     left join public.reports sr on g.entity_type='report' and sr.id=g.entity_id),'[]'::jsonb)));
end
$fn$;

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- 4. Additive audit triggers. AFTER, SECURITY DEFINER, strict (no exception handler): an audit failure fails the decision. They record entity,
-- status and the Admin's own reason or note only: no document names, file paths, user names or contact details.
-- A decision is only audited when made by an Admin: a user cancelling their own submission or a reporter's own event is not an Admin decision.
create function rentlease_admin_actions.audit_verification_decision() returns trigger language plpgsql security definer set search_path=pg_catalog as $fn$
declare a uuid:=auth.uid();
begin
 if a is null or public.is_admin(a) is not true then return null;end if;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values(a,'verification_'||new.status::text,'verification_submission',new.id,
  jsonb_build_object('status',new.status::text,'previous_status',old.status::text,'tier',new.tier::text,'reason',left(coalesce(nullif(btrim(new.rejection_reason),''),nullif(btrim(new.review_note),'')),1000)));
 return null;
end
$fn$;
create trigger audit_verification_decision after update of status on public.verification_submissions for each row
 when (old.status is distinct from new.status and new.status in('under_review','approved','rejected'))
 execute function rentlease_admin_actions.audit_verification_decision();

create function rentlease_admin_actions.audit_report_decision() returns trigger language plpgsql security definer set search_path=pg_catalog as $fn$
begin
 if new.actor_id is null or public.is_admin(new.actor_id) is not true then return null;end if;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values(new.actor_id,'report_'||new.status,'report',new.report_id,
  jsonb_build_object('status',new.status,'kind',(select c.kind from rentlease_reporting.cases c where c.report_id=new.report_id),'reason',left(new.note,1000)));
 return null;
end
$fn$;
create trigger audit_report_decision after insert on rentlease_reporting.events for each row
 when (new.status<>'submitted')
 execute function rentlease_admin_actions.audit_report_decision();

create function rentlease_admin_actions.audit_review_decision() returns trigger language plpgsql security definer set search_path=pg_catalog as $fn$
begin
 if new.actor_id is null or public.is_admin(new.actor_id) is not true then return null;end if;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values(new.actor_id,'review_'||new.action,'review',new.review_id,
  jsonb_build_object('status',new.action,'kind',(select e.kind from rentlease_reviews.entries e where e.id=new.review_id),'reason',left(new.note,1000)));
 return null;
end
$fn$;
create trigger audit_review_decision after insert on rentlease_reviews.events for each row
 when (new.action in('approved','rejected','hidden'))
 execute function rentlease_admin_actions.audit_review_decision();

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- Ownership and grants: clients may EXECUTE only the three RPCs; nothing else is reachable by them.
alter function public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz) owner to postgres;
alter function public.get_admin_restrictions() owner to postgres;
alter function public.get_admin_audit_log(text,integer) owner to postgres;
revoke all on function public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz),public.get_admin_restrictions(),public.get_admin_audit_log(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz),public.get_admin_restrictions(),public.get_admin_audit_log(text,integer) to authenticated;
revoke all on all functions in schema rentlease_admin_actions from public,anon,authenticated,service_role;

-- Final self-check: any deviation raises and rolls the whole migration back.
do $migration$
declare rpc regprocedure[]:=array['public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)'::regprocedure,'public.get_admin_restrictions()'::regprocedure,'public.get_admin_audit_log(text,integer)'::regprocedure];
begin
 if not (select every(p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and p.proconfig=array['search_path=pg_catalog']) from pg_proc p where p.oid=any(rpc) or (p.pronamespace='rentlease_admin_actions'::regnamespace and p.prorettype='trigger'::regtype and p.proname<>'immutable')) then raise exception 'New functions must be security definer, owned by postgres, with search_path=pg_catalog';end if;
 if (select count(*) from pg_proc p where p.oid=any(rpc) and has_function_privilege('authenticated',p.oid,'execute') and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('service_role',p.oid,'execute'))<>3 then raise exception 'The RPCs must be executable by authenticated only';end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where p.oid=any(rpc) and x.grantee not in(p.proowner,'authenticated'::regrole)) then raise exception 'Unexpected grantee on an Admin RPC';end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where p.pronamespace='rentlease_admin_actions'::regnamespace and x.grantee<>p.proowner) then raise exception 'Private Admin functions must not be executable by clients';end if;
 if has_table_privilege('authenticated','public.moderation_actions','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','public.admin_audit_logs','select,insert,update,delete,truncate,references,trigger') or has_table_privilege('authenticated','rentlease_admin_actions.receipts','select,insert,update,delete,truncate,references,trigger') or has_schema_privilege('authenticated','rentlease_admin_actions','usage') then raise exception 'Clients must not hold privileges on the moderation, audit or receipt tables';end if;
 if (select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and tgname in('audit_verification_decision','audit_report_decision','audit_review_decision','receipts_immutable'))<>4 then raise exception 'Audit triggers are missing or not enabled';end if;
 if (select md5(prosrc) from pg_proc where oid='public.apply_moderation_action()'::regprocedure) is distinct from '311afeb3c10eef8dd2b1b5a965377f21' then raise exception 'public.apply_moderation_action changed during migration';end if;
end$migration$;
commit;
