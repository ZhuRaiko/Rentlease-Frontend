-- Rollback for 20261116140000_review_tags.sql (DATA-RETAINING). Run only if the migration was applied and must be undone.
-- It puts the three original function definitions back byte for byte (from rentlease_reviews.function_backups, written by the migration),
-- removes the summary read and its helper, and re-grants the original 5-argument submit to authenticated only.
-- It KEEPS the tags column, its CHECK, valid_tags and the function_backups table, so no stored tag is lost. Nothing in rentlease_reviews.entries,
-- events or receipts is deleted or changed. Use review_tags_rollback_full.sql afterwards ONLY while no tag has ever been stored.
begin;
set local lock_timeout='10s';
do $guard$
begin
 if to_regclass('rentlease_reviews.function_backups') is null or (select count(*) from rentlease_reviews.function_backups)<>3 then raise exception 'function_backups missing or not the three pinned originals';end if;
 if to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text,text[])') is null or to_regprocedure('public.get_review_summary(text,uuid)') is null then raise exception 'The review tags migration is not applied (or is already rolled back)';end if;
 if exists(select 1 from rentlease_reviews.function_backups where source_md5 not in('62fd03983b613f068191da462af4d693','8503a84e55583636a0d2ede4e1d1272d','e0ba690c49e865d6e8c1f33b9aa209ea')) then raise exception 'function_backups were altered';end if;
end$guard$;
select set_config('rentlease.entries_before',(select count(*)::text from rentlease_reviews.entries),true);
select set_config('rentlease.tagged_before',(select count(*)::text from rentlease_reviews.entries where tags<>'{}'::text[]),true);

drop function public.submit_tenancy_review(uuid,uuid,text,integer,text);
drop function public.submit_tenancy_review(uuid,uuid,text,integer,text,text[]);
drop function public.get_review_summary(text,uuid);
drop function rentlease_reviews.can_read_published(uuid,text,uuid);

do $restore$
declare b record;
begin
 for b in select name,definition,source_md5 from rentlease_reviews.function_backups order by name loop
  execute b.definition;
  if md5((select prosrc from pg_proc where oid=to_regprocedure(b.name))) is distinct from b.source_md5 then raise exception 'Restored % does not match its pinned original',b.name;end if;
 end loop;
end$restore$;
revoke all on function public.submit_tenancy_review(uuid,uuid,text,integer,text),public.get_tenancy_reviews(uuid),public.get_published_rental_reviews(text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.submit_tenancy_review(uuid,uuid,text,integer,text),public.get_tenancy_reviews(uuid),public.get_published_rental_reviews(text,uuid,integer) to authenticated;

do $post$
declare f oid;
begin
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)')))<>'62fd03983b613f068191da462af4d693'
  or md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_reviews(uuid)')))<>'8503a84e55583636a0d2ede4e1d1272d'
  or md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)')))<>'e0ba690c49e865d6e8c1f33b9aa209ea' then raise exception 'Originals not restored';end if;
 if to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text,text[])') is not null or to_regprocedure('public.get_review_summary(text,uuid)') is not null or to_regprocedure('rentlease_reviews.can_read_published(uuid,text,uuid)') is not null then raise exception 'Feature functions still present';end if;
 foreach f in array array[to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)'),to_regprocedure('public.get_tenancy_reviews(uuid)'),to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)')] loop
  if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'Grants wrong after rollback: %',f::regprocedure;end if;
 end loop;
 if (select count(*) from rentlease_reviews.entries)<>current_setting('rentlease.entries_before')::bigint or (select count(*) from rentlease_reviews.entries where tags<>'{}'::text[])<>current_setting('rentlease.tagged_before')::bigint then raise exception 'Review rows changed during rollback';end if;
 if not exists(select 1 from pg_attribute where attrelid='rentlease_reviews.entries'::regclass and attname='tags' and not attisdropped) then raise exception 'tags column must be retained';end if;
end$post$;
commit;
