-- ROLLBACK for 20261113180000_admin_actions_audit.sql. Separately authorize before running; take a fresh backup first.
-- Drops the three Admin RPCs, the three audit triggers and their functions, and the audit pagination index.
-- It NEVER undoes an applied action (suspended accounts stay suspended, removed listings stay removed) and NEVER deletes admin_audit_logs rows:
-- audit evidence written while the migration was live is retained. The private receipts table is dropped only when it is empty; if it holds
-- idempotency receipts it is retained (with its immutability trigger and function) as evidence, and the schema stays. The existing
-- apply_moderation_action trigger function is not touched by the migration or by this rollback; the rollback aborts if it has drifted.
begin;
set local lock_timeout='10s';
do $rollback$
begin
 if to_regprocedure('public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)') is null then raise exception 'Admin actions migration is not applied or is already rolled back';end if;
 if (select md5(prosrc) from pg_proc where oid='public.apply_moderation_action()'::regprocedure) is distinct from '311afeb3c10eef8dd2b1b5a965377f21' then raise exception 'public.apply_moderation_action changed since the migration; review rollback before proceeding';end if;
end$rollback$;

drop trigger audit_verification_decision on public.verification_submissions;
drop trigger audit_report_decision on rentlease_reporting.events;
drop trigger audit_review_decision on rentlease_reviews.events;
drop function public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz);
drop function public.get_admin_restrictions();
drop function public.get_admin_audit_log(text,integer);
drop function rentlease_admin_actions.audit_verification_decision();
drop function rentlease_admin_actions.audit_report_decision();
drop function rentlease_admin_actions.audit_review_decision();
drop index public.idx_admin_audit_logs_created_at;

do $rollback$
begin
 if exists(select 1 from rentlease_admin_actions.receipts) then
  raise notice 'Retained rentlease_admin_actions.receipts (% rows) as evidence; the schema is kept',(select count(*) from rentlease_admin_actions.receipts);
 else
  drop table rentlease_admin_actions.receipts;
  drop function rentlease_admin_actions.immutable();
  drop schema rentlease_admin_actions;
 end if;
end$rollback$;
commit;
