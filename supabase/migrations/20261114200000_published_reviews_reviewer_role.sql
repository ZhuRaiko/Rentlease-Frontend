-- LOCAL ONLY. NOT APPLIED. Prepared 2026-11-14 for review; do not apply without explicit authorization, a fresh predeploy backup and live-source
-- reconfirmation. Apply directly (db query --linked -f), then `migration repair --status applied 20261114200000`; never db push.
--
-- Why: get_published_rental_reviews('user', id) returns every approved person-review about the user, from EITHER side, and its rows do not say who
-- wrote them. The profile section "Landlord's experience with this user" therefore cannot tell a landlord's review from a tenant's.
--
-- What changes (and only this): each returned row gains one key, 'reviewerRole', 'landlord' when the review's author is the landlord of the
-- review's tenancy and 'tenant' otherwise (a property review is always written by the tenant). It is derived from data the row already comes
-- from (rentlease_reviews.entries.reviewer_id against the joined tenancy's landlord_id). The role is not an identity: no reviewer id is added.
-- count, average, ordering, paging, filters and access checks are untouched.
-- Patch technique (same as 20261114180000): the live source must match the pinned md5, each anchor must occur EXACTLY ONCE in
-- pg_get_functiondef, the edit must be exactly reversible, the result must match the md5 recorded below, and owner, ACL, security-definer
-- flag, config, volatility and return type must be identical afterward. Any drift raises and the migration rolls back.
-- Pins (hosted, read-only, 2026-11-14):
--   public.get_published_rental_reviews(text,uuid,integer)  7f0847017fc4547576efd9e8eb16960a  ->  e0ba690c49e865d6e8c1f33b9aa209ea
-- Rollback: supabase/test-support/published_reviews_reviewer_role_rollback.sql (restores the original source).
begin;
set local lock_timeout='10s';
do $m$
declare
 target_oid oid:=to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)');
 a1 constant text:=$a1$select x.* from rentlease_reviews.entries x$a1$;
 b1 constant text:=$b1$select x.*,(x.reviewer_id=t.landlord_id) as reviewer_is_landlord from rentlease_reviews.entries x$b1$;
 a2 constant text:=$a2$'moderatedAt',q.moderated_at)$a2$;
 b2 constant text:=$b2$'moderatedAt',q.moderated_at,'reviewerRole',case when q.reviewer_is_landlord then 'landlord' else 'tenant' end)$b2$;
 old_src text; old_def text; new_def text; new_src text; before_meta text; after_meta text;
begin
 if target_oid is null then raise exception 'get_published_rental_reviews is missing';end if;
 select prosrc,pg_get_functiondef(oid) into old_src,old_def from pg_proc where oid=target_oid;
 if md5(old_src)<>'7f0847017fc4547576efd9e8eb16960a' then raise exception 'get_published_rental_reviews source drift';end if;
 if (length(old_def)-length(replace(old_def,a1,'')))/length(a1)<>1 then raise exception 'Anchor A1 must occur exactly once';end if;
 if (length(old_def)-length(replace(old_def,a2,'')))/length(a2)<>1 then raise exception 'Anchor A2 must occur exactly once';end if;
 if position(b1 in old_def)>0 or position(b2 in old_def)>0 then raise exception 'The edit is already present';end if;
 select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text,proisstrict::text,prorettype::regtype::text,proargtypes::text,pronargdefaults::text) into before_meta from pg_proc where oid=target_oid;
 new_def:=replace(replace(old_def,a1,b1),a2,b2);
 execute new_def;
 select prosrc into new_src from pg_proc where oid=target_oid;
 select concat_ws('|',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text,proisstrict::text,prorettype::regtype::text,proargtypes::text,pronargdefaults::text) into after_meta from pg_proc where oid=target_oid;
 if md5(new_src)<>'e0ba690c49e865d6e8c1f33b9aa209ea' then raise exception 'Patched source does not match the reviewed result (%)',md5(new_src);end if;
 if replace(replace(new_src,b2,a2),b1,a1)<>old_src then raise exception 'The edit is not exactly reversible';end if;
 if before_meta<>after_meta then raise exception 'Owner, ACL or settings changed: % vs %',before_meta,after_meta;end if;
 if not has_function_privilege('authenticated','public.get_published_rental_reviews(text,uuid,integer)','execute') or has_function_privilege('anon','public.get_published_rental_reviews(text,uuid,integer)','execute') then raise exception 'get_published_rental_reviews ACL changed';end if;
end$m$;
commit;
