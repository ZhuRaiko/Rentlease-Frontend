-- Tenancy early move-in rollback, DATA-RETAINING. Withdraws only the three client entry points. The private schema
-- rentlease_tenancy_movein (requests, events, receipts, helpers) and every row stay, so no request or decision is lost. Use this first.
-- Accepted requests have already moved tenancies.start_date; that is tenancy data and is NOT undone here. The events table records each accept
-- with the date it set, and the request row keeps base_start_date (the date before), so an owner-approved reversal can be done by hand.
-- Frontend must be withdrawn or must tolerate the RPCs being absent before running this.
begin;
revoke all on function public.write_tenancy_move_in(uuid,uuid,text,jsonb),public.get_tenancy_move_in(uuid),public.get_pending_tenancy_move_ins() from public,anon,authenticated,service_role;
drop function public.write_tenancy_move_in(uuid,uuid,text,jsonb);
drop function public.get_tenancy_move_in(uuid);
drop function public.get_pending_tenancy_move_ins();
commit;
