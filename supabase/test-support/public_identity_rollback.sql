-- Privacy-preserving feature disable. Keep the sanitized public_profiles view,
-- explicit-consent columns, Storage restrictions and records. Never restore the
-- ambiguous legacy name/avatar projection or delete already-public objects here.
begin;
drop trigger if exists initialize_registration_public_identity on public.profiles;
drop function if exists public.initialize_registration_public_identity();
revoke execute on function public.get_public_identities(uuid[]),public.get_own_public_identity(),public.get_own_avatar_upload(text),public.set_own_public_identity(uuid,uuid,text,text,boolean) from authenticated;
commit;
