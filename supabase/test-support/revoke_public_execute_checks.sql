-- Checks for 20261116150100_revoke_public_execute.sql. Needs the migration objects to exist in the same transaction (pre-apply: run migration A + migration B bodies + this file as one batch
-- with begin/commit removed) or in the database (post-apply: run this file alone). Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results.
-- The fixture (a landlord, a tenant, a stranger, a listing, a conversation, a tenancy and a maintenance request) is built with triggers off, then triggers are switched back on.
set local session_replication_role = replica;
create temp table rv_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create temp table rv_ctx(k text primary key,v text not null) on commit drop;
create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into rv_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
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
create function pg_temp.state(p text) returns text language sql as $$ select case when p like 'OK|%' then 'OK' else split_part(p,'|',2) end $$;

do $f$
declare ld uuid:=gen_random_uuid();tn uuid:=gen_random_uuid();st uuid:=gen_random_uuid();p uuid:=gen_random_uuid();l uuid:=gen_random_uuid();t uuid:=gen_random_uuid();c uuid:=gen_random_uuid();
begin
 insert into public.profiles(id,account_status,tier1_verified_at) values(ld,'active',now()),(tn,'active',now()),(st,'active',now());
 insert into public.user_roles(user_id,role) values(ld,'landlord'),(tn,'tenant');
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location,is_active) values(p,ld,'room','imus','Fixture',st_setsrid(st_makepoint(120.96,14.45),4326)::geography,true);
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status,published_at) values(l,p,ld,'Fixture listing','Fixture listing',6000,'active',now()-interval '5 days');
 insert into public.conversations(id,listing_id,tenant_id,landlord_id,status) values(c,l,tn,ld,'open');
 insert into public.tenancies(id,property_id,listing_id,tenant_id,landlord_id,status,start_date,agreed_monthly_rent,rent_due_day,created_by,conversation_id) values(t,p,l,tn,ld,'active',current_date-30,6000,2,ld,c);
 insert into public.maintenance_requests(tenancy_id,requested_by,title,description) values(t,tn,'Fixture leak','Fixture description');
 insert into rv_ctx values('ld',ld::text),('tn',tn::text),('st',st::text),('t',t::text),('c',c::text),('p',p::text),('l',l::text);
end$f$;
set local session_replication_role = origin;

do $t$
declare ld uuid;tn uuid;st uuid;t uuid;c uuid;p uuid;l uuid;res text;fn text;n int;
 nine text[]:=array['public.can_access_conversation(uuid,uuid)','public.can_access_tenancy(uuid,uuid)','public.can_manage_property(uuid,uuid)','public.can_view_property(uuid,uuid)','public.has_app_role(app_role,uuid)','public.is_admin(uuid)','public.is_tier1_verified(uuid)','public.refresh_my_tier1_verification()','public.update_my_profile(text,text,text)'];
 calls text[];
begin
 select v::uuid into ld from rv_ctx where k='ld';select v::uuid into tn from rv_ctx where k='tn';select v::uuid into st from rv_ctx where k='st';select v::uuid into t from rv_ctx where k='t';select v::uuid into c from rv_ctx where k='c';select v::uuid into p from rv_ctx where k='p';select v::uuid into l from rv_ctx where k='l';
 calls:=array[format('select public.can_access_conversation(%L,%L)::text',c,ld),format('select public.can_access_tenancy(%L,%L)::text',t,ld),format('select public.can_manage_property(%L,%L)::text',p,ld),format('select public.can_view_property(%L,%L)::text',p,ld),
  format('select public.has_app_role(%L::app_role,%L)::text','admin',ld),format('select public.is_admin(%L)::text',ld),format('select public.is_tier1_verified(%L)::text',ld),'select public.refresh_my_tier1_verification()::text','select public.update_my_profile(''x'',''y'',''z'')::text'];

 -- ---------------------------------------------------------------- 1 anon is refused on all nine
 for n in 1..9 loop
  res:=pg_temp.act(null,'anon',calls[n]);
  perform pg_temp.chk('1.'||n||' anon is refused (42501) on '||nine[n],pg_temp.state(res)='42501',left(res,100));
 end loop;
 perform pg_temp.chk('1.10 no PUBLIC grant and no anon EXECUTE remain on any of the nine, and no non-trigger function in public is anon-callable',
  not exists(select 1 from unnest(nine) f,pg_proc pr,aclexplode(pr.proacl) a where pr.oid=to_regprocedure(f) and a.grantee=0)
  and not exists(select 1 from unnest(nine) f where has_function_privilege('anon',to_regprocedure(f),'EXECUTE'))
  and not exists(select 1 from pg_proc pr where pr.pronamespace='public'::regnamespace and pr.prokind='f' and pr.prorettype<>'trigger'::regtype and has_function_privilege('anon',pr.oid,'EXECUTE')),'');
 perform pg_temp.chk('1.11 the trigger functions are left alone (18 still anon-executable) and default privileges are unchanged',(select count(*) from pg_proc pr where pr.pronamespace='public'::regnamespace and pr.prokind='f' and pr.prorettype='trigger'::regtype and has_function_privilege('anon',pr.oid,'EXECUTE'))=18
  and not exists(select 1 from pg_default_acl d where d.defaclnamespace='public'::regnamespace),'');

 -- ---------------------------------------------------------------- 2 authenticated keeps working
 res:=pg_temp.act(ld,'authenticated',calls[7]);
 perform pg_temp.chk('2.1 authenticated: is_tier1_verified(uuid) still true for a Tier 1 user',res='OK|true',left(res,100));
 res:=pg_temp.act(st,'authenticated',format('select public.is_tier1_verified(%L)::text',gen_random_uuid()));
 perform pg_temp.chk('2.2 authenticated: is_tier1_verified(uuid) false for an unknown user',res='OK|false',left(res,100));
 res:=pg_temp.act(ld,'authenticated','select public.is_tier1_verified()::text');
 perform pg_temp.chk('2.3 authenticated: the default-argument form (as the app and the policies call it) still works',res='OK|true',left(res,100));
 res:=pg_temp.act(ld,'authenticated',calls[2]);
 perform pg_temp.chk('2.4 authenticated: can_access_tenancy(tenancy, party) still true',res='OK|true',left(res,100));
 res:=pg_temp.act(st,'authenticated',format('select public.can_access_tenancy(%L,%L)::text',t,st));
 perform pg_temp.chk('2.5 authenticated: can_access_tenancy(tenancy, stranger) still false',res='OK|false',left(res,100));
 for n in 1..9 loop
  if n not in(2,7) then
   res:=pg_temp.act(ld,'authenticated',calls[n]);
   -- update_my_profile writes the caller's profile row; the synthetic fixture row has no auth user, so a foreign key error (23503) proves it ran; only a permission error would be a failure.
   perform pg_temp.chk('2.'||(5+n)||' authenticated still executes '||nine[n],case when n=9 then pg_temp.state(res) in('OK','23503') else pg_temp.state(res)='OK' end,left(res,100));
  end if;
 end loop;
 res:=pg_temp.act(ld,'authenticated','select public.is_admin()::text');
 perform pg_temp.chk('2.15 authenticated: is_admin() with no argument (the Edge Function path) still works and is false',res='OK|false',left(res,100));

 -- ---------------------------------------------------------------- 3 service_role (nothing uses it today; it is regranted)
 res:=pg_temp.act(null,'service_role',calls[7]);
 perform pg_temp.chk('3.1 service_role keeps EXECUTE (explicit grant)',res='OK|true',left(res,100));
 res:=pg_temp.act(null,'service_role',calls[2]);
 perform pg_temp.chk('3.2 service_role can call can_access_tenancy',pg_temp.state(res)='OK',left(res,100));

 -- ---------------------------------------------------------------- 4 existing RLS-dependent reads (policies TO authenticated that call the nine)
 res:=pg_temp.act(ld,'authenticated','select count(*)::text from public.conversations');
 perform pg_temp.chk('4.1 conversations read (policy uses is_admin) still returns the landlord''s conversation',res='OK|1',left(res,100));
 res:=pg_temp.act(st,'authenticated',format('select count(*)::text from public.listings where id=%L',l));
 perform pg_temp.chk('4.2 listings read (policy uses is_tier1_verified) still returns the active listing to a Tier 1 stranger',res='OK|1',left(res,100));
 res:=pg_temp.act(st,'authenticated',format('select count(*)::text from public.properties where id=%L',p));
 perform pg_temp.chk('4.3 properties read (policy uses can_view_property, which uses is_tier1_verified) still works',res='OK|1',left(res,100));
 perform pg_temp.chk('4.4 the can_access_tenancy policies (maintenance and rent tables) guard tables authenticated cannot select directly (no table SELECT), so they only run for definer RPCs: unchanged by the revoke',
  not has_table_privilege('authenticated','public.maintenance_requests','SELECT') and not has_table_privilege('authenticated','public.rent_obligations','SELECT'),'');
 res:=pg_temp.act(ld,'authenticated',format('select public.get_tenancy_reviews(%L)::text',t));
 perform pg_temp.chk('4.5 a tenancy RPC that reaches is_tier1_verified through a private helper (get_tenancy_reviews) still works for a party',pg_temp.state(res)='OK',left(res,100));
 res:=pg_temp.act(ld,'authenticated','select count(*)::text from public.tenancies');
 perform pg_temp.chk('4.6 tenancies read (policy uses is_admin) still returns the party''s tenancy',res='OK|1',left(res,100));
 res:=pg_temp.act(st,'authenticated','select count(*)::text from public.search_nearby_listings(14.45::double precision,120.96::double precision,5,10,0)');
 perform pg_temp.chk('4.7 search_nearby_listings (an invoker function that calls is_tier1_verified as the caller) still runs',pg_temp.state(res)='OK',left(res,160));
 res:=pg_temp.act(st,'authenticated','select count(*)::text from public.public_profiles');
 perform pg_temp.chk('4.8 the public_profiles view (it calls can_read_public_identity, which calls is_tier1_verified) still reads',pg_temp.state(res)='OK',left(res,100));
 res:=pg_temp.act(st,'authenticated',format('select public.get_public_identities(array[%L]::uuid[])::text',ld));
 perform pg_temp.chk('4.9 get_public_identities (the only nickname and avatar read) still works',pg_temp.state(res)='OK',left(res,100));
 if to_regprocedure('public.get_public_profile(uuid)') is not null then
  res:=pg_temp.act(st,'authenticated',format('select public.get_public_profile(%L)::text',ld));
  perform pg_temp.chk('4.10 get_public_profile (migration A) works for a Tier 1 caller after the revoke',pg_temp.state(res)='OK',left(res,100));
 end if;
 res:=pg_temp.act(null,'anon','select count(*)::text from public.conversations');
 perform pg_temp.chk('4.11 anon still has no table access at all (permission denied, 42501)',pg_temp.state(res)='42501',left(res,100));
end$t$;

-- Deliberate abort: carries the results out and guarantees the whole batch (fixture, migration objects if run pre-apply) rolls back.
do $out$
declare report text; bad int;
begin
 select count(*) filter (where not ok) into bad from rv_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when detail is not null and detail<>'' then ' :: '||left(detail,64) else '' end,E'
' order by n) into report from rv_res /*WHERE*/;
 raise exception E'REVOKE_CHECKS total=% failed=%
%',(select count(*) from rv_res),bad,report using errcode='P0001';
end$out$;
