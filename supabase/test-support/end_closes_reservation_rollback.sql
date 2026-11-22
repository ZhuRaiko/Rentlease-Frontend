-- Rollback for 20261122100000_end_closes_reservation. Removes the trigger and its functions. Reservations that were closed stay 'cancelled' (that is data);
-- each one has a rentlease_reservations.events row with action 'cancel' and input reason 'stay_ended', so an owner-approved reversal can list them.
begin;
drop trigger if exists trg_end_closes_reservation on public.tenancies;
drop schema if exists rentlease_tenancy_close cascade;
commit;
