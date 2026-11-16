-- Rent ledger rollback, FULL REMOVAL. Only for a ledger that holds no evidence: it stops unless rent_obligations, the events table and the
-- receipts table are all empty. If anything was recorded, use rent_ledger_rollback.sql instead (it retains the data).
-- Removes: both public RPCs, the revision trigger, the status/timestamp constraint, the ledger_revision column and the private schema
-- (events, receipts, helpers). Nothing else is touched; chat messages already sent by clients stay (they are conversation history).
begin;
do $guard$
begin
 if to_regnamespace('rentlease_rent_ledger') is not null then
  if exists(select 1 from public.rent_obligations) then raise exception 'rent_obligations holds rows; use rent_ledger_rollback.sql (data-retaining)';end if;
  if exists(select 1 from rentlease_rent_ledger.events) then raise exception 'ledger events exist; use rent_ledger_rollback.sql (data-retaining)';end if;
  if exists(select 1 from rentlease_rent_ledger.receipts) then raise exception 'ledger receipts exist; use rent_ledger_rollback.sql (data-retaining)';end if;
 end if;
end$guard$;
drop function if exists public.get_rent_ledger(uuid,integer);
drop function if exists public.write_rent_ledger(uuid,uuid,text,date,uuid);
drop trigger if exists rent_ledger_revision on public.rent_obligations;
alter table public.rent_obligations drop constraint if exists rent_obligations_status_timestamps;
alter table public.rent_obligations drop column if exists ledger_revision;
drop schema if exists rentlease_rent_ledger cascade;
commit;
