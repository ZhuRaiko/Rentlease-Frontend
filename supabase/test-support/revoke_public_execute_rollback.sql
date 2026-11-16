-- Rollback for 20261116150100_revoke_public_execute.sql: one grant of EXECUTE to PUBLIC on the nine functions (restores anonymous access exactly as it was).
-- The explicit authenticated and service_role grants the migration added stay; they change nothing for any caller (service_role only gained what PUBLIC already gave it).
begin;
grant execute on function public.can_access_conversation(uuid,uuid),public.can_access_tenancy(uuid,uuid),public.can_manage_property(uuid,uuid),public.can_view_property(uuid,uuid),public.has_app_role(app_role,uuid),
 public.is_admin(uuid),public.is_tier1_verified(uuid),public.refresh_my_tier1_verification(),public.update_my_profile(text,text,text) to public;
commit;
