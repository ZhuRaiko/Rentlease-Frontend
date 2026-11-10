-- Read-only live contract snapshot, cxfsbwbwmwmgtqfonqth, November 6, 2026.
CREATE OR REPLACE FUNCTION public.validate_viewing_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id = new.conversation_id
      and c.listing_id = new.listing_id
      and c.tenant_id = new.tenant_id
      and c.landlord_id = new.landlord_id
      and new.proposed_by in (c.tenant_id, c.landlord_id)
  ) then
    raise exception 'Viewing schedule participants must match the conversation';
  end if;

  return new;
end;
$function$;
