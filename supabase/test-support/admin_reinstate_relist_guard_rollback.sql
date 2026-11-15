-- ROLLBACK for 20261114120000_admin_reinstate_relist_guard.sql. Separately authorize before running; take a fresh backup first.
-- Restores save_listing_draft, publish_listing, apply_admin_moderation_action and get_admin_audit_log to their pre-migration source and drops
-- public.get_admin_removed_listings. Guarded like the migration: each reversal asserts the migrated text EXACTLY ONCE and that the edit is exactly
-- reversible; owner, ACL, security-definer flag, config and volatility must be unchanged; and at the end md5(prosrc) of each function must equal the
-- pre-migration pin (the same values the migration pinned), so a partial or foreign edit can never be mistaken for a clean rollback.
-- It NEVER undoes an applied action: reinstated listings stay paused/active, removed listings stay removed, and NO audit row or receipt is deleted.
-- Note: audit rows with action 'reinstate_listing' remain in public.admin_audit_logs. The old get_admin_audit_log still returns them under "All"
-- (its actions filter does not list 'reinstate_listing' and it names no subject for verification or report rows). Receipts of reinstatements also
-- remain; the old RPC refuses 'reinstate_listing' before it ever looks at a receipt, so they are inert.
-- After rolling back, a property with a removed listing can be re-listed again (the guard is gone). Reinstating is no longer possible from the app.
begin;
set local lock_timeout='10s';
do $rollback$
declare
 spec record;src text;patched text;n integer;before_state jsonb;after_state jsonb;
 state constant text:='select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(''owner'',pg_get_userbyid(p.proowner),''acl'',p.proacl::text[],''secdef'',p.prosecdef,''config'',p.proconfig,''volatile'',p.provolatile,''lang'',p.prolang)) from pg_proc p where p.oid in(''public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)''::regprocedure,''public.publish_listing(uuid)''::regprocedure,''public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)''::regprocedure,''public.get_admin_audit_log(text,integer)''::regprocedure)';
begin
 if to_regprocedure('public.get_admin_removed_listings()') is null then raise exception 'Migration 20261114120000 is not applied or is already rolled back';end if;
 -- The functions must still be exactly what the migration produced before anything is reversed.
 if (select md5(prosrc) from pg_proc where oid='public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)'::regprocedure) is distinct from 'd237ba50f916e5bed50cd374b642dd5f'
  or (select md5(prosrc) from pg_proc where oid='public.publish_listing(uuid)'::regprocedure) is distinct from '2f4cfbd538be5d760256995ec01ce7a7'
  or (select md5(prosrc) from pg_proc where oid='public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)'::regprocedure) is distinct from '13167370320a77a820ace658be778f04'
  or (select md5(prosrc) from pg_proc where oid='public.get_admin_audit_log(text,integer)'::regprocedure) is distinct from '43458893456015aa7738c5f2dbeec02b' then raise exception 'A migrated function changed since the migration; review rollback before proceeding';end if;
 execute state into before_state;
 for spec in select * from (values
  (0,'public.get_admin_audit_log(text,integer)',
   $q$(l.metadata->>'report_id')::uuid,a))$q$||chr(10)||$q$    and not (l.action='reinstate_listing' and l.entity_type='listing' and exists(select 1 from public.listings rl0 join public.reports rx on (rx.reported_listing_id=rl0.id or rx.reported_user_id=rl0.landlord_id) where rl0.id=l.entity_id and rentlease_reporting.conflicted(rx.id,a)))),$q$,
   $q$(l.metadata->>'report_id')::uuid,a))),$q$,null::text),
  (1,'public.get_admin_audit_log(text,integer)',
   $q$left join public.reports sr on g.entity_type='report' and sr.id=g.entity_id$q$||chr(10)||
   $q$     left join public.verification_submissions vs on g.entity_type='verification_submission' and vs.id=g.entity_id$q$||chr(10)||
   $q$     left join public.profiles vp on vp.id=vs.user_id$q$||chr(10)||
   $q$     left join public.listings rl on rl.id=sr.reported_listing_id$q$||chr(10)||
   $q$     left join public.profiles rp on rp.id=sr.reported_user_id$q$,
   $q$left join public.reports sr on g.entity_type='report' and sr.id=g.entity_id$q$,null::text),
  (2,'public.get_admin_audit_log(text,integer)',
   $q$when 'verification_submission' then coalesce(case when vp.public_nickname_confirmed_at is not null then nullif(btrim(vp.public_nickname),'') end,'User '||left(vs.user_id::text,8))$q$||chr(10)||
   $q$        when 'report' then case when sr.reported_listing_id is not null then coalesce(nullif(btrim(rl.title),''),'Listing '||left(sr.reported_listing_id::text,8)) else coalesce(case when rp.public_nickname_confirmed_at is not null then nullif(btrim(rp.public_nickname),'') end,'User '||left(sr.reported_user_id::text,8)) end$q$||chr(10)||
   $q$        else null end,$q$,
   $q$else null end,$q$,null),
  (3,'public.get_admin_audit_log(text,integer)',
   $q$'entityId',g.entity_id,'actorId',g.admin_id,$q$,
   $q$'entityId',g.entity_id,$q$,null),
  (4,'public.get_admin_audit_log(text,integer)',
   $q$'remove_listing','reinstate_listing','restrict_account','warning') end$q$,
   $q$'remove_listing','restrict_account','warning') end$q$,'08481f61304cb7498c51ea359af2bbef'),
  (5,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',
   $q$when 'restore_account' then 'active' when 'reinstate_listing' then 'paused' else 'removed' end$q$,
   $q$when 'restore_account' then 'active' else 'removed' end$q$,null),
  (6,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',
   $q$if p_action='reinstate_listing' then$q$||chr(10)||$q$  mid:=p_operation_id;$q$||chr(10)||
   $q$  update public.listings set status='paused',paused_at=now(),removed_at=null,removal_reason=null where id=p_target_listing_id and status='removed';$q$||chr(10)||
   $q$  insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values(a,'reinstate_listing','listing',p_target_listing_id,jsonb_build_object('reason',reason,'previous_status','removed','status','paused'));$q$||chr(10)||
   $q$ else$q$||chr(10)||$q$ insert into public.moderation_actions(report_id,admin_id,action_type,target_user_id,target_listing_id,reason,ends_at)$q$||chr(10)||$q$ values(p_report_id,a,p_action::public.moderation_action_type,p_target_user_id,p_target_listing_id,reason,p_ends_at) returning id into mid;$q$||chr(10)||$q$ end if;$q$,
   $q$insert into public.moderation_actions(report_id,admin_id,action_type,target_user_id,target_listing_id,reason,ends_at)$q$||chr(10)||$q$ values(p_report_id,a,p_action::public.moderation_action_type,p_target_user_id,p_target_listing_id,reason,p_ends_at) returning id into mid;$q$,null),
  (7,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',
   $q$then raise exception 'Listing cannot be removed while a tenancy is open' using errcode='22023';end if;$q$||chr(10)||$q$  elsif p_action='reinstate_listing' then$q$||chr(10)||
   $q$   if l.status<>'removed' then raise exception 'Listing is not removed' using errcode='22023';end if;$q$||chr(10)||
   $q$   if exists(select 1 from public.listings o where o.property_id=l.property_id and o.id<>l.id and o.status in('active','paused','rented')) then raise exception 'This property already has a live listing' using errcode='22023';end if;$q$||chr(10)||
   $q$   if exists(select 1 from public.reports rr where (rr.reported_listing_id=l.id or rr.reported_user_id=l.landlord_id) and rentlease_reporting.conflicted(rr.id,a)) then raise exception 'Access unavailable' using errcode='42501';end if;$q$,
   $q$then raise exception 'Listing cannot be removed while a tenancy is open' using errcode='22023';end if;$q$,null),
  (8,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',
   $q$then raise exception 'A report is required for this action' using errcode='22023';end if;$q$||chr(10)||$q$ if p_report_id is not null and p_action='reinstate_listing' then raise exception 'A report is not used for this action' using errcode='22023';end if;$q$,
   $q$then raise exception 'A report is required for this action' using errcode='22023';end if;$q$,null),
  (9,'public.apply_admin_moderation_action(uuid,text,uuid,uuid,uuid,text,timestamptz)',
   $q$p_action not in('suspend_account','restore_account','remove_listing','reinstate_listing')$q$,
   $q$p_action not in('suspend_account','restore_account','remove_listing')$q$,'7cb33c1bc86c374a0761049ecfcfc879'),
  (10,'public.publish_listing(uuid)',
   $q$    raise exception 'Only a draft listing can be published' using errcode = '22023';$q$||chr(10)||$q$  end if;$q$||chr(10)||chr(10)||$q$  if exists (select 1 from public.listings r where r.property_id = v_listing.property_id and r.id <> v_listing.id and r.status = 'removed'::public.listing_status) then$q$||chr(10)||$q$    raise exception 'Property has a removed listing' using errcode = '22023';$q$,
   $q$    raise exception 'Only a draft listing can be published' using errcode = '22023';$q$,'11e9d42b4ff2cdec8bd2148557beb92a'),
  (11,'public.save_listing_draft(uuid,text,text,numeric,text,rental_term_type,numeric,numeric,smallint,date)',
   $q$  if exists (select 1 from public.listings r where r.property_id = p_property_id and r.status = 'removed'::public.listing_status) then raise exception 'Property has a removed listing' using errcode = '22023'; end if;$q$||chr(10)||chr(10)||$q$  select l.*$q$,
   $q$  select l.*$q$,'260ffe2c338beb57840aa761072e2b82')
 ) as t(step,sig,migrated_text,original_text,final_md5) order by step loop
  src:=pg_get_functiondef(to_regprocedure(spec.sig));
  n:=(length(src)-length(replace(src,spec.migrated_text,'')))/length(spec.migrated_text);
  if n<>1 then raise exception 'Unexpected % contract: migrated text found % times (step %); review rollback before proceeding',spec.sig,n,spec.step;end if;
  patched:=replace(src,spec.migrated_text,spec.original_text);
  if patched is null or patched=src or replace(patched,spec.original_text,spec.migrated_text)<>src then raise exception 'Unexpected % rollback result (step %)',spec.sig,spec.step;end if;
  execute patched;
  if spec.final_md5 is not null and (select md5(prosrc) from pg_proc where oid=to_regprocedure(spec.sig)) is distinct from spec.final_md5 then raise exception 'Rolled back % does not match its pre-migration md5',spec.sig;end if;
 end loop;
 execute state into after_state;
 if after_state is distinct from before_state then raise exception 'Function owner, ACL, security or configuration changed unexpectedly';end if;
 drop function public.get_admin_removed_listings();
end$rollback$;
commit;
