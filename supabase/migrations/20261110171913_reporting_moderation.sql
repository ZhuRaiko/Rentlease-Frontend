-- LOCAL ONLY. Reuse public.reports; no enforcement, direct grants or legacy backfill.
begin;
lock table public.reports in share row exclusive mode;
do $$begin
 if not (select relrowsecurity from pg_class where oid='public.reports'::regclass) then raise exception 'Reports RLS drift';end if;
 if exists(select 1 from public.reports) then raise exception 'Legacy reports require separate recovery review';end if;
 if has_table_privilege('authenticated','public.reports','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.reports','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unexpected report grants';end if;
end$$;
create schema rentlease_reporting;
revoke all on schema rentlease_reporting from public,anon,authenticated,service_role;
create table rentlease_reporting.cases(
 report_id uuid primary key references public.reports(id) on delete restrict,
 reporter_id uuid not null,kind text not null check(kind in('listing','user')),target_id uuid not null,
 property_id uuid,parties uuid[] not null,snapshot jsonb not null,
 revision uuid not null default gen_random_uuid(),open boolean not null default true,public_resolution text
);
create unique index reporting_one_open_target on rentlease_reporting.cases(reporter_id,kind,target_id) where open;
create table rentlease_reporting.events(id uuid primary key default gen_random_uuid(),report_id uuid not null references public.reports(id) on delete restrict,actor_id uuid not null,status text not null,note text not null,created_at timestamptz not null default now());
create index reporting_events_idx on rentlease_reporting.events(report_id,created_at desc,id);
create table rentlease_reporting.receipts(actor_id uuid not null,operation_id uuid not null,body jsonb not null,report_id uuid not null references public.reports(id) on delete restrict,primary key(actor_id,operation_id));
alter table rentlease_reporting.cases enable row level security;
alter table rentlease_reporting.events enable row level security;
alter table rentlease_reporting.receipts enable row level security;
revoke all on all tables in schema rentlease_reporting from public,anon,authenticated,service_role;
create index reporting_reporter_page on public.reports(reporter_id,submitted_at desc,id);
create index reporting_queue_page on public.reports(status,submitted_at,id);
create policy reports_rpc_only on public.reports as restrictive for all to authenticated using(false) with check(false);
create function rentlease_reporting.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'Report evidence is immutable' using errcode='42501';end$$;
create trigger reporting_events_immutable before update or delete on rentlease_reporting.events for each row execute function rentlease_reporting.immutable();
create trigger reporting_receipts_immutable before update or delete on rentlease_reporting.receipts for each row execute function rentlease_reporting.immutable();
create function rentlease_reporting.guard() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if TG_OP='DELETE' then raise exception 'Reports must be retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['status','assigned_admin_id','admin_summary','resolved_at','updated_at']) is distinct from (to_jsonb(old)-array['status','assigned_admin_id','admin_summary','resolved_at','updated_at']) then raise exception 'Report source is immutable' using errcode='42501';end if;
 return new;
end$$;
create trigger reporting_source_immutable before update or delete on public.reports for each row execute function rentlease_reporting.guard();
create function rentlease_reporting.conflicted(r uuid,a uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from rentlease_reporting.cases c where c.report_id=r and (a=any(c.parties) or exists(select 1 from public.properties p where p.id=c.property_id and p.landlord_id=a) or exists(select 1 from public.tenancies t where t.property_id=c.property_id and a in(t.tenant_id,t.landlord_id))))
$$;
create function public.get_rental_report(p_report_id uuid,p_admin boolean default false) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();r public.reports%rowtype;c rentlease_reporting.cases%rowtype;result jsonb;begin
 if a is null or public.is_tier1_verified(a) is not true or p_admin is null then raise exception 'Access unavailable' using errcode='42501';end if;
 select * into r from public.reports where id=p_report_id;select * into c from rentlease_reporting.cases where report_id=p_report_id;
 if c.report_id is null or (case when p_admin then public.is_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) else r.reporter_id<>a end) then raise exception 'Access unavailable' using errcode='42501';end if;
 result:=jsonb_build_object('id',r.id,'kind',c.kind,'reason',r.reason,'details',r.details,'status',r.status,'submittedAt',r.submitted_at,'resolvedAt',r.resolved_at,'publicSummary',c.public_resolution,'label',c.snapshot->>'label','revision',c.revision);
 if p_admin then result:=result||jsonb_build_object('targetId',c.target_id,'context',c.snapshot,'history',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from (select status,note,created_at as "createdAt" from rentlease_reporting.events where report_id=r.id order by created_at desc,id limit 20) e));end if;
 return result;
end$$;
create function public.get_rental_reports(p_admin boolean default false,p_kind text default 'all',p_status text default 'all',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();result jsonb;begin
 if a is null or public.is_tier1_verified(a) is not true or p_admin is null or (p_admin and public.is_admin(a) is not true) then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_kind is null or p_kind not in('all','listing','user') or p_status is null or p_status not in('all','submitted','under_review','upheld','dismissed','needs_information','closed') or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid report filters' using errcode='22023';end if;
 with allowed as(select r.* from public.reports r join rentlease_reporting.cases c on c.report_id=r.id where (case when p_admin then not rentlease_reporting.conflicted(r.id,a) else r.reporter_id=a end) and (p_kind='all' or c.kind=p_kind)),filtered as(select * from allowed where p_status='all' or status::text=p_status),page as(select id from filtered order by submitted_at desc,id limit 20 offset p_offset)
 select jsonb_build_object('count',(select count(*) from filtered),'openCount',(select count(*) from allowed where status::text in('submitted','under_review')),'rows',(select coalesce(jsonb_agg(public.get_rental_report(id,p_admin)),'[]'::jsonb) from page)) into result;
 return result;
end$$;
create function public.submit_rental_report(p_operation_id uuid,p_kind text,p_context_id uuid,p_reason text,p_details text default '') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();target uuid;owner_id uuid;prop uuid;rid uuid;prior rentlease_reporting.receipts%rowtype;c public.conversations%rowtype;l public.listings%rowtype;body jsonb;snapshot jsonb;parties uuid[];begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if a is null or public.is_tier1_verified(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_operation_id is null or p_context_id is null or p_kind is null or p_kind not in('listing','user') or p_reason is null or p_reason not in('fraudulent_listing','misleading_information','harassment','impersonation','unsafe_property','spam','policy_violation','other') or p_details is null or length(p_details)>2000 or (p_kind='user' and p_reason in('fraudulent_listing','misleading_information','unsafe_property')) or (p_kind='listing' and p_reason in('harassment','impersonation')) then raise exception 'Invalid report' using errcode='22023';end if;
 body:=jsonb_build_object('kind',p_kind,'context',p_context_id,'reason',p_reason,'details',p_details);
 perform pg_advisory_xact_lock(hashtextextended('report-op:'||a::text||p_operation_id::text,0));
 select * into prior from rentlease_reporting.receipts where actor_id=a and operation_id=p_operation_id;
 if found then if prior.body is distinct from body then raise exception 'Operation changed' using errcode='22023';end if;return public.get_rental_report(prior.report_id,false);end if;
 if p_kind='listing' then
  select * into l from public.listings where id=p_context_id;
  if l.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
  prop:=l.property_id;owner_id:=l.landlord_id;
  perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
  perform 1 from public.properties p where p.id=prop and p.is_active and p.landlord_id=owner_id for share;
  if not found then raise exception 'Access unavailable' using errcode='42501';end if;
  select q.* into l from public.listings q where q.id=p_context_id and q.property_id=prop and q.landlord_id=owner_id and q.status='active' and q.published_at is not null and (q.available_from is null or q.available_from<=(statement_timestamp() at time zone 'Asia/Manila')::date) for share;
  if l.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
  target:=l.id;owner_id:=l.landlord_id;prop:=l.property_id;parties:=array[a,owner_id];snapshot:=jsonb_build_object('label',l.title,'listingId',l.id,'propertyId',prop);
 else
  select * into c from public.conversations where id=p_context_id and a in(tenant_id,landlord_id) and tenant_id<>landlord_id for share;
  if c.id is null then raise exception 'Access unavailable' using errcode='42501';end if;
  target:=case when c.tenant_id=a then c.landlord_id else c.tenant_id end;
  if target is null or target=a then raise exception 'Access unavailable' using errcode='42501';end if;
  parties:=array[c.tenant_id,c.landlord_id];snapshot:=jsonb_build_object('label','Conversation participant','conversationId',c.id);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('report-target:'||a::text||p_kind||target::text,0));
 if exists(select 1 from rentlease_reporting.cases where reporter_id=a and kind=p_kind and target_id=target and open) then raise exception 'An open report already exists' using errcode='23505';end if;
 insert into public.reports(reporter_id,reported_listing_id,reported_user_id,reason,details) values(a,case when p_kind='listing' then target end,case when p_kind='user' then target end,p_reason::public.report_reason,p_details) returning id into rid;
 insert into rentlease_reporting.cases(report_id,reporter_id,kind,target_id,property_id,parties,snapshot) values(rid,a,p_kind,target,prop,parties,snapshot);
 insert into rentlease_reporting.events(report_id,actor_id,status,note) values(rid,a,'submitted','Report submitted');
 insert into rentlease_reporting.receipts values(a,p_operation_id,body,rid);
 return public.get_rental_report(rid,false);
end$$;
create function public.moderate_rental_report(p_report_id uuid,p_operation_id uuid,p_revision uuid,p_status text,p_note text,p_public_summary text default '') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();r public.reports%rowtype;c rentlease_reporting.cases%rowtype;prior rentlease_reporting.receipts%rowtype;body jsonb;begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if a is null or public.is_tier1_verified(a) is not true or public.is_admin(a) is not true or rentlease_reporting.conflicted(p_report_id,a) then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_operation_id is null or p_report_id is null or p_revision is null or p_status is null or p_status not in('under_review','upheld','dismissed') or p_note is null or length(btrim(p_note)) not between 1 and 1000 or p_public_summary is null or length(p_public_summary)>500 or (p_status='under_review' and p_public_summary<>'') then raise exception 'Invalid decision' using errcode='22023';end if;
 body:=jsonb_build_object('report',p_report_id,'revision',p_revision,'status',p_status,'note',p_note,'public',p_public_summary);
 perform pg_advisory_xact_lock(hashtextextended('report-op:'||a::text||p_operation_id::text,0));
 select * into prior from rentlease_reporting.receipts where actor_id=a and operation_id=p_operation_id;
 if found then if prior.body is distinct from body then raise exception 'Operation changed' using errcode='22023';end if;return jsonb_build_object('operationId',p_operation_id,'reportId',prior.report_id,'status',p_status,'current',public.get_rental_report(prior.report_id,true));end if;
 select * into r from public.reports where id=p_report_id for update;select * into c from rentlease_reporting.cases where report_id=p_report_id for update;
 if c.report_id is null or rentlease_reporting.conflicted(p_report_id,a) then raise exception 'Access unavailable' using errcode='42501';end if;
 if c.revision is distinct from p_revision then raise exception 'Report changed' using errcode='40001';end if;
 if not ((r.status::text='submitted' and p_status in('under_review','dismissed')) or (r.status::text='under_review' and p_status in('upheld','dismissed'))) then raise exception 'Invalid transition' using errcode='22023';end if;
 update public.reports set status=p_status::public.report_status,assigned_admin_id=a,admin_summary=p_note,resolved_at=case when p_status in('upheld','dismissed') then statement_timestamp() end where id=p_report_id;
 update rentlease_reporting.cases set revision=gen_random_uuid(),open=p_status='under_review',public_resolution=case when p_status in('upheld','dismissed') then nullif(p_public_summary,'') end where report_id=p_report_id;
 insert into rentlease_reporting.events(report_id,actor_id,status,note) values(p_report_id,a,p_status,p_note);
 insert into rentlease_reporting.receipts values(a,p_operation_id,body,p_report_id);
 return jsonb_build_object('operationId',p_operation_id,'reportId',p_report_id,'status',p_status,'current',public.get_rental_report(p_report_id,true));
end$$;
create function rentlease_reporting.case_guard() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if TG_OP='DELETE' or (to_jsonb(new)-array['revision','open','public_resolution']) is distinct from (to_jsonb(old)-array['revision','open','public_resolution']) then raise exception 'Report context is immutable' using errcode='42501';end if;return new;
end$$;
create trigger reporting_context_immutable before update or delete on rentlease_reporting.cases for each row execute function rentlease_reporting.case_guard();
alter function public.get_rental_report(uuid,boolean) owner to postgres;
alter function public.get_rental_reports(boolean,text,text,integer) owner to postgres;
alter function public.submit_rental_report(uuid,text,uuid,text,text) owner to postgres;
alter function public.moderate_rental_report(uuid,uuid,uuid,text,text,text) owner to postgres;
revoke all on all functions in schema rentlease_reporting from public,anon,authenticated,service_role;
revoke all on function public.get_rental_report(uuid,boolean),public.get_rental_reports(boolean,text,text,integer),public.submit_rental_report(uuid,text,uuid,text,text),public.moderate_rental_report(uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_rental_report(uuid,boolean),public.get_rental_reports(boolean,text,text,integer),public.submit_rental_report(uuid,text,uuid,text,text),public.moderate_rental_report(uuid,uuid,uuid,text,text,text) to authenticated;
commit;
