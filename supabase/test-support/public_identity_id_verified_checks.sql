-- Checks for 20261118100000_public_identity_id_verified.sql (the 'id_verified' key of public.get_public_identities).
-- Pre-apply: run the migration body (without its begin/commit) and then this file as ONE batch. Post-apply: run this file alone.
-- Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results, so NOTHING can commit.
-- Fixtures only (profiles, verification submissions, properties, listings). No DDL on any real schema; the only objects created are pg_temp helpers.
-- The fixture is built with triggers off; triggers are switched back on before any RPC runs.
set local session_replication_role = replica;
create temp table iv_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create temp table iv_ctx(k text primary key,v text not null) on commit drop;

create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into iv_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
create function pg_temp.cx(p_k text) returns uuid language sql as $$ select v::uuid from iv_ctx where k=p_k $$;
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
create function pg_temp.ids(p_viewer uuid,p_role text,p_ids uuid[]) returns text language sql as $$
 select pg_temp.act(p_viewer,p_role,format('select public.get_public_identities(%L::uuid[])::text',p_ids)) $$;
create function pg_temp.body(p text) returns jsonb language sql as $$ select substr(p,4)::jsonb $$;
create function pg_temp.state(p text) returns text language sql as $$ select case when p like 'OK|%' then 'OK' else split_part(p,'|',2) end $$;
create function pg_temp.keys(j jsonb) returns text language sql as $$ select coalesce((select string_agg(k,',' order by k) from jsonb_object_keys(j) k),'') $$;
create function pg_temp.row(j jsonb,p_id uuid) returns jsonb language sql as $$ select e from jsonb_array_elements(j) e where e->>'id'=p_id::text $$;
create function pg_temp.mkprop(p_ld uuid,p_title text) returns void language plpgsql as $$
declare pid uuid:=gen_random_uuid();lid uuid:=gen_random_uuid();
begin
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location,is_active) values(pid,p_ld,'room','imus','Fixture',st_setsrid(st_makepoint(120.96,14.45),4326)::geography,true);
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status,published_at) values(lid,pid,p_ld,p_title,'Fixture listing',6000,'active'::public.listing_status,now()-interval '5 days');
end$$;

do $f$
declare
 r uuid:=gen_random_uuid();r0 uuid:=gen_random_uuid();v uuid:=gen_random_uuid();t1 uuid:=gen_random_uuid();pend uuid:=gen_random_uuid();unapp uuid:=gen_random_uuid();
 nocol uuid:=gen_random_uuid();mism uuid:=gen_random_uuid();not1 uuid:=gen_random_uuid();susp uuid:=gen_random_uuid();
 ts timestamptz:=now()-interval '3 days';avatar text:=v::text||'/public/'||gen_random_uuid()||'.png';
begin
 -- r reads everyone below (Tier 1); r0 has no Tier 1. v: active, Tier 1, exactly one approved Tier 2 submission that matches tier2_verified_at.
 insert into public.profiles(id,account_status,tier1_verified_at) values(r,'active',now()),(r0,'active',null);
 insert into public.profiles(id,account_status,tier1_verified_at,tier2_verified_at,public_nickname,public_nickname_confirmed_at,avatar_path,avatar_public_confirmed_at) values(v,'active',now(),ts,'Nightcity',now(),avatar,now());
 -- t1: Tier 1 only, no nickname and no avatar (the table forbids a nickname without its consent stamp). pend: a pending Tier 2 submission. unapp: a Tier 2 stamp with no approved submission.
 -- nocol: an approved submission but no stamp. mism: stamp and approval at different times. not1: approved Tier 2 but no Tier 1. susp: suspended with a valid Tier 2.
 insert into public.profiles(id,account_status,tier1_verified_at) values(t1,'active',now());
 insert into public.profiles(id,account_status,tier1_verified_at) values(pend,'active',now()),(nocol,'active',now());
 insert into public.profiles(id,account_status,tier1_verified_at,tier2_verified_at) values(unapp,'active',now(),ts),(mism,'active',now(),ts+interval '1 day'),(susp,'suspended',now(),ts);
 insert into public.profiles(id,account_status,tier1_verified_at,tier2_verified_at) values(not1,'active',null,ts);
 insert into public.verification_submissions(user_id,tier,status,reviewed_by,reviewed_at) values
  (v,'tier_2_identity','approved',gen_random_uuid(),ts),(nocol,'tier_2_identity','approved',gen_random_uuid(),ts),(mism,'tier_2_identity','approved',gen_random_uuid(),ts),
  (not1,'tier_2_identity','approved',gen_random_uuid(),ts),(susp,'tier_2_identity','approved',gen_random_uuid(),ts);
 insert into public.verification_submissions(user_id,tier,status) values(pend,'tier_2_identity','pending');
 -- Every target owns a published active listing, so the existing filter (can_read_public_identity) lets r read them; the suspended one is hidden by that filter.
 perform pg_temp.mkprop(v,'Fixture v');perform pg_temp.mkprop(t1,'Fixture t1');perform pg_temp.mkprop(pend,'Fixture pend');perform pg_temp.mkprop(unapp,'Fixture unapp');
 perform pg_temp.mkprop(nocol,'Fixture nocol');perform pg_temp.mkprop(mism,'Fixture mism');perform pg_temp.mkprop(not1,'Fixture not1');perform pg_temp.mkprop(susp,'Fixture susp');
 insert into iv_ctx values('r',r::text),('r0',r0::text),('v',v::text),('t1',t1::text),('pend',pend::text),('unapp',unapp::text),('nocol',nocol::text),('mism',mism::text),('not1',not1::text),('susp',susp::text),('avatar',avatar);
end$f$;
set local session_replication_role = origin;

do $c$
declare
 r uuid:=pg_temp.cx('r');r0 uuid:=pg_temp.cx('r0');v uuid:=pg_temp.cx('v');t1 uuid:=pg_temp.cx('t1');pend uuid:=pg_temp.cx('pend');unapp uuid:=pg_temp.cx('unapp');
 nocol uuid:=pg_temp.cx('nocol');mism uuid:=pg_temp.cx('mism');not1 uuid:=pg_temp.cx('not1');susp uuid:=pg_temp.cx('susp');
 o text;j jsonb;big50 uuid[];big51 uuid[];
begin
 -- 1 the function itself
 perform pg_temp.chk('shape: security definer, STABLE, search_path empty, returns jsonb, one overload',
  exists(select 1 from pg_proc where oid='public.get_public_identities(uuid[])'::regprocedure and prosecdef and provolatile='s' and proconfig=array['search_path=""']::text[] and prorettype='jsonb'::regtype)
  and (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='get_public_identities')=1,null);
 perform pg_temp.chk('fingerprint of the new body (CRs removed) is 78cf58cd42aa0df1611bd21f9dfa6d72',
  md5(replace((select prosrc from pg_proc where oid='public.get_public_identities(uuid[])'::regprocedure),chr(13),''))='78cf58cd42aa0df1611bd21f9dfa6d72',null);
 perform pg_temp.chk('grants: authenticated only (PUBLIC, anon, service_role have no execute)',
  has_function_privilege('authenticated','public.get_public_identities(uuid[])','EXECUTE') and not has_function_privilege('anon','public.get_public_identities(uuid[])','EXECUTE')
  and not has_function_privilege('service_role','public.get_public_identities(uuid[])','EXECUTE')
  and not exists(select 1 from pg_proc p,aclexplode(p.proacl) a where p.oid='public.get_public_identities(uuid[])'::regprocedure and a.grantee=0),null);
 perform pg_temp.chk('id_verified itself is still not executable by authenticated, anon or service_role',
  not has_function_privilege('authenticated','rentlease_profiles.id_verified(uuid)','EXECUTE') and not has_function_privilege('anon','rentlease_profiles.id_verified(uuid)','EXECUTE')
  and not has_function_privilege('service_role','rentlease_profiles.id_verified(uuid)','EXECUTE'),null);
 perform pg_temp.chk('id_verified is unchanged (fingerprint a201389104dcd2ec35e3f97d7f667c91, CRs removed)',
  md5(replace((select prosrc from pg_proc where oid='rentlease_profiles.id_verified(uuid)'::regprocedure),chr(13),''))='a201389104dcd2ec35e3f97d7f667c91',null);

 -- 2 the values, read by a Tier 1 user who can see all of them
 o:=pg_temp.ids(r,'authenticated',array[v,t1,pend,unapp,nocol,mism,not1,susp,gen_random_uuid()]);
 perform pg_temp.chk('a mixed batch is accepted',pg_temp.state(o)='OK',left(o,80));
 j:=pg_temp.body(o);
 perform pg_temp.chk('same filter: the suspended account and the unknown id are not returned; the other seven are',jsonb_array_length(j)=7 and pg_temp.row(j,susp) is null,jsonb_array_length(j)::text);
 perform pg_temp.chk('verified user (Tier 1 + one approved Tier 2 matching the stamp) -> true',pg_temp.row(j,v)->'id_verified'='true'::jsonb,null);
 perform pg_temp.chk('Tier 1 only -> false',pg_temp.row(j,t1)->'id_verified'='false'::jsonb,null);
 perform pg_temp.chk('pending Tier 2 -> false',pg_temp.row(j,pend)->'id_verified'='false'::jsonb,null);
 perform pg_temp.chk('Tier 2 stamp without an approved submission -> false',pg_temp.row(j,unapp)->'id_verified'='false'::jsonb,null);
 perform pg_temp.chk('approved submission without the stamp -> false',pg_temp.row(j,nocol)->'id_verified'='false'::jsonb,null);
 perform pg_temp.chk('stamp and approval at different times -> false',pg_temp.row(j,mism)->'id_verified'='false'::jsonb,null);
 perform pg_temp.chk('approved Tier 2 without Tier 1 -> false',pg_temp.row(j,not1)->'id_verified'='false'::jsonb,null);
 perform pg_temp.chk('suspended account: id_verified is false even when called directly (and the filter already hides it)',rentlease_profiles.id_verified(susp)=false,null);
 perform pg_temp.chk('id_verified is always a boolean, never NULL',(select count(*) from jsonb_array_elements(j) e where jsonb_typeof(e->'id_verified')<>'boolean')=0,null);

 -- 3 the old keys are unchanged
 perform pg_temp.chk('keys are exactly id, nickname, avatar_path and the new id_verified',pg_temp.keys(pg_temp.row(j,v))='avatar_path,id,id_verified,nickname' and pg_temp.keys(pg_temp.row(j,t1))='avatar_path,id,id_verified,nickname',null);
 perform pg_temp.chk('confirmed nickname and avatar are returned as before',pg_temp.row(j,v)->>'nickname'='Nightcity' and pg_temp.row(j,v)->>'avatar_path'=(select c.v from iv_ctx c where c.k='avatar') and pg_temp.row(j,v)->>'id'=v::text,null);
 perform pg_temp.chk('no nickname and no avatar stay null, as before',pg_temp.row(j,t1)->'nickname'='null'::jsonb and pg_temp.row(j,t1)->'avatar_path'='null'::jsonb,null);

 -- 4 batch size and the same errors
 select array_agg(x) into big50 from (select v as x union all select gen_random_uuid() from generate_series(1,49)) s;
 select array_agg(x) into big51 from (select v as x union all select gen_random_uuid() from generate_series(1,50)) s;
 o:=pg_temp.ids(r,'authenticated',big50);
 perform pg_temp.chk('a batch of 50 is accepted and still returns the verified flag',pg_temp.state(o)='OK' and pg_temp.row(pg_temp.body(o),v)->'id_verified'='true'::jsonb,left(o,60));
 o:=pg_temp.ids(r,'authenticated',big51);
 perform pg_temp.chk('a batch of 51 is rejected with 22023 Invalid identity batch',o like 'ERR|22023|Invalid identity batch%',o);
 o:=pg_temp.ids(r,'authenticated','{}'::uuid[]);
 perform pg_temp.chk('an empty batch is rejected with 22023',o like 'ERR|22023|Invalid identity batch%',o);
 o:=pg_temp.ids(r,'authenticated',null);
 perform pg_temp.chk('a NULL batch is rejected with 22023',o like 'ERR|22023|Invalid identity batch%',o);
 o:=pg_temp.ids(r,'authenticated',array[v,null]::uuid[]);
 perform pg_temp.chk('a NULL element is rejected with 22023',o like 'ERR|22023|Invalid identity batch%',o);

 -- 5 who may call it
 o:=pg_temp.ids(null,'anon',array[v]);
 perform pg_temp.chk('anon is rejected (42501, no execute)',pg_temp.state(o)='42501',o);
 o:=pg_temp.ids(gen_random_uuid(),'authenticated',array[v]);
 perform pg_temp.chk('a caller with no profile is rejected: Active account required',o like 'ERR|42501|Active account required%',o);
 o:=pg_temp.ids(susp,'authenticated',array[r]);
 perform pg_temp.chk('a suspended caller is rejected: Active account required',o like 'ERR|42501|Active account required%',o);
 o:=pg_temp.ids(v,'authenticated',array[v]);
 perform pg_temp.chk('a user reading their own row gets id_verified true',pg_temp.state(o)='OK' and pg_temp.row(pg_temp.body(o),v)->'id_verified'='true'::jsonb,left(o,60));
 o:=pg_temp.ids(r0,'authenticated',array[v,r0]);
 perform pg_temp.chk('a caller without Tier 1 still sees only their own row (filter unchanged); theirs is false',pg_temp.state(o)='OK' and jsonb_array_length(pg_temp.body(o))=1 and pg_temp.row(pg_temp.body(o),r0)->'id_verified'='false'::jsonb,left(o,60));
end$c$;

do $out$
declare report text;bad int;
begin
 select count(*) filter (where not ok) into bad from iv_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when detail is not null and detail<>'' then ' :: '||left(detail,64) else '' end,E'
' order by n) into report from iv_res;
 raise exception E'IDENTITY_ID_VERIFIED_CHECKS total=% failed=%
%',(select count(*) from iv_res),bad,report using errcode='P0001';
end$out$;
