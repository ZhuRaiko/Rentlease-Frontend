-- Rent ledger rollback, DATA-RETAINING. Withdraws only the two client entry points. The private schema rentlease_rent_ledger (events,
-- receipts), the ledger_revision column, the status/timestamp constraint, the revision trigger and every row stay, so recorded statements
-- are never lost. Use this first. Frontend must be withdrawn or must tolerate the RPCs being absent before running it.
-- After a successful apply the expected md5(prosrc) of the dropped functions were:
--   get_rent_ledger   9222f65775d38442049de604f52d135d
--   write_rent_ledger 47bce52490337d7eb6c08fb812b3490e
begin;
revoke all on function public.get_rent_ledger(uuid,integer),public.write_rent_ledger(uuid,uuid,text,date,uuid) from public,anon,authenticated,service_role;
drop function public.get_rent_ledger(uuid,integer);
drop function public.write_rent_ledger(uuid,uuid,text,date,uuid);
commit;
