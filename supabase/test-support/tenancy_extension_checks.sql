-- Tenancy extension checks. NOT RUN YET (written without hosted access). Needs the migration objects to exist in the same transaction
-- (pre-apply: run the migration body + this file as one batch with the migration's begin/commit removed) or in the database
-- (post-apply: run this file alone). Run pre-apply against a scratch database or branch, never against the hosted project that
-- is serving a live test.
-- Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results, so NOTHING can commit.
-- The fixture (profiles, tenancies, reservations) is built with triggers off; triggers are back on before any RPC runs, so the real
-- tenancy triggers (property gate, identity gate, commitment guard, listing sync, validation, notifications) run on every accept.
create temp table te_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;

create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into te_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
-- Run a statement as a role with a JWT subject; return 'OK|<result>' or 'ERR|<sqlstate>|<message>'.
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
create function pg_temp.w(p_uid uuid,p_tenancy uuid,p_op uuid,p_action text,p_payload jsonb) returns text language sql as $$
 select pg_temp.act(p_uid,'authenticated',format('select public.write_tenancy_extension(%L,%L,%L,%L::jsonb)::text',p_tenancy,p_op,p_action,p_payload::text)) $$;
create function pg_temp.g(p_uid uuid,p_tenancy uuid) returns text language sql as $$
 select pg_temp.act(p_uid,'authenticated',format('select public.get_tenancy_extension(%L)::text',p_tenancy)) $$;
create function pg_temp.gp(p_uid uuid) returns text language sql as $$
 select pg_temp.act(p_uid,'authenticated','select public.get_pending_tenancy_extensions()::text') $$;
create function pg_temp.body(p text) returns jsonb language sql as $$ select substr(p,4)::jsonb $$;
create function pg_temp.state(p text) returns text language sql as $$ select case when p like 'OK|%' then 'OK' else split_part(p,'|',2) end $$;
create function pg_temp.msg(p text) returns text language sql as $$ select case when p like 'ERR|%' then split_part(p,'|',3) else '' end $$;
-- Direct fixture changes with triggers off, then back on.
create function pg_temp.fx(p text) returns void language plpgsql as $$
begin execute 'set local session_replication_role = replica'; execute p; execute 'set local session_replication_role = origin'; end$$;
create function pg_temp.req(p_end date,p_note text default null) returns jsonb language sql as $$
 select jsonb_strip_nulls(jsonb_build_object('requestedEndDate',to_char(p_end,'YYYY-MM-DD'),'note',p_note)) $$;
create function pg_temp.dec(p_id text,p_rev text) returns jsonb language sql as $$ select jsonb_build_object('requestId',p_id,'revision',p_rev) $$;

do $t$
declare
 tn uuid:=gen_random_uuid(); ld uuid:=gen_random_uuid(); st uuid:=gen_random_uuid(); nt uuid:=gen_random_uuid(); ot uuid:=gen_random_uuid();
 ta uuid:=gen_random_uuid(); tb uuid:=gen_random_uuid(); tc uuid:=gen_random_uuid(); td uuid:=gen_random_uuid(); te uuid:=gen_random_uuid(); tf uuid:=gen_random_uuid();
 tg uuid:=gen_random_uuid(); th uuid:=gen_random_uuid(); ti uuid:=gen_random_uuid(); tj uuid:=gen_random_uuid(); tk uuid:=gen_random_uuid(); tm uuid:=gen_random_uuid();
 tq uuid:=gen_random_uuid(); tr uuid:=gen_random_uuid(); ts uuid:=gen_random_uuid(); tu uuid:=gen_random_uuid(); tx uuid:=gen_random_uuid();
 p_a uuid:=gen_random_uuid(); p_g uuid:=gen_random_uuid(); p_h uuid:=gen_random_uuid(); p_j uuid:=gen_random_uuid(); p_r uuid:=gen_random_uuid();
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; y int:=extract(year from (statement_timestamp() at time zone 'Asia/Manila'))::int+1;
 ea date:=today+30; bound date; res text; j jsonb; r1 text; r1rev text; op uuid; res2 text; n int; before_n int; after_n int; ledger_before int; ledger_after int; rid2 uuid; fstart date;
 resv uuid:=gen_random_uuid(); msgs text;
begin
 execute 'set local session_replication_role = replica';
 -- ---------------------------------------------------------------- fixture (triggers off)
 insert into public.profiles(id,account_status,tier1_verified_at) values(tn,'active',now()),(ld,'active',now()),(st,'active',now()),(nt,'active',null),(ot,'active',now());
 insert into public.tenancies(id,property_id,listing_id,tenant_id,landlord_id,status,start_date,expected_end_date,actual_end_date,ended_at,agreed_monthly_rent,rent_due_day,created_by,tenant_confirmed_at,landlord_confirmed_at,activated_at) values
  (ta,p_a,gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tb,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-90,today-3,null,null,10000,5,ld,now(),now(),now()),
  (tc,gen_random_uuid(),gen_random_uuid(),tn,ld,'pending_confirmation',today+5,today+95,null,null,10000,5,ld,now(),null,null),
  (td,gen_random_uuid(),gen_random_uuid(),tn,ld,'ended',today-90,today-5,today-5,now(),10000,5,ld,now(),now(),now()),
  (te,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,make_date(y,1,31),null,null,10000,5,ld,now(),now(),now()),
  (tf,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,make_date(y,3,1)-1,null,null,10000,5,ld,now(),now(),now()),
  (tg,p_g,gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (th,p_h,gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (ti,p_h,gen_random_uuid(),ot,ld,'pending_confirmation',today+50,today+120,null,null,10000,5,ld,now(),null,null),
  (tj,p_j,gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tk,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tm,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tq,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tr,p_r,gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (ts,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tu,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tx,gen_random_uuid(),gen_random_uuid(),nt,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now());
 -- tg: another party holds an approved reservation from today+40. p_r: a mix of reservations of which only one counts (from today+45).
 insert into public.rental_reservations(id,conversation_id,listing_id,property_id,tenant_id,landlord_id,move_in_date,duration_months,end_date,status,expires_at) values
  (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),p_g,ot,ld,today+40,2,today+100,'approved',now()+interval '100 days'),
  (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),p_r,ot,ld,today+45,2,today+105,'pending',now()+interval '3 days'),
  (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),p_r,ot,ld,today+36,1,today+60,'pending',now()-interval '1 day'),
  (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),p_r,tn,ld,today+35,2,today+80,'pending',now()+interval '3 days'),
  (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),p_r,ot,ld,today+31,1,today+50,'declined',now()+interval '3 days');
 execute 'set local session_replication_role = origin';

 perform pg_temp.chk('fixture: the extension tables start empty',(select count(*) from rentlease_tenancy_extension.requests)=0 and (select count(*) from rentlease_tenancy_extension.events)=0 and (select count(*) from rentlease_tenancy_extension.receipts)=0,'');

 -- ---------------------------------------------------------------- 1 grants and entry rules
 perform pg_temp.chk('1a anon, service_role and PUBLIC have no execute on any of the three RPCs; authenticated has',
  not exists(select 1 from unnest(array['public.write_tenancy_extension(uuid,uuid,text,jsonb)','public.get_tenancy_extension(uuid)','public.get_pending_tenancy_extensions()']) f where has_function_privilege('anon',f::regprocedure,'EXECUTE') or has_function_privilege('service_role',f::regprocedure,'EXECUTE') or not has_function_privilege('authenticated',f::regprocedure,'EXECUTE'))
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a where p.pronamespace in('public'::regnamespace) and p.proname in('write_tenancy_extension','get_tenancy_extension','get_pending_tenancy_extensions') and a.grantee=0),'');
 res:=pg_temp.act(tn,'anon',format('select public.get_tenancy_extension(%L)::text',ta));
 perform pg_temp.chk('1b the anon role is refused by the database',pg_temp.state(res)='42501',res);
 perform pg_temp.chk('1c the private schema and its tables are closed to client roles',
  not has_schema_privilege('authenticated','rentlease_tenancy_extension','USAGE') and not has_table_privilege('authenticated','rentlease_tenancy_extension.requests','SELECT,INSERT,UPDATE,DELETE')
  and not exists(select 1 from pg_proc p where p.pronamespace='rentlease_tenancy_extension'::regnamespace and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE'))),'');
 perform pg_temp.chk('1d write_tenancy_lifecycle still has the pinned source (not touched)',md5((select prosrc from pg_proc where oid=to_regprocedure('public.write_tenancy_lifecycle(uuid,uuid,text,text,uuid,text)')))='312e8bdaee38ba3b762a55b1635b2c63','');

 -- ---------------------------------------------------------------- 2 actor rules
 res:=pg_temp.w(ld,ta,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('2a the owner cannot request',pg_temp.state(res)='42501' and pg_temp.msg(res)='Tenant required',res);
 res:=pg_temp.w(st,ta,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('2b a stranger is refused',pg_temp.state(res)='42501' and pg_temp.msg(res)='Access unavailable',res);
 res:=pg_temp.w(nt,tx,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('2c a participant without Tier 1 is refused',pg_temp.state(res)='42501',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'accept',pg_temp.dec(gen_random_uuid()::text,gen_random_uuid()::text));
 perform pg_temp.chk('2d the tenant cannot accept',pg_temp.state(res)='42501' and pg_temp.msg(res)='Owner required',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'decline',pg_temp.dec(gen_random_uuid()::text,gen_random_uuid()::text));
 perform pg_temp.chk('2e the tenant cannot decline',pg_temp.state(res)='42501',res);
 res:=pg_temp.w(ld,ta,gen_random_uuid(),'withdraw',pg_temp.dec(gen_random_uuid()::text,gen_random_uuid()::text));
 perform pg_temp.chk('2f the owner cannot withdraw',pg_temp.state(res)='42501' and pg_temp.msg(res)='Tenant required',res);
 res:=pg_temp.g(st,ta);
 perform pg_temp.chk('2g a stranger cannot read',pg_temp.state(res)='42501',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'bogus','{}'::jsonb);
 perform pg_temp.chk('2h an unknown action is refused',pg_temp.state(res)='22023',res);

 -- ---------------------------------------------------------------- 3 date bounds (ta ends today+30)
 bound:=((ea+1)::timestamp+interval '6 months')::date-1;
 perform pg_temp.chk('3a the latest end date is (end + 1 day) + 6 months - 1 day',rentlease_tenancy_extension.latest_end(ea)=bound,'end='||ea||' bound='||bound||' fn='||rentlease_tenancy_extension.latest_end(ea));
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea));
 perform pg_temp.chk('3b a request equal to the current end is refused',pg_temp.state(res)='22023' and pg_temp.msg(res)='extension_date_invalid:not_after_end',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea-1));
 perform pg_temp.chk('3c a request before the current end is refused',pg_temp.msg(res)='extension_date_invalid:not_after_end',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(bound+1));
 perform pg_temp.chk('3d six months and a day is refused',pg_temp.state(res)='22023' and pg_temp.msg(res)='extension_date_invalid:beyond_limit',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request','{}'::jsonb);
 perform pg_temp.chk('3e a missing date is refused',pg_temp.msg(res)='extension_date_invalid:missing',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request','{"requestedEndDate":"2027-02-30"}'::jsonb);
 perform pg_temp.chk('3f an impossible date is refused',pg_temp.msg(res)='extension_date_invalid:malformed',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',jsonb_build_object('requestedEndDate',to_char(ea+10,'YYYY-MM-DD'),'extra',1));
 perform pg_temp.chk('3g an unknown payload field is refused',pg_temp.state(res)='22023' and pg_temp.msg(res)='Unexpected fields',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+10,''));
 perform pg_temp.chk('3h an empty note is refused',pg_temp.state(res)='22023',res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+10,repeat('x',1001)));
 perform pg_temp.chk('3i a note over 1000 characters is refused',pg_temp.state(res)='22023',res);
 perform pg_temp.chk('3j refusals left nothing behind',(select count(*) from rentlease_tenancy_extension.requests)=0 and (select count(*) from rentlease_tenancy_extension.receipts)=0,'');
 -- the tenancy states
 res:=pg_temp.w(tn,tb,gen_random_uuid(),'request',pg_temp.req(today+10));
 perform pg_temp.chk('3k an active tenancy past its end date is refused',pg_temp.state(res)='22023' and pg_temp.msg(res)='extension_unavailable:past_end_date',res);
 res:=pg_temp.w(tn,tc,gen_random_uuid(),'request',pg_temp.req(today+100));
 perform pg_temp.chk('3l a tenancy that has not started is refused',pg_temp.msg(res)='extension_unavailable:not_active',res);
 res:=pg_temp.w(tn,td,gen_random_uuid(),'request',pg_temp.req(today+10));
 perform pg_temp.chk('3m an ended tenancy is refused',pg_temp.msg(res)='extension_unavailable:not_active',res);
 -- the month rule on month-end dates
 res:=pg_temp.w(tn,te,gen_random_uuid(),'request',pg_temp.req(make_date(y,7,31)+1));
 perform pg_temp.chk('3n Jan 31: Aug 1 is beyond the limit',pg_temp.msg(res)='extension_date_invalid:beyond_limit',res);
 res:=pg_temp.w(tn,te,gen_random_uuid(),'request',pg_temp.req(make_date(y,7,31)));
 perform pg_temp.chk('3o Jan 31: Jul 31 is the latest allowed',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='pending',res);
 res:=pg_temp.w(tn,tf,gen_random_uuid(),'request',pg_temp.req(make_date(y,8,31)+1));
 perform pg_temp.chk('3p last day of Feb: Sep 1 is beyond the limit',pg_temp.msg(res)='extension_date_invalid:beyond_limit',res);
 res:=pg_temp.w(tn,tf,gen_random_uuid(),'request',pg_temp.req(make_date(y,8,31)));
 perform pg_temp.chk('3q last day of Feb: Aug 31 is the latest allowed (not Aug 28)',pg_temp.state(res)='OK',res);
 -- exactly six months on ta
 op:=gen_random_uuid(); res:=pg_temp.w(tn,ta,op,'request',pg_temp.req(bound,'Staying for the semester'));
 perform pg_temp.chk('3r exactly six months is accepted as a request',pg_temp.state(res)='OK' and (pg_temp.body(res)->>'requestedEndDate')::date=bound and (pg_temp.body(res)->>'currentEndDate')::date=ea,res);
 r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';

 -- ---------------------------------------------------------------- 4 one pending request, retry, stale, withdraw
 res2:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('4a a second request while one is pending is refused',pg_temp.state(res2)='22023' and pg_temp.msg(res2)='extension_unavailable:request_pending',res2);
 res2:=pg_temp.w(tn,ta,op,'request',pg_temp.req(bound,'Staying for the semester'));
 perform pg_temp.chk('4b the same operation id with the same input returns the same result and writes nothing',res2=res and (select count(*) from rentlease_tenancy_extension.requests where tenancy_id=ta)=1 and (select count(*) from rentlease_tenancy_extension.events where tenancy_id=ta)=1,res2);
 res2:=pg_temp.w(tn,ta,op,'request',pg_temp.req(bound-1));
 perform pg_temp.chk('4c the same operation id with different input is refused',pg_temp.state(res2)='22023' and pg_temp.msg(res2)='Conflicting retry',res2);
 res2:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(r1,gen_random_uuid()::text));
 perform pg_temp.chk('4d a stale revision is refused with 40001',pg_temp.state(res2)='40001',res2);
 res2:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(gen_random_uuid()::text,r1rev));
 perform pg_temp.chk('4e an unknown request id is refused with 40001',pg_temp.state(res2)='40001',res2);
 -- reads while pending
 res:=pg_temp.g(ld,ta); j:=pg_temp.body(res);
 perform pg_temp.chk('4f owner read: pending request with canAccept, canDecline, no conflict, role landlord, no user ids',
  j->>'role'='landlord' and j#>>'{request,status}'='pending' and (j#>>'{request,canAccept}')::boolean and (j#>>'{request,canDecline}')::boolean and not (j#>>'{request,canWithdraw}')::boolean
  and j#>>'{request,conflictDate}' is null and (j->>'currentEndDate')::date=ea and (j->>'latestEndDate')::date=bound and (j#>>'{request,revision}')=r1rev and position(tn::text in res)=0 and position(ld::text in res)=0,left(res,200));
 res:=pg_temp.g(tn,ta); j:=pg_temp.body(res);
 perform pg_temp.chk('4g tenant read: pending request with canWithdraw, no canAccept, no conflictDate, canRequest false because a request is pending',
  j->>'role'='tenant' and (j#>>'{request,canWithdraw}')::boolean and not (j#>>'{request,canAccept}')::boolean and j#>>'{request,conflictDate}' is null and not (j->>'canRequest')::boolean and j->>'cannotRequestReason'='request_pending' and j#>>'{request,note}'='Staying for the semester',left(res,200));
 res:=pg_temp.gp(ld); j:=pg_temp.body(res);
 perform pg_temp.chk('4h pending feed: the owner sees the request with both dates and no conflict',
  jsonb_array_length(j->'rows')>=1 and exists(select 1 from jsonb_array_elements(j->'rows') e where e->>'requestId'=r1 and e->>'tenancyId'=ta::text and (e->>'requestedEndDate')::date=bound and (e->>'currentEndDate')::date=ea and e->'conflictDate'='null'::jsonb) and (j->>'hasMore')='false' and position(tn::text in res)=0,left(res,200));
 res:=pg_temp.gp(tn); perform pg_temp.chk('4i pending feed: the tenant sees nothing',jsonb_array_length(pg_temp.body(res)->'rows')=0,left(res,120));
 res:=pg_temp.gp(st); perform pg_temp.chk('4j pending feed: a stranger sees nothing',jsonb_array_length(pg_temp.body(res)->'rows')=0,left(res,120));
 -- withdraw, then ask again
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('4k the tenant withdraws',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='withdrawn',res);
 res:=pg_temp.g(tn,ta); j:=pg_temp.body(res);
 perform pg_temp.chk('4l after a withdrawal the read shows it and the tenant can ask again',j#>>'{request,status}'='withdrawn' and j#>>'{request,whoDecided}'='tenant' and (j->>'canRequest')::boolean,left(res,200));
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('4m withdrawing again is refused (not pending any more)',pg_temp.state(res)='40001',res);
 -- decline with a note, then ask again
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+20)); r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';
 perform pg_temp.chk('4n the tenant asks again after a withdrawal',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(ld,ta,gen_random_uuid(),'decline',jsonb_build_object('requestId',r1,'revision',r1rev,'note','Not this time'));
 perform pg_temp.chk('4o the owner declines with a note',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='declined',res);
 res:=pg_temp.g(tn,ta); j:=pg_temp.body(res);
 perform pg_temp.chk('4p the tenant sees the decline, the note, who decided, and can ask again',j#>>'{request,status}'='declined' and j#>>'{request,decisionNote}'='Not this time' and j#>>'{request,whoDecided}'='landlord' and (j->>'canRequest')::boolean,left(res,240));
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+20));
 perform pg_temp.chk('4q the tenant asks again after a decline',pg_temp.state(res)='OK',res);
 perform pg_temp.chk('4r events are one row per step and the tenancy end date has not moved',(select count(*) from rentlease_tenancy_extension.events where tenancy_id=ta)=5 and (select expected_end_date from public.tenancies where id=ta)=ea,'');

 -- ---------------------------------------------------------------- 5 accept moves the end date (tm)
 select count(*) into ledger_before from rentlease_rent_ledger.due_dates((select start_date from public.tenancies where id=tm),(select expected_end_date from public.tenancies where id=tm),5,today+400);
 select count(*) into before_n from public.notifications;
 op:=gen_random_uuid(); res:=pg_temp.w(tn,tm,gen_random_uuid(),'request',pg_temp.req(ea+60)); r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';
 perform pg_temp.chk('5a the tenant asks for 60 more days',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(ld,tm,op,'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('5b the owner accepts',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='accepted' and (pg_temp.body(res)->>'currentEndDate')::date=ea+60,res);
 perform pg_temp.chk('5c the tenancy end date moved and nothing else did',
  (select expected_end_date from public.tenancies where id=tm)=ea+60 and (select actual_end_date from public.tenancies where id=tm) is null and (select status from public.tenancies where id=tm)='active'
  and (select agreed_monthly_rent from public.tenancies where id=tm)=10000 and (select rent_due_day from public.tenancies where id=tm)=5 and (select start_date from public.tenancies where id=tm)=today-60,'');
 select count(*) into ledger_after from rentlease_rent_ledger.due_dates((select start_date from public.tenancies where id=tm),(select coalesce(actual_end_date,expected_end_date) from public.tenancies where id=tm),5,today+400);
 perform pg_temp.chk('5d the rent ledger schedule (coalesce(actual, expected)) now has the extra months',ledger_after>ledger_before,'before='||ledger_before||' after='||ledger_after);
 select count(*) into after_n from public.notifications;
 perform pg_temp.chk('5e no notification was created',after_n=before_n,'before='||before_n||' after='||after_n);
 res:=pg_temp.w(ld,tm,op,'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('5f retrying the accept with the same operation id returns the stored result',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='accepted',res);
 res:=pg_temp.w(ld,tm,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('5g accepting again with a new operation id is refused (not pending)',pg_temp.state(res)='40001',res);
 res:=pg_temp.g(tn,tm); j:=pg_temp.body(res);
 perform pg_temp.chk('5h the read shows the accepted request, the new end date and a new limit',j#>>'{request,status}'='accepted' and (j->>'currentEndDate')::date=ea+60 and (j->>'latestEndDate')::date=rentlease_tenancy_extension.latest_end(ea+60) and j#>>'{request,whoDecided}'='landlord',left(res,240));
 res:=pg_temp.w(tn,tm,gen_random_uuid(),'request',pg_temp.req(ea+70));
 perform pg_temp.chk('5i the tenant can ask again from the new end date',pg_temp.state(res)='OK' and (pg_temp.body(res)->>'currentEndDate')::date=ea+60,res);
 res:=pg_temp.w(tn,tm,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('5j ... and the old end date is no longer enough',pg_temp.msg(res) in('extension_unavailable:request_pending','extension_date_invalid:not_after_end'),res);

 -- ---------------------------------------------------------------- 6 conflicts
 res:=pg_temp.w(tn,tg,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('6a a request that reaches another party''s approved reservation is refused with the first conflicting date',pg_temp.state(res)='23P01' and pg_temp.msg(res)='extension_conflict:'||to_char(today+40,'YYYY-MM-DD'),res);
 res:=pg_temp.w(tn,tg,gen_random_uuid(),'request',pg_temp.req(today+39));
 perform pg_temp.chk('6b a request that stops the day before the reservation is allowed',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(tn,th,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('6c a request that reaches another tenancy is refused with its start date',pg_temp.state(res)='23P01' and pg_temp.msg(res)='extension_conflict:'||to_char(today+50,'YYYY-MM-DD'),res);
 res:=pg_temp.w(tn,tr,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('6d only an unexpired pending reservation by another party counts (not expired, declined or the same pair''s)',pg_temp.state(res)='23P01' and pg_temp.msg(res)='extension_conflict:'||to_char(today+45,'YYYY-MM-DD'),res);
 -- a conflict that appears between the request and the accept
 res:=pg_temp.w(tn,tj,gen_random_uuid(),'request',pg_temp.req(ea+40)); r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';
 perform pg_temp.chk('6e a request with a clear calendar is accepted as pending',pg_temp.state(res)='OK',res);
 perform pg_temp.fx(format('insert into public.rental_reservations(id,conversation_id,listing_id,property_id,tenant_id,landlord_id,move_in_date,duration_months,end_date,status,expires_at) values(%L,%L,%L,%L,%L,%L,%L,2,%L,''approved'',now()+interval ''100 days'')',resv,gen_random_uuid(),gen_random_uuid(),p_j,ot,ld,today+45,today+105));
 res:=pg_temp.g(ld,tj); j:=pg_temp.body(res);
 perform pg_temp.chk('6f the owner read now carries conflictDate live and canAccept is false',j#>>'{request,conflictDate}'=to_char(today+45,'YYYY-MM-DD') and not (j#>>'{request,canAccept}')::boolean and (j#>>'{request,canDecline}')::boolean,left(res,240));
 res:=pg_temp.gp(ld); j:=pg_temp.body(res);
 perform pg_temp.chk('6g the pending feed carries the same conflictDate',exists(select 1 from jsonb_array_elements(j->'rows') e where e->>'requestId'=r1 and e->>'conflictDate'=to_char(today+45,'YYYY-MM-DD')),left(res,240));
 res:=pg_temp.w(ld,tj,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('6h accept checks again and refuses with the conflicting date',pg_temp.state(res)='23P01' and pg_temp.msg(res)='extension_conflict:'||to_char(today+45,'YYYY-MM-DD'),res);
 perform pg_temp.chk('6i the refused accept moved nothing',(select expected_end_date from public.tenancies where id=tj)=ea and (select status from rentlease_tenancy_extension.requests where id=r1::uuid)='pending','');
 perform pg_temp.fx(format('delete from public.rental_reservations where id=%L',resv));
 res:=pg_temp.w(ld,tj,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('6j once the conflict is gone the same request can be accepted',pg_temp.state(res)='OK' and (select expected_end_date from public.tenancies where id=tj)=ea+40,res);

 -- ---------------------------------------------------------------- 7 early-end requests and other changes
 perform pg_temp.fx(format('insert into rentlease_tenancy_end.requests(tenancy_id,initiator_id,proposed_end_date,reason,base_version,original_terms) values(%L,%L,%L,''Moving out'',''v'',''{}''::jsonb)',tk,tn,today));
 res:=pg_temp.w(tn,tk,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('7a a tenant cannot ask while an early-end request is pending',pg_temp.state(res)='22023' and pg_temp.msg(res)='extension_unavailable:early_end_pending',res);
 res:=pg_temp.g(tn,tk); j:=pg_temp.body(res);
 perform pg_temp.chk('7b the read says so',not (j->>'canRequest')::boolean and j->>'cannotRequestReason'='early_end_pending',left(res,200));
 -- the other way round: the extension is pending first
 res:=pg_temp.w(tn,tq,gen_random_uuid(),'request',pg_temp.req(ea+10)); r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';
 perform pg_temp.fx(format('insert into rentlease_tenancy_end.requests(id,tenancy_id,initiator_id,proposed_end_date,reason,base_version,original_terms) values(%L,%L,%L,%L,''Moving out'',''v'',''{}''::jsonb)',gen_random_uuid(),tq,tn,today));
 res:=pg_temp.w(ld,tq,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7c the owner cannot accept while an early-end request is pending',pg_temp.state(res)='22023' and pg_temp.msg(res)='extension_unavailable:early_end_pending',res);
 res:=pg_temp.g(ld,tq); j:=pg_temp.body(res);
 perform pg_temp.chk('7d the owner read shows canAccept false, but the owner can still decline',not (j#>>'{request,canAccept}')::boolean and (j#>>'{request,canDecline}')::boolean,left(res,240));
 perform pg_temp.fx(format('update rentlease_tenancy_end.requests set status=''withdrawn'',resolved_at=now(),resolved_by=%L where tenancy_id=%L and status=''pending''',tn,tq));
 res:=pg_temp.w(ld,tq,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7e once the early-end request is resolved the extension can be accepted',pg_temp.state(res)='OK',res);
 -- the tenancy ended while the extension was pending
 res:=pg_temp.w(tn,ts,gen_random_uuid(),'request',pg_temp.req(ea+10)); r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';
 perform pg_temp.fx(format('update public.tenancies set status=''ended'',actual_end_date=%L,ended_at=now() where id=%L',today,ts));
 res:=pg_temp.gp(ld);
 perform pg_temp.chk('7f the pending feed no longer lists a request on an ended tenancy',not exists(select 1 from jsonb_array_elements(pg_temp.body(res)->'rows') e where e->>'tenancyId'=ts::text),left(res,160));
 res:=pg_temp.w(ld,ts,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7g accept refuses because the tenancy is no longer active',pg_temp.state(res)='22023' and pg_temp.msg(res)='extension_unavailable:not_active',res);
 res:=pg_temp.w(ld,ts,gen_random_uuid(),'decline',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7h the owner can still clear it by declining',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='declined',res);
 -- the tenancy's end date changed under a pending request
 res:=pg_temp.w(tn,tu,gen_random_uuid(),'request',pg_temp.req(ea+10)); r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';
 perform pg_temp.fx(format('update public.tenancies set expected_end_date=%L where id=%L',ea+1,tu));
 res:=pg_temp.w(ld,tu,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7i accept refuses with 40001 when the tenancy end date is no longer the one the request was made against',pg_temp.state(res)='40001' and pg_temp.msg(res)='Tenancy changed. Reload.',res);
 -- today is past the end date at accept time (a request row made earlier; the tenancy tb ended its term 3 days ago)
 perform pg_temp.fx(format('insert into rentlease_tenancy_extension.requests(id,tenancy_id,requester_id,requested_end_date,base_end_date) values(%L,%L,%L,%L,%L)',gen_random_uuid(),tb,tn,today+10,today-3));
 select id::text,revision::text into r1,r1rev from rentlease_tenancy_extension.requests where tenancy_id=tb and status='pending';
 res:=pg_temp.w(ld,tb,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7j accept refuses once today is past the current end date',pg_temp.state(res)='22023' and pg_temp.msg(res)='extension_unavailable:past_end_date',res);
 res:=pg_temp.gp(ld);
 perform pg_temp.chk('7k the pending feed does not list a request past its end date',not exists(select 1 from jsonb_array_elements(pg_temp.body(res)->'rows') e where e->>'tenancyId'=tb::text),left(res,160));

 -- ---------------------------------------------------------------- 8 evidence is immutable
 perform pg_temp.chk('8a there is evidence to protect',(select count(*) from rentlease_tenancy_extension.events)>0 and (select count(*) from rentlease_tenancy_extension.receipts)>0,'');
 begin update rentlease_tenancy_extension.events set note='x';perform pg_temp.chk('8b events cannot be updated',false,'updated');exception when others then perform pg_temp.chk('8b events cannot be updated',sqlstate='42501',sqlerrm);end;
 begin delete from rentlease_tenancy_extension.receipts;perform pg_temp.chk('8c receipts cannot be deleted',false,'deleted');exception when others then perform pg_temp.chk('8c receipts cannot be deleted',sqlstate='42501',sqlerrm);end;
 begin delete from rentlease_tenancy_extension.requests;perform pg_temp.chk('8d requests cannot be deleted',false,'deleted');exception when others then perform pg_temp.chk('8d requests cannot be deleted',sqlstate='42501',sqlerrm);end;
 begin update rentlease_tenancy_extension.requests set requested_end_date=requested_end_date+1 where status='accepted';perform pg_temp.chk('8e an original request field cannot be changed',false,'changed');exception when others then perform pg_temp.chk('8e an original request field cannot be changed',sqlstate='42501',sqlerrm);end;
 begin update rentlease_tenancy_extension.requests set status='pending' where status='accepted';perform pg_temp.chk('8f a decided request cannot be reopened',false,'reopened');exception when others then perform pg_temp.chk('8f a decided request cannot be reopened',sqlstate in('42501','23514'),sqlerrm);end;
 perform pg_temp.chk('8g a tenancy with extension history cannot be deleted (RESTRICT)',(select count(*) from pg_constraint where conrelid='rentlease_tenancy_extension.requests'::regclass and contype='f' and confdeltype='r')=1 and (select count(*) from pg_constraint where conrelid='rentlease_tenancy_extension.events'::regclass and contype='f' and confdeltype='r')=2,'');
 perform pg_temp.chk('8h every extension table has row level security and no policy',not exists(select 1 from pg_tables where schemaname='rentlease_tenancy_extension' and not rowsecurity) and not exists(select 1 from pg_policies where schemaname='rentlease_tenancy_extension'),'');
end$t$;

-- Deliberate abort: carries the results out and guarantees the whole batch (fixture, migration objects if run pre-apply) rolls back.
do $out$
declare report text; bad int;
begin
 select count(*) filter (where not ok) into bad from te_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when detail is not null and detail<>'' then ' :: '||left(detail,72) else '' end,E'
' order by n) into report from te_res /*WHERE*/;
 raise exception E'TENANCY_EXTENSION_CHECKS total=% failed=%
%',(select count(*) from te_res),bad,report using errcode='P0001';
end$out$;
