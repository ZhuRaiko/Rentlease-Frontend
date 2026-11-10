-- PREPARED LOCALLY ONLY. Separate backup/preflight/deployment authorization required.
-- UC-09A only: no reservations, payments, tenancy, messaging policy or publication changes.
begin;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.viewing_schedules'::regclass)
 or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.validate_viewing_schedule()'::regprocedure) is distinct from 'e1f3e44b650e926ebf60e99bb321cb98'
 or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.start_property_inquiry(uuid)'::regprocedure) is distinct from '08c34f11bac13edad288a06d6d31e348'
 or has_table_privilege('authenticated','public.viewing_schedules','INSERT,UPDATE,DELETE')
 or has_any_column_privilege('authenticated','public.viewing_schedules','INSERT,UPDATE')
 or has_table_privilege('anon','public.viewing_schedules','SELECT,INSERT,UPDATE,DELETE')
 or has_any_column_privilege('anon','public.viewing_schedules','SELECT,INSERT,UPDATE') then
 raise exception 'Viewing baseline drift; review before deployment'; end if;
end $$;
alter table public.viewing_schedules add column revision integer not null default 1 check(revision>0),
 add column request_note text check(char_length(request_note)<=1000);
create policy viewing_rpc_insert_only on public.viewing_schedules as restrictive for insert to authenticated with check(false);
create policy viewing_rpc_update_only on public.viewing_schedules as restrictive for update to authenticated using(false) with check(false);
-- No direct client writes. Existing policies/grants and triggers are preserved.
create table public.viewing_schedule_events(
 operation_id uuid primary key,
 viewing_id uuid not null references public.viewing_schedules(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 action text not null,
 input jsonb not null,
 snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.viewing_schedule_events enable row level security;
revoke all on public.viewing_schedule_events from public,anon,authenticated;
create index viewing_events_history on public.viewing_schedule_events(viewing_id,created_at,operation_id);
create index viewing_participant_page on public.viewing_schedules(tenant_id,starts_at,id);
create index viewing_owner_page on public.viewing_schedules(landlord_id,starts_at,id);

create function public.get_property_viewings(p_conversation_id uuid default null,p_offset integer default 0,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not public.is_tier1_verified(actor) then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Invalid page' using errcode='22023'; end if;
 if p_conversation_id is not null and not exists(select 1 from public.conversations c where c.id=p_conversation_id and actor in(c.tenant_id,c.landlord_id)) then raise exception 'Viewing unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at desc,r.id desc),'[]') into result from (
 select v.*,l.title as listing_title,
 coalesce((select jsonb_agg(h.entry order by h.created_at,h.operation_id) from
 (select e.snapshot || jsonb_build_object('action',e.action,'actor_id',e.actor_id,'event_at',e.created_at) as entry,e.created_at,e.operation_id
 from public.viewing_schedule_events e where e.viewing_id=v.id order by e.created_at desc,e.operation_id desc limit 100)h),'[]') as history
 from public.viewing_schedules v left join public.listings l on l.id=v.listing_id
 where actor in(v.tenant_id,v.landlord_id) and (p_conversation_id is null or v.conversation_id=p_conversation_id)
 order by v.starts_at desc,v.id desc limit p_limit offset p_offset)r;
 return result;
end $$;

create function public.request_property_viewing(p_conversation_id uuid,p_request_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c public.conversations; v public.viewing_schedules; original jsonb; note text:=nullif(btrim(p_note),'');
begin
 if actor is null or not public.is_tier1_verified(actor) then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_request_id is null or p_conversation_id is null or p_starts_at is null or p_ends_at is null or char_length(note)>1000 then raise exception 'Invalid viewing request' using errcode='22023'; end if;
 select * into c from public.conversations where id=p_conversation_id for update;
 if not found or actor<>c.tenant_id or actor=c.landlord_id then raise exception 'Renter participant required' using errcode='42501'; end if;
 select * into v from public.viewing_schedules where id=p_request_id;
 if found then
 select snapshot into original from public.viewing_schedule_events where operation_id=p_request_id and action='request';
 if original is null or v.conversation_id<>c.id or v.tenant_id<>actor or (original->>'starts_at')::timestamptz<>p_starts_at or (original->>'ends_at')::timestamptz<>p_ends_at or original->>'request_note' is distinct from note then raise exception 'Request ID already used' using errcode='23505'; end if;
 return to_jsonb(v); end if;
 if c.status<>'open' or not public.is_tier1_verified(c.landlord_id) or not exists(
 select 1 from public.listings l join public.properties p on p.id=l.property_id where l.id=c.listing_id and l.status='active' and l.published_at is not null and p.is_active
 and l.landlord_id=c.landlord_id and p.landlord_id=c.landlord_id and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date)) then raise exception 'Listing unavailable' using errcode='22023'; end if;
 if p_starts_at<=clock_timestamp() or p_ends_at<=p_starts_at then raise exception 'Invalid or past viewing time' using errcode='22023'; end if;
 if exists(select 1 from public.viewing_schedules where conversation_id=c.id and status in('pending','confirmed','reschedule_requested') and ends_at>clock_timestamp()) then raise exception 'An active viewing already exists for this conversation' using errcode='23505'; end if;
 insert into public.viewing_schedules(id,conversation_id,listing_id,tenant_id,landlord_id,proposed_by,starts_at,ends_at,request_note)
 values(p_request_id,c.id,c.listing_id,c.tenant_id,c.landlord_id,actor,p_starts_at,p_ends_at,note) returning * into v;
 insert into public.viewing_schedule_events(operation_id,viewing_id,actor_id,action,input,snapshot) values(p_request_id,v.id,actor,'request','{}',to_jsonb(v));
 return to_jsonb(v);
end $$;

create function public.respond_property_viewing(p_viewing_id uuid,p_operation_id uuid,p_expected_revision integer,p_action text,p_starts_at timestamptz default null,p_ends_at timestamptz default null,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v public.viewing_schedules; prior public.viewing_schedule_events; note text:=nullif(btrim(p_note),''); payload jsonb;
begin
 if actor is null or not public.is_tier1_verified(actor) then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_operation_id is null or p_viewing_id is null or p_expected_revision is null or p_action is null or p_action not in('approve','decline','reschedule','cancel') or char_length(note)>1000 then raise exception 'Invalid viewing action' using errcode='22023'; end if;
 select * into v from public.viewing_schedules where id=p_viewing_id;
 if not found or actor not in(v.tenant_id,v.landlord_id) then raise exception 'Viewing unavailable' using errcode='42501'; end if;
 -- Consistent participant lock order serializes confirmations across properties and owners.
 perform 1 from public.profiles where id in(v.tenant_id,v.landlord_id) order by id for update;
 select * into v from public.viewing_schedules where id=p_viewing_id for update;
 payload:=jsonb_build_object('revision',p_expected_revision,'action',p_action,'starts_at',p_starts_at,'ends_at',p_ends_at,'note',note);
 select * into prior from public.viewing_schedule_events where operation_id=p_operation_id;
 if found then
 if prior.viewing_id<>v.id or prior.actor_id<>actor or prior.input<>payload then raise exception 'Operation ID already used' using errcode='23505'; end if;
 return to_jsonb(v); end if;
 if v.revision<>p_expected_revision then raise exception 'Viewing changed; refresh before responding' using errcode='40001'; end if;
 if v.status not in('pending','confirmed','reschedule_requested') or v.starts_at<=clock_timestamp() then raise exception 'Viewing is no longer actionable' using errcode='22023'; end if;
 if p_action<>'reschedule' and (p_starts_at is not null or p_ends_at is not null) then raise exception 'Only a proposal may change times' using errcode='22023'; end if;
 if p_action in('approve','reschedule') and (not public.is_tier1_verified(v.tenant_id) or not public.is_tier1_verified(v.landlord_id) or not exists(
 select 1 from public.conversations c join public.listings l on l.id=c.listing_id join public.properties p on p.id=l.property_id
 where c.id=v.conversation_id and c.status='open' and l.status='active' and l.published_at is not null and p.is_active
 and p.landlord_id=v.landlord_id and l.landlord_id=v.landlord_id and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))) then raise exception 'Listing unavailable' using errcode='22023'; end if;
 if p_action in('approve','decline') then
 if (v.status='pending' and actor<>v.landlord_id) or (v.status='reschedule_requested' and actor=v.proposed_by) or v.status='confirmed' then raise exception 'Only the proposal recipient can respond' using errcode='42501'; end if;
 if p_action='approve' and exists(select 1 from public.viewing_schedules x where x.id<>v.id and x.status='confirmed'
 and (x.landlord_id in(v.landlord_id,v.tenant_id) or x.tenant_id in(v.landlord_id,v.tenant_id)) and x.starts_at<v.ends_at and x.ends_at>v.starts_at) then raise exception 'Confirmed viewing overlaps another appointment' using errcode='23P01'; end if;
 v.status:=case when p_action='approve' then 'confirmed'::public.viewing_status else 'declined'::public.viewing_status end;
 elsif p_action='reschedule' then
 if actor<>v.landlord_id then raise exception 'Property owner required to propose another time' using errcode='42501'; end if;
 if p_starts_at is null or p_ends_at is null or p_starts_at<=clock_timestamp() or p_ends_at<=p_starts_at or (p_starts_at=v.starts_at and p_ends_at=v.ends_at) then raise exception 'Choose a different future viewing time' using errcode='22023'; end if;
 v.starts_at:=p_starts_at;v.ends_at:=p_ends_at;v.proposed_by:=actor;v.status:='reschedule_requested';
 else v.status:='cancelled';v.cancelled_by:=actor;v.cancelled_at:=clock_timestamp(); end if;
 update public.viewing_schedules set status=v.status,starts_at=v.starts_at,ends_at=v.ends_at,proposed_by=v.proposed_by,
 response_note=note,responded_by=actor,responded_at=clock_timestamp(),cancelled_by=v.cancelled_by,cancelled_at=v.cancelled_at,revision=revision+1 where id=v.id returning * into v;
 insert into public.viewing_schedule_events(operation_id,viewing_id,actor_id,action,input,snapshot) values(p_operation_id,v.id,actor,p_action,payload,to_jsonb(v));
 return to_jsonb(v);
end $$;
revoke all on function public.get_property_viewings(uuid,integer,integer),public.request_property_viewing(uuid,uuid,timestamptz,timestamptz,text),public.respond_property_viewing(uuid,uuid,integer,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.get_property_viewings(uuid,integer,integer),public.request_property_viewing(uuid,uuid,timestamptz,timestamptz,text),public.respond_property_viewing(uuid,uuid,integer,text,timestamptz,timestamptz,text) to authenticated;
commit;
