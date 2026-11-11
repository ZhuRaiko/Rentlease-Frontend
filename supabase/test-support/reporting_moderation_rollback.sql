-- Separately authorize after client withdrawal and reconciliation. Retain reports/audit/receipts/RLS.
begin;
revoke execute on function public.get_rental_report(uuid,boolean),public.get_rental_reports(boolean,text,text,integer),public.submit_rental_report(uuid,text,uuid,text,text),public.moderate_rental_report(uuid,uuid,uuid,text,text,text) from authenticated;
commit;
