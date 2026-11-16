-- PREPARED LOCAL ONLY. Feature 4 ratings with tags. Not applied. See docs/design/f4-ratings-backend-design.md (decisions at its top).
-- What changes: (1) rentlease_reviews.entries gains `tags` (fixed lists per kind, max 5, deduplicated, enforced by a CHECK and by the RPC);
-- (2) submit_tenancy_review gets a 6-argument form that also REJECTS tenant -> landlord reviews (42501); the 5-argument form stays as a wrapper
-- that delegates to it, so neither path can bypass the rule; (3) get_tenancy_reviews gains tags and a `received` list (the counterpart's APPROVED
-- reviews only); (4) get_published_rental_reviews rows gain `tags`; (5) new get_review_summary(kind, id) for property, tenant and landlord.
-- No notification, no rejection reason, no existing row is touched (the one approved tenant -> landlord review stays as it is).
-- Patches are based on the HOSTED prosrc (read 2026-11-16) with md5 pins and exactly-once anchors; the original definitions are copied into the
-- private table rentlease_reviews.function_backups by this migration so the rollback restores them byte for byte.
-- Pins (hosted, read-only, 2026-11-16):
--   get_tenancy_reviews(uuid)                                8503a84e55583636a0d2ede4e1d1272d  ->  a05eacbf77b776d5d349cbba9b2245df
--   submit_tenancy_review(uuid,uuid,text,integer,text)       62fd03983b613f068191da462af4d693  (dropped, recreated as the wrapper)
--   get_published_rental_reviews(text,uuid,integer)          e0ba690c49e865d6e8c1f33b9aa209ea  ->  29c849ef9a845fdfc622b42c7fa94fce
-- Rollback: supabase/test-support/review_tags_rollback.sql (entry points, data retained) and review_tags_rollback_full.sql (only while no tags are stored).
begin;
set local lock_timeout='10s';
select set_config('rentlease.entries_before',(select count(*)::text from rentlease_reviews.entries),true);

-- ---------------------------------------------------------------------------------------------------------------------------
-- Baseline guards: stop unless every live object this migration touches or relies on is exactly what the design was written against.
-- ---------------------------------------------------------------------------------------------------------------------------
do $guard$
declare got text;
begin
 if to_regnamespace('rentlease_reviews') is null then raise exception 'rentlease_reviews is missing';end if;
 select string_agg(relname,',' order by relname) into got from pg_class where relnamespace='rentlease_reviews'::regnamespace and relkind='r';
 if got is distinct from 'entries,events,receipts' then raise exception 'rentlease_reviews tables drifted: %',got;end if;
 select string_agg(proname,',' order by proname) into got from pg_proc where pronamespace='rentlease_reviews'::regnamespace;
 if got is distinct from 'actor,guard_content,guard_user_source,immutable,tenancy' then raise exception 'rentlease_reviews functions drifted: %',got;end if;
 select md5(string_agg(c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),''),'|' order by c.relname,a.attnum)) into got
  from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where c.relnamespace='rentlease_reviews'::regnamespace and c.relkind='r';
 if got is distinct from '04c0f393900d9a33ce9ef17917af49ce' then raise exception 'rentlease_reviews columns drifted (%)',got;end if;
 select md5(string_agg(conrelid::regclass::text||'.'||conname||'='||pg_get_constraintdef(oid),'|' order by conrelid::regclass::text,conname)) into got from pg_constraint where connamespace='rentlease_reviews'::regnamespace;
 if got is distinct from 'ed1ac7c2b90b7b6de7a0183c1cc71c3f' then raise exception 'rentlease_reviews constraints drifted (%)',got;end if;
 select md5(string_agg(indexname||'='||indexdef,'|' order by indexname)) into got from pg_indexes where schemaname='rentlease_reviews';
 if got is distinct from '4998007414acdd4a9c071a86b375d26a' then raise exception 'rentlease_reviews indexes drifted (%)',got;end if;
 select md5(string_agg(tgrelid::regclass::text||'.'||tgname||'='||pg_get_triggerdef(oid),'|' order by tgrelid::regclass::text,tgname)) into got from pg_trigger where tgrelid in (select oid from pg_class where relnamespace='rentlease_reviews'::regnamespace and relkind='r') and not tgisinternal;
 if got is distinct from '2fe18ab5a7ea937a95ae04d7a1b43328' then raise exception 'rentlease_reviews triggers drifted (%)',got;end if;
 if exists(select 1 from pg_class c where c.relnamespace='rentlease_reviews'::regnamespace and c.relkind='r' and (not c.relrowsecurity or exists(select 1 from pg_policy p where p.polrelid=c.oid))) then raise exception 'rentlease_reviews RLS drifted';end if;
 if has_schema_privilege('anon','rentlease_reviews','USAGE') or has_schema_privilege('authenticated','rentlease_reviews','USAGE') or has_schema_privilege('service_role','rentlease_reviews','USAGE') then raise exception 'rentlease_reviews schema exposed';end if;
 if exists(select 1 from pg_class c, unnest(array['anon','authenticated','service_role']) r where c.relnamespace='rentlease_reviews'::regnamespace and c.relkind='r' and (has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege(r,c.oid,'SELECT,INSERT,UPDATE'))) then raise exception 'Unexpected rentlease_reviews table grant';end if;
 -- Functions patched or replaced here, and the ones they call.
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_reviews(uuid)'))) is distinct from '8503a84e55583636a0d2ede4e1d1272d' then raise exception 'get_tenancy_reviews drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)'))) is distinct from '62fd03983b613f068191da462af4d693' then raise exception 'submit_tenancy_review drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)'))) is distinct from 'e0ba690c49e865d6e8c1f33b9aa209ea' then raise exception 'get_published_rental_reviews drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_review_moderation(text,integer)'))) is distinct from '93e3270fd858ffd0421728730a5df232' then raise exception 'get_review_moderation drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.moderate_rental_review(uuid,uuid,uuid,text,text)'))) is distinct from '70396ca92553684801e891ea2383e75f' then raise exception 'moderate_rental_review drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('rentlease_reviews.actor(boolean)'))) is distinct from 'b74018fbe96fe3bf8ca14664a7c60f92' then raise exception 'rentlease_reviews.actor drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('rentlease_reviews.tenancy(uuid)'))) is distinct from 'f44edfb3b171c220d5288d8f9af37bf1' then raise exception 'rentlease_reviews.tenancy drifted';end if;
 if md5((select prosrc from pg_proc where oid=to_regprocedure('public.is_tier1_verified(uuid)'))) is distinct from 'ddd2c8ed28b61e30e23e4f3ddefe4590' then raise exception 'is_tier1_verified drifted';end if;
 -- Public properties/tenancies columns the summary reads.
 if (select count(*) from pg_attribute where attrelid='public.properties'::regclass and not attisdropped and attname=any(array['id','landlord_id','is_active']))<>3
  or (select count(*) from pg_attribute where attrelid='public.listings'::regclass and not attisdropped and attname=any(array['property_id','landlord_id','status','published_at','available_from']))<>5 then raise exception 'properties/listings columns drifted';end if;
 -- Reservation table read by the tenant/landlord access rule (the table behind respond_rental_reservation); its status values are the hosted CHECK.
 if (select string_agg(attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull,',' order by attname) from pg_attribute where attrelid='public.rental_reservations'::regclass and not attisdropped and attname in('id','tenant_id','landlord_id','property_id','status'))
   is distinct from 'id:uuid:true,landlord_id:uuid:true,property_id:uuid:true,status:text:true,tenant_id:uuid:true'
  or (select string_agg(pg_get_constraintdef(oid),'|') from pg_constraint where conrelid='public.rental_reservations'::regclass and contype='c' and pg_get_constraintdef(oid) like '%status%')
   is distinct from 'CHECK ((status = ANY (ARRAY[''pending''::text, ''approved''::text, ''declined''::text, ''cancelled''::text, ''expired''::text])))'
  or (select count(*) from pg_attribute where attrelid='public.tenancies'::regclass and not attisdropped and attname in('tenant_id','landlord_id','status'))<>3 then raise exception 'rental_reservations or tenancies columns drifted';end if;
 -- None of this feature may exist yet.
 if exists(select 1 from pg_attribute where attrelid='rentlease_reviews.entries'::regclass and attname='tags' and not attisdropped)
  or to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text,text[])') is not null or to_regprocedure('public.get_review_summary(text,uuid)') is not null
  or to_regprocedure('rentlease_reviews.valid_tags(text,text[])') is not null or to_regprocedure('rentlease_reviews.can_read_published(uuid,text,uuid)') is not null
  or to_regclass('rentlease_reviews.function_backups') is not null then raise exception 'Review tag objects already exist';end if;
end$guard$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Byte-exact copies of the three originals, for the rollback. Same private schema: no client role can read them.
-- ---------------------------------------------------------------------------------------------------------------------------
create table rentlease_reviews.function_backups(
 name text primary key,definition text not null,source_md5 text not null,saved_at timestamptz not null default statement_timestamp());
alter table rentlease_reviews.function_backups enable row level security;
revoke all on rentlease_reviews.function_backups from public,anon,authenticated,service_role;
create trigger review_function_backups_immutable before update or delete on rentlease_reviews.function_backups for each row execute function rentlease_reviews.immutable();
insert into rentlease_reviews.function_backups(name,definition,source_md5)
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid),md5(p.prosrc) from pg_proc p
 where p.oid in(to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)'),to_regprocedure('public.get_tenancy_reviews(uuid)'),to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)'));

-- ---------------------------------------------------------------------------------------------------------------------------
-- Tags: fixed lists per kind, at most 5, deduplicated. The existing content guard freezes the column after submit.
-- ---------------------------------------------------------------------------------------------------------------------------
alter table rentlease_reviews.entries add column tags text[] not null default '{}'::text[];
create function rentlease_reviews.valid_tags(p_kind text,p_tags text[]) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select coalesce(p_tags is not null and cardinality(p_tags)<=5 and array_position(p_tags,null) is null
  and cardinality(p_tags)=(select count(distinct x) from unnest(p_tags) x)
  and p_tags<@(case p_kind
   when 'property' then array['clean','good_wifi','quiet','safe_area','fair_price','well_maintained','matches_listing','good_location']::text[]
   when 'user' then array['communicated_well','respectful','paid_on_time','kept_clean','followed_rules','reported_issues_early']::text[]
   else array[]::text[] end),false)
$$;
alter table rentlease_reviews.entries add constraint entries_tags_valid check(rentlease_reviews.valid_tags(kind,tags));

-- ---------------------------------------------------------------------------------------------------------------------------
-- submit_tenancy_review: 6-argument form (hosted source plus tags, text normalization and the tenant -> landlord rejection) and a wrapper.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.submit_tenancy_review(p_tenancy_id uuid,p_operation_id uuid,p_kind text,p_rating integer,p_text text,p_tags text[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t public.tenancies;a uuid:=rentlease_reviews.actor();input jsonb;c rentlease_reviews.receipts;rid uuid:=gen_random_uuid();target uuid;result jsonb;
 txt text:=nullif(btrim(p_text),'');tag_list text[]:=coalesce(p_tags,'{}'::text[]);
begin
 t:=rentlease_reviews.tenancy(p_tenancy_id);
 if p_operation_id is null or p_kind is null or p_kind not in('property','user') or p_rating is null or p_rating not between 1 and 5 or length(txt)>2000 then raise exception 'Check review fields' using errcode='22023';end if;
 if not rentlease_reviews.valid_tags(p_kind,tag_list) then raise exception 'Check review tags' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(a::text||p_operation_id::text,3));input:=jsonb_build_object('tenancy',t.id,'kind',p_kind,'rating',p_rating,'text',txt,'tags',to_jsonb(tag_list));
 select * into c from rentlease_reviews.receipts where actor_id=a and operation_id=p_operation_id;
 if found then if c.input is distinct from input then raise exception 'Conflicting retry' using errcode='22023';end if;return c.result;end if;
 if t.status<>'ended' or t.actual_end_date is null or t.ended_at is null or t.ended_at>statement_timestamp() or t.actual_end_date>(statement_timestamp() at time zone 'Asia/Manila')::date then raise exception 'Completed tenancy required' using errcode='42501';end if;
 if p_kind='property' and a<>t.tenant_id then raise exception 'Actual tenant required' using errcode='42501';end if;
 -- Two directions only: the tenant rates the property, the landlord rates the tenant.
 if p_kind='user' and a=t.tenant_id then raise exception 'Only the landlord can rate the tenant' using errcode='42501';end if;
 if p_kind='user' then
  target:=case when a=t.tenant_id then t.landlord_id else t.tenant_id end;
  insert into public.reviews(id,tenancy_id,reviewer_id,reviewee_id,rating,comment) values(rid,t.id,a,target,p_rating,txt);
 end if;
 insert into rentlease_reviews.entries(id,kind,tenancy_id,property_id,reviewer_id,reviewee_id,user_review_id,rating,body,tags)
 values(rid,p_kind,t.id,t.property_id,a,target,case when p_kind='user' then rid end,p_rating,txt,tag_list);
 insert into rentlease_reviews.events(review_id,actor_id,action) values(rid,a,'submitted_pending');
 result:=public.get_tenancy_reviews(t.id);insert into rentlease_reviews.receipts(actor_id,operation_id,input,result) values(a,p_operation_id,input,result);return result;
end$$;
-- The old 5-argument form becomes a thin wrapper that calls the new function, so the direction rule and the tag rules cannot be bypassed.
drop function public.submit_tenancy_review(uuid,uuid,text,integer,text);
create function public.submit_tenancy_review(p_tenancy_id uuid,p_operation_id uuid,p_kind text,p_rating integer,p_text text) returns jsonb
language sql security definer set search_path=pg_catalog as $$
 select public.submit_tenancy_review(p_tenancy_id,p_operation_id,p_kind,p_rating,p_text,array[]::text[])
$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Anchor patches, based on the hosted source. Each anchor must occur EXACTLY ONCE, the edit must be exactly reversible, the result must match
-- the recorded md5, and owner, ACL, security-definer flag, config, volatility and return type must be identical afterwards.
-- ---------------------------------------------------------------------------------------------------------------------------
do $patch$
declare
 gtr oid:=to_regprocedure('public.get_tenancy_reviews(uuid)');
 gpr oid:=to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)');
 g_a1 constant text:=$g1a$'createdAt',e.created_at)) from rentlease_reviews.entries e where e.tenancy_id=t.id and e.reviewer_id=a)$g1a$;
 g_b1 constant text:=$g1b$'createdAt',e.created_at,'tags',to_jsonb(e.tags))) from rentlease_reviews.entries e where e.tenancy_id=t.id and e.reviewer_id=a)$g1b$;
 g_a2 constant text:=$g2a$'legacyUserReview',exists($g2a$;
 g_b2 constant text:=$g2b$'received',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'rating',r.rating,'text',r.body,'tags',to_jsonb(r.tags),'createdAt',r.created_at,'reviewerRole',case when r.reviewer_id=t.landlord_id then 'landlord' else 'tenant' end) order by r.created_at,r.id) from rentlease_reviews.entries r where r.tenancy_id=t.id and r.status='approved' and r.reviewer_id<>a and ((r.kind='user' and r.reviewee_id=a) or (r.kind='property' and a=t.landlord_id))),'[]'::jsonb),
 'legacyUserReview',exists($g2b$;
 p_a1 constant text:=$p1a$'reviewerRole',case when q.reviewer_is_landlord then 'landlord' else 'tenant' end)$p1a$;
 p_b1 constant text:=$p1b$'reviewerRole',case when q.reviewer_is_landlord then 'landlord' else 'tenant' end,'tags',to_jsonb(q.tags))$p1b$;
 old_src text;old_def text;new_def text;new_src text;before_meta text;after_meta text;
 meta constant text:='concat_ws(''|'',pg_get_userbyid(proowner),proacl::text,prosecdef::text,provolatile::text,proconfig::text,proisstrict::text,prorettype::regtype::text,proargtypes::text,pronargdefaults::text)';
begin
 -- get_tenancy_reviews: tags on own rows, and the counterpart's approved reviews as `received`.
 select prosrc,pg_get_functiondef(oid) into old_src,old_def from pg_proc where oid=gtr;
 if md5(old_src)<>'8503a84e55583636a0d2ede4e1d1272d' then raise exception 'get_tenancy_reviews source drift';end if;
 if (length(old_def)-length(replace(old_def,g_a1,'')))/length(g_a1)<>1 then raise exception 'Anchor G1 must occur exactly once';end if;
 if (length(old_def)-length(replace(old_def,g_a2,'')))/length(g_a2)<>1 then raise exception 'Anchor G2 must occur exactly once';end if;
 if position(g_b1 in old_def)>0 or position(g_b2 in old_def)>0 then raise exception 'The get_tenancy_reviews edit is already present';end if;
 execute 'select '||meta||' from pg_proc where oid='||gtr::int into before_meta;
 new_def:=replace(replace(old_def,g_a1,g_b1),g_a2,g_b2);
 execute new_def;
 select prosrc into new_src from pg_proc where oid=gtr;
 execute 'select '||meta||' from pg_proc where oid='||gtr::int into after_meta;
 if md5(new_src)<>'a05eacbf77b776d5d349cbba9b2245df' then raise exception 'Patched get_tenancy_reviews does not match the reviewed result (%)',md5(new_src);end if;
 if replace(replace(new_src,g_b2,g_a2),g_b1,g_a1)<>old_src then raise exception 'The get_tenancy_reviews edit is not exactly reversible';end if;
 if before_meta<>after_meta then raise exception 'get_tenancy_reviews owner, ACL or settings changed: % vs %',before_meta,after_meta;end if;
 -- get_published_rental_reviews: tags on each row.
 select prosrc,pg_get_functiondef(oid) into old_src,old_def from pg_proc where oid=gpr;
 if md5(old_src)<>'e0ba690c49e865d6e8c1f33b9aa209ea' then raise exception 'get_published_rental_reviews source drift';end if;
 if (length(old_def)-length(replace(old_def,p_a1,'')))/length(p_a1)<>1 then raise exception 'Anchor P1 must occur exactly once';end if;
 if position(p_b1 in old_def)>0 then raise exception 'The get_published_rental_reviews edit is already present';end if;
 execute 'select '||meta||' from pg_proc where oid='||gpr::int into before_meta;
 new_def:=replace(old_def,p_a1,p_b1);
 execute new_def;
 select prosrc into new_src from pg_proc where oid=gpr;
 execute 'select '||meta||' from pg_proc where oid='||gpr::int into after_meta;
 if md5(new_src)<>'29c849ef9a845fdfc622b42c7fa94fce' then raise exception 'Patched get_published_rental_reviews does not match the reviewed result (%)',md5(new_src);end if;
 if replace(new_src,p_b1,p_a1)<>old_src then raise exception 'The get_published_rental_reviews edit is not exactly reversible';end if;
 if before_meta<>after_meta then raise exception 'get_published_rental_reviews owner, ACL or settings changed: % vs %',before_meta,after_meta;end if;
end$patch$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Summary read. The access rule is the same one get_published_rental_reviews uses (a private helper; the checks assert both agree).
-- property: that property's approved property reviews. tenant: approved landlord -> tenant reviews about that person.
-- Access (tenant, landlord): self; any tenancy between the two; a pending or approved reservation request between them (tenant: the actor
-- is the property landlord and the target the requester; landlord: the actor is the requester); landlord also by an active published listing.
-- landlord: approved property reviews across every property the landlord owns. profile_rating_summary is never used.
-- ---------------------------------------------------------------------------------------------------------------------------
create function rentlease_reviews.can_read_published(p_actor uuid,p_kind text,p_target uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select case p_kind
  when 'property' then exists(select 1 from public.properties p where p.id=p_target and (p.landlord_id=p_actor or exists(select 1 from public.tenancies t where t.property_id=p.id and p_actor in(t.tenant_id,t.landlord_id)) or (p.is_active and exists(select 1 from public.listings l where l.property_id=p.id and l.landlord_id=p.landlord_id and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date)))))
  when 'tenant' then (p_target=p_actor or exists(select 1 from public.tenancies t where (t.tenant_id=p_actor and t.landlord_id=p_target) or (t.landlord_id=p_actor and t.tenant_id=p_target)) or exists(select 1 from public.rental_reservations r where r.landlord_id=p_actor and r.tenant_id=p_target and r.status in('pending','approved')))
  when 'landlord' then (p_target=p_actor or exists(select 1 from public.tenancies t where (t.tenant_id=p_actor and t.landlord_id=p_target) or (t.landlord_id=p_actor and t.tenant_id=p_target)) or exists(select 1 from public.rental_reservations r where r.tenant_id=p_actor and r.landlord_id=p_target and r.status in('pending','approved')) or exists(select 1 from public.listings l join public.properties p on p.id=l.property_id where l.landlord_id=p_target and p.landlord_id=p_target and p.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date)))
  else false end
$$;
create function public.get_review_summary(p_kind text,p_target_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=rentlease_reviews.actor();result jsonb;
begin
 if p_kind is null or p_kind not in('property','tenant','landlord') or p_target_id is null then raise exception 'Invalid review summary target' using errcode='22023';end if;
 if not rentlease_reviews.can_read_published(a,p_kind,p_target_id) then raise exception 'Access unavailable' using errcode='42501';end if;
 with base as (
  select e.rating,e.tags from rentlease_reviews.entries e join public.tenancies t on t.id=e.tenancy_id join public.properties p on p.id=e.property_id
  where e.status='approved' and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null
   and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp()
   and (case p_kind
    when 'property' then (e.kind='property' and e.property_id=p_target_id)
    when 'tenant' then (e.kind='user' and e.reviewee_id=p_target_id and e.reviewer_id=t.landlord_id)
    else (e.kind='property' and p.landlord_id=p_target_id) end))
 select jsonb_build_object('kind',p_kind,'targetId',p_target_id,'count',(select count(*) from base),'average',(select round(avg(rating),2) from base),
  'distribution',(select jsonb_build_array(count(*) filter (where rating=1),count(*) filter (where rating=2),count(*) filter (where rating=3),count(*) filter (where rating=4),count(*) filter (where rating=5)) from base),
  'tags',(select coalesce(jsonb_agg(jsonb_build_object('tag',z.tag,'count',z.n) order by z.n desc,z.tag),'[]'::jsonb) from (select u.tag,count(*) n from base b cross join lateral unnest(b.tags) as u(tag) group by u.tag order by count(*) desc,u.tag limit 8) z))
 into result;
 return result;
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Grants: authenticated only, never anon. The private schema stays closed.
-- ---------------------------------------------------------------------------------------------------------------------------
revoke all on all functions in schema rentlease_reviews from public,anon,authenticated,service_role;
revoke all on function public.submit_tenancy_review(uuid,uuid,text,integer,text,text[]),public.submit_tenancy_review(uuid,uuid,text,integer,text),public.get_review_summary(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_tenancy_review(uuid,uuid,text,integer,text,text[]),public.submit_tenancy_review(uuid,uuid,text,integer,text),public.get_review_summary(text,uuid) to authenticated;

-- Post-conditions: stop (and roll everything back) if the final state is not what was designed.
do $post$
declare fns oid[]:=array[to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text,text[])'),to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)'),to_regprocedure('public.get_review_summary(text,uuid)'),
  to_regprocedure('public.get_tenancy_reviews(uuid)'),to_regprocedure('public.get_published_rental_reviews(text,uuid,integer)'),to_regprocedure('public.get_review_moderation(text,integer)'),to_regprocedure('public.moderate_rental_review(uuid,uuid,uuid,text,text)')];
 f oid;before_count bigint:=current_setting('rentlease.entries_before')::bigint;
begin
 foreach f in array fns loop
  if f is null then raise exception 'A review function is missing';end if;
  if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'Review function grants are wrong: %',f::regprocedure;end if;
  if exists(select 1 from pg_proc p where p.oid=f and (not p.prosecdef and p.prolang<>(select oid from pg_language where lanname='sql') or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres')) then raise exception 'Review function definition drifted: %',f::regprocedure;end if;
 end loop;
 if exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)') and not p.prosecdef) then raise exception 'Wrapper must be security definer';end if;
 if exists(select 1 from pg_proc p where p.pronamespace='rentlease_reviews'::regnamespace and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'Private review function exposed';end if;
 if exists(select 1 from pg_class c, unnest(array['anon','authenticated','service_role']) r where c.relnamespace='rentlease_reviews'::regnamespace and c.relkind='r' and has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE')) then raise exception 'Private review table exposed';end if;
 if (select count(*) from rentlease_reviews.entries)<>before_count or exists(select 1 from rentlease_reviews.entries where tags<>'{}'::text[]) then raise exception 'Existing review rows changed';end if;
 if (select count(*) from rentlease_reviews.function_backups)<>3 or exists(select 1 from rentlease_reviews.function_backups where source_md5 not in('62fd03983b613f068191da462af4d693','8503a84e55583636a0d2ede4e1d1272d','e0ba690c49e865d6e8c1f33b9aa209ea')) then raise exception 'Function backups are not the pinned originals';end if;
end$post$;
commit;
