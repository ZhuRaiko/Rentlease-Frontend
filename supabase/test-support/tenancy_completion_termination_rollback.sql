-- Separately authorized compensating migration only. Withdraw client, reconcile pending actions first.
-- Retain original terms, ended records, all requests/events/receipts and existing listing archival.
-- No destructive rollback or automatic reactivation; hosted recovery remains untested.
begin;
revoke execute on function public.get_tenancy_lifecycle(uuid,integer),public.write_tenancy_lifecycle(uuid,uuid,text,text,uuid,text) from authenticated;
commit;
