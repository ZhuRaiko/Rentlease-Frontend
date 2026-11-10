-- LOCAL ONLY; separately authorize any downgrade. Withdraw client and reconcile uncertain operations first.
-- Preserve actual tenancies, source bindings, accepted evidence and receipts. No destructive reversal.
begin;
revoke execute on function public.get_tenancy_establishment_links(uuid[]) from authenticated;
revoke execute on function public.get_tenancy_establishment(uuid),public.establish_tenancy(uuid,uuid,uuid,uuid,numeric,integer),public.respond_tenancy_establishment(uuid,uuid,uuid,uuid,uuid,text) from authenticated;
commit;
-- Re-enable only reviewed functions/grants, never replay CREATE SCHEMA or drop tenancies/history.
