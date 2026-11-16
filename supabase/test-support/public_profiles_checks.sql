-- Public profiles checks. Needs the migration objects to exist in the same transaction (pre-apply: run the migration body + this file as one batch with begin/commit removed)
-- or in the database (post-apply: run this file alone). Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results, so NOTHING can commit.
-- The fixture is built inside the transaction with triggers off; triggers are switched back on before any RPC runs (reviews are submitted through the real submit function).
set local session_replication_role = replica;
create temp table pp_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create temp table pp_ctx(k text primary key,v text not null) on commit drop;

create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into pp_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
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
create function pg_temp.prof(p_viewer uuid,p_role text,p_target uuid) returns text language sql as $$
 select pg_temp.act(p_viewer,p_role,format('select public.get_public_profile(%L)::text',p_target)) $$;
create function pg_temp.summary(p_viewer uuid,p_kind text,p_target uuid) returns text language sql as $$
 select pg_temp.act(p_viewer,'authenticated',format('select public.get_review_summary(%L,%L)::text',p_kind,p_target)) $$;
create function pg_temp.body(p text) returns jsonb language sql as $$ select substr(p,4)::jsonb $$;
create function pg_temp.state(p text) returns text language sql as $$ select case when p like 'OK|%' then 'OK' else split_part(p,'|',2) end $$;
create function pg_temp.keys(j jsonb) returns text language sql as $$ select coalesce((select string_agg(k,',' order by k) from jsonb_object_keys(j) k),'') $$;
create function pg_temp.mkprop(p_ld uuid,p_title text,p_status text,p_published boolean,p_active boolean,out pid uuid,out lid uuid) language plpgsql as $$
begin
 pid:=gen_random_uuid();lid:=gen_random_uuid();
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location,is_active) values(pid,p_ld,'room','imus','Fixture',st_setsrid(st_makepoint(120.96,14.45),4326)::geography,p_active);
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status,published_at) values(lid,pid,p_ld,p_title,'Fixture listing',6000,p_status::public.listing_status,case when p_published then now()-interval '5 days' end);
end$$;
create function pg_temp.mkten(p_ld uuid,p_tn uuid,p_status text,p_pid uuid,p_lid uuid,p_conv uuid) returns uuid language plpgsql as $$
declare tid uuid:=gen_random_uuid();
begin
 insert into public.tenancies(id,property_id,listing_id,tenant_id,landlord_id,status,start_date,actual_end_date,ended_at,agreed_monthly_rent,rent_due_day,created_by,conversation_id)
 values(tid,p_pid,p_lid,p_tn,p_ld,p_status::public.tenancy_status,case when p_status='ended' then current_date-120 else current_date+10 end,case when p_status='ended' then current_date-10 end,case when p_status='ended' then now()-interval '10 days' end,6000,2,p_ld,p_conv);
 return tid;
end$$;

do $f$
declare
 ld uuid:=gen_random_uuid();tn uuid:=gen_random_uuid();tn6 uuid:=gen_random_uuid();tz uuid:=gen_random_uuid();tz2 uuid:=gen_random_uuid();bo uuid:=gen_random_uuid();st uuid:=gen_random_uuid();
 ap uuid:=gen_random_uuid();bl uuid:=gen_random_uuid();tp uuid:=gen_random_uuid();inact uuid:=gen_random_uuid();nt1 uuid:=gen_random_uuid();wk uuid:=gen_random_uuid();
 pr record;l1 uuid;l2 uuid;l6 uuid;p1 uuid;p2 uuid;p5 uuid;p6 uuid;pb record;pi record;pw record;
 co uuid:=gen_random_uuid();rs2 uuid:=gen_random_uuid();dv uuid:=gen_random_uuid();cc uuid:=gen_random_uuid();cr uuid:=gen_random_uuid();pco record;prs record;
 t1 uuid;t2 uuid;t6 uuid;t7 uuid;t8 uuid;t9 uuid;avatar text:=ld::text||'/public/'||gen_random_uuid()||'.png';tier2 timestamptz:=now()-interval '1 day';
begin
 insert into public.profiles(id,account_status,tier1_verified_at,tier2_verified_at,public_nickname,public_nickname_confirmed_at,avatar_path,avatar_public_confirmed_at) values
  (ld,'active',now(),tier2,'Nightcity',now(),avatar,now());
 insert into public.profiles(id,account_status,tier1_verified_at) select x,'active',now() from unnest(array[tn,tn6,tz,tz2,bo,st,ap,bl,tp]) x;
 insert into public.profiles(id,account_status,tier1_verified_at) values(inact,'suspended',now()),(nt1,'active',null);
 insert into public.profiles(id,account_status,tier1_verified_at) values(co,'active',now()),(rs2,'active',now()),(dv,'active',now());
 insert into public.profiles(id,account_status,tier1_verified_at,tier2_verified_at) values(wk,'active',now(),now()-interval '2 days');
 insert into public.verification_submissions(user_id,tier,status,reviewed_by,reviewed_at) values(ld,'tier_2_identity','approved',gen_random_uuid(),tier2);
 insert into public.user_roles(user_id,role) values(ld,'landlord'),(tn,'tenant'),(tn6,'tenant'),(tz,'tenant'),(tz2,'tenant'),(bo,'landlord'),(bo,'tenant'),(ap,'tenant'),(bl,'tenant'),(tp,'tenant'),(inact,'landlord'),(wk,'landlord');
 -- ld: p1 and p2 active listings; p3 unfinished (no listing); p4 inactive property; p5 archived listing that was published; p6 never published.
 select * into pr from pg_temp.mkprop(ld,'Fixture one','active',true,true);p1:=pr.pid;l1:=pr.lid;
 select * into pr from pg_temp.mkprop(ld,'Fixture two','active',true,true);p2:=pr.pid;l2:=pr.lid;
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location,is_active) values(gen_random_uuid(),ld,'room','imus','Unfinished',st_setsrid(st_makepoint(120.97,14.46),4326)::geography,true);
 perform pg_temp.mkprop(ld,'Inactive property listing','active',true,false);
 select * into pr from pg_temp.mkprop(ld,'Archived listing','archived',true,true);p5:=pr.pid;
 select * into pr from pg_temp.mkprop(ld,'Draft never published','draft',false,true);p6:=pr.pid;l6:=pr.lid;
 select * into pb from pg_temp.mkprop(bo,'Both roles listing','active',true,true);
 select * into pi from pg_temp.mkprop(inact,'Suspended owner listing','active',true,true);
 select * into pw from pg_temp.mkprop(wk,'Weak tier 2 listing','active',true,true);
 -- conversations: ap open, bl blocked (both with ld)
 insert into public.conversations(listing_id,tenant_id,landlord_id,status) values(l1,ap,ld,'open'),(l2,bl,ld,'blocked');
 -- Applicants who are tenants ONLY by a conversation (co) or ONLY by a reservation (rs2): no user_roles tenant row, no tenancy. Each also owns a public listing so a stranger can open the profile.
 select * into pco from pg_temp.mkprop(co,'Applicant co listing','active',true,true);
 select * into prs from pg_temp.mkprop(rs2,'Applicant rs2 listing','active',true,true);
 insert into public.conversations(id,listing_id,tenant_id,landlord_id,status) values(cc,l1,co,ld,'open');
 insert into public.conversations(id,listing_id,tenant_id,landlord_id,status) values(cr,l2,dv,rs2,'open');
 insert into public.rental_reservations(id,conversation_id,listing_id,property_id,tenant_id,landlord_id,move_in_date,duration_months,end_date,status,expires_at) values(gen_random_uuid(),cr,l2,p2,rs2,ld,current_date+30,6,current_date+210,'declined',now()+interval '7 days');
 -- tenancies (ended unless stated). tp has a pending tenancy with NO conversation.
 t1:=pg_temp.mkten(ld,tn,'ended',p1,l1,null);t2:=pg_temp.mkten(ld,bo,'ended',p2,l2,null);t6:=pg_temp.mkten(ld,tn6,'ended',p6,l6,null);
 t7:=pg_temp.mkten(ld,tz,'ended',p1,l1,null);t8:=pg_temp.mkten(ld,tz2,'ended',p1,l1,null);t9:=pg_temp.mkten(ld,tp,'pending_confirmation',p5,(select id from public.listings where property_id=p5),null);
 insert into pp_ctx values('ld',ld::text),('tn',tn::text),('tn6',tn6::text),('tz',tz::text),('tz2',tz2::text),('bo',bo::text),('st',st::text),('ap',ap::text),('bl',bl::text),('tp',tp::text),('inact',inact::text),('nt1',nt1::text),('wk',wk::text),
  ('t1',t1::text),('t2',t2::text),('t6',t6::text),('t7',t7::text),('t8',t8::text),('t9',t9::text),('co',co::text),('rs2',rs2::text),('dv',dv::text),('avatar',avatar),('p1',p1::text),('l1',l1::text);
end$f$;
set local session_replication_role = origin;

-- Reviews through the real submit function, then approval by the fixture (moderation is outside this migration).
do $r$
declare ld uuid;tn uuid;tn6 uuid;bo uuid;tz2 uuid;t1 uuid;t2 uuid;t6 uuid;t8 uuid;res text;
begin
 select v::uuid into ld from pp_ctx where k='ld';select v::uuid into tn from pp_ctx where k='tn';select v::uuid into tn6 from pp_ctx where k='tn6';select v::uuid into bo from pp_ctx where k='bo';select v::uuid into tz2 from pp_ctx where k='tz2';
 select v::uuid into t1 from pp_ctx where k='t1';select v::uuid into t2 from pp_ctx where k='t2';select v::uuid into t6 from pp_ctx where k='t6';select v::uuid into t8 from pp_ctx where k='t8';
 res:=pg_temp.act(tn,'authenticated',format('select public.submit_tenancy_review(%L,%L,%L,%s,%L,%L::text[])::text',t1,gen_random_uuid(),'property',5,'Great stay',array['clean','good_wifi']));
 perform pg_temp.chk('F1 fixture: tenant property review (t1)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.act(bo,'authenticated',format('select public.submit_tenancy_review(%L,%L,%L,%s,%L,%L::text[])::text',t2,gen_random_uuid(),'property',4,'Decent',array['clean']));
 perform pg_temp.chk('F2 fixture: both-roles tenant property review (t2)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.act(tn6,'authenticated',format('select public.submit_tenancy_review(%L,%L,%L,%s,%L,%L::text[])::text',t6,gen_random_uuid(),'property',2,'Meh',array[]::text[]));
 perform pg_temp.chk('F3 fixture: tenant property review on a never-published property (t6)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.act(tz2,'authenticated',format('select public.submit_tenancy_review(%L,%L,%L,%s,%L,%L::text[])::text',t8,gen_random_uuid(),'property',1,'Pending only',array[]::text[]));
 perform pg_temp.chk('F4 fixture: a review that stays pending (t8)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.act(ld,'authenticated',format('select public.submit_tenancy_review(%L,%L,%L,%s,%L,%L::text[])::text',t1,gen_random_uuid(),'user',4,'Tenant was easy',array['paid_on_time']));
 perform pg_temp.chk('F5 fixture: landlord reviews tenant (t1)',pg_temp.state(res)='OK',left(res,120));
 res:=pg_temp.act(ld,'authenticated',format('select public.submit_tenancy_review(%L,%L,%L,%s,%L,%L::text[])::text',t2,gen_random_uuid(),'user',3,null,array[]::text[]));
 perform pg_temp.chk('F6 fixture: landlord reviews the both-roles user (t2)',pg_temp.state(res)='OK',left(res,120));
end$r$;
set local session_replication_role = replica;
update rentlease_reviews.entries e set status='approved',moderated_at=now(),created_at=now()-(case t.id when (select v::uuid from pp_ctx where k='t1') then interval '1 day' when (select v::uuid from pp_ctx where k='t2') then interval '2 days' else interval '3 days' end)
 from public.tenancies t where t.id=e.tenancy_id and t.id<>(select v::uuid from pp_ctx where k='t8') and e.tenancy_id in (select v::uuid from pp_ctx where k in('t1','t2','t6'));
set local session_replication_role = origin;

do $t$
declare
 ld uuid;tn uuid;tn6 uuid;tz uuid;bo uuid;st uuid;ap uuid;bl uuid;tp uuid;inact uuid;nt1 uuid;wk uuid;co uuid;rs2 uuid;dv uuid;avatar text;
 res text;j jsonb;j2 jsonb;s1 jsonb;s2 jsonb;txt text;ids text;n int;
 top constant text:='avatarPath,id,idVerified,landlord,nickname,relationship,roles,tenant';
begin
 select v::uuid into ld from pp_ctx where k='ld';select v::uuid into tn from pp_ctx where k='tn';select v::uuid into tn6 from pp_ctx where k='tn6';select v::uuid into tz from pp_ctx where k='tz';select v::uuid into bo from pp_ctx where k='bo';select v::uuid into st from pp_ctx where k='st';
 select v::uuid into ap from pp_ctx where k='ap';select v::uuid into bl from pp_ctx where k='bl';select v::uuid into tp from pp_ctx where k='tp';select v::uuid into inact from pp_ctx where k='inact';select v::uuid into nt1 from pp_ctx where k='nt1';select v::uuid into wk from pp_ctx where k='wk';
 select v into avatar from pp_ctx where k='avatar';select v::uuid into co from pp_ctx where k='co';select v::uuid into rs2 from pp_ctx where k='rs2';select v::uuid into dv from pp_ctx where k='dv';

 -- ---------------------------------------------------------------- 1 the landlord with a public listing, seen by any active Tier 1 stranger
 res:=pg_temp.prof(st,'authenticated',ld);j:=pg_temp.body(res);
 perform pg_temp.chk('1a a landlord with a public listing is visible to any active Tier 1 user',pg_temp.state(res)='OK',left(res,160));
 perform pg_temp.chk('1b exact top-level key set',pg_temp.keys(j)=top,pg_temp.keys(j));
 perform pg_temp.chk('1c landlord block keys are exactly the whitelist',pg_temp.keys(j->'landlord')='activeListings,listings,propertiesManaged,rating,recentReviews',pg_temp.keys(j->'landlord'));
 perform pg_temp.chk('1d rating keys are exactly count, average, distribution, tags',pg_temp.keys(j->'landlord'->'rating')='average,count,distribution,tags',pg_temp.keys(j->'landlord'->'rating'));
 perform pg_temp.chk('1e listing and review row keys are exactly the whitelist',pg_temp.keys(j->'landlord'->'listings'->0)='city,listingId,monthlyRent,propertyId,title' and pg_temp.keys(j->'landlord'->'recentReviews'->0)='createdAt,propertyTitle,rating,reviewerRole,tags,text',
  pg_temp.keys(j->'landlord'->'listings'->0)||' / '||pg_temp.keys(j->'landlord'->'recentReviews'->0));
 perform pg_temp.chk('1f identity: nickname, avatar, roles, ID verified, no relationship',j->>'nickname'='Nightcity' and j->>'avatarPath'=avatar and j->'roles'='["landlord"]'::jsonb and (j->>'idVerified')::boolean and not (j->>'relationship')::boolean and j->'tenant'='null'::jsonb,left(j::text,200));
 perform pg_temp.chk('1g active listings count only active listings on active properties (2), properties managed counts active properties with a published listing (3)',(j->'landlord'->>'activeListings')::int=2 and (j->'landlord'->>'propertiesManaged')::int=3,j->'landlord'->>'activeListings'||'/'||(j->'landlord'->>'propertiesManaged'));
 perform pg_temp.chk('1h the listing cards are the two active listings, newest first, with city and rent',jsonb_array_length(j->'landlord'->'listings')=2 and (j->'landlord'->'listings'->0->>'monthlyRent')::numeric=6000 and j->'landlord'->'listings'->0->>'city'='imus',left((j->'landlord'->'listings')::text,200));
 perform pg_temp.chk('1i rating across all the landlord''s properties: 3 reviews (5, 4, 2), average 3.67, distribution and tag counts',
  (j->'landlord'->'rating'->>'count')::int=3 and (j->'landlord'->'rating'->>'average')::numeric=3.67 and j->'landlord'->'rating'->'distribution'='[0,1,0,1,1]'::jsonb and j->'landlord'->'rating'->'tags'='[{"tag":"clean","count":2},{"tag":"good_wifi","count":1}]'::jsonb,left((j->'landlord'->'rating')::text,200));
 perform pg_temp.chk('1j the pending review is not counted',(j->'landlord'->'rating'->>'count')::int=3,'');
 perform pg_temp.chk('1k recent reviews: newest first, property title from the latest published listing, "A property" when never published',
  j->'landlord'->'recentReviews'->0->>'propertyTitle'='Fixture one' and j->'landlord'->'recentReviews'->1->>'propertyTitle'='Fixture two' and j->'landlord'->'recentReviews'->2->>'propertyTitle'='A property' and j->'landlord'->'recentReviews'->0->>'reviewerRole'='tenant',left((j->'landlord'->'recentReviews')::text,300));
 perform pg_temp.chk('1l a review row carries its text and tags',j->'landlord'->'recentReviews'->0->>'text'='Great stay' and j->'landlord'->'recentReviews'->0->'tags'='["clean","good_wifi"]'::jsonb,'');
 txt:=j::text;
 select string_agg(id::text,',') into ids from rentlease_reviews.entries;
 perform pg_temp.chk('1m no forbidden field name anywhere in the answer',txt !~* '(account_status|suspend|suspension|trust|created_at|"tier|bio"|email|phone|reviewer_id|reviewerId|reviewId)',left(txt,120));
 perform pg_temp.chk('1n no reviewer id and no review id appears in the answer',position(tn::text in txt)=0 and position(bo::text in txt)=0 and position(tn6::text in txt)=0 and not exists(select 1 from rentlease_reviews.entries e where position(e.id::text in txt)>0),'');

 -- ---------------------------------------------------------------- 2 tenant: hidden from strangers, visible with a conversation or tenancy
 res:=pg_temp.prof(st,'authenticated',tn);
 perform pg_temp.chk('2a a tenant with no listing and no relationship is refused (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.prof(ld,'authenticated',tn);j:=pg_temp.body(res);
 perform pg_temp.chk('2b the landlord of a tenancy sees the tenant, with the relationship flag',pg_temp.state(res)='OK' and (j->>'relationship')::boolean and j->'roles'='["tenant"]'::jsonb and j->'landlord'='null'::jsonb,left(res,160));
 perform pg_temp.chk('2c tenant block keys are exactly the whitelist, and its review rows carry no property name',pg_temp.keys(j->'tenant')='completedStays,rating,recentReviews,reviewerCount' and pg_temp.keys(j->'tenant'->'recentReviews'->0)='createdAt,rating,reviewerRole,tags,text' and ((j->'tenant')::text !~ 'Fixture'),pg_temp.keys(j->'tenant'));
 perform pg_temp.chk('2d tenant numbers: 1 completed stay, 1 reviewer, count 1, average 4.00, distribution and tags',(j->'tenant'->>'completedStays')::int=1 and (j->'tenant'->>'reviewerCount')::int=1 and (j->'tenant'->'rating'->>'count')::int=1 and (j->'tenant'->'rating'->>'average')::numeric=4.00
  and j->'tenant'->'rating'->'distribution'='[0,0,0,1,0]'::jsonb and j->'tenant'->'rating'->'tags'='[{"tag":"paid_on_time","count":1}]'::jsonb and j->'tenant'->'recentReviews'->0->>'reviewerRole'='landlord',left((j->'tenant')::text,260));
 perform pg_temp.chk('2e an unconfirmed nickname is not shown, and an unset avatar is null',j->'nickname'='null'::jsonb and j->'avatarPath'='null'::jsonb and not (j->>'idVerified')::boolean,left(j::text,160));
 res:=pg_temp.prof(ld,'authenticated',ap);j:=pg_temp.body(res);
 perform pg_temp.chk('2f an applicant with a shared open conversation is visible and the tenant block appears (0 stays, no reviews)',pg_temp.state(res)='OK' and (j->>'relationship')::boolean and (j->'tenant'->>'completedStays')::int=0 and (j->'tenant'->'rating'->>'count')::int=0,left(res,200));
 res:=pg_temp.prof(st,'authenticated',ap);
 perform pg_temp.chk('2g a stranger cannot see the applicant (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.prof(ld,'authenticated',tp);j:=pg_temp.body(res);
 perform pg_temp.chk('2h a tenancy party with NO conversation is visible (tenancy parties added by the helper)',pg_temp.state(res)='OK' and (j->>'relationship')::boolean and j->'tenant'<>'null'::jsonb,left(res,160));
 perform pg_temp.chk('2i can_read_public_identity itself is unchanged: it does not see that tenancy-only party',pg_temp.act(ld,'authenticated',format('select public.can_read_public_identity(%L)::text',tp))='OK|false','');
 res:=pg_temp.prof(ld,'authenticated',(select v::uuid from pp_ctx where k='tz'));j:=pg_temp.body(res);
 perform pg_temp.chk('2j a tenant with no reviews: count 0, no average, zero distribution, no tags, no reviews, but the completed stay counts',(j->'tenant'->'rating'->>'count')::int=0 and j->'tenant'->'rating'->'average'='null'::jsonb and j->'tenant'->'rating'->'distribution'='[0,0,0,0,0]'::jsonb
  and j->'tenant'->'rating'->'tags'='[]'::jsonb and j->'tenant'->'recentReviews'='[]'::jsonb and (j->'tenant'->>'reviewerCount')::int=0 and (j->'tenant'->>'completedStays')::int=1,left((j->'tenant')::text,260));

 -- ---------------------------------------------------------------- 3 blocked conversation, inactive target, caller rules
 res:=pg_temp.prof(ld,'authenticated',bl);
 perform pg_temp.chk('3a a blocked conversation does not grant the profile (42501), though can_read_public_identity still would',pg_temp.state(res)='42501' and pg_temp.act(ld,'authenticated',format('select public.can_read_public_identity(%L)::text',bl))='OK|true',left(res,120));
 res:=pg_temp.prof(bl,'authenticated',ld);j:=pg_temp.body(res);
 perform pg_temp.chk('3b the blocked person can still see the public landlord, with no relationship and no tenant block',pg_temp.state(res)='OK' and not (j->>'relationship')::boolean and j->'tenant'='null'::jsonb,left(res,120));
 res:=pg_temp.prof(st,'authenticated',inact);
 perform pg_temp.chk('3c an inactive (suspended) target is refused even with an active listing (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.prof(inact,'authenticated',ld);
 perform pg_temp.chk('3d an inactive caller is refused (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.prof(nt1,'authenticated',ld);
 perform pg_temp.chk('3e a caller without Tier 1 is refused (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.prof(ld,'authenticated',ld);j:=pg_temp.body(res);
 perform pg_temp.chk('3f the caller can read their own profile (relationship false)',pg_temp.state(res)='OK' and not (j->>'relationship')::boolean,left(res,100));
 res:=pg_temp.prof(st,'authenticated',null);
 perform pg_temp.chk('3g a null id is 42501 "Profile unavailable"',res='ERR|42501|Profile unavailable',left(res,120));
 res:=pg_temp.prof(st,'authenticated',gen_random_uuid());
 perform pg_temp.chk('3h an unknown id is the same 42501 "Profile unavailable" (no existence oracle)',res='ERR|42501|Profile unavailable',left(res,120));
 res:=pg_temp.prof(null,'authenticated',ld);
 perform pg_temp.chk('3i a signed-in role with no user id is refused (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.prof(null,'anon',ld);
 perform pg_temp.chk('3j anon is refused (42501)',pg_temp.state(res)='42501',left(res,120));
 res:=pg_temp.prof(null,'service_role',ld);
 perform pg_temp.chk('3k service_role is refused: no EXECUTE grant (42501), and no user id would also refuse',pg_temp.state(res)='42501',left(res,120));
 perform pg_temp.chk('3l grants: authenticated only; the private helpers have no client grant',has_function_privilege('authenticated',to_regprocedure('public.get_public_profile(uuid)'),'EXECUTE') and not has_function_privilege('anon',to_regprocedure('public.get_public_profile(uuid)'),'EXECUTE')
  and not has_function_privilege('service_role',to_regprocedure('public.get_public_profile(uuid)'),'EXECUTE') and not exists(select 1 from pg_proc p where p.pronamespace in('rentlease_profiles'::regnamespace) and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')))
  and not has_function_privilege('authenticated',to_regprocedure('rentlease_reviews.summarize(text,uuid)'),'EXECUTE') and not has_function_privilege('authenticated',to_regprocedure('rentlease_reviews.approved_set(text,uuid)'),'EXECUTE'),'');

 -- ---------------------------------------------------------------- 4 both roles
 res:=pg_temp.prof(ld,'authenticated',bo);j:=pg_temp.body(res);
 perform pg_temp.chk('4a a user with both roles returns BOTH blocks to someone who shares a tenancy with them',pg_temp.state(res)='OK' and j->'roles'='["landlord","tenant"]'::jsonb and j->'landlord'<>'null'::jsonb and j->'tenant'<>'null'::jsonb and (j->>'relationship')::boolean,left(res,200));
 perform pg_temp.chk('4b ... with each block carrying its own numbers (tenant: 1 review of 3 stars; landlord: their own listing)',(j->'tenant'->'rating'->>'count')::int=1 and (j->'tenant'->'rating'->>'average')::numeric=3.00 and (j->'landlord'->>'activeListings')::int=1,left(j::text,200));
 res:=pg_temp.prof(st,'authenticated',bo);j:=pg_temp.body(res);
 perform pg_temp.chk('4c ... but a stranger sees the landlord block only: the tenant block is hidden without a relationship',pg_temp.state(res)='OK' and j->'landlord'<>'null'::jsonb and j->'tenant'='null'::jsonb and not (j->>'relationship')::boolean and j->'roles'='["landlord","tenant"]'::jsonb,left(res,200));
 res:=pg_temp.prof(bo,'authenticated',bo);j:=pg_temp.body(res);
 perform pg_temp.chk('4d the user''s own profile shows both blocks',j->'landlord'<>'null'::jsonb and j->'tenant'<>'null'::jsonb,left(res,120));

 -- ---------------------------------------------------------------- 5 ID verified: one strict rule
 perform pg_temp.chk('5a one approved, reviewed Tier 2 submission matching the profile timestamp: ID verified',(pg_temp.body(pg_temp.prof(st,'authenticated',ld))->>'idVerified')::boolean,'');
 perform pg_temp.chk('5b a Tier 2 timestamp with no approved submission is NOT ID verified (the profile column alone is not enough)',not (pg_temp.body(pg_temp.prof(st,'authenticated',wk))->>'idVerified')::boolean,'');
 perform pg_temp.chk('5c no Tier 2 at all is not ID verified',not (pg_temp.body(pg_temp.prof(ld,'authenticated',tn))->>'idVerified')::boolean,'');
 perform pg_temp.chk('5d the helper agrees with the recommendation function''s rule for the same owner',rentlease_profiles.id_verified(ld) and not rentlease_profiles.id_verified(wk),'');

 -- ---------------------------------------------------------------- 6 parity with get_review_summary (not patched)
 s1:=pg_temp.body(pg_temp.summary(st,'landlord',ld));j:=pg_temp.body(pg_temp.prof(st,'authenticated',ld))->'landlord'->'rating';
 perform pg_temp.chk('6a landlord rating equals get_review_summary(''landlord'') exactly (count, average, distribution, tags)',s1->'count'=j->'count' and s1->'average'=j->'average' and s1->'distribution'=j->'distribution' and s1->'tags'=j->'tags',left(s1::text,160)||' vs '||left(j::text,160));
 s2:=pg_temp.body(pg_temp.summary(ld,'tenant',tn));j2:=pg_temp.body(pg_temp.prof(ld,'authenticated',tn))->'tenant'->'rating';
 perform pg_temp.chk('6b tenant rating equals get_review_summary(''tenant'') exactly',s2->'count'=j2->'count' and s2->'average'=j2->'average' and s2->'distribution'=j2->'distribution' and s2->'tags'=j2->'tags',left(s2::text,160)||' vs '||left(j2::text,160));
 s2:=pg_temp.body(pg_temp.summary(ld,'tenant',(select v::uuid from pp_ctx where k='tz')));j2:=pg_temp.body(pg_temp.prof(ld,'authenticated',(select v::uuid from pp_ctx where k='tz')))->'tenant'->'rating';
 perform pg_temp.chk('6c the empty case matches too (count 0, null average)',s2->'count'=j2->'count' and s2->'average'=j2->'average' and s2->'distribution'=j2->'distribution' and s2->'tags'=j2->'tags',left(s2::text,120));
 perform pg_temp.chk('6d get_review_summary is untouched (pin)',md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_review_summary(text,uuid)')))='78f27537f0afaa46caf35cc96dfb8922' and md5((select prosrc from pg_proc where oid=to_regprocedure('public.can_read_public_identity(uuid)')))='ce7a49ff8184972232e5d000cb2135cc','');
 res:=pg_temp.summary(st,'tenant',tn);
 perform pg_temp.chk('6e where the profile would refuse a stranger, get_review_summary refuses too (no looser gate)',pg_temp.state(res)='42501','');
 -- ---------------------------------------------------------------- 7 roles from conversations and reservations
 res:=pg_temp.prof(ld,'authenticated',co);j:=pg_temp.body(res);
 perform pg_temp.chk('7a a conversation-only applicant (no tenant role row, no tenancy) gets the tenant role and, with a shared conversation, the tenant block',pg_temp.state(res)='OK' and j->'roles'='["landlord","tenant"]'::jsonb and (j->>'relationship')::boolean and j->'tenant'<>'null'::jsonb
  and (j->'tenant'->>'completedStays')::int=0 and (j->'tenant'->'rating'->>'count')::int=0,left(res,200));
 res:=pg_temp.prof(st,'authenticated',co);j:=pg_temp.body(res);
 perform pg_temp.chk('7b ... and without a relationship the tenant block is hidden (the role is listed, the block is null)',pg_temp.state(res)='OK' and j->'roles'='["landlord","tenant"]'::jsonb and not (j->>'relationship')::boolean and j->'tenant'='null'::jsonb and j->'landlord'<>'null'::jsonb,left(res,200));
 res:=pg_temp.prof(dv,'authenticated',rs2);j:=pg_temp.body(res);
 perform pg_temp.chk('7c a reservation-only applicant (declined reservation, no tenant role row, no tenancy, never the tenant of a conversation) gets the tenant role and, for a viewer who shares a conversation with them, the tenant block',pg_temp.state(res)='OK' and j->'roles'='["landlord","tenant"]'::jsonb and (j->>'relationship')::boolean and j->'tenant'<>'null'::jsonb,left(res,200));
 res:=pg_temp.prof(st,'authenticated',rs2);j:=pg_temp.body(res);
 perform pg_temp.chk('7d ... and without a relationship the tenant block is hidden',pg_temp.state(res)='OK' and j->'roles'='["landlord","tenant"]'::jsonb and not (j->>'relationship')::boolean and j->'tenant'='null'::jsonb,left(res,200));
 perform pg_temp.chk('7e the role rows alone did not make them tenants (the fixture has none for these two, and no tenancy)',not exists(select 1 from public.user_roles where user_id in(co,rs2) and role='tenant') and not exists(select 1 from public.tenancies where tenant_id in(co,rs2)),'');
 res:=pg_temp.prof(ap,'authenticated',ld);j:=pg_temp.body(res);
 perform pg_temp.chk('7f a pure landlord keeps roles ["landlord"] and shows no tenant block to a viewer with a relationship (shared conversation)',pg_temp.state(res)='OK' and j->'roles'='["landlord"]'::jsonb and (j->>'relationship')::boolean and j->'tenant'='null'::jsonb,left(res,200));
 res:=pg_temp.prof(tn,'authenticated',ld);j:=pg_temp.body(res);
 perform pg_temp.chk('7g ... also for a viewer with a tenancy relationship (being the landlord of conversations and tenancies does not make a tenant)',pg_temp.state(res)='OK' and j->'roles'='["landlord"]'::jsonb and (j->>'relationship')::boolean and j->'tenant'='null'::jsonb,left(res,200));
end$t$;


-- Deliberate abort: carries the results out and guarantees the whole batch (fixture, migration objects if run pre-apply) rolls back.
do $out$
declare report text; bad int;
begin
 select count(*) filter (where not ok) into bad from pp_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when detail is not null and detail<>'' then ' :: '||left(detail,64) else '' end,E'
' order by n) into report from pp_res /*WHERE*/;
 raise exception E'PUBLIC_PROFILE_CHECKS total=% failed=%
%',(select count(*) from pp_res),bad,report using errcode='P0001';
end$out$;
