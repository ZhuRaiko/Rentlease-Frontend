-- Review tags checks. Needs the migration objects to exist in the same transaction (pre-apply: run migration body + this file as one
-- batch with the migration's begin/commit removed) or in the database (post-apply: run this file alone).
-- Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results, so NOTHING can commit.
-- The fixture (profiles, properties, listings, tenancies) is built inside the transaction with triggers off, then triggers are switched back
-- on before any review RPC runs, so the real triggers (immutability, content guard) are exercised.
set local session_replication_role = replica;
create temp table rt_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create temp table rt_ctx(k text primary key,v text not null) on commit drop;

create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into rt_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
create function pg_temp.act(p_uid uuid,p_role text,p_sql text) returns text language plpgsql as $f$
declare r text;
begin
 perform set_config('request.jwt.claims',json_build_object('sub',p_uid,'role',p_role)::text,true);
 perform set_config('request.jwt.claim.sub',coalesce(p_uid::text,''),true);
 execute format('set local role %I',p_role);
 execute p_sql into r;
 execute 'reset role';
 return 'OK|'||coalesce(r,'');
exception when others then
 return 'ERR|'||sqlstate||'|'||sqlerrm;
end$f$;
-- 6-argument submit and 5-argument wrapper as a given user.
create function pg_temp.s6(p_uid uuid,p_role text,p_tenancy uuid,p_op uuid,p_kind text,p_rating integer,p_text text,p_tags text[]) returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.submit_tenancy_review(%L,%L,%L,%L::integer,%L,%L::text[])::text',p_tenancy,p_op,p_kind,p_rating,p_text,p_tags)) $$;
create function pg_temp.s5(p_uid uuid,p_role text,p_tenancy uuid,p_op uuid,p_kind text,p_rating integer,p_text text) returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.submit_tenancy_review(%L,%L,%L,%L::integer,%L)::text',p_tenancy,p_op,p_kind,p_rating,p_text)) $$;
create function pg_temp.g(p_uid uuid,p_role text,p_tenancy uuid) returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.get_tenancy_reviews(%L)::text',p_tenancy)) $$;
create function pg_temp.sm(p_uid uuid,p_role text,p_kind text,p_target uuid) returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.get_review_summary(%L,%L)::text',p_kind,p_target)) $$;
create function pg_temp.body(p text) returns jsonb language sql as $$ select substr(p,4)::jsonb $$;
create function pg_temp.state(p text) returns text language sql as $$ select case when p like 'OK|%' then 'OK' else split_part(p,'|',2) end $$;

do $t1$
declare
 ld uuid:=gen_random_uuid(); tn uuid:=gen_random_uuid(); tn2 uuid:=gen_random_uuid(); st uuid:=gen_random_uuid();
 p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid();
 l1 uuid:=gen_random_uuid(); l2 uuid:=gen_random_uuid(); l3 uuid:=gen_random_uuid();
 t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); t3 uuid:=gen_random_uuid();
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
begin
 insert into public.profiles(id,account_status,tier1_verified_at) values(ld,'active',now()),(tn,'active',now()),(tn2,'active',now()),(st,'active',now());
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location) values
  (p1,ld,'apartment','imus','Fixture A',st_setsrid(st_makepoint(120.93,14.42),4326)::geography),
  (p2,ld,'house','imus','Fixture B',st_setsrid(st_makepoint(120.94,14.43),4326)::geography),
  (p3,ld,'room','imus','Fixture C',st_setsrid(st_makepoint(120.95,14.44),4326)::geography);
 -- p1 and p2 have an active published listing; p3 has none (so a stranger cannot read p3).
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status,published_at) values
  (l1,p1,ld,'Fixture one','Fixture listing',9000,'active',now()),(l2,p2,ld,'Fixture two','Fixture listing',8000,'active',now()),(l3,p3,ld,'Fixture three','Fixture listing',7000,'archived',now());
 insert into public.tenancies(id,property_id,listing_id,tenant_id,landlord_id,status,start_date,actual_end_date,ended_at,agreed_monthly_rent,rent_due_day,created_by) values
  (t1,p1,l1,tn,ld,'ended',today-120,today-10,now()-interval '10 days',9000,2,ld),
  (t2,p2,l2,tn2,ld,'ended',today-120,today-10,now()-interval '10 days',8000,2,ld),
  (t3,p3,l3,tn,ld,'ended',today-120,today-10,now()-interval '10 days',7000,2,ld);
 insert into rt_ctx values('ld',ld::text),('tn',tn::text),('tn2',tn2::text),('st',st::text),('p1',p1::text),('p2',p2::text),('p3',p3::text),('t1',t1::text),('t2',t2::text),('t3',t3::text);
end$t1$;
set local session_replication_role = origin;

do $t$
declare
 ld uuid;tn uuid;tn2 uuid;st uuid;p1 uuid;p2 uuid;p3 uuid;t1 uuid;t2 uuid;t3 uuid;
 res text;j jsonb;n int;op uuid;before_cnt int;rid1 uuid;rid2 uuid;rid3 uuid;stored text[];msg text;
 six text[]:=array['clean','good_wifi','quiet','safe_area','fair_price','well_maintained'];
begin
 select v::uuid into ld from rt_ctx where k='ld';select v::uuid into tn from rt_ctx where k='tn';select v::uuid into tn2 from rt_ctx where k='tn2';select v::uuid into st from rt_ctx where k='st';
 select v::uuid into p1 from rt_ctx where k='p1';select v::uuid into p2 from rt_ctx where k='p2';select v::uuid into p3 from rt_ctx where k='p3';
 select v::uuid into t1 from rt_ctx where k='t1';select v::uuid into t2 from rt_ctx where k='t2';select v::uuid into t3 from rt_ctx where k='t3';

 -- ---------------------------------------------------------------- 1 tags: invalid values are rejected and write nothing
 before_cnt:=(select count(*) from rentlease_reviews.entries);
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',5,null,array['clean','not_a_tag']);
 perform pg_temp.chk('1a an unknown tag is rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',5,null,array['clean','good_wifi','quiet','safe_area','fair_price','well_maintained']);
 perform pg_temp.chk('1b six tags are rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',5,null,array['clean','clean']);
 perform pg_temp.chk('1c a duplicate tag is rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',5,null,array['paid_on_time']);
 perform pg_temp.chk('1d a tenant tag on a property review is rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.s6(ld,'authenticated',t1,gen_random_uuid(),'user',5,null,array['clean']);
 perform pg_temp.chk('1e a property tag on a tenant review is rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',5,null,array['clean',null]);
 perform pg_temp.chk('1f a NULL tag is rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 perform pg_temp.chk('1g none of the rejected submissions wrote a row',(select count(*) from rentlease_reviews.entries)=before_cnt,'');
 -- the CHECK itself, bypassing the RPC
 begin
  insert into rentlease_reviews.entries(kind,tenancy_id,property_id,reviewer_id,rating,tags) values('property',t1,p1,tn,5,array['bogus']);
  perform pg_temp.chk('1h the table CHECK rejects bad tags even without the RPC',false,'inserted');
 exception when check_violation then perform pg_temp.chk('1h the table CHECK rejects bad tags even without the RPC',true,'');
 when others then perform pg_temp.chk('1h the table CHECK rejects bad tags even without the RPC',false,sqlstate||' '||sqlerrm);
 end;
 perform pg_temp.chk('1i exactly 5 valid tags are accepted by valid_tags',rentlease_reviews.valid_tags('property',array['clean','good_wifi','quiet','safe_area','fair_price']) and not rentlease_reviews.valid_tags('property',six),'');
 perform pg_temp.chk('1j the full lists match the wireframe (8 property, 6 tenant)',rentlease_reviews.valid_tags('property',array['good_location','matches_listing'])
  and rentlease_reviews.valid_tags('user',array['communicated_well','respectful','paid_on_time','kept_clean','followed_rules']) and rentlease_reviews.valid_tags('user',array['reported_issues_early']) and not rentlease_reviews.valid_tags('user',array['clean']),'');

 -- ---------------------------------------------------------------- 2 stars required 1-5, comment optional
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',null,null,'{}');
 perform pg_temp.chk('2a missing stars are rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',0,null,'{}');
 perform pg_temp.chk('2b zero stars are rejected (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',6,null,'{}');
 perform pg_temp.chk('2c six stars are rejected (22023)',pg_temp.state(res)='22023',left(res,120));

 -- ---------------------------------------------------------------- 3 valid submit: tenant reviews the property with tags and no comment
 op:=gen_random_uuid();
 res:=pg_temp.s6(tn,'authenticated',t1,op,'property',5,null,array['clean','good_wifi','quiet']);
 perform pg_temp.chk('3a tenant -> property with tags and no comment succeeds',pg_temp.state(res)='OK',left(res,160));
 select id,tags::text[] into rid1,stored from rentlease_reviews.entries where tenancy_id=t1 and reviewer_id=tn and kind='property';
 perform pg_temp.chk('3b the tags are stored on the row',stored=array['clean','good_wifi','quiet'],coalesce(stored::text,'null'));
 perform pg_temp.chk('3c the row is pending and has no body',(select status='pending' and body is null from rentlease_reviews.entries where id=rid1),'');
 j:=pg_temp.body(res);
 perform pg_temp.chk('3d the result lists the own review with its tags',exists(select 1 from jsonb_array_elements(coalesce(j->'own',j->'reviews','[]'::jsonb)) e where e->'tags'=to_jsonb(array['clean','good_wifi','quiet'])) or position('"tags": ["clean", "good_wifi", "quiet"]' in j::text)>0,left(j::text,200));
 res:=pg_temp.s6(tn,'authenticated',t1,op,'property',5,null,array['clean','good_wifi','quiet']);
 perform pg_temp.chk('3e an identical retry replays the receipt',pg_temp.state(res)='OK' and (select count(*) from rentlease_reviews.entries where tenancy_id=t1 and reviewer_id=tn and kind='property')=1,left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,op,'property',5,null,array['clean']);
 perform pg_temp.chk('3f the same operation with different tags is a conflict (22023)',pg_temp.state(res)='22023',left(res,120));

 -- ---------------------------------------------------------------- 4 direction: tenant -> landlord is rejected on BOTH entry points
 before_cnt:=(select count(*) from rentlease_reviews.entries);
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'user',5,'nice',array['communicated_well']);
 perform pg_temp.chk('4a tenant -> landlord through the new function is 42501',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.s5(tn,'authenticated',t1,gen_random_uuid(),'user',5,'nice');
 perform pg_temp.chk('4b tenant -> landlord through the 5-argument wrapper is 42501',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'user',5,null,'{}');
 perform pg_temp.chk('4c tenant -> landlord with no tags and no comment is also 42501',pg_temp.state(res)='42501',left(res,120));
 perform pg_temp.chk('4d no landlord review and no legacy review was written',(select count(*) from rentlease_reviews.entries)=before_cnt and not exists(select 1 from public.reviews where tenancy_id=t1 and reviewer_id=tn),'');

 -- ---------------------------------------------------------------- 5 landlord -> tenant allowed; one review per kind
 res:=pg_temp.s6(ld,'authenticated',t1,gen_random_uuid(),'user',4,'Good tenant',array['paid_on_time','kept_clean']);
 perform pg_temp.chk('5a landlord -> tenant with tags succeeds',pg_temp.state(res)='OK',left(res,160));
 select id into rid2 from rentlease_reviews.entries where tenancy_id=t1 and reviewer_id=ld and kind='user';
 perform pg_temp.chk('5b the tenant review stores the tags and the tenant as reviewee',(select tags=array['paid_on_time','kept_clean'] and reviewee_id=tn from rentlease_reviews.entries where id=rid2),'');
 res:=pg_temp.s6(ld,'authenticated',t1,gen_random_uuid(),'user',3,null,'{}');
 perform pg_temp.chk('5c a second landlord -> tenant review in the same tenancy is refused (23505)',pg_temp.state(res)='23505',left(res,120));
 res:=pg_temp.s6(tn,'authenticated',t1,gen_random_uuid(),'property',3,null,'{}');
 perform pg_temp.chk('5d a second property review in the same tenancy is refused (23505)',pg_temp.state(res)='23505',left(res,120));
 res:=pg_temp.s6(ld,'authenticated',t1,gen_random_uuid(),'property',5,null,'{}');
 perform pg_temp.chk('5e the landlord cannot review the property (42501)',pg_temp.state(res)='42501',left(res,120));

 -- ---------------------------------------------------------------- 6 wrapper still works and delegates
 res:=pg_temp.s5(tn2,'authenticated',t2,gen_random_uuid(),'property',3,'Fine place');
 perform pg_temp.chk('6a the 5-argument wrapper still submits a property review',pg_temp.state(res)='OK',left(res,160));
 perform pg_temp.chk('6b the wrapper stores empty tags',(select tags='{}'::text[] from rentlease_reviews.entries where tenancy_id=t2 and reviewer_id=tn2 and kind='property'),'');
 res:=pg_temp.s5(tn2,'authenticated',t2,gen_random_uuid(),'property',9,null);
 perform pg_temp.chk('6c the wrapper validates stars through the new function (22023)',pg_temp.state(res)='22023',left(res,120));
 perform pg_temp.chk('6d the wrapper delegates to the 6-argument function',position('public.submit_tenancy_review(p_tenancy_id, p_operation_id, p_kind, p_rating, p_text, ARRAY[]::text[])' in pg_get_functiondef(to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)')))>0
  or position('submit_tenancy_review(p_tenancy_id,p_operation_id,p_kind,p_rating,p_text,array[]::text[])' in replace(lower(pg_get_functiondef(to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)'))),' ',''))>0,'');

 -- ---------------------------------------------------------------- 7 pending reviews are hidden from `received` and from summaries
 res:=pg_temp.g(tn,'authenticated',t1);j:=pg_temp.body(res);
 perform pg_temp.chk('7a tenant sees an empty received list while the landlord review is pending',pg_temp.state(res)='OK' and jsonb_array_length(j->'received')=0,left(res,160));
 res:=pg_temp.g(ld,'authenticated',t1);j:=pg_temp.body(res);
 perform pg_temp.chk('7b landlord sees an empty received list while the property review is pending',pg_temp.state(res)='OK' and jsonb_array_length(j->'received')=0,left(res,160));
 res:=pg_temp.sm(ld,'authenticated','property',p1);j:=pg_temp.body(res);
 perform pg_temp.chk('7c the property summary ignores pending reviews',(j->>'count')::int=0 and j->'average'='null'::jsonb,left(res,160));
 res:=pg_temp.sm(ld,'authenticated','tenant',tn);j:=pg_temp.body(res);
 perform pg_temp.chk('7d the tenant summary ignores pending reviews',(j->>'count')::int=0,left(res,160));
 res:=pg_temp.sm(st,'authenticated','landlord',ld);j:=pg_temp.body(res);
 perform pg_temp.chk('7e the landlord summary ignores pending reviews',pg_temp.state(res)='OK' and (j->>'count')::int=0,left(res,160));

 -- ---------------------------------------------------------------- 8 tags are frozen after submit (with the real triggers on)
 begin
  update rentlease_reviews.entries set tags='{}'::text[] where id=rid1;
  perform pg_temp.chk('8a tags cannot be edited after submit',false,'updated');
 exception when others then perform pg_temp.chk('8a tags cannot be edited after submit',true,sqlstate||' '||left(sqlerrm,60));
 end;
 perform pg_temp.chk('8b the stored tags are unchanged',(select tags=array['clean','good_wifi','quiet'] from rentlease_reviews.entries where id=rid1),'');
 select id into rid3 from rentlease_reviews.entries where tenancy_id=t2 and reviewer_id=tn2;
end$t$;

-- Moderation is outside this migration; the fixture approves rows directly (triggers off for this one UPDATE).
set local session_replication_role = replica;
update rentlease_reviews.entries set status='approved',moderated_at=now() where tenancy_id in((select v::uuid from rt_ctx where k='t1'),(select v::uuid from rt_ctx where k='t2'));
set local session_replication_role = origin;

do $t2$
declare
 ld uuid;tn uuid;tn2 uuid;st uuid;p1 uuid;p2 uuid;p3 uuid;t1 uuid;t2 uuid;t3 uuid;
 res text;j jsonb;
begin
 select v::uuid into ld from rt_ctx where k='ld';select v::uuid into tn from rt_ctx where k='tn';select v::uuid into tn2 from rt_ctx where k='tn2';select v::uuid into st from rt_ctx where k='st';
 select v::uuid into p1 from rt_ctx where k='p1';select v::uuid into p2 from rt_ctx where k='p2';select v::uuid into p3 from rt_ctx where k='p3';
 select v::uuid into t1 from rt_ctx where k='t1';select v::uuid into t2 from rt_ctx where k='t2';select v::uuid into t3 from rt_ctx where k='t3';

 -- ---------------------------------------------------------------- 9 approved reviews are shown in `received`
 res:=pg_temp.g(tn,'authenticated',t1);j:=pg_temp.body(res);
 perform pg_temp.chk('9a the tenant receives the landlord''s approved review with its tags',jsonb_array_length(j->'received')=1 and j->'received'->0->>'kind'='user' and j->'received'->0->'tags'=to_jsonb(array['paid_on_time','kept_clean']) and j->'received'->0->>'rating'='4',left(res,220));
 perform pg_temp.chk('9b received carries no reviewer or review id',not (j->'received'->0 ? 'reviewerId') and not (j->'received'->0 ? 'reviewer_id'),left((j->'received'->0)::text,160));
 res:=pg_temp.g(ld,'authenticated',t1);j:=pg_temp.body(res);
 perform pg_temp.chk('9c the landlord receives the tenant''s approved property review with its tags',jsonb_array_length(j->'received')=1 and j->'received'->0->>'kind'='property' and j->'received'->0->'tags'=to_jsonb(array['clean','good_wifi','quiet']),left(res,220));
 perform pg_temp.chk('9d own list still shows the party''s own review',position('paid_on_time' in j::text)>0,'');
 res:=pg_temp.g(st,'authenticated',t1);
 perform pg_temp.chk('9e a stranger cannot read the tenancy reviews',pg_temp.state(res)<>'OK',left(res,120));

 -- ---------------------------------------------------------------- 10 summaries: property, tenant, landlord average across two properties
 res:=pg_temp.sm(ld,'authenticated','property',p1);j:=pg_temp.body(res);
 perform pg_temp.chk('10a property summary: one approved 5-star review, distribution and tags',(j->>'count')::int=1 and (j->>'average')::numeric=5.00 and j->'distribution'=to_jsonb(array[0,0,0,0,1]) and jsonb_array_length(j->'tags')=3,left(res,220));
 res:=pg_temp.sm(ld,'authenticated','tenant',tn);j:=pg_temp.body(res);
 perform pg_temp.chk('10b tenant summary: the approved landlord review (4 stars, two tags)',(j->>'count')::int=1 and (j->>'average')::numeric=4.00 and jsonb_array_length(j->'tags')=2,left(res,220));
 res:=pg_temp.sm(st,'authenticated','landlord',ld);j:=pg_temp.body(res);
 perform pg_temp.chk('10c landlord summary averages approved property reviews across both properties (5 and 3 = 4.00)',pg_temp.state(res)='OK' and (j->>'count')::int=2 and (j->>'average')::numeric=4.00 and j->'distribution'=to_jsonb(array[0,0,1,0,1]),left(res,220));
 perform pg_temp.chk('10d the landlord summary did not count the landlord->tenant review',(j->>'count')::int=2,'');
 perform pg_temp.chk('10e the landlord summary does not read profile_rating_summary',position('profile_rating_summary' in pg_get_functiondef(to_regprocedure('public.get_review_summary(text,uuid)')))=0,'');
 res:=pg_temp.sm(ld,'authenticated','property',p2);j:=pg_temp.body(res);
 perform pg_temp.chk('10f the second property has its own summary (one 3-star review)',(j->>'count')::int=1 and (j->>'average')::numeric=3.00,left(res,160));
 res:=pg_temp.sm(ld,'authenticated','property',p3);j:=pg_temp.body(res);
 perform pg_temp.chk('10g a property with no reviews reports count 0',(j->>'count')::int=0,left(res,160));
 res:=pg_temp.sm(ld,'authenticated','user',tn);
 perform pg_temp.chk('10h the old kind name user is invalid (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.sm(ld,'authenticated','bogus',tn);
 perform pg_temp.chk('10i an unknown kind is invalid (22023)',pg_temp.state(res)='22023',left(res,120));
 res:=pg_temp.sm(ld,'authenticated','property',null);
 perform pg_temp.chk('10j a null target is invalid (22023)',pg_temp.state(res)='22023',left(res,120));

 -- ---------------------------------------------------------------- 11 access: stranger and anon
 res:=pg_temp.sm(st,'authenticated','tenant',tn);
 perform pg_temp.chk('11a a stranger cannot read a tenant summary (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(st,'authenticated','property',p3);
 perform pg_temp.chk('11b a stranger cannot read a property summary without a public listing (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.act(st,'authenticated',format('select public.get_published_rental_reviews(%L,%L,0)::text','property',p3));
 perform pg_temp.chk('11c get_published_rental_reviews agrees: the same stranger is refused on that property',pg_temp.state(res)<>'OK',left(res,120));
 res:=pg_temp.sm(st,'authenticated','property',p1);
 perform pg_temp.chk('11d a stranger can read the summary of a publicly listed property',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.act(st,'authenticated',format('select public.get_published_rental_reviews(%L,%L,0)::text','property',p2));
 perform pg_temp.chk('11e get_published_rental_reviews agrees on the listed property and rows now carry tags',pg_temp.state(res)='OK' and position('"tags"' in res)>0,left(res,200));
 res:=pg_temp.s6(st,'authenticated',t1,gen_random_uuid(),'property',5,null,'{}');
 perform pg_temp.chk('11f a stranger cannot submit a review (not a party)',pg_temp.state(res)<>'OK',left(res,120));
 res:=pg_temp.s6(null,'anon',t1,gen_random_uuid(),'property',5,null,'{}');
 perform pg_temp.chk('11g anon cannot call the 6-argument submit (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.s5(null,'anon',t1,gen_random_uuid(),'property',5,null);
 perform pg_temp.chk('11h anon cannot call the 5-argument wrapper (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(null,'anon','property',p1);
 perform pg_temp.chk('11i anon cannot call get_review_summary (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.act(null,'service_role',format('select public.get_review_summary(%L,%L)::text','property',p1));
 perform pg_temp.chk('11j service_role cannot call get_review_summary (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(gen_random_uuid(),'authenticated','property',p3);
 perform pg_temp.chk('11k an authenticated caller with no profile is refused',pg_temp.state(res)<>'OK',left(res,120));
end$t2$;

-- ---------------------------------------------------------------- 13 tenant/landlord summary access: reservations and tenancies of any status
set local session_replication_role = replica;
create function pg_temp.mkprop(p_ld uuid,p_status text,out pid uuid,out lid uuid) language plpgsql as $$
begin
 pid:=gen_random_uuid();lid:=gen_random_uuid();
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location) values(pid,p_ld,'room','imus','Fixture R',st_setsrid(st_makepoint(120.96,14.45),4326)::geography);
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status,published_at) values(lid,pid,p_ld,'Fixture r','Fixture listing',6000,p_status::listing_status,now());
end$$;
create function pg_temp.mkres(p_ld uuid,p_tn uuid,p_status text,p_pid uuid,p_lid uuid) returns void language sql as $$
 insert into public.rental_reservations(id,conversation_id,listing_id,property_id,tenant_id,landlord_id,move_in_date,duration_months,end_date,status,expires_at)
 values(gen_random_uuid(),gen_random_uuid(),p_lid,p_pid,p_tn,p_ld,current_date+30,6,current_date+210,p_status,now()+interval '7 days') $$;
create function pg_temp.mkten(p_ld uuid,p_tn uuid,p_status text,p_pid uuid,p_lid uuid) returns void language sql as $$
 insert into public.tenancies(id,property_id,listing_id,tenant_id,landlord_id,status,start_date,agreed_monthly_rent,rent_due_day,created_by)
 values(gen_random_uuid(),p_pid,p_lid,p_tn,p_ld,p_status::tenancy_status,current_date+3,6000,2,p_ld) $$;
do $f13$
declare
 ld uuid:=(select v::uuid from rt_ctx where k='ld'); ld2 uuid:=gen_random_uuid(); ld3 uuid:=gen_random_uuid();
 ap uuid:=gen_random_uuid(); ap2 uuid:=gen_random_uuid(); ap3 uuid:=gen_random_uuid(); ap4 uuid:=gen_random_uuid(); ap5 uuid:=gen_random_uuid(); ap6 uuid:=gen_random_uuid(); ap7 uuid:=gen_random_uuid(); nobody uuid:=gen_random_uuid(); tpend uuid:=gen_random_uuid(); tact uuid:=gen_random_uuid();
 pr record;
begin
 insert into public.profiles(id,account_status,tier1_verified_at) select x,'active',now() from unnest(array[ld2,ld3,ap,ap2,ap3,ap4,ap5,ap6,ap7,nobody,tpend,tact]) x;
 -- ld: five applicants, each on its own property (one open request per property)
 select * into pr from pg_temp.mkprop(ld,'active'); perform pg_temp.mkres(ld,ap,'pending',pr.pid,pr.lid);
 select * into pr from pg_temp.mkprop(ld,'active'); perform pg_temp.mkres(ld,ap2,'approved',pr.pid,pr.lid);
 select * into pr from pg_temp.mkprop(ld,'active'); perform pg_temp.mkres(ld,ap3,'declined',pr.pid,pr.lid);
 select * into pr from pg_temp.mkprop(ld,'active'); perform pg_temp.mkres(ld,ap4,'cancelled',pr.pid,pr.lid);
 select * into pr from pg_temp.mkprop(ld,'active'); perform pg_temp.mkres(ld,ap7,'expired',pr.pid,pr.lid);
 -- ld2: every listing archived; ap5 has a pending request, ap6 a declined one
 select * into pr from pg_temp.mkprop(ld2,'archived'); perform pg_temp.mkres(ld2,ap5,'pending',pr.pid,pr.lid);
 select * into pr from pg_temp.mkprop(ld2,'archived'); perform pg_temp.mkres(ld2,ap6,'declined',pr.pid,pr.lid);
 -- ld3: archived listings, tenancies in pending_confirmation and active
 select * into pr from pg_temp.mkprop(ld3,'archived'); perform pg_temp.mkten(ld3,tpend,'pending_confirmation',pr.pid,pr.lid);
 select * into pr from pg_temp.mkprop(ld3,'archived'); perform pg_temp.mkten(ld3,tact,'active',pr.pid,pr.lid);
 insert into rt_ctx values('ld2',ld2::text),('ld3',ld3::text),('ap',ap::text),('ap2',ap2::text),('ap3',ap3::text),('ap4',ap4::text),('ap5',ap5::text),('ap6',ap6::text),('ap7',ap7::text),('nobody',nobody::text),('tpend',tpend::text),('tact',tact::text);
end$f13$;
set local session_replication_role = origin;
do $t13$
declare
 ld uuid:=(select v::uuid from rt_ctx where k='ld'); ld2 uuid:=(select v::uuid from rt_ctx where k='ld2'); ld3 uuid:=(select v::uuid from rt_ctx where k='ld3');
 ap uuid:=(select v::uuid from rt_ctx where k='ap'); ap2 uuid:=(select v::uuid from rt_ctx where k='ap2'); ap3 uuid:=(select v::uuid from rt_ctx where k='ap3'); ap4 uuid:=(select v::uuid from rt_ctx where k='ap4');
 ap5 uuid:=(select v::uuid from rt_ctx where k='ap5'); ap6 uuid:=(select v::uuid from rt_ctx where k='ap6'); ap7 uuid:=(select v::uuid from rt_ctx where k='ap7'); nobody uuid:=(select v::uuid from rt_ctx where k='nobody');
 tpend uuid:=(select v::uuid from rt_ctx where k='tpend'); tact uuid:=(select v::uuid from rt_ctx where k='tact');
 res text;
begin
 res:=pg_temp.sm(ld,'authenticated','tenant',ap);
 perform pg_temp.chk('13a a landlord reads the tenant summary of an applicant with a pending request',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(ld,'authenticated','tenant',ap2);
 perform pg_temp.chk('13b a landlord reads a tenant who has only an approved reservation',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(ld,'authenticated','tenant',nobody);
 perform pg_temp.chk('13c a landlord with no tenancy and no reservation is refused the tenant summary (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(ap5,'authenticated','landlord',ld2);
 perform pg_temp.chk('13d a tenant with a pending request reads a landlord whose listings are all archived',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(nobody,'authenticated','landlord',ld2);
 perform pg_temp.chk('13e a stranger is refused a landlord with no active listing (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(ld,'authenticated','tenant',ap3);
 perform pg_temp.chk('13f a declined reservation grants no tenant access (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(ld,'authenticated','tenant',ap4);
 perform pg_temp.chk('13g a cancelled reservation grants no tenant access (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(ld,'authenticated','tenant',ap7);
 perform pg_temp.chk('13h an expired reservation grants no tenant access (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(ap6,'authenticated','landlord',ld2);
 perform pg_temp.chk('13i a declined reservation grants no landlord access (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(tpend,'authenticated','landlord',ld3);
 perform pg_temp.chk('13j a pending_confirmation tenancy grants landlord access (tenant side)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(ld3,'authenticated','tenant',tpend);
 perform pg_temp.chk('13k a pending_confirmation tenancy grants tenant access (landlord side)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(tact,'authenticated','landlord',ld3);
 perform pg_temp.chk('13l an active tenancy grants landlord access (tenant side)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(ld3,'authenticated','tenant',tact);
 perform pg_temp.chk('13m an active tenancy grants tenant access (landlord side)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(ap,'authenticated','tenant',ld);
 perform pg_temp.chk('13n an applicant cannot read the landlord through the tenant kind (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.sm(ap,'authenticated','landlord',ld);
 perform pg_temp.chk('13o an applicant with a pending request reads the landlord',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(ld2,'authenticated','tenant',ap5);
 perform pg_temp.chk('13p the property landlord reads the applicant of its own request (ld2 reads ap5)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.sm(ap2,'authenticated','tenant',ap);
 perform pg_temp.chk('13q one applicant cannot read another applicant (42501)',pg_temp.state(res)='42501',left(res,120));
end$t13$;

-- Grants, shape and untouched data (checked as the batch's own role, no JWT).
do $t3$
declare fn oid;
begin
 foreach fn in array array[to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text,text[])'),to_regprocedure('public.submit_tenancy_review(uuid,uuid,text,integer,text)'),to_regprocedure('public.get_review_summary(text,uuid)')] loop
  perform pg_temp.chk('12 '||fn::regprocedure::text||': authenticated only, no anon, no PUBLIC',has_function_privilege('authenticated',fn,'EXECUTE') and not has_function_privilege('anon',fn,'EXECUTE') and not has_function_privilege('service_role',fn,'EXECUTE')
   and not exists(select 1 from pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=fn and a.grantee=0),'');
  perform pg_temp.chk('12 '||fn::regprocedure::text||': security definer with search_path=pg_catalog',(select prosecdef and proconfig=array['search_path=pg_catalog'] from pg_proc where oid=fn),'');
 end loop;
 perform pg_temp.chk('12d the private helpers are not callable by any client role',not has_function_privilege('authenticated',to_regprocedure('rentlease_reviews.can_read_published(uuid,text,uuid)'),'EXECUTE') and not has_function_privilege('anon',to_regprocedure('rentlease_reviews.valid_tags(text,text[])'),'EXECUTE'),'');
 perform pg_temp.chk('12e the function backups table is closed to clients',not has_table_privilege('authenticated','rentlease_reviews.function_backups','SELECT') and not has_table_privilege('anon','rentlease_reviews.function_backups','SELECT') and (select count(*) from rentlease_reviews.function_backups)=3,'');
 perform pg_temp.chk('12f no client role has any privilege on the review tables',not exists(select 1 from pg_class c,unnest(array['anon','authenticated','service_role']) r where c.relnamespace='rentlease_reviews'::regnamespace and c.relkind='r' and has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE')),'');
 perform pg_temp.chk('12g the existing rows kept empty tags (only fixture rows carry tags)',not exists(select 1 from rentlease_reviews.entries e where e.tags<>'{}'::text[] and e.tenancy_id not in(select v::uuid from rt_ctx where k in('t1','t2','t3'))),'');
end$t3$;

-- Deliberate abort: carries the results out and guarantees the whole batch (fixture, migration objects if run pre-apply) rolls back.
do $out$
declare report text; bad int;
begin
 select count(*) filter (where not ok) into bad from rt_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when detail is not null and detail<>'' then ' :: '||left(detail,64) else '' end,E'
' order by n) into report from rt_res /*WHERE*/;
 raise exception E'REVIEW_TAGS_CHECKS total=% failed=%
%',(select count(*) from rt_res),bad,report using errcode='P0001';
end$out$;
