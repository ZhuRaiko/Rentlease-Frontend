-- Tenancy extension rollback, FULL REMOVAL. Only for an extension feature that holds no evidence: it stops unless the requests, events
-- and receipts tables are all empty. If anything was recorded, use tenancy_extension_rollback.sql instead (it retains the data).
-- Removes: the three public RPCs and the private schema (tables, triggers, helpers). Nothing else is touched: no existing function,
-- trigger, policy or tenancy row was changed by the migration, so nothing else needs restoring.
begin;
do $guard$
begin
 if to_regnamespace('rentlease_tenancy_extension') is not null then
  if exists(select 1 from rentlease_tenancy_extension.requests) then raise exception 'extension requests exist; use tenancy_extension_rollback.sql (data-retaining)';end if;
  if exists(select 1 from rentlease_tenancy_extension.events) then raise exception 'extension events exist; use tenancy_extension_rollback.sql (data-retaining)';end if;
  if exists(select 1 from rentlease_tenancy_extension.receipts) then raise exception 'extension receipts exist; use tenancy_extension_rollback.sql (data-retaining)';end if;
 end if;
end$guard$;
drop function if exists public.write_tenancy_extension(uuid,uuid,text,jsonb);
drop function if exists public.get_tenancy_extension(uuid);
drop function if exists public.get_pending_tenancy_extensions();
drop schema if exists rentlease_tenancy_extension cascade;
commit;
