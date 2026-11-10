-- Catalog definitions inspected read-only on cxfsbwbwmwmgtqfonqth, 2026-11-08.
-- Synthetic local fixtures only; never apply this file to a hosted database.
CREATE OR REPLACE FUNCTION public.is_admin(requested_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_app_role('admin', requested_user);
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_property(property_uuid uuid, requested_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin(requested_user)
    or exists (
      select 1
      from public.properties p
      where p.id = property_uuid
        and p.landlord_id = requested_user
    );
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_property(property_uuid uuid, requested_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.can_manage_property(property_uuid, requested_user)
    or (
      public.is_tier1_verified(requested_user)
      and exists (
        select 1
        from public.listings l
        where l.property_id = property_uuid
          and l.status = 'active'
      )
    )
    or exists (
      select 1
      from public.tenancies t
      where t.property_id = property_uuid
        and requested_user in (t.tenant_id, t.landlord_id)
    );
$function$
;
CREATE OR REPLACE FUNCTION public.refresh_profile_verification_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target_user uuid;
begin
  if tg_op = 'DELETE' then
    target_user := old.user_id;
  else
    target_user := new.user_id;
  end if;

  update public.profiles p
  set
    tier2_verified_at = (
      select max(v.reviewed_at)
      from public.verification_submissions v
      where v.user_id = target_user
        and v.tier = 'tier_2_identity'
        and v.status = 'approved'
    ),
    tier3_verified_at = (
      select max(v.reviewed_at)
      from public.verification_submissions v
      where v.user_id = target_user
        and v.tier = 'tier_3_property'
        and v.status = 'approved'
    ),
    updated_at = now()
  where p.id = target_user;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$
;
CREATE UNIQUE INDEX uq_tier2_single_open_or_approved_per_user ON public.verification_submissions USING btree (user_id) WHERE ((tier = 'tier_2_identity'::verification_tier) AND (status = ANY (ARRAY['pending'::verification_status, 'under_review'::verification_status, 'approved'::verification_status])));
CREATE TRIGGER trg_refresh_profile_verification AFTER INSERT OR DELETE OR UPDATE ON public.verification_submissions FOR EACH ROW EXECUTE FUNCTION refresh_profile_verification_timestamps();
create policy listings_read_allowed on public.listings for select to authenticated using ((((status = 'active'::listing_status) AND is_tier1_verified()) OR (landlord_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM tenancies t
  WHERE ((t.listing_id = listings.id) AND ((auth.uid() = t.tenant_id) OR (auth.uid() = t.landlord_id)))))));
create policy profiles_select_own on public.profiles for select to authenticated using ((( SELECT auth.uid() AS uid) = id));
create policy properties_read_allowed on public.properties for select to authenticated using (((landlord_id = ( SELECT auth.uid() AS uid)) OR can_view_property(id)));
create policy verification_submissions_read_owner_admin on public.verification_submissions for select to authenticated using (((user_id = auth.uid()) OR is_admin()));
