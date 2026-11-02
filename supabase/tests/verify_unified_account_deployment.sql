-- Read-only postdeployment smoke check; no test records or membership changes.
-- Uses existing eligible actors; role-free behavior is covered locally and by
-- exact deployed function fingerprints when no role-free live account exists.
begin read only;
do $verify$
declare owner_id uuid; other_id uuid; property_id uuid; expected_verified boolean; actual_verified boolean; landlord_only uuid;
begin
 select p.landlord_id,p.id,rentlease_property_identity.verified(p.id) into owner_id,property_id,expected_verified from public.properties p join public.profiles a on a.id=p.landlord_id where a.account_status='active' and a.tier1_verified_at is not null order by p.id limit 1;
 select id into other_id from public.profiles a where id<>owner_id and account_status='active' and tier1_verified_at is not null and not public.is_admin(id) limit 1;
 select a.id into landlord_only from public.profiles a where a.account_status='active' and a.tier1_verified_at is not null and public.has_app_role('landlord',a.id) and not public.has_app_role('tenant',a.id) limit 1;
 if owner_id is null or other_id is null or landlord_only is null then raise exception 'Required existing verification actors unavailable';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 select s.verified into actual_verified from public.get_owned_property_identity_statuses(array[property_id]) s;
 if actual_verified is distinct from expected_verified then raise exception 'Owner exact-property verification mismatch';end if;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 begin
   perform * from public.get_owned_property_identity_statuses(array[property_id]);
   raise exception 'Non-owner status read unexpectedly allowed';
 exception when insufficient_privilege then null;end;
 if public.is_admin() then raise exception 'Ordinary actor unexpectedly Admin';end if;
 begin
   perform * from public.set_user_roles(array['admin']);
   raise exception 'Admin self-assignment unexpectedly allowed';
 exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',landlord_only::text,true);
 if not public.is_tier1_verified() then raise exception 'Expected active Tier 1 actor';end if;
 perform * from public.search_nearby_listings(14.4,120.9,3,5,0);
 execute 'reset role';
end $verify$;
select 'read_only_owner_nonowner_admin_and_landlord_gps_checks_passed' result;
commit;
