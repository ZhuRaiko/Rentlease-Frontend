-- Tenancy extension rollback, DATA-RETAINING. Withdraws only the three client entry points. The private schema
-- rentlease_tenancy_extension (requests, events, receipts, helpers) and every row stay, so no request or decision is lost. Use this first.
-- Accepted requests have already moved tenancies.expected_end_date; that is tenancy data and is NOT undone here. The events table
-- records each accept with the date it set, so an owner-approved reversal can be done by hand from it.
-- Frontend must be withdrawn or must tolerate the RPCs being absent before running this.
-- Expected md5(prosrc) of the dropped functions, computed from the migration file (not read from a database):
--   write_tenancy_extension           60f187a9a9489c0e26a15b46ec89e3cd
--   get_tenancy_extension             a3733c90e3c08ba79340c2c278b64714
--   get_pending_tenancy_extensions    b79b8191fe9e5935faf2d9aff9b900c3
begin;
revoke all on function public.write_tenancy_extension(uuid,uuid,text,jsonb),public.get_tenancy_extension(uuid),public.get_pending_tenancy_extensions() from public,anon,authenticated,service_role;
drop function public.write_tenancy_extension(uuid,uuid,text,jsonb);
drop function public.get_tenancy_extension(uuid);
drop function public.get_pending_tenancy_extensions();
commit;
