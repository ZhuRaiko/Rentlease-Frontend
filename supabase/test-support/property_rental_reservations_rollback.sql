-- Coordinated feature-disable only. Keep all reservation records/events for audit.
-- Retain the tenancy conflict guard so existing approved commitments remain honored.
begin;
drop function public.respond_rental_reservation(uuid,uuid,integer,text,text);
drop function public.request_rental_reservation(uuid,uuid,date,integer,text);
drop function public.get_rental_reservations(uuid,integer,integer);
-- Private projection/tables/indexes and the tenancy guard remain for recovery.
-- Never drop the guard while unexpired approved commitments exist. Reenable or
-- retire commitments through a separately authorized, reviewed recovery migration.
commit;
