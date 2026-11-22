-- Maintenance inbox: an ended tenancy no longer keeps its RESOLVED requests (confirmed or not) in the landlord's inbox rows or counts.
-- Why: a request the landlord resolved but the tenant never confirmed stayed in the inbox and in awaitingConfirmation forever once the tenancy ended.
-- Open, in-progress and scheduled requests of an ended tenancy stay visible; active tenancies are unchanged. ONLY the filter on line "where t.landlord_id=a" changes.
-- Tenant side (get_tenancy_care, get_maintenance_request) and write_tenancy_care are untouched: the tenant can still confirm a resolved request after the end.
-- NOT APPLIED. Apply directly (db query --linked -f), then single-version migration repair; never db push.
-- Rollback: supabase/test-support/maintenance_ended_inbox_rollback.sql.
-- Source md5 expected before: 6e6b30d67a0affc4075a8dc8b22d638c
do $guard$ begin
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_maintenance_inbox(integer)')))<>'6e6b30d67a0affc4075a8dc8b22d638c' then raise exception 'get_maintenance_inbox source drift';end if;
end $guard$;
create or replace function public.get_maintenance_inbox(p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare a uuid:=auth.uid();counts jsonb;rows_json jsonb;more boolean;
begin
 if a is null or public.is_tier1_verified(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 with v as (
  select m.*,t.property_id,t.tenant_id as tenant_uid,(t.status='ended') as ended,
   (m.status not in('cancelled','rejected') and not (m.status='resolved' and m.tenant_confirmed_resolved_at is not null)) as is_open
  from public.maintenance_requests m join public.tenancies t on t.id=m.tenancy_id
  where t.landlord_id=a and (t.status='active' or (t.status='ended' and m.status not in('cancelled','rejected','resolved')))),
 ranked as (select v.*,row_number() over (order by (v.is_open and v.priority='urgent') desc,v.created_at desc,v.id) as rn from v)
 select
  jsonb_build_object('open',count(*) filter (where is_open),'inProgress',count(*) filter (where status in('in_progress','scheduled')),
   'awaitingConfirmation',count(*) filter (where status='resolved' and tenant_confirmed_resolved_at is null),'resolved',count(*) filter (where status='resolved' and tenant_confirmed_resolved_at is not null),
   'urgentOpen',count(*) filter (where is_open and priority='urgent')),
  coalesce(jsonb_agg(jsonb_build_object('id',r.id,'tenancyId',r.tenancy_id,'propertyId',r.property_id,'title',r.title,'category',r.category,'priority',r.priority,'status',r.status,
   'tenantConfirmedAt',r.tenant_confirmed_resolved_at,'createdAt',r.created_at,'updatedAt',r.updated_at,'revision',r.care_revision,'tenancyEnded',r.ended,
   'lastNote',(select jsonb_build_object('role',case when u.actor_id=r.tenant_uid then 'tenant' else 'landlord' end,'note',u.note,'at',u.created_at)
     from public.maintenance_updates u where u.maintenance_request_id=r.id and u.from_status is not null and u.note is not null order by u.created_at desc,u.id desc limit 1))
   order by r.rn) filter (where r.rn>p_offset and r.rn<=p_offset+20),'[]'::jsonb),
  coalesce(bool_or(r.rn>p_offset+20),false)
 into counts,rows_json,more from ranked r;
 return jsonb_build_object('counts',counts,'rows',rows_json,'hasMore',more);
end$function$;

do $check$ begin
 if (select proacl::text from pg_proc where oid=to_regprocedure('public.get_maintenance_inbox(integer)')) is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'get_maintenance_inbox ACL changed';end if;
 if not (select prosecdef and provolatile='s' and proconfig::text='{search_path=pg_catalog}' from pg_proc where oid=to_regprocedure('public.get_maintenance_inbox(integer)')) then raise exception 'get_maintenance_inbox settings changed';end if;
end $check$;
