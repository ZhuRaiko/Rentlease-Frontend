-- PREPARED LOCAL ONLY. Feature 5 public profiles. Not applied. See docs/design/f5-profiles-backend-design.md (decisions in the Step 1 request).
-- What changes: (1) public.get_public_profile(p_user_id) returns a WHITELIST only (nickname, avatar, idVerified, roles, relationship flag, a landlord block and a tenant block);
-- (2) private helpers in the new closed schema rentlease_profiles (can_view, relationship, id_verified, recent_reviews) and rentlease_reviews (approved_set, summarize).
-- can_read_public_identity, get_public_identities, get_review_summary and the reservation projection are NOT changed (pins below must still match).
-- Access: the caller must be an active Tier 1 account and the target an active account; the target is visible when it is the caller, a landlord with an active published listing,
-- or someone the caller shares a NON-BLOCKED conversation or a tenancy with. A refused or missing user, a null id and a caller without a session all raise 42501 'Profile unavailable'.
-- roles: user_roles, plus facts (an owned published listing -> landlord; a tenancy, conversation or reservation as tenant_id, any status -> tenant). The tenant block is returned only for the caller's own profile or with a shared conversation or tenancy. No table, column or data changes.
-- Pins (hosted, read-only, 2026-11-16):
--   can_read_public_identity(uuid) ce7a49ff8184972232e5d000cb2135cc   get_public_identities(uuid[]) ef1a0176b11b9fe926b121fe4a79d8b3
--   get_review_summary(text,uuid) 78f27537f0afaa46caf35cc96dfb8922     rentlease_reviews.can_read_published cb1557227dac289543f2260ed0babe68
--   rentlease_property_identity.verified 199b17b6693820eb3b69e6357638e99f   get_recommendation_owner_verification ffc8b7377e5696bb11e99db47104a555   is_tier1_verified ddd2c8ed28b61e30e23e4f3ddefe4590
-- Rollback: supabase/test-support/public_profiles_rollback.sql (nothing is stored, so it removes the functions and the private schema).
begin;
set local lock_timeout='10s';

-- ---------------------------------------------------------------------------------------------------------------------------
-- Baseline guards: stop unless every live object this migration reads or relies on is exactly what the design was written against.
-- ---------------------------------------------------------------------------------------------------------------------------
do $guard$
declare got text;f text;
begin
 for f,got in select * from (values
  ('public.can_read_public_identity(uuid)','ce7a49ff8184972232e5d000cb2135cc'),('public.get_public_identities(uuid[])','ef1a0176b11b9fe926b121fe4a79d8b3'),
  ('public.get_review_summary(text,uuid)','78f27537f0afaa46caf35cc96dfb8922'),('rentlease_reviews.can_read_published(uuid,text,uuid)','cb1557227dac289543f2260ed0babe68'),
  ('rentlease_property_identity.verified(uuid)','199b17b6693820eb3b69e6357638e99f'),('public.get_recommendation_owner_verification(uuid[])','ffc8b7377e5696bb11e99db47104a555'),
  ('public.is_tier1_verified(uuid)','ddd2c8ed28b61e30e23e4f3ddefe4590')) v(a,b)
 loop
  if md5((select prosrc from pg_proc where oid=to_regprocedure(f))) is distinct from got then raise exception 'Function drifted: %',f;end if;
 end loop;
 for f,got in select * from (values
  ('public.profiles','de8f4f0dead0e63eece818d3671c194d'),('public.user_roles','f0cf385bcc9c0c386cfcb61f565eb900'),('public.tenancies','d3a6c191562c99faeb9d5ea1fda38721'),
  ('public.listings','6376a0dfd9779a387ab10ca7885d90c5'),('public.properties','d10d4e24850d3962a74c629b64e0724c'),('public.conversations','2b03ebe59bb52541acbb5ab46971341f'),
  ('public.verification_submissions','59ec02ed703e9baf08c3d9168a3402f1'),('rentlease_reviews.entries','d3cb9f713ceb4c9f8df25bd01b746c5f')) v(a,b)
 loop
  if (select md5(string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull,'|' order by a.attname)) from pg_attribute a where a.attrelid=f::regclass and a.attnum>0 and not a.attisdropped) is distinct from got then raise exception 'Columns drifted: %',f;end if;
 end loop;
 if (select enum_range(null::public.conversation_status)::text||enum_range(null::public.app_role)::text||enum_range(null::public.verification_tier)::text||enum_range(null::public.account_status)::text) is distinct from
  '{open,closed,blocked}{tenant,landlord,admin}{tier_2_identity,tier_3_property}{active,restricted,suspended,deleted}' then raise exception 'Enum values drifted';end if;
 select string_agg(proname,',' order by proname) into got from pg_proc where pronamespace='rentlease_reviews'::regnamespace;
 if got is distinct from 'actor,can_read_published,guard_content,guard_user_source,immutable,tenancy,valid_tags' then raise exception 'rentlease_reviews functions drifted: %',got;end if;
 -- rental_reservations: only these five columns are read (a person is a tenant if they are the tenant_id of any reservation, any status).
 if (select string_agg(attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull,',' order by attname) from pg_attribute where attrelid='public.rental_reservations'::regclass and not attisdropped and attname in('id','tenant_id','landlord_id','property_id','status')) is distinct from 'id:uuid:true,landlord_id:uuid:true,property_id:uuid:true,status:text:true,tenant_id:uuid:true' then raise exception 'rental_reservations columns drifted';end if;
 if not exists(select 1 from pg_class where oid='public.profiles'::regclass and relrowsecurity) or not exists(select 1 from pg_class where oid='public.tenancies'::regclass and relrowsecurity) then raise exception 'RLS drifted';end if;
 -- None of this feature may exist yet.
 if to_regnamespace('rentlease_profiles') is not null or to_regprocedure('public.get_public_profile(uuid)') is not null or to_regprocedure('rentlease_reviews.summarize(text,uuid)') is not null
  or to_regprocedure('rentlease_reviews.approved_set(text,uuid)') is not null then raise exception 'Public profile objects already exist';end if;
end$guard$;

create schema rentlease_profiles;
revoke all on schema rentlease_profiles from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Private helpers (no client grant).
-- ---------------------------------------------------------------------------------------------------------------------------
-- The caller and target share a conversation that is not blocked, or are parties of one tenancy (any status). Never true for the same person.
create function rentlease_profiles.relationship(p_actor uuid,p_target uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null and p_target is not null and p_actor<>p_target and (
  exists(select 1 from public.conversations c where c.status<>'blocked' and p_actor in(c.tenant_id,c.landlord_id) and p_target in(c.tenant_id,c.landlord_id))
  or exists(select 1 from public.tenancies t where p_actor in(t.tenant_id,t.landlord_id) and p_target in(t.tenant_id,t.landlord_id)))
$$;
-- Who may see a profile. Same shape as can_read_public_identity (active caller and target, Tier 1 caller, public landlord or a relationship), with the relationship rule above.
create function rentlease_profiles.can_view(p_actor uuid,p_target uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null and p_target is not null
  and exists(select 1 from public.profiles a where a.id=p_actor and a.account_status='active')
  and exists(select 1 from public.profiles t where t.id=p_target and t.account_status='active')
  and (p_actor=p_target or (public.is_tier1_verified(p_actor) and (
   exists(select 1 from public.listings l join public.properties pr on pr.id=l.property_id where l.landlord_id=p_target and pr.landlord_id=p_target and pr.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date))
   or rentlease_profiles.relationship(p_actor,p_target))))
$$;
-- "ID verified": ONE strict rule, the one get_recommendation_owner_verification uses for owners (exactly one approved Tier 2 submission, reviewed by someone, reviewed in the past, and the
-- profile timestamp equal to its review time), plus an active Tier 1 account. Anything unclear is false, never "unknown".
create function rentlease_profiles.id_verified(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce((select p.tier2_verified_at is not null and v.approvals=1 and v.trusted=1 and p.tier2_verified_at=v.approved_at
  from public.profiles p cross join lateral (
   select count(*) as approvals,count(*) filter (where s.property_id is null and s.reviewed_by is not null and s.reviewed_at is not null and s.reviewed_at<=statement_timestamp()) as trusted,max(s.reviewed_at) as approved_at
   from public.verification_submissions s where s.user_id=p.id and s.tier='tier_2_identity'::public.verification_tier and s.status='approved'::public.verification_status) v
  where p.id=p_user and p.account_status='active' and p.tier1_verified_at is not null),false)
$$;
-- The approved review set, the same filters get_review_summary uses (approved, ended and eligible tenancy). tenant: landlord to tenant reviews about that person.
-- landlord: property reviews across every property the landlord owns. No gate: callers gate first. Parity with get_review_summary is asserted by the checks.
create function rentlease_reviews.approved_set(p_kind text,p_target uuid) returns table(id uuid,rating smallint,body text,tags text[],created_at timestamptz,reviewer_id uuid,property_id uuid)
language sql stable security definer set search_path=pg_catalog as $$
 select e.id,e.rating,e.body,e.tags,e.created_at,e.reviewer_id,e.property_id
 from rentlease_reviews.entries e join public.tenancies t on t.id=e.tenancy_id join public.properties p on p.id=e.property_id
 where e.status='approved' and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null
  and t.actual_end_date<=(statement_timestamp() at time zone 'Asia/Manila')::date and t.ended_at<=statement_timestamp()
  and (case p_kind
   when 'tenant' then (e.kind='user' and e.reviewee_id=p_target and e.reviewer_id=t.landlord_id)
   when 'landlord' then (e.kind='property' and p.landlord_id=p_target)
   else false end)
$$;
create function rentlease_reviews.summarize(p_kind text,p_target uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 with base as (select * from rentlease_reviews.approved_set(p_kind,p_target))
 select jsonb_build_object('count',(select count(*) from base),'average',(select round(avg(rating),2) from base),
  'distribution',(select jsonb_build_array(count(*) filter (where rating=1),count(*) filter (where rating=2),count(*) filter (where rating=3),count(*) filter (where rating=4),count(*) filter (where rating=5)) from base),
  'tags',(select coalesce(jsonb_agg(jsonb_build_object('tag',z.tag,'count',z.n) order by z.n desc,z.tag),'[]'::jsonb) from (select u.tag,count(*) n from base b cross join lateral unnest(b.tags) as u(tag) group by u.tag order by count(*) desc,u.tag limit 8) z),
  'reviewers',(select count(distinct reviewer_id) from base))
$$;
-- Newest reviews, no ids. A landlord's review carries the property's title from its latest PUBLISHED listing, else "A property". A tenant's review carries no property name.
create function rentlease_profiles.recent_reviews(p_kind text,p_target uuid,p_limit integer) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(
  case when p_kind='landlord'
   then jsonb_build_object('rating',r.rating,'text',r.body,'tags',to_jsonb(r.tags),'createdAt',r.created_at,'reviewerRole','tenant','propertyTitle',coalesce(r.title,'A property'))
   else jsonb_build_object('rating',r.rating,'text',r.body,'tags',to_jsonb(r.tags),'createdAt',r.created_at,'reviewerRole','landlord') end
  order by r.created_at desc,r.id),'[]'::jsonb)
 from (select s.id,s.rating,s.body,s.tags,s.created_at,
   (select l.title from public.listings l where l.property_id=s.property_id and l.published_at is not null order by l.published_at desc,l.id desc limit 1) as title
  from rentlease_reviews.approved_set(p_kind,p_target) s order by s.created_at desc,s.id limit least(greatest(coalesce(p_limit,0),0),10)) r
$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- The profile read. Whitelist only; every key is listed here and asserted by the checks.
-- ---------------------------------------------------------------------------------------------------------------------------
create function public.get_public_profile(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p public.profiles;rel boolean;roles text[];ls jsonb;ts jsonb;landlord jsonb;tenant jsonb;
 today date:=(now() at time zone 'Asia/Manila')::date;
begin
 if a is null or p_user_id is null or not rentlease_profiles.can_view(a,p_user_id) then raise exception 'Profile unavailable' using errcode='42501';end if;
 select * into p from public.profiles where id=p_user_id;
 rel:=rentlease_profiles.relationship(a,p_user_id);
 select coalesce(array_agg(x.r order by x.r),'{}'::text[]) into roles from (
  select 'landlord'::text as r where exists(select 1 from public.user_roles ur where ur.user_id=p_user_id and ur.role='landlord')
   or exists(select 1 from public.listings l join public.properties pr on pr.id=l.property_id where l.landlord_id=p_user_id and pr.landlord_id=p_user_id and l.published_at is not null)
  union select 'tenant'::text where exists(select 1 from public.user_roles ur where ur.user_id=p_user_id and ur.role='tenant')
   or exists(select 1 from public.tenancies t where t.tenant_id=p_user_id)
   or exists(select 1 from public.conversations c where c.tenant_id=p_user_id)
   or exists(select 1 from public.rental_reservations rr where rr.tenant_id=p_user_id)) x;
 if 'landlord'=any(roles) then
  ls:=rentlease_reviews.summarize('landlord',p_user_id);
  landlord:=jsonb_build_object(
   'activeListings',(select count(*) from public.listings l join public.properties pr on pr.id=l.property_id where l.landlord_id=p_user_id and pr.landlord_id=p_user_id and pr.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=today)),
   'propertiesManaged',(select count(*) from public.properties pr where pr.landlord_id=p_user_id and pr.is_active and exists(select 1 from public.listings l where l.property_id=pr.id and l.published_at is not null)),
   'rating',jsonb_build_object('count',ls->'count','average',ls->'average','distribution',ls->'distribution','tags',ls->'tags'),
   'listings',(select coalesce(jsonb_agg(jsonb_build_object('listingId',x.id,'propertyId',x.property_id,'title',x.title,'city',x.city::text,'monthlyRent',x.asking_rent_monthly) order by x.published_at desc,x.id),'[]'::jsonb)
     from (select l.id,l.property_id,l.title,pr.city,l.asking_rent_monthly,l.published_at from public.listings l join public.properties pr on pr.id=l.property_id
      where l.landlord_id=p_user_id and pr.landlord_id=p_user_id and pr.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=today)
      order by l.published_at desc,l.id limit 5) x),
   'recentReviews',rentlease_profiles.recent_reviews('landlord',p_user_id,5));
 end if;
 if 'tenant'=any(roles) and (p_user_id=a or rel) then
  ts:=rentlease_reviews.summarize('tenant',p_user_id);
  tenant:=jsonb_build_object(
   'completedStays',(select count(*) from public.tenancies t where t.tenant_id=p_user_id and t.status='ended' and t.actual_end_date is not null and t.ended_at is not null and t.actual_end_date<=today and t.ended_at<=statement_timestamp()),
   'reviewerCount',ts->'reviewers',
   'rating',jsonb_build_object('count',ts->'count','average',ts->'average','distribution',ts->'distribution','tags',ts->'tags'),
   'recentReviews',rentlease_profiles.recent_reviews('tenant',p_user_id,5));
 end if;
 return jsonb_build_object('id',p.id,
  'nickname',case when p.public_nickname_confirmed_at is not null then p.public_nickname end,
  'avatarPath',case when p.avatar_public_confirmed_at is not null and p.avatar_path ~ ('^'||p.id::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then p.avatar_path end,
  'idVerified',rentlease_profiles.id_verified(p.id),'roles',to_jsonb(roles),'relationship',rel,'landlord',landlord,'tenant',tenant);
end$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Grants: authenticated only for the one public RPC; the private schemas stay closed.
-- ---------------------------------------------------------------------------------------------------------------------------
revoke all on all functions in schema rentlease_profiles from public,anon,authenticated,service_role;
revoke all on all functions in schema rentlease_reviews from public,anon,authenticated,service_role;
revoke all on function public.get_public_profile(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_profile(uuid) to authenticated;

do $post$
declare f oid;
begin
 f:=to_regprocedure('public.get_public_profile(uuid)');
 if f is null or has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'get_public_profile grants are wrong';end if;
 if exists(select 1 from pg_proc p where p.oid=f and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres')) then raise exception 'get_public_profile definition drifted';end if;
 if exists(select 1 from pg_proc p where p.pronamespace in('rentlease_profiles'::regnamespace,'rentlease_reviews'::regnamespace) and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')))
  then raise exception 'A private profile function is exposed';end if;
 if exists(select 1 from pg_proc p where (p.pronamespace='rentlease_profiles'::regnamespace or p.oid in(to_regprocedure('rentlease_reviews.approved_set(text,uuid)'),to_regprocedure('rentlease_reviews.summarize(text,uuid)'))) and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog'] or pg_get_userbyid(p.proowner)<>'postgres'))
  then raise exception 'A private profile function has the wrong settings';end if;
 if has_schema_privilege('anon','rentlease_profiles','USAGE') or has_schema_privilege('authenticated','rentlease_profiles','USAGE') or has_schema_privilege('service_role','rentlease_profiles','USAGE') then raise exception 'rentlease_profiles is exposed';end if;
end$post$;
commit;
