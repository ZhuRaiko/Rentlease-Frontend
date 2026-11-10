-- Removes only the recommendation owner-status RPC and its function ACL.
-- Existing verification data, policies, tables, grants and functions are untouched.
begin;
drop function public.get_recommendation_owner_verification(uuid[]);
commit;
