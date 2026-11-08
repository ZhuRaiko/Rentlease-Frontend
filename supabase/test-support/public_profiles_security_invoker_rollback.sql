-- Emergency compatibility rollback only: restores the former owner-rights view
-- and its advisor warning. Requires separate review/authorization; never widens RLS.
begin;
alter view public.public_profiles reset (security_invoker);
commit;
