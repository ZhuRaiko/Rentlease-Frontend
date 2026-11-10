-- Read-only live function snapshot, cxfsbwbwmwmgtqfonqth, 2026-11-04.
-- Disposable local contract fixtures only. Never replay against production.
CREATE OR REPLACE FUNCTION public.has_app_role(requested_role app_role, requested_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = requested_user
      and ur.role = requested_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(requested_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_app_role('admin', requested_user);
$function$;

CREATE OR REPLACE FUNCTION public.is_tier1_verified(requested_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = requested_user
      and p.tier1_verified_at is not null
      and p.account_status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.prevent_conversation_identity_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin()
     and (
       new.listing_id is distinct from old.listing_id
       or new.tenant_id is distinct from old.tenant_id
       or new.landlord_id is distinct from old.landlord_id
     ) then
    raise exception 'Conversation listing and participants are immutable';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_conversation_after_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_conversation_participants()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  listing_landlord uuid;
  listing_state public.listing_status;
begin
  select l.landlord_id, l.status
    into listing_landlord, listing_state
  from public.listings l
  where l.id = new.listing_id;

  if listing_landlord is null then
    raise exception 'Listing does not exist';
  end if;

  if new.landlord_id <> listing_landlord then
    raise exception 'Conversation landlord must match listing landlord';
  end if;

  if new.tenant_id = new.landlord_id then
    raise exception 'Tenant and landlord must be different users';
  end if;

  if tg_op = 'INSERT' and listing_state <> 'active' then
    raise exception 'New inquiries can only be opened for active listings';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_message_sender()
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
      and new.sender_id in (c.tenant_id, c.landlord_id)
      and c.status = 'open'
  ) then
    raise exception 'Sender is not an active participant in this conversation';
  end if;

  return new;
end;
$function$;
