-- PREPARED ONLY. Separate deployment authorization and backup required.
-- UC-09B is independent of UC-09A; no payment, tenancy creation, or listing status writes.
begin;
do $$ begin
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.start_property_inquiry(uuid)'::regprocedure) is distinct from '08c34f11bac13edad288a06d6d31e348'
 or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='rentlease_property_edit.guard_tenancy_property_version()'::regprocedure) is distinct from 'e1ec428e3e5267ed035f9595d602de35'
 or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='rentlease_property_identity.guard_tenancy_identity()'::regprocedure) is distinct from 'a23bec75d66b4670388a514f7c9b6d42' then
 raise exception 'Reservation baseline drift; review before deployment'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.tenancies'::regclass and tgname='aaa_tenancy_property_gate' and tgfoid='rentlease_property_edit.guard_tenancy_property_version()'::regprocedure and tgenabled='O')
 or not exists(select 1 from pg_trigger where tgrelid='public.tenancies'::regclass and tgname='aab_tenancy_identity_gate' and tgfoid='rentlease_property_identity.guard_tenancy_identity()'::regprocedure and tgenabled='O') then raise exception 'Tenancy serialization guard drift';end if;
end $$;
create schema rentlease_reservations;
revoke all on schema rentlease_reservations from public,anon,authenticated;
create table public.rental_reservations(
 id uuid primary key,
 conversation_id uuid not null references public.conversations(id) on delete restrict,
 listing_id uuid not null references public.listings(id) on delete restrict,
 property_id uuid not null references public.properties(id) on delete restrict,
 tenant_id uuid not null references public.profiles(id) on delete restrict,
 landlord_id uuid not null references public.profiles(id) on delete restrict,
 move_in_date date not null,
 duration_months smallint not null check(duration_months between 1 and 120),
 end_date date not null check(end_date>move_in_date),
 message text check(char_length(message)<=1000),
 status text not null default 'pending' check(status in('pending','approved','declined','cancelled','expired')),
 expires_at timestamptz not null,
 revision integer not null default 1 check(revision>0),
 response_note text check(char_length(response_note)<=1000),
 responded_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(tenant_id<>landlord_id)
);
alter table public.rental_reservations enable row level security;
revoke all on public.rental_reservations from public,anon,authenticated;
create index reservation_participant_page on public.rental_reservations(tenant_id,created_at desc,id desc);
create index reservation_owner_page on public.rental_reservations(landlord_id,created_at desc,id desc);
create index reservation_property_commitments on public.rental_reservations(property_id,move_in_date,end_date) where status='approved';
create table rentlease_reservations.events(
 operation_id uuid primary key,
 reservation_id uuid not null references public.rental_reservations(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 action text not null,
 input jsonb not null,
 snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table rentlease_reservations.events enable row level security;
revoke all on rentlease_reservations.events from public,anon,authenticated;
create index reservation_event_history on rentlease_reservations.events(reservation_id,created_at,operation_id);

create function rentlease_reservations.project(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(r)||jsonb_build_object(
 'effective_status',case when r.status in('pending','approved') and r.expires_at<=statement_timestamp() then 'expired' else r.status end,
 'listing_title',l.title,'server_now',statement_timestamp(),'applicant_label','Renter',
 'applicant_tier1',public.is_tier1_verified(r.tenant_id),
 'applicant_tier2',p.tier2_verified_at is not null,
 'history',coalesce((select jsonb_agg(h.entry order by h.created_at,h.operation_id) from (
 select jsonb_build_object('action',e.action,'actor_id',e.actor_id,'at',e.created_at,'status',e.snapshot->>'status','note',e.snapshot->>'response_note') entry,e.created_at,e.operation_id
 from rentlease_reservations.events e where e.reservation_id=r.id order by e.created_at desc,e.operation_id desc limit 100)h),'[]'::jsonb))
 from public.rental_reservations r join public.profiles p on p.id=r.tenant_id left join public.listings l on l.id=r.listing_id where r.id=p_id;
$$;
revoke all on function rentlease_reservations.project(uuid) from public,anon,authenticated;

create function public.get_rental_reservations(p_conversation_id uuid default null,p_offset integer default 0,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or public.is_tier1_verified(actor) is not true then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Invalid page' using errcode='22023'; end if;
 if p_conversation_id is not null and not exists(select 1 from public.conversations where id=p_conversation_id and actor in(tenant_id,landlord_id)) then raise exception 'Reservation unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_agg(rentlease_reservations.project(r.id) order by r.created_at desc,r.id desc),'[]') into result from
 (select id,created_at from public.rental_reservations where actor in(tenant_id,landlord_id) and (p_conversation_id is null or conversation_id=p_conversation_id) order by created_at desc,id desc limit p_limit offset p_offset)r;
 return result;
end $$;

create function public.request_rental_reservation(p_conversation_id uuid,p_request_id uuid,p_move_in_date date,p_duration_months integer,p_message text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c public.conversations; r public.rental_reservations; property uuid; ending date; message text:=nullif(btrim(p_message),''); original jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001'; end if;
 if actor is null or public.is_tier1_verified(actor) is not true then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_request_id is null or p_conversation_id is null or p_move_in_date is null or not isfinite(p_move_in_date) or p_duration_months is null or p_duration_months not between 1 and 120 or char_length(message)>1000 then raise exception 'Invalid reservation request' using errcode='22023'; end if;
 select * into c from public.conversations where id=p_conversation_id;
 if not found or actor<>c.tenant_id or actor=c.landlord_id then raise exception 'Renter participant required' using errcode='42501'; end if;
 select property_id into property from public.listings where id=c.listing_id;
 -- Same lock as existing property/identity/tenancy guards, before row locks.
 perform pg_advisory_xact_lock(hashtextextended(property::text,0));
 select * into c from public.conversations where id=p_conversation_id for update;
 if public.is_tier1_verified(actor) is not true then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 select * into r from public.rental_reservations where id=p_request_id;
 if found then
 if r.tenant_id<>actor or r.conversation_id<>c.id or r.move_in_date<>p_move_in_date or r.duration_months<>p_duration_months or r.message is distinct from message then raise exception 'Request ID already used' using errcode='23505'; end if;
 return rentlease_reservations.project(r.id); end if;
 if c.status<>'open' or public.is_tier1_verified(c.landlord_id) is not true or not exists(
 select 1 from public.listings l join public.properties p on p.id=l.property_id where l.id=c.listing_id and p.id=property and p.is_active and l.status='active' and l.published_at is not null
 and l.landlord_id=c.landlord_id and p.landlord_id=c.landlord_id and (l.available_from is null or l.available_from<=p_move_in_date)) then raise exception 'Listing unavailable' using errcode='22023'; end if;
 if p_move_in_date<=(clock_timestamp() at time zone 'Asia/Manila')::date then raise exception 'Choose a future move-in date' using errcode='22023'; end if;
 ending:=(p_move_in_date+make_interval(months=>p_duration_months))::date;
 if extract(year from ending)>9999 then raise exception 'Unsupported move-in date' using errcode='22023';end if;
 if exists(select 1 from public.rental_reservations where property_id=property and tenant_id=actor and status in('pending','approved') and expires_at>clock_timestamp() and daterange(move_in_date,end_date,'[)')&&daterange(p_move_in_date,ending,'[)')) then raise exception 'Active overlapping reservation request already exists' using errcode='23505'; end if;
 if exists(select 1 from public.tenancies t where t.property_id=property and t.status in('proposed','pending_confirmation','active') and daterange(t.start_date,coalesce(t.actual_end_date,t.expected_end_date)+1,'[)')&&daterange(p_move_in_date,ending,'[)')) then raise exception 'Unit has an overlapping tenancy commitment' using errcode='23P01'; end if;
 if exists(select 1 from public.rental_reservations where property_id=property and status='approved' and expires_at>clock_timestamp() and daterange(move_in_date,end_date,'[)')&&daterange(p_move_in_date,ending,'[)')) then raise exception 'Unit already reserved for this period' using errcode='23P01'; end if;
 insert into public.rental_reservations(id,conversation_id,listing_id,property_id,tenant_id,landlord_id,move_in_date,duration_months,end_date,message,expires_at)
 values(p_request_id,c.id,c.listing_id,property,c.tenant_id,c.landlord_id,p_move_in_date,p_duration_months,ending,message,least(clock_timestamp()+interval '7 days',p_move_in_date::timestamp at time zone 'Asia/Manila')) returning * into r;
 insert into rentlease_reservations.events(operation_id,reservation_id,actor_id,action,input,snapshot) values(p_request_id,r.id,actor,'request','{}',to_jsonb(r));
 return rentlease_reservations.project(r.id);
end $$;

create function public.respond_rental_reservation(p_reservation_id uuid,p_operation_id uuid,p_expected_revision integer,p_action text,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r public.rental_reservations; prior rentlease_reservations.events; payload jsonb; note text:=nullif(btrim(p_note),'');
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001'; end if;
 if actor is null or public.is_tier1_verified(actor) is not true then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 if p_reservation_id is null or p_operation_id is null or p_expected_revision is null or p_action is null or p_action not in('approve','decline','cancel','expire') or char_length(note)>1000 then raise exception 'Invalid reservation action' using errcode='22023'; end if;
 select * into r from public.rental_reservations where id=p_reservation_id;
 if not found or actor not in(r.tenant_id,r.landlord_id) then raise exception 'Reservation unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.property_id::text,0));
 select * into r from public.rental_reservations where id=p_reservation_id for update;
 if public.is_tier1_verified(actor) is not true then raise exception 'Active Tier 1 required' using errcode='42501'; end if;
 payload:=jsonb_build_object('revision',p_expected_revision,'action',p_action,'note',note);
 select * into prior from rentlease_reservations.events where operation_id=p_operation_id;
 if found then
 if prior.reservation_id<>r.id or prior.actor_id<>actor or prior.input<>payload then raise exception 'Operation ID already used' using errcode='23505'; end if;
 return rentlease_reservations.project(r.id); end if;
 if r.revision<>p_expected_revision then raise exception 'Reservation changed; refresh' using errcode='40001'; end if;
 if r.status not in('pending','approved') then raise exception 'Reservation is final' using errcode='22023'; end if;
 if p_action='expire' then
 if r.expires_at>clock_timestamp() then raise exception 'Reservation has not expired' using errcode='22023'; end if;
 r.status:='expired';
 else
 if r.expires_at<=clock_timestamp() then raise exception 'Reservation expired' using errcode='22023'; end if;
 if p_action in('approve','decline') and (actor<>r.landlord_id or r.status<>'pending') then raise exception 'Pending reservation owner required' using errcode='42501'; end if;
 if p_action='approve' then
 if r.move_in_date<=(clock_timestamp() at time zone 'Asia/Manila')::date or public.is_tier1_verified(r.tenant_id) is not true or not exists(
 select 1 from public.conversations c join public.listings l on l.id=c.listing_id join public.properties p on p.id=l.property_id where c.id=r.conversation_id and c.status='open'
 and l.property_id=r.property_id and l.landlord_id=r.landlord_id and p.landlord_id=r.landlord_id and p.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=r.move_in_date)) then raise exception 'Listing unavailable' using errcode='22023'; end if;
 if exists(select 1 from public.rental_reservations x where x.id<>r.id and x.property_id=r.property_id and x.status='approved' and x.expires_at>clock_timestamp() and daterange(x.move_in_date,x.end_date,'[)')&&daterange(r.move_in_date,r.end_date,'[)'))
 or exists(select 1 from public.tenancies t where t.property_id=r.property_id and t.status in('proposed','pending_confirmation','active') and daterange(t.start_date,coalesce(t.actual_end_date,t.expected_end_date)+1,'[)')&&daterange(r.move_in_date,r.end_date,'[)')) then raise exception 'Unit has an overlapping commitment' using errcode='23P01'; end if;
 r.status:='approved';r.expires_at:=r.end_date::timestamp at time zone 'Asia/Manila';
 elsif p_action='decline' then r.status:='declined';else r.status:='cancelled';end if;
 end if;
 update public.rental_reservations set status=r.status,expires_at=r.expires_at,response_note=note,responded_by=actor,revision=revision+1,updated_at=clock_timestamp() where id=r.id returning * into r;
 insert into rentlease_reservations.events(operation_id,reservation_id,actor_id,action,input,snapshot) values(p_operation_id,r.id,actor,p_action,payload,to_jsonb(r));
 return rentlease_reservations.project(r.id);
end $$;

-- Existing tenancy writes already use this property lock. This adds only a
-- reservation conflict check; all prior ownership/version/identity gates remain.
create function rentlease_reservations.guard_tenancy_commitment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status in('proposed','pending_confirmation','active') then
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if exists(select 1 from public.rental_reservations r where r.property_id=new.property_id and r.status='approved' and r.expires_at>clock_timestamp()
 and (r.tenant_id<>new.tenant_id or r.landlord_id<>new.landlord_id) and daterange(r.move_in_date,r.end_date,'[)')&&daterange(new.start_date,coalesce(new.actual_end_date,new.expected_end_date)+1,'[)')) then raise exception 'Unit has an overlapping reservation commitment' using errcode='23P01'; end if;
 end if;return new;
end $$;
revoke all on function rentlease_reservations.guard_tenancy_commitment() from public,anon,authenticated;
create trigger aac_reservation_tenancy_commitment before insert or update on public.tenancies for each row execute function rentlease_reservations.guard_tenancy_commitment();
revoke all on function public.get_rental_reservations(uuid,integer,integer),public.request_rental_reservation(uuid,uuid,date,integer,text),public.respond_rental_reservation(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.get_rental_reservations(uuid,integer,integer),public.request_rental_reservation(uuid,uuid,date,integer,text),public.respond_rental_reservation(uuid,uuid,integer,text,text) to authenticated;
commit;
