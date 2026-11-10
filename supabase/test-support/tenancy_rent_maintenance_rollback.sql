-- Data-retaining rollback guidance: withdraw T3/T4 client first; reconcile pending receipts.
-- Apply only as a separately reviewed compensating migration after verifying deployed signatures.
-- Does not remove requests, history, reminders, receipts, category or care_revision.
-- No data-loss rollback or migration history repair is provided.
begin;
revoke execute on function public.get_tenancy_care(uuid,integer),public.get_tenancy_maintenance_history(uuid,integer),public.write_tenancy_care(uuid,uuid,text,jsonb) from authenticated;
commit;
