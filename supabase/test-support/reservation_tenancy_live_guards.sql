-- Live contract snapshot, November 6, 2026, cxfsbwbwmwmgtqfonqth.
-- Disposable fixtures only; never replay against production.
CREATE OR REPLACE FUNCTION rentlease_property_edit.guard_tenancy_property_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v uuid;target uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if tg_op='UPDATE' and (new.property_id<>old.property_id or new.listing_id<>old.listing_id) then
  raise exception 'Tenancy property and listing cannot be reassigned' using errcode='22023';end if;
 if tg_op='DELETE' then target:=old.property_id;else target:=new.property_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 if tg_op='DELETE' then return old;end if;
 if new.status in ('proposed','pending_confirmation','active') and
  (tg_op='INSERT' or new.status is distinct from old.status
   or new.tenant_confirmed_at is distinct from old.tenant_confirmed_at
   or new.landlord_confirmed_at is distinct from old.landlord_confirmed_at
   or new.accepted_property_edit_version is distinct from old.accepted_property_edit_version) then
  select edit_version into v from public.properties where id=target;
  if new.accepted_property_edit_version is null or new.accepted_property_edit_version is distinct from v then
   raise exception 'Property changed. Both parties must review the current property before confirming' using errcode='40001';end if;
 end if;
 return new;
end$function$
;

CREATE OR REPLACE FUNCTION rentlease_property_identity.guard_tenancy_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$declare r uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if new.status in('proposed','pending_confirmation','active') and (tg_op='INSERT' or new.status is distinct from old.status or new.tenant_confirmed_at is distinct from old.tenant_confirmed_at or new.landlord_confirmed_at is distinct from old.landlord_confirmed_at or new.accepted_identity_revision_id is distinct from old.accepted_identity_revision_id) then
  select revision_id into r from rentlease_property_identity.current_identity where property_id=new.property_id;
  if r is null or new.accepted_identity_revision_id is distinct from r then raise exception 'Both parties must review the current property identity before confirming' using errcode='40001';end if;
 end if;return new;
end$function$
;
