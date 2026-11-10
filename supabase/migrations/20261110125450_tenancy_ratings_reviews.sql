-- T7A LOCAL ONLY. No NLP processor, public direct writes, or automatic publication.
begin;
-- Serialize legacy snapshots and managed-source guard installation with existing writers.
lock table public.reviews in share row exclusive mode;
create schema rentlease_reviews;
revoke all on schema rentlease_reviews from public,anon,authenticated,service_role;
do $$begin
 if has_table_privilege('authenticated','public.reviews','select,insert,update,delete') or has_any_column_privilege('authenticated','public.reviews','select,insert,update') then raise exception 'Unexpected direct review grants';end if;
end$$;
create table rentlease_reviews.entries(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('property','user')),
 tenancy_id uuid not null references public.tenancies(id) on delete restrict,
 property_id uuid not null references public.properties(id) on delete restrict,
 reviewer_id uuid not null,reviewee_id uuid,user_review_id uuid unique references public.reviews(id) on delete restrict,
 rating smallint not null check(rating between 1 and 5),body text check(length(body)<=2000),
 status text not null default 'pending' check(status in('pending','approved','rejected','hidden')),
 revision uuid not null default gen_random_uuid(),created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),moderated_at timestamptz,
 unique(tenancy_id,reviewer_id,kind),
 check((kind='property' and reviewee_id is null and user_review_id is null) or (kind='user' and reviewee_id is not null and reviewee_id<>reviewer_id and user_review_id is not null)));
create index review_public_property on rentlease_reviews.entries(property_id,created_at desc,id) where kind='property' and status='approved';
create index review_public_user on rentlease_reviews.entries(reviewee_id,created_at desc,id) where kind='user' and status='approved';
create index review_queue on rentlease_reviews.entries(status,created_at,id);
create table rentlease_reviews.events(id uuid primary key default gen_random_uuid(),review_id uuid not null references rentlease_reviews.entries(id) on delete restrict,actor_id uuid,action text not null,note text,created_at timestamptz not null default statement_timestamp());
create table rentlease_reviews.receipts(actor_id uuid not null,operation_id uuid not null,input jsonb not null,result jsonb not null,created_at timestamptz not null default statement_timestamp(),primary key(actor_id,operation_id));
alter table rentlease_reviews.entries enable row level security;
alter table rentlease_reviews.events enable row level security;
alter table rentlease_reviews.receipts enable row level security;
revoke all on all tables in schema rentlease_reviews from public,anon,authenticated,service_role;
-- Existing reviews have no approval provenance. Import valid history as pending only.
insert into rentlease_reviews.entries(id,kind,tenancy_id,property_id,reviewer_id,reviewee_id,user_review_id,rating,body,created_at,updated_at)
 select r.id,'user',t.id,t.property_id,r.reviewer_id,r.reviewee_id,r.id,r.rating,r.comment,r.created_at,r.updated_at
 from public.reviews r join public.tenancies t on t.id=r.tenancy_id
 where t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp()
 and ((r.reviewer_id=t.tenant_id and r.reviewee_id=t.landlord_id) or (r.reviewer_id=t.landlord_id and r.reviewee_id=t.tenant_id))
 and r.rating between 1 and 5 and (r.comment is null or length(r.comment)<=2000);
insert into rentlease_reviews.events(review_id,action) select id,'imported_pending' from rentlease_reviews.entries;
create function rentlease_reviews.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'Review evidence is immutable' using errcode='42501';end$$;
create trigger review_events_immutable before update or delete on rentlease_reviews.events for each row execute function rentlease_reviews.immutable();
create trigger review_receipts_immutable before update or delete on rentlease_reviews.receipts for each row execute function rentlease_reviews.immutable();
create function rentlease_reviews.guard_content() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if TG_OP='DELETE' then raise exception 'Review evidence cannot be deleted' using errcode='42501';end if;
 if (to_jsonb(new)-array['status','revision','updated_at','moderated_at']) is distinct from (to_jsonb(old)-array['status','revision','updated_at','moderated_at']) then raise exception 'Original review text and binding are immutable' using errcode='42501';end if;return new;end$$;
create trigger review_content_immutable before update or delete on rentlease_reviews.entries for each row execute function rentlease_reviews.guard_content();
create function rentlease_reviews.guard_user_source() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from rentlease_reviews.entries where user_review_id=old.id) then raise exception 'Managed review source is immutable' using errcode='42501';end if;
 if TG_OP='DELETE' then return old;end if;return new;end$$;
create trigger managed_review_immutable before update or delete on public.reviews for each row execute function rentlease_reviews.guard_user_source();
-- Defense in depth: raw legacy rows never become a public moderation bypass.
create policy review_rpc_only on public.reviews as restrictive for all to authenticated using(false) with check(false);
create function rentlease_reviews.actor(p_admin boolean default false) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();begin
 if a is null then raise exception 'Access unavailable' using errcode='42501';end if;
 if p_admin then
  if public.is_admin(a) is not true or not exists(select 1 from public.profiles where id=a and account_status='active') then raise exception 'Active Admin required' using errcode='42501';end if;
 elsif public.is_tier1_verified(a) is not true then raise exception 'Active Tier 1 required' using errcode='42501';end if;return a;end$$;
create function rentlease_reviews.tenancy(p_id uuid) returns public.tenancies language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_reviews.actor();t public.tenancies;target uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 select property_id into target from public.tenancies where id=p_id and a in(tenant_id,landlord_id);
 if target is null then raise exception 'Access unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into t from public.tenancies where id=p_id and a in(tenant_id,landlord_id) for share;
 if t.id is null then raise exception 'Access unavailable' using errcode='42501';end if;return t;
end$$;
create function public.get_tenancy_reviews(p_tenancy_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies;a uuid:=rentlease_reviews.actor();begin
 t:=rentlease_reviews.tenancy(p_tenancy_id);
 return jsonb_build_object('tenancyId',t.id,'propertyId',t.property_id,'tenantId',t.tenant_id,'landlordId',t.landlord_id,'eligible',t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp(),
 'own',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'rating',e.rating,'text',e.body,'status',e.status,'revision',e.revision,'createdAt',e.created_at)) from rentlease_reviews.entries e where e.tenancy_id=t.id and e.reviewer_id=a),'[]'::jsonb),
 'legacyUserReview',exists(select 1 from public.reviews r where r.tenancy_id=t.id and r.reviewer_id=a and not exists(select 1 from rentlease_reviews.entries e where e.user_review_id=r.id)));
end$$;
create function public.submit_tenancy_review(p_tenancy_id uuid,p_operation_id uuid,p_kind text,p_rating integer,p_text text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies;a uuid:=rentlease_reviews.actor();input jsonb;c rentlease_reviews.receipts;rid uuid:=gen_random_uuid();target uuid;result jsonb;
begin
 t:=rentlease_reviews.tenancy(p_tenancy_id);
 if p_operation_id is null or p_kind is null or p_kind not in('property','user') or p_rating is null or p_rating not between 1 and 5 or length(p_text)>2000 then raise exception 'Check review fields' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(a::text||p_operation_id::text,3));input:=jsonb_build_object('tenancy',t.id,'kind',p_kind,'rating',p_rating,'text',p_text);
 select * into c from rentlease_reviews.receipts where actor_id=a and operation_id=p_operation_id;
 if found then if c.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;return c.result;end if;
 if t.status<>'ended' or t.actual_end_date is null or t.ended_at is null or t.ended_at>statement_timestamp() or t.actual_end_date>(statement_timestamp() at time zone 'Asia/Manila')::date then raise exception 'Completed tenancy required' using errcode='42501';end if;
 if p_kind='property' and a<>t.tenant_id then raise exception 'Actual tenant required' using errcode='42501';end if;
 if p_kind='user' then
  target:=case when a=t.tenant_id then t.landlord_id else t.tenant_id end;
  insert into public.reviews(id,tenancy_id,reviewer_id,reviewee_id,rating,comment) values(rid,t.id,a,target,p_rating,p_text);
 end if;
 insert into rentlease_reviews.entries(id,kind,tenancy_id,property_id,reviewer_id,reviewee_id,user_review_id,rating,body)
 values(rid,p_kind,t.id,t.property_id,a,target,case when p_kind='user' then rid end,p_rating,p_text);
 insert into rentlease_reviews.events(review_id,actor_id,action) values(rid,a,'submitted_pending');
 result:=public.get_tenancy_reviews(t.id);insert into rentlease_reviews.receipts(actor_id,operation_id,input,result) values(a,p_operation_id,input,result);return result;
end$$;
create function public.get_published_rental_reviews(p_kind text,p_target_id uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_reviews.actor();result jsonb;
begin
 if p_kind is null or p_kind not in('property','user') or p_target_id is null or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid review target/page' using errcode='22023';end if;
 if p_kind='property' then
  if not exists(select 1 from public.properties p where p.id=p_target_id and (p.landlord_id=a or exists(select 1 from public.tenancies t where t.property_id=p.id and a in(t.tenant_id,t.landlord_id)) or (p.is_active and exists(select 1 from public.listings l where l.property_id=p.id and l.landlord_id=p.landlord_id and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))))) then raise exception 'Access unavailable' using errcode='42501';end if;
 else
  if not(p_target_id=a or exists(select 1 from public.tenancies t where t.status='ended' and ((t.tenant_id=a and t.landlord_id=p_target_id) or (t.landlord_id=a and t.tenant_id=p_target_id))) or exists(select 1 from public.listings l join public.properties p on p.id=l.property_id where l.landlord_id=p_target_id and p.landlord_id=p_target_id and p.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))) then raise exception 'Access unavailable' using errcode='42501';end if;
 end if;
 select jsonb_build_object('kind',p_kind,'targetId',p_target_id,'count',count(*),'average',avg(e.rating),'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'propertyId',case when q.kind='property' then q.property_id end,'rating',q.rating,'text',q.body,'revision',q.revision,'createdAt',q.created_at,'updatedAt',q.updated_at,'moderatedAt',q.moderated_at)),'[]'::jsonb) from (select x.* from rentlease_reviews.entries x join public.tenancies t on t.id=x.tenancy_id where x.kind=p_kind and x.status='approved' and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp() and (case when p_kind='property' then x.property_id else x.reviewee_id end)=p_target_id order by x.created_at desc,x.id limit 20 offset p_offset) q)) into result
 from rentlease_reviews.entries e join public.tenancies t on t.id=e.tenancy_id where e.kind=p_kind and e.status='approved' and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp() and (case when p_kind='property' then e.property_id else e.reviewee_id end)=p_target_id;
 return result;
end$$;
create function public.get_review_moderation(p_status text default 'pending',p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform rentlease_reviews.actor(true);
 if p_status is null or p_status not in('pending','approved','rejected','hidden') or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page/state' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'propertyId',e.property_id,'rating',e.rating,'text',e.body,'status',e.status,'revision',e.revision,'createdAt',e.created_at,'history',(select coalesce(jsonb_agg(jsonb_build_object('action',h.action,'note',h.note,'createdAt',h.created_at)),'[]'::jsonb) from (select * from rentlease_reviews.events where review_id=e.id order by created_at desc,id limit 20) h))) from (select * from rentlease_reviews.entries where status=p_status order by created_at,id limit 20 offset p_offset) e),'[]'::jsonb);
end$$;
create function public.moderate_rental_review(p_review_id uuid,p_operation_id uuid,p_revision uuid,p_status text,p_note text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_reviews.actor(true);e rentlease_reviews.entries;c rentlease_reviews.receipts;input jsonb;result jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if p_operation_id is null or p_status is null or p_status not in('approved','rejected','hidden') or p_note is null or length(btrim(p_note)) not between 1 and 1000 then raise exception 'Moderation decision/note required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(a::text||p_operation_id::text,3));input:=jsonb_build_object('review',p_review_id,'revision',p_revision,'status',p_status,'note',p_note);
 select * into c from rentlease_reviews.receipts where actor_id=a and operation_id=p_operation_id;
 if found then if c.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;return c.result;end if;
 select * into e from rentlease_reviews.entries where id=p_review_id for update;
 if e.id is null then raise exception 'Review unavailable' using errcode='42501';end if;
 if p_status='approved' and not exists(select 1 from public.tenancies t where t.id=e.tenancy_id and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp()) then raise exception 'Eligible completed tenancy required' using errcode='42501';end if;
 if a=e.reviewer_id or a=e.reviewee_id or exists(select 1 from public.tenancies t where t.id=e.tenancy_id and a in(t.tenant_id,t.landlord_id)) then raise exception 'Independent moderator required' using errcode='42501';end if;
 if e.revision is distinct from p_revision then raise exception 'Review changed. Reload.' using errcode='40001';end if;
 if not ((e.status='pending' and p_status in('approved','rejected')) or (e.status='approved' and p_status='hidden') or (e.status in('rejected','hidden') and p_status in('approved','rejected') and e.status<>p_status)) then raise exception 'Transition unavailable' using errcode='22023';end if;
 update rentlease_reviews.entries set status=p_status,revision=gen_random_uuid(),updated_at=statement_timestamp(),moderated_at=statement_timestamp() where id=e.id;
 insert into rentlease_reviews.events(review_id,actor_id,action,note) values(e.id,a,p_status,p_note);
 result:=jsonb_build_object('id',e.id,'status',p_status);insert into rentlease_reviews.receipts(actor_id,operation_id,input,result) values(a,p_operation_id,input,result);return result;
end$$;
revoke all on all functions in schema rentlease_reviews from public,anon,authenticated,service_role;
revoke all on function public.get_tenancy_reviews(uuid),public.submit_tenancy_review(uuid,uuid,text,integer,text),public.get_published_rental_reviews(text,uuid,integer),public.get_review_moderation(text,integer),public.moderate_rental_review(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_tenancy_reviews(uuid),public.submit_tenancy_review(uuid,uuid,text,integer,text),public.get_published_rental_reviews(text,uuid,integer),public.get_review_moderation(text,integer),public.moderate_rental_review(uuid,uuid,uuid,text,text) to authenticated;
commit;
