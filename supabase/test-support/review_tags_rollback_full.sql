-- FULL rollback for 20261116140000_review_tags.sql: removes the tags column, its CHECK, valid_tags and function_backups.
-- Run review_tags_rollback.sql FIRST. This script refuses to run if any tag has ever been stored or if the feature functions still exist.
begin;
set local lock_timeout='10s';
do $guard$
begin
 if to_regprocedure('public.get_review_summary(text,uuid)') is not null or to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text,text[])') is not null then raise exception 'Run review_tags_rollback.sql first';end if;
 if not exists(select 1 from pg_attribute where attrelid='rentlease_reviews.entries'::regclass and attname='tags' and not attisdropped) then raise exception 'tags column already removed';end if;
 if exists(select 1 from rentlease_reviews.entries where tags<>'{}'::text[]) then raise exception 'Stored tags exist: a full rollback would lose data';end if;
 if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and prosrc like '%.tags%' and proname in('get_tenancy_reviews','get_published_rental_reviews','submit_tenancy_review')) then raise exception 'A public review function still reads tags';end if;
end$guard$;
alter table rentlease_reviews.entries drop constraint entries_tags_valid;
alter table rentlease_reviews.entries drop column tags;
drop function rentlease_reviews.valid_tags(text,text[]);
drop table rentlease_reviews.function_backups;
do $post$
begin
 if exists(select 1 from pg_attribute where attrelid='rentlease_reviews.entries'::regclass and attname='tags' and not attisdropped) or to_regclass('rentlease_reviews.function_backups') is not null or to_regprocedure('rentlease_reviews.valid_tags(text,text[])') is not null then raise exception 'Full rollback incomplete';end if;
 if (select md5(string_agg(c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),''),'|' order by c.relname,a.attnum))
  from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where c.relnamespace='rentlease_reviews'::regnamespace and c.relkind='r')<>'04c0f393900d9a33ce9ef17917af49ce' then raise exception 'Columns are not back to the pre-migration shape';end if;
 if (select md5(string_agg(conrelid::regclass::text||'.'||conname||'='||pg_get_constraintdef(oid),'|' order by conrelid::regclass::text,conname)) from pg_constraint where connamespace='rentlease_reviews'::regnamespace)<>'ed1ac7c2b90b7b6de7a0183c1cc71c3f' then raise exception 'Constraints are not back to the pre-migration shape';end if;
end$post$;
commit;
