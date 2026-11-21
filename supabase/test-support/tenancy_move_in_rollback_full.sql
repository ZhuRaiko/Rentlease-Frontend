-- Tenancy early move-in rollback, FULL REMOVAL. Only for a move-in feature that holds no evidence: it stops unless the requests, events
-- and receipts tables are all empty. If anything was recorded, use tenancy_move_in_rollback.sql instead (it retains the data).
-- Removes: the three public RPCs and the private schema (tables, triggers, helpers). Nothing else is touched: no existing function,
-- trigger, policy or tenancy row was changed by the migration, so nothing else needs restoring.
begin;
do $guard$
begin
 if to_regnamespace('rentlease_tenancy_movein') is not null then
  if exists(select 1 from rentlease_tenancy_movein.requests) then raise exception 'move-in requests exist; use tenancy_move_in_rollback.sql (data-retaining)';end if;
  if exists(select 1 from rentlease_tenancy_movein.events) then raise exception 'move-in events exist; use tenancy_move_in_rollback.sql (data-retaining)';end if;
  if exists(select 1 from rentlease_tenancy_movein.receipts) then raise exception 'move-in receipts exist; use tenancy_move_in_rollback.sql (data-retaining)';end if;
 end if;
end$guard$;
drop function if exists public.write_tenancy_move_in(uuid,uuid,text,jsonb);
drop function if exists public.get_tenancy_move_in(uuid);
drop function if exists public.get_pending_tenancy_move_ins();
drop schema if exists rentlease_tenancy_movein cascade;
commit;
