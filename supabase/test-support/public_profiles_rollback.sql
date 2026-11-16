-- Rollback for 20261116150000_public_profiles.sql. Nothing is stored by that migration (no table, column or data), so the rollback removes its functions and the private schema.
-- Retained: every existing function and table (can_read_public_identity, get_public_identities, get_review_summary and rentlease_reviews.* are verified untouched afterwards).
begin;
set local lock_timeout='10s';
do $guard$
begin
 if to_regprocedure('public.get_public_profile(uuid)') is null or to_regnamespace('rentlease_profiles') is null then raise exception 'The public profiles migration is not applied (or is already rolled back)';end if;
end$guard$;
drop function public.get_public_profile(uuid);
drop schema rentlease_profiles cascade;
drop function rentlease_reviews.summarize(text,uuid);
drop function rentlease_reviews.approved_set(text,uuid);
do $post$
begin
 if to_regprocedure('public.get_public_profile(uuid)') is not null or to_regnamespace('rentlease_profiles') is not null or to_regprocedure('rentlease_reviews.summarize(text,uuid)') is not null or to_regprocedure('rentlease_reviews.approved_set(text,uuid)') is not null then raise exception 'Rollback incomplete';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.can_read_public_identity(uuid)')))<>'ce7a49ff8184972232e5d000cb2135cc'
  or md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_public_identities(uuid[])')))<>'ef1a0176b11b9fe926b121fe4a79d8b3'
  or md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_review_summary(text,uuid)')))<>'78f27537f0afaa46caf35cc96dfb8922' then raise exception 'An existing function changed';end if;
 if (select string_agg(proname,',' order by proname) from pg_proc where pronamespace='rentlease_reviews'::regnamespace)<>'actor,can_read_published,guard_content,guard_user_source,immutable,tenancy,valid_tags' then raise exception 'rentlease_reviews functions are not back to the baseline';end if;
end$post$;
commit;
