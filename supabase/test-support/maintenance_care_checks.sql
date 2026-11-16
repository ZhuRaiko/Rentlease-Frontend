-- Maintenance care checks. Needs the migration objects to exist in the same transaction (pre-apply: run the migration body + this file as one batch with begin/commit removed)
-- or in the database (post-apply: run this file alone). Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results, so NOTHING can commit.
-- The fixture (profiles, properties, listings, tenancies and some leftover requests) is built with triggers off; triggers are switched back on before any RPC runs, so the real
-- triggers (revision rotation, status logging, notifications) are exercised. Every request in the write flows is created through the real RPC.
set local session_replication_role = replica;
create temp table mc_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create temp table mc_ctx(k text primary key,v text not null) on commit drop;
create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into mc_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
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
create function pg_temp.w(p_uid uuid,p_tenancy uuid,p_action text,p_payload jsonb,p_op uuid default gen_random_uuid(),p_role text default 'authenticated') returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.write_tenancy_care(%L,%L,%L,%L::jsonb)::text',p_tenancy,p_op,p_action,p_payload::text)) $$;
create function pg_temp.state(p text) returns text language sql as $$ select case when p like 'OK|%' then 'OK' else split_part(p,'|',2) end $$;
create function pg_temp.body(p text) returns jsonb language sql as $$ select case when p like 'OK|%' then substr(p,4)::jsonb end $$;
create function pg_temp.rev(p_req uuid) returns text language sql as $$ select care_revision::text from public.maintenance_requests where id=p_req $$;
create function pg_temp.st(p_req uuid) returns text language sql as $$ select status::text from public.maintenance_requests where id=p_req $$;
create function pg_temp.nupd(p_req uuid) returns int language sql as $$ select count(*)::int from public.maintenance_updates where maintenance_request_id=p_req $$;
create function pg_temp.nmsg(p_uid uuid) returns int language sql as $$ select count(*)::int from public.notifications where user_id=p_uid and type::text='maintenance_update' $$;
create function pg_temp.lastnote(p_req uuid) returns text language sql as $$ select note from public.maintenance_updates where maintenance_request_id=p_req order by ctid desc limit 1 $$;
create function pg_temp.mkprop(p_ld uuid,out pid uuid,out lid uuid) language plpgsql as $$
begin
 pid:=gen_random_uuid();lid:=gen_random_uuid();
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location,is_active) values(pid,p_ld,'room','imus','Fixture',st_setsrid(st_makepoint(120.96,14.45),4326)::geography,true);
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status,published_at) values(lid,pid,p_ld,'Fixture listing','Fixture listing',6000,'active',now()-interval '5 days');
end$$;
create function pg_temp.mkten(p_ld uuid,p_tn uuid,p_status text) returns uuid language plpgsql as $$
declare pr record;tid uuid:=gen_random_uuid();
begin
 select * into pr from pg_temp.mkprop(p_ld);
 insert into public.tenancies(id,property_id,listing_id,tenant_id,landlord_id,status,start_date,actual_end_date,ended_at,agreed_monthly_rent,rent_due_day,created_by)
 values(tid,pr.pid,pr.lid,p_tn,p_ld,p_status::public.tenancy_status,current_date-120,case when p_status='ended' then current_date-10 end,case when p_status='ended' then now()-interval '10 days' end,6000,2,p_ld);
 return tid;
end$$;
create function pg_temp.mkreq(p_ten uuid,p_by uuid,p_status text,p_priority text,p_age interval,p_confirmed boolean default false,p_title text default 'Fixture request') returns uuid language plpgsql as $$
declare rid uuid:=gen_random_uuid();
begin
 insert into public.maintenance_requests(id,tenancy_id,requested_by,title,description,category,priority,status,resolved_at,tenant_confirmed_resolved_at,created_at,landlord_response)
 values(rid,p_ten,p_by,p_title,'Fixture description for the request','plumbing',p_priority::public.maintenance_priority,p_status::public.maintenance_status,
  case when p_status='resolved' then now()-p_age end,case when p_confirmed then now()-p_age end,now()-p_age,'Fixture landlord note');
 return rid;
end$$;

do $f$
declare
 ld uuid:=gen_random_uuid();tn uuid:=gen_random_uuid();st uuid:=gen_random_uuid();ld2 uuid:=gen_random_uuid();tn2 uuid:=gen_random_uuid();nt1 uuid:=gen_random_uuid();ld3 uuid:=gen_random_uuid();tn3 uuid:=gen_random_uuid();ld4 uuid:=gen_random_uuid();tn4 uuid:=gen_random_uuid();
 tA uuid;tB uuid;tC uuid;tI1 uuid;tI2 uuid;tP uuid;tI3 uuid;tX uuid;x1 uuid;x2 uuid;x3 uuid;x4 uuid;
 e1 uuid;e2 uuid;e3 uuid;e4 uuid;e5 uuid;e6 uuid;c1 uuid;
 u1 uuid;u2 uuid;u3 uuid;u4 uuid;u5 uuid;u6 uuid;i1 uuid;i2 uuid;i3 uuid;i4 uuid;i5 uuid;i6 uuid;k int;
begin
 insert into public.profiles(id,account_status,tier1_verified_at) select x,'active',now() from unnest(array[ld,tn,st,ld2,tn2,ld3,tn3,ld4,tn4]) x;
 insert into public.profiles(id,account_status,tier1_verified_at) values(nt1,'active',null);
 tA:=pg_temp.mkten(ld,tn,'active');tB:=pg_temp.mkten(ld,tn,'ended');tC:=pg_temp.mkten(ld2,tn2,'active');tP:=pg_temp.mkten(ld,tn,'pending_confirmation');
 -- an ACTIVE tenancy whose expected end date has passed (status still active), with open requests
 tX:=pg_temp.mkten(ld,tn,'active');update public.tenancies set expected_end_date=current_date-5 where id=tX;
 x1:=pg_temp.mkreq(tX,tn,'in_progress','normal',interval '8 days');x2:=pg_temp.mkreq(tX,tn,'resolved','normal',interval '8 days');x3:=pg_temp.mkreq(tX,tn,'submitted','normal',interval '8 days');x4:=pg_temp.mkreq(tX,tn,'acknowledged','normal',interval '8 days');
 -- leftover requests on the ended tenancy tB
 e1:=pg_temp.mkreq(tB,tn,'in_progress','normal',interval '9 days');e2:=pg_temp.mkreq(tB,tn,'resolved','normal',interval '9 days');e3:=pg_temp.mkreq(tB,tn,'submitted','normal',interval '9 days');
 e4:=pg_temp.mkreq(tB,tn,'cancelled','normal',interval '9 days');e5:=pg_temp.mkreq(tB,tn,'resolved','normal',interval '9 days');e6:=pg_temp.mkreq(tB,tn,'acknowledged','normal',interval '9 days');
 c1:=pg_temp.mkreq(tC,tn2,'submitted','urgent',interval '1 day');
 -- inbox fixture: ld3 (clean landlord with known numbers)
 tI1:=pg_temp.mkten(ld3,tn3,'active');tI2:=pg_temp.mkten(ld3,tn3,'ended');
 u1:=pg_temp.mkreq(tI1,tn3,'submitted','urgent',interval '5 minutes',false,'Urgent leak');u2:=pg_temp.mkreq(tI1,tn3,'in_progress','normal',interval '4 minutes');
 u3:=pg_temp.mkreq(tI1,tn3,'resolved','urgent',interval '3 minutes',true);u4:=pg_temp.mkreq(tI1,tn3,'resolved','low',interval '2 minutes');
 u5:=pg_temp.mkreq(tI1,tn3,'cancelled','normal',interval '1 minute');u6:=pg_temp.mkreq(tI1,tn3,'in_progress','urgent',interval '10 minutes');
 i1:=pg_temp.mkreq(tI2,tn3,'submitted','normal',interval '20 minutes');i2:=pg_temp.mkreq(tI2,tn3,'resolved','normal',interval '21 minutes',true);i3:=pg_temp.mkreq(tI2,tn3,'cancelled','normal',interval '22 minutes');
 i4:=pg_temp.mkreq(tI2,tn3,'resolved','normal',interval '30 minutes');
 -- thread fixture on u1 with distinct times
 insert into public.maintenance_updates(maintenance_request_id,actor_id,from_status,to_status,note,created_at) values(u1,tn3,null,'submitted','Request submitted',now()-interval '5 minutes'),(u1,tn3,'submitted','submitted','Water everywhere',now()-interval '4 minutes'),(u1,ld3,'submitted','submitted','On my way',now()-interval '3 minutes');
 -- pagination fixture: ld4 with 22 requests
 tI3:=pg_temp.mkten(ld4,tn4,'active');
 for k in 1..22 loop perform pg_temp.mkreq(tI3,tn4,'submitted','normal',make_interval(mins=>k)); end loop;
 insert into mc_ctx values('ld',ld::text),('tn',tn::text),('st',st::text),('ld2',ld2::text),('tn2',tn2::text),('nt1',nt1::text),('ld3',ld3::text),('tn3',tn3::text),('ld4',ld4::text),('tn4',tn4::text),
  ('tX',tX::text),('x1',x1::text),('x2',x2::text),('x3',x3::text),('x4',x4::text),('tA',tA::text),('tB',tB::text),('tC',tC::text),('tP',tP::text),('tI1',tI1::text),('tI2',tI2::text),('e1',e1::text),('e2',e2::text),('e3',e3::text),('e4',e4::text),('e5',e5::text),('e6',e6::text),('c1',c1::text),
  ('u1',u1::text),('u2',u2::text),('u3',u3::text),('u4',u4::text),('u5',u5::text),('u6',u6::text),('i1',i1::text),('i2',i2::text),('i3',i3::text),('i4',i4::text);
end$f$;
set local session_replication_role = origin;

do $t$
declare
 ld uuid;tn uuid;st uuid;ld2 uuid;tn2 uuid;nt1 uuid;tX uuid;x1 uuid;x2 uuid;x3 uuid;x4 uuid;tA uuid;tB uuid;tC uuid;tP uuid;e1 uuid;e2 uuid;e3 uuid;e4 uuid;e5 uuid;e6 uuid;c1 uuid;
 res text;j jsonb;r1 uuid;r2 uuid;r3 uuid;r4 uuid;r5 uuid;r6 uuid;r7 uuid;rv text;op uuid;n0 int;nl0 int;nt0 int;u0 int;pc int;
begin
 select v::uuid into ld from mc_ctx where k='ld';select v::uuid into tn from mc_ctx where k='tn';select v::uuid into st from mc_ctx where k='st';select v::uuid into ld2 from mc_ctx where k='ld2';select v::uuid into tn2 from mc_ctx where k='tn2';select v::uuid into nt1 from mc_ctx where k='nt1';
 select v::uuid into tX from mc_ctx where k='tX';select v::uuid into x1 from mc_ctx where k='x1';select v::uuid into x2 from mc_ctx where k='x2';select v::uuid into x3 from mc_ctx where k='x3';select v::uuid into x4 from mc_ctx where k='x4';
 select v::uuid into tA from mc_ctx where k='tA';select v::uuid into tB from mc_ctx where k='tB';select v::uuid into tC from mc_ctx where k='tC';select v::uuid into tP from mc_ctx where k='tP';
 select v::uuid into e1 from mc_ctx where k='e1';select v::uuid into e2 from mc_ctx where k='e2';select v::uuid into e3 from mc_ctx where k='e3';select v::uuid into e4 from mc_ctx where k='e4';select v::uuid into e5 from mc_ctx where k='e5';select v::uuid into e6 from mc_ctx where k='e6';select v::uuid into c1 from mc_ctx where k='c1';

 -- ---------------------------------------------------------------- 1 create: priority, categories, who may
 nl0:=pg_temp.nmsg(ld);nt0:=pg_temp.nmsg(tn);
 res:=pg_temp.w(tn,tA,'create',jsonb_build_object('title','Leaking kitchen sink','description','Water drips under the sink all day','category','internet'));
 r1:=(pg_temp.body(res)->>'requestId')::uuid;
 perform pg_temp.chk('1a the tenant creates a request; no priority means "normal"; internet is a valid category',pg_temp.state(res)='OK' and (select priority::text='normal' and category='internet' and status::text='submitted' and requested_by=tn from public.maintenance_requests where id=r1),left(res,120));
 perform pg_temp.chk('1b create writes exactly one history row "Request submitted" and one notification, to the landlord only',pg_temp.nupd(r1)=1 and pg_temp.lastnote(r1)='Request submitted' and pg_temp.nmsg(ld)=nl0+1 and pg_temp.nmsg(tn)=nt0,'');
 res:=pg_temp.w(tn,tA,'create',jsonb_build_object('title','Mice in the ceiling','description','I hear mice at night near the ceiling','category','pests','priority','urgent'));
 r2:=(pg_temp.body(res)->>'requestId')::uuid;
 perform pg_temp.chk('1c priority urgent is stored, and pests is a valid category',pg_temp.state(res)='OK' and (select priority::text='urgent' and category='pests' from public.maintenance_requests where id=r2),left(res,120));
 res:=pg_temp.w(tn,tA,'create',jsonb_build_object('title','Wall crack worsens','description','The crack beside the window grows','category','structural','priority','low'));
 r3:=(pg_temp.body(res)->>'requestId')::uuid;
 perform pg_temp.chk('1d priority low is stored, and structural stays valid',pg_temp.state(res)='OK' and (select priority::text='low' and category='structural' from public.maintenance_requests where id=r3),left(res,120));
 for pc in 1..7 loop
  res:=pg_temp.w(tn,tA,'create',case pc
   when 1 then jsonb_build_object('title','Bad category here','description','This description is long enough','category','bogus')
   when 2 then jsonb_build_object('title','Bad priority here','description','This description is long enough','category','other','priority','high')
   when 3 then jsonb_build_object('title','Bad priority text','description','This description is long enough','category','other','priority','asap')
   when 4 then jsonb_build_object('title','Extra key here','description','This description is long enough','category','other','photos','x')
   when 5 then jsonb_build_object('title','ab','description','This description is long enough','category','other')
   when 6 then jsonb_build_object('title','Short description','description','too short','category','other')
   else jsonb_build_object('title','Priority is a number','description','This description is long enough','category','other','priority',5) end);
  perform pg_temp.chk('1e.'||pc||' an invalid create is refused (22023): '||(array['unknown category','priority high (unused)','unknown priority','extra key (no photos)','short title','short description','priority not text'])[pc],pg_temp.state(res)='22023',left(res,100));
 end loop;
 res:=pg_temp.w(ld,tA,'create',jsonb_build_object('title','Landlord request','description','A long enough description here','category','other'));
 perform pg_temp.chk('1f the landlord cannot create (42501 "Tenant required")',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(st,tA,'create',jsonb_build_object('title','Stranger request','description','A long enough description here','category','other'));
 perform pg_temp.chk('1g a stranger is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(null,tA,'create',jsonb_build_object('title','Anon request','description','A long enough description here','category','other'),gen_random_uuid(),'anon');
 perform pg_temp.chk('1h anon is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(tn,tB,'create',jsonb_build_object('title','Ended tenancy request','description','A long enough description here','category','other'));
 perform pg_temp.chk('1i a new request on an ended tenancy is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(tn,tP,'create',jsonb_build_object('title','Pending tenancy request','description','A long enough description here','category','other'));
 perform pg_temp.chk('1j a new request on a tenancy that is not active or ended is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(nt1,tA,'create',jsonb_build_object('title','Not Tier 1 request','description','A long enough description here','category','other'));
 perform pg_temp.chk('1k a caller without Tier 1 is refused (42501)',pg_temp.state(res)='42501',left(res,100));

 -- ---------------------------------------------------------------- 2 landlord transitions on r1 (and the straight-to-in_progress path on r2)
 rv:=pg_temp.rev(r1);
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','resolved','note','Fixed already'));
 perform pg_temp.chk('2a submitted -> resolved is refused (22023)',pg_temp.state(res)='22023' and pg_temp.st(r1)='submitted',left(res,100));
 res:=pg_temp.w(tn,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','acknowledged','note','Tenant tries'));
 perform pg_temp.chk('2b the tenant cannot use respond (42501 "Landlord required")',pg_temp.state(res)='42501' and pg_temp.st(r1)='submitted',left(res,100));
 res:=pg_temp.w(st,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','acknowledged','note','Stranger tries'));
 perform pg_temp.chk('2c a stranger cannot respond (42501)',pg_temp.state(res)='42501',left(res,100));
 nt0:=pg_temp.nmsg(tn);u0:=pg_temp.nupd(r1);
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','acknowledged','note','Seen, a plumber will look'));
 perform pg_temp.chk('2d submitted -> acknowledged; one history row (submitted -> acknowledged) with the landlord note; one notification, to the tenant',pg_temp.state(res)='OK' and pg_temp.st(r1)='acknowledged' and pg_temp.nupd(r1)=u0+1 and pg_temp.lastnote(r1)='Seen, a plumber will look'
  and exists(select 1 from public.maintenance_updates where maintenance_request_id=r1 and from_status='submitted' and to_status='acknowledged' and actor_id=ld) and pg_temp.nmsg(tn)=nt0+1,left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','in_progress','note','Stale view'));
 perform pg_temp.chk('2e a stale revision is refused (40001)',pg_temp.state(res)='40001' and pg_temp.st(r1)='acknowledged',left(res,100));
 rv:=pg_temp.rev(r1);nt0:=pg_temp.nmsg(tn);u0:=pg_temp.nupd(r1);
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','acknowledged','note','Plumber comes Tuesday'));
 perform pg_temp.chk('2f a note on the same status is allowed: one history row, status unchanged, one notification',pg_temp.state(res)='OK' and pg_temp.st(r1)='acknowledged' and pg_temp.nupd(r1)=u0+1 and pg_temp.lastnote(r1)='Plumber comes Tuesday' and pg_temp.nmsg(tn)=nt0+1,left(res,100));
 -- replies by both parties
 rv:=pg_temp.rev(r1);nl0:=pg_temp.nmsg(ld);u0:=pg_temp.nupd(r1);
 res:=pg_temp.w(tn,tA,'reply',jsonb_build_object('requestId',r1,'revision',rv,'note','It is getting worse'));
 perform pg_temp.chk('2g tenant reply: same status, one history row with the tenant note, one notification to the landlord, revision rotated',pg_temp.state(res)='OK' and pg_temp.st(r1)='acknowledged' and pg_temp.nupd(r1)=u0+1 and pg_temp.lastnote(r1)='It is getting worse' and pg_temp.nmsg(ld)=nl0+1 and pg_temp.rev(r1)<>rv and pg_temp.rev(r1)=(pg_temp.body(res)->>'revision'),left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','in_progress','note','Stale after reply'));
 perform pg_temp.chk('2h a reply invalidates the other party''s stale view (40001)',pg_temp.state(res)='40001',left(res,100));
 rv:=pg_temp.rev(r1);nt0:=pg_temp.nmsg(tn);u0:=pg_temp.nupd(r1);
 res:=pg_temp.w(ld,tA,'reply',jsonb_build_object('requestId',r1,'revision',rv,'note','Thanks, noted'));
 perform pg_temp.chk('2i landlord reply: one history row with the landlord note and one notification to the tenant',pg_temp.state(res)='OK' and pg_temp.nupd(r1)=u0+1 and pg_temp.lastnote(r1)='Thanks, noted' and pg_temp.nmsg(tn)=nt0+1,left(res,100));
 res:=pg_temp.w(st,tA,'reply',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','Stranger reply'));
 perform pg_temp.chk('2j a stranger cannot reply (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(tn,tA,'reply',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)));
 perform pg_temp.chk('2k a reply without a note is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(tn,tA,'reply',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note',repeat('x',2001)));
 perform pg_temp.chk('2l a reply over 2000 characters is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(tn,tA,'reply',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','ok','extra','x'));
 perform pg_temp.chk('2m an extra key in a reply is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(tn2,tC,'reply',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','Wrong tenancy'));
 perform pg_temp.chk('2n a request id from another tenancy is unavailable (42501)',pg_temp.state(res)='42501',left(res,100));
 -- start work, resolve
 rv:=pg_temp.rev(r1);
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',rv,'status','in_progress','note','Work started'));
 perform pg_temp.chk('2p acknowledged -> in_progress',pg_temp.state(res)='OK' and pg_temp.st(r1)='in_progress',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'status','acknowledged','note','Back'));
 perform pg_temp.chk('2q in_progress -> acknowledged is refused (22023)',pg_temp.state(res)='22023' and pg_temp.st(r1)='in_progress',left(res,100));
 res:=pg_temp.w(tn,tA,'cancel',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)));
 perform pg_temp.chk('2r the tenant cannot cancel once work is in progress (22023)',pg_temp.state(res)='22023' and pg_temp.st(r1)='in_progress',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'status','resolved','note','Pipe replaced'));
 perform pg_temp.chk('2s in_progress -> resolved sets resolved_at; the tenant has not confirmed yet',pg_temp.state(res)='OK' and pg_temp.st(r1)='resolved' and (select resolved_at is not null and tenant_confirmed_resolved_at is null from public.maintenance_requests where id=r1),left(res,100));
 -- straight to in_progress (r2)
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r2,'revision',pg_temp.rev(r2),'status','in_progress','note','Starting now'));
 perform pg_temp.chk('2t submitted -> in_progress directly (counts as seen)',pg_temp.state(res)='OK' and pg_temp.st(r2)='in_progress',left(res,100));

 -- ---------------------------------------------------------------- 3 tenant actions on the resolved request r1
 res:=pg_temp.w(ld,tA,'confirm_resolved',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)));
 perform pg_temp.chk('3a the landlord cannot confirm (42501 "Tenant required")',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(ld,tA,'reopen',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','Landlord reopens'));
 perform pg_temp.chk('3b the landlord cannot reopen (42501)',pg_temp.state(res)='42501' and pg_temp.st(r1)='resolved',left(res,100));
 res:=pg_temp.w(ld,tA,'cancel',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)));
 perform pg_temp.chk('3c the landlord cannot cancel (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(tn,tA,'reopen',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)));
 perform pg_temp.chk('3d reopen without a note is refused (22023)',pg_temp.state(res)='22023' and pg_temp.st(r1)='resolved',left(res,100));
 res:=pg_temp.w(tn,tA,'reopen',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','   '));
 perform pg_temp.chk('3e reopen with a blank note is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 rv:=pg_temp.rev(r1);nl0:=pg_temp.nmsg(ld);nt0:=pg_temp.nmsg(tn);u0:=pg_temp.nupd(r1);
 res:=pg_temp.w(tn,tA,'reopen',jsonb_build_object('requestId',r1,'revision',rv,'note','Still dripping after the repair'));
 perform pg_temp.chk('3f reopen (resolved -> reopened): the status changes, resolved_at is cleared, the landlord response is kept',pg_temp.state(res)='OK' and pg_temp.st(r1)='reopened' and (select resolved_at is null and tenant_confirmed_resolved_at is null and landlord_response='Pipe replaced' from public.maintenance_requests where id=r1),left(res,100));
 perform pg_temp.chk('3g the trigger fix: the history row logs the TENANT''s note, not the landlord''s stale response',pg_temp.nupd(r1)=u0+1 and pg_temp.lastnote(r1)='Still dripping after the repair'
  and exists(select 1 from public.maintenance_updates where maintenance_request_id=r1 and from_status='resolved' and to_status='reopened' and actor_id=tn and note='Still dripping after the repair')
  and not exists(select 1 from public.maintenance_updates where maintenance_request_id=r1 and to_status='reopened' and note='Pipe replaced'),'');
 perform pg_temp.chk('3h the reopen produces one notification, to the landlord only',pg_temp.nmsg(ld)=nl0+1 and pg_temp.nmsg(tn)=nt0,'');
 res:=pg_temp.w(tn,tA,'reopen',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','Again'));
 perform pg_temp.chk('3i reopen from reopened is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(tn,tA,'confirm_resolved',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)));
 perform pg_temp.chk('3j confirm from reopened is refused (22023)',pg_temp.state(res)='22023' and (select tenant_confirmed_resolved_at is null from public.maintenance_requests where id=r1),left(res,100));
 -- landlord handles the reopened request: acknowledge, resolve
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'status','acknowledged','note','Seen again'));
 perform pg_temp.chk('3k reopened -> acknowledged',pg_temp.state(res)='OK' and pg_temp.st(r1)='acknowledged',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'status','in_progress','note','Second visit'));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'status','resolved','note','Seal replaced'));
 perform pg_temp.chk('3l acknowledged -> in_progress -> resolved again',pg_temp.state(res)='OK' and pg_temp.st(r1)='resolved',left(res,100));
 nl0:=pg_temp.nmsg(ld);u0:=pg_temp.nupd(r1);
 res:=pg_temp.w(tn,tA,'confirm_resolved',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)));
 perform pg_temp.chk('3m confirm_resolved writes tenant_confirmed_resolved_at, keeps status resolved, writes one history row "Confirmed fixed" and notifies the landlord once',pg_temp.state(res)='OK' and pg_temp.st(r1)='resolved'
  and (select tenant_confirmed_resolved_at is not null and tenant_confirmed_resolved_at<=statement_timestamp() from public.maintenance_requests where id=r1) and pg_temp.nupd(r1)=u0+1 and pg_temp.lastnote(r1)='Confirmed fixed' and pg_temp.nmsg(ld)=nl0+1,left(res,100));
 for pc in 1..5 loop
  res:=case pc
   when 1 then pg_temp.w(tn,tA,'reply',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','After confirm'))
   when 2 then pg_temp.w(ld,tA,'reply',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','After confirm'))
   when 3 then pg_temp.w(tn,tA,'reopen',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'note','After confirm'))
   when 4 then pg_temp.w(tn,tA,'confirm_resolved',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1)))
   else pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r1,'revision',pg_temp.rev(r1),'status','resolved','note','After confirm')) end;
  perform pg_temp.chk('3n.'||pc||' a confirmed resolved request is final: '||(array['tenant reply','landlord reply','reopen','confirm again','landlord respond'])[pc]||' is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 end loop;

 -- ---------------------------------------------------------------- 4 cancel, and the unused statuses
 nl0:=pg_temp.nmsg(ld);u0:=pg_temp.nupd(r3);
 res:=pg_temp.w(tn,tA,'cancel',jsonb_build_object('requestId',r3,'revision',pg_temp.rev(r3)));
 perform pg_temp.chk('4a the tenant cancels a submitted request; the history row logs the default note and the landlord is notified once',pg_temp.state(res)='OK' and pg_temp.st(r3)='cancelled' and pg_temp.nupd(r3)=u0+1 and pg_temp.lastnote(r3)='Cancelled by the tenant' and pg_temp.nmsg(ld)=nl0+1,left(res,100));
 res:=pg_temp.w(tn,tA,'reply',jsonb_build_object('requestId',r3,'revision',pg_temp.rev(r3),'note','After cancel'));
 perform pg_temp.chk('4b a cancelled request is final: reply refused (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r3,'revision',pg_temp.rev(r3),'status','acknowledged','note','After cancel'));
 perform pg_temp.chk('4c ... and so is respond (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(tn,tA,'create',jsonb_build_object('title','Gate does not close','description','The gate latch is broken again','category','other'));
 r4:=(pg_temp.body(res)->>'requestId')::uuid;
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r4,'revision',pg_temp.rev(r4),'status','acknowledged','note','Seen'));
 res:=pg_temp.w(tn,tA,'cancel',jsonb_build_object('requestId',r4,'revision',pg_temp.rev(r4),'note','Fixed it myself'));
 perform pg_temp.chk('4d the tenant cancels an acknowledged request with their own note; the note is the tenant''s, not the landlord''s',pg_temp.state(res)='OK' and pg_temp.st(r4)='cancelled' and pg_temp.lastnote(r4)='Fixed it myself',left(res,100));
 res:=pg_temp.w(tn,tA,'create',jsonb_build_object('title','Switch sparks badly','description','The wall switch sparks when used','category','electrical','priority','urgent'));
 r5:=(pg_temp.body(res)->>'requestId')::uuid;
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r5,'revision',pg_temp.rev(r5),'status','acknowledged','note','Seen'));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r5,'revision',pg_temp.rev(r5),'status','resolved','note','Replaced'));
 res:=pg_temp.w(tn,tA,'reopen',jsonb_build_object('requestId',r5,'revision',pg_temp.rev(r5),'note','Still sparks'));
 res:=pg_temp.w(tn,tA,'cancel',jsonb_build_object('requestId',r5,'revision',pg_temp.rev(r5),'note','Not needed any more'));
 perform pg_temp.chk('4e the tenant may cancel a reopened request (it is before in_progress)',pg_temp.state(res)='OK' and pg_temp.st(r5)='cancelled',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r2,'revision',pg_temp.rev(r2),'status','scheduled','note','Scheduled'));
 perform pg_temp.chk('4f the unused status scheduled cannot be set (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r2,'revision',pg_temp.rev(r2),'status','rejected','note','No'));
 perform pg_temp.chk('4g the unused status rejected cannot be set (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',r2,'revision',pg_temp.rev(r2),'status','needs_information','note','More info'));
 perform pg_temp.chk('4h the unused status needs_information cannot be set (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.w(ld,tA,'bogus_action',jsonb_build_object('requestId',r2));
 perform pg_temp.chk('4i an unknown action is refused (22023)',pg_temp.state(res)='22023',left(res,100));

 -- ---------------------------------------------------------------- 5 replay and conflicting retry
 op:=gen_random_uuid();rv:=pg_temp.rev(r2);u0:=pg_temp.nupd(r2);nt0:=pg_temp.nmsg(tn);
 res:=pg_temp.w(ld,tA,'reply',jsonb_build_object('requestId',r2,'revision',rv,'note','Parts ordered'),op);
 j:=pg_temp.body(res);
 perform pg_temp.chk('5a a reply is written once',pg_temp.state(res)='OK' and pg_temp.nupd(r2)=u0+1 and pg_temp.nmsg(tn)=nt0+1,left(res,100));
 res:=pg_temp.w(ld,tA,'reply',jsonb_build_object('requestId',r2,'revision',rv,'note','Parts ordered'),op);
 perform pg_temp.chk('5b replaying the same operation id returns the first result and writes nothing (no row, no notification, no revision change)',pg_temp.state(res)='OK' and pg_temp.body(res)=j and pg_temp.nupd(r2)=u0+1 and pg_temp.nmsg(tn)=nt0+1 and pg_temp.rev(r2)=(j->>'revision'),left(res,100));
 res:=pg_temp.w(ld,tA,'reply',jsonb_build_object('requestId',r2,'revision',rv,'note','A different note'),op);
 perform pg_temp.chk('5c the same operation id with different input is a conflicting retry (22023)',pg_temp.state(res)='22023' and pg_temp.nupd(r2)=u0+1,left(res,100));
 op:=gen_random_uuid();
 res:=pg_temp.w(tn,tA,'create',jsonb_build_object('title','Replay safe create','description','Creating the same request twice','category','other'),op);
 r6:=(pg_temp.body(res)->>'requestId')::uuid;
 res:=pg_temp.w(tn,tA,'create',jsonb_build_object('title','Replay safe create','description','Creating the same request twice','category','other'),op);
 perform pg_temp.chk('5d replaying a create returns the same request and creates no second one',pg_temp.state(res)='OK' and (pg_temp.body(res)->>'requestId')::uuid=r6 and (select count(*) from public.maintenance_requests where title='Replay safe create')=1,left(res,100));

 -- ---------------------------------------------------------------- 6 ended tenancy: reading allowed, most writes refused, closing allowed
 res:=pg_temp.w(tn,tB,'reply',jsonb_build_object('requestId',e1,'revision',pg_temp.rev(e1),'note','Reply after the end'));
 perform pg_temp.chk('6a a reply on an ended tenancy is refused (42501)',pg_temp.state(res)='42501' and pg_temp.nupd(e1)=0,left(res,100));
 res:=pg_temp.w(ld,tB,'reply',jsonb_build_object('requestId',e1,'revision',pg_temp.rev(e1),'note','Landlord reply after the end'));
 perform pg_temp.chk('6b ... for the landlord too (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(tn,tB,'reopen',jsonb_build_object('requestId',e5,'revision',pg_temp.rev(e5),'note','Reopen after the end'));
 perform pg_temp.chk('6c a reopen on an ended tenancy is refused (42501)',pg_temp.state(res)='42501' and pg_temp.st(e5)='resolved',left(res,100));
 res:=pg_temp.w(ld,tB,'respond',jsonb_build_object('requestId',e6,'revision',pg_temp.rev(e6),'status','in_progress','note','Start after the end'));
 perform pg_temp.chk('6d starting work on an ended tenancy is refused (22023 "Transition unavailable": only resolving is allowed there)',pg_temp.state(res)='22023' and pg_temp.st(e6)='acknowledged',left(res,100));
 res:=pg_temp.w(tn,tB,'check_reminder','{}'::jsonb);
 perform pg_temp.chk('6e a reminder check on an ended tenancy is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(ld,tB,'respond',jsonb_build_object('requestId',e1,'revision',pg_temp.rev(e1),'status','resolved','note','Done before they left'));
 perform pg_temp.chk('6f the landlord may still mark an open request resolved on an ended tenancy (so it can close)',pg_temp.state(res)='OK' and pg_temp.st(e1)='resolved',left(res,100));
 res:=pg_temp.w(tn,tB,'confirm_resolved',jsonb_build_object('requestId',e1,'revision',pg_temp.rev(e1)));
 perform pg_temp.chk('6g the tenant may confirm it on the ended tenancy',pg_temp.state(res)='OK' and (select tenant_confirmed_resolved_at is not null from public.maintenance_requests where id=e1),left(res,100));
 res:=pg_temp.w(tn,tB,'confirm_resolved',jsonb_build_object('requestId',e2,'revision',pg_temp.rev(e2)));
 perform pg_temp.chk('6h ... and any other unconfirmed resolved request',pg_temp.state(res)='OK',left(res,100));
 res:=pg_temp.w(tn,tB,'cancel',jsonb_build_object('requestId',e3,'revision',pg_temp.rev(e3)));
 perform pg_temp.chk('6i the tenant may cancel a submitted request on the ended tenancy',pg_temp.state(res)='OK' and pg_temp.st(e3)='cancelled',left(res,100));
 res:=pg_temp.w(tn,tB,'cancel',jsonb_build_object('requestId',e4,'revision',pg_temp.rev(e4)));
 perform pg_temp.chk('6j a cancelled request stays final on an ended tenancy (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.act(tn,'authenticated',format('select public.get_tenancy_care(%L,0)::text',tB));
 perform pg_temp.chk('6k reading the ended tenancy''s care stays allowed',pg_temp.state(res)='OK' and jsonb_array_length(pg_temp.body(res)->'requests')=6,left(res,100));
 res:=pg_temp.act(ld,'authenticated',format('select public.get_maintenance_request(%L,0)::text',e5));
 perform pg_temp.chk('6l reading one request on the ended tenancy stays allowed (landlord)',pg_temp.state(res)='OK' and (pg_temp.body(res)->'request'->>'tenancyEnded')::boolean and pg_temp.body(res)->'request'->>'role'='landlord',left(res,100));
 res:=pg_temp.act(tn,'authenticated',format('select public.get_tenancy_maintenance_history(%L,0)::text',e1));
 perform pg_temp.chk('6m reading the history of a request on the ended tenancy stays allowed',pg_temp.state(res)='OK',left(res,100));

 -- ---------------------------------------------------------------- 6b an ACTIVE tenancy whose expected end date is in the past (status still active)
 perform pg_temp.chk('6n fixture: the tenancy is active in status with an end date in the past',(select status::text='active' and expected_end_date<current_date and actual_end_date is null from public.tenancies where id=tX),'');
 res:=pg_temp.w(tn,tX,'create',jsonb_build_object('title','Past end date request','description','A long enough description here','category','other'));
 perform pg_temp.chk('6o a new request on a tenancy past its end date is refused (42501 "Active tenancy required")',pg_temp.state(res)='42501' and res like '%Active tenancy required%',left(res,100));
 res:=pg_temp.w(tn,tX,'reply',jsonb_build_object('requestId',x1,'revision',pg_temp.rev(x1),'note','Reply after the end date'));
 perform pg_temp.chk('6p a tenant reply is refused (42501 "Active tenancy required") and writes no history row',pg_temp.state(res)='42501' and res like '%Active tenancy required%' and pg_temp.nupd(x1)=0,left(res,100));
 res:=pg_temp.w(ld,tX,'reply',jsonb_build_object('requestId',x1,'revision',pg_temp.rev(x1),'note','Landlord reply after the end date'));
 perform pg_temp.chk('6q a landlord reply is refused too (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(tn,tX,'reopen',jsonb_build_object('requestId',x2,'revision',pg_temp.rev(x2),'note','Reopen after the end date'));
 perform pg_temp.chk('6r a reopen is refused (42501) and the request stays resolved',pg_temp.state(res)='42501' and pg_temp.st(x2)='resolved',left(res,100));
 res:=pg_temp.w(ld,tX,'respond',jsonb_build_object('requestId',x4,'revision',pg_temp.rev(x4),'status','in_progress','note','Start after the end date'));
 perform pg_temp.chk('6s starting work (respond to in_progress) is refused (22023) and the status does not change',pg_temp.state(res)='22023' and pg_temp.st(x4)='acknowledged',left(res,100));
 res:=pg_temp.w(ld,tX,'respond',jsonb_build_object('requestId',x1,'revision',pg_temp.rev(x1),'status','resolved','note','Finished before the end date passed'));
 perform pg_temp.chk('6t the landlord may still respond to resolved on an open request',pg_temp.state(res)='OK' and pg_temp.st(x1)='resolved' and pg_temp.nupd(x1)=1,left(res,100));
 res:=pg_temp.w(tn,tX,'confirm_resolved',jsonb_build_object('requestId',x1,'revision',pg_temp.rev(x1)));
 perform pg_temp.chk('6u the tenant may still confirm_resolved (tenant_confirmed_resolved_at is written)',pg_temp.state(res)='OK' and (select tenant_confirmed_resolved_at is not null from public.maintenance_requests where id=x1),left(res,100));
 res:=pg_temp.w(tn,tX,'confirm_resolved',jsonb_build_object('requestId',x2,'revision',pg_temp.rev(x2)));
 perform pg_temp.chk('6v ... and for a request the landlord resolved earlier',pg_temp.state(res)='OK',left(res,100));
 res:=pg_temp.w(tn,tX,'cancel',jsonb_build_object('requestId',x3,'revision',pg_temp.rev(x3),'note','No longer needed'));
 perform pg_temp.chk('6w the tenant may still cancel a submitted request, with their own note logged',pg_temp.state(res)='OK' and pg_temp.st(x3)='cancelled' and pg_temp.lastnote(x3)='No longer needed',left(res,100));
 res:=pg_temp.act(tn,'authenticated',format('select public.get_tenancy_care(%L,0)::text',tX));
 perform pg_temp.chk('6x reading the care of a tenancy past its end date stays allowed',pg_temp.state(res)='OK' and jsonb_array_length(pg_temp.body(res)->'requests')=4,left(res,100));
 res:=pg_temp.act(ld,'authenticated',format('select public.get_maintenance_request(%L,0)::text',x4));
 perform pg_temp.chk('6y reading one request there stays allowed, and the landlord''s inbox still lists it',pg_temp.state(res)='OK'
  and exists(select 1 from jsonb_array_elements(pg_temp.body(pg_temp.act(ld,'authenticated','select public.get_maintenance_inbox(0)::text'))->'rows') x where x->>'id'=x4::text),left(res,100));

 -- ---------------------------------------------------------------- 7 isolation: the other landlord's tenancy
 res:=pg_temp.w(ld,tC,'respond',jsonb_build_object('requestId',c1,'revision',pg_temp.rev(c1),'status','acknowledged','note','Not mine'));
 perform pg_temp.chk('7a a landlord cannot act on another landlord''s tenancy (42501)',pg_temp.state(res)='42501' and pg_temp.st(c1)='submitted',left(res,100));
 res:=pg_temp.w(tn,tC,'reply',jsonb_build_object('requestId',c1,'revision',pg_temp.rev(c1),'note','Not my tenancy'));
 perform pg_temp.chk('7b a tenant cannot act on another tenancy (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.w(ld,tA,'respond',jsonb_build_object('requestId',c1,'revision',pg_temp.rev(c1),'status','acknowledged','note','Wrong tenancy id'));
 perform pg_temp.chk('7c a request id from another landlord''s tenancy is unavailable even through my own tenancy id (42501)',pg_temp.state(res)='42501' and pg_temp.st(c1)='submitted',left(res,100));
 res:=pg_temp.act(ld,'authenticated',format('select public.get_maintenance_request(%L,0)::text',c1));
 perform pg_temp.chk('7d reading another landlord''s request is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.act(st,'authenticated',format('select public.get_maintenance_request(%L,0)::text',r1));
 perform pg_temp.chk('7e a stranger cannot read a request (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.act(st,'authenticated',format('select public.get_maintenance_request(%L,0)::text',gen_random_uuid()));
 perform pg_temp.chk('7f an unknown request id is refused the same way (42501)',pg_temp.state(res)='42501',left(res,100));
end$t$;

do $t2$
declare
 ld uuid;tn uuid;st uuid;ld2 uuid;tn2 uuid;nt1 uuid;ld3 uuid;tn3 uuid;ld4 uuid;tn4 uuid;tA uuid;u1 uuid;i4 uuid;
 res text;j jsonb;ids text;n int;
begin
 select v::uuid into ld from mc_ctx where k='ld';select v::uuid into tn from mc_ctx where k='tn';select v::uuid into st from mc_ctx where k='st';select v::uuid into ld2 from mc_ctx where k='ld2';select v::uuid into tn2 from mc_ctx where k='tn2';select v::uuid into nt1 from mc_ctx where k='nt1';
 select v::uuid into ld3 from mc_ctx where k='ld3';select v::uuid into tn3 from mc_ctx where k='tn3';select v::uuid into ld4 from mc_ctx where k='ld4';select v::uuid into tn4 from mc_ctx where k='tn4';
 select v::uuid into u1 from mc_ctx where k='u1';select v::uuid into tA from mc_ctx where k='tA';

 -- ---------------------------------------------------------------- 8 inbox (clean landlord ld3): active tenancy rows plus the open requests of the ended tenancy
 res:=pg_temp.act(ld3,'authenticated','select public.get_maintenance_inbox(0)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8a the inbox answers for the landlord; the rule is active tenancy (all requests) plus ended tenancy (open requests only): 8 rows',pg_temp.state(res)='OK' and jsonb_array_length(j->'rows')=8 and not (j->>'hasMore')::boolean,left(res,160));
 perform pg_temp.chk('8b counts over the visible set: open 6, in progress 2, awaiting confirmation 2, resolved 1, urgent open 2',(j->'counts')='{"open":6,"inProgress":2,"awaitingConfirmation":2,"resolved":1,"urgentOpen":2}'::jsonb,(j->'counts')::text);
 select string_agg(x->>'title'||':'||(x->>'status')||':'||(x->>'priority'),',' order by ord) into ids from jsonb_array_elements(j->'rows') with ordinality as t(x,ord);
 perform pg_temp.chk('8c urgent OPEN rows sort first (newest first), then the rest newest first: u1, u6, u5, u4, u3, u2, then the ended tenancy''s open requests',
  (select array_agg((x->>'priority')||'/'||(x->>'status') order by ord) from jsonb_array_elements(j->'rows') with ordinality as t(x,ord))=array['urgent/submitted','urgent/in_progress','normal/cancelled','low/resolved','urgent/resolved','normal/in_progress','normal/submitted','normal/resolved'],ids);
 perform pg_temp.chk('8d a confirmed urgent resolved request does not outrank open ones',(j->'rows'->4->>'priority')='urgent' and (j->'rows'->4->>'status')='resolved' and (j->'rows'->4->'tenantConfirmedAt')<>'null'::jsonb,'');
 perform pg_temp.chk('8e closed requests of the ENDED tenancy are not listed (confirmed resolved, cancelled), its open ones are, marked tenancyEnded',
  (select count(*) from jsonb_array_elements(j->'rows') x where (x->>'tenancyEnded')::boolean)=2 and not exists(select 1 from jsonb_array_elements(j->'rows') x where (x->>'tenancyEnded')::boolean and x->>'status'='cancelled'),'');
 perform pg_temp.chk('8f a row has exactly the whitelist keys (no tenant id, no description, no photo count)',(select string_agg(k,',' order by k) from jsonb_object_keys(j->'rows'->0) k)='category,createdAt,id,lastNote,priority,propertyId,revision,status,tenancyEnded,tenancyId,tenantConfirmedAt,title,updatedAt','');
 perform pg_temp.chk('8g lastNote is the newest note by either party, ignoring "Request submitted": the landlord''s "On my way" on the urgent leak',(j->'rows'->0->'lastNote')->>'role'='landlord' and (j->'rows'->0->'lastNote')->>'note'='On my way','');
 perform pg_temp.chk('8h a request with no note has lastNote null',(j->'rows'->1->'lastNote')='null'::jsonb,'');
 res:=pg_temp.act(ld,'authenticated','select public.get_maintenance_inbox(0)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8i another landlord sees only their own tenancies: none of ld3''s rows, and not ld2''s',pg_temp.state(res)='OK' and not exists(select 1 from jsonb_array_elements(j->'rows') x where x->>'id' in(select v from mc_ctx where k in('u1','u2','u3','u4','u5','u6','c1'))),left(res,100));
 res:=pg_temp.act(ld2,'authenticated','select public.get_maintenance_inbox(0)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8j the second landlord sees exactly their one request',pg_temp.state(res)='OK' and jsonb_array_length(j->'rows')=1 and (j->'counts'->>'urgentOpen')::int=1,left(res,100));
 res:=pg_temp.act(tn3,'authenticated','select public.get_maintenance_inbox(0)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8k a tenant gets no rows and zero counts (the inbox is the landlord''s)',pg_temp.state(res)='OK' and jsonb_array_length(j->'rows')=0 and (j->'counts'->>'open')::int=0,left(res,100));
 res:=pg_temp.act(st,'authenticated','select public.get_maintenance_inbox(0)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8l a stranger gets no rows',pg_temp.state(res)='OK' and jsonb_array_length(j->'rows')=0,left(res,100));
 res:=pg_temp.act(nt1,'authenticated','select public.get_maintenance_inbox(0)::text');
 perform pg_temp.chk('8m a caller without Tier 1 is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.act(null,'anon','select public.get_maintenance_inbox(0)::text');
 perform pg_temp.chk('8n anon is refused (42501)',pg_temp.state(res)='42501',left(res,100));
 res:=pg_temp.act(ld3,'authenticated','select public.get_maintenance_inbox(-1)::text');
 perform pg_temp.chk('8o a negative page is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.act(ld4,'authenticated','select public.get_maintenance_inbox(0)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8p paging: 20 rows and more to come on the first page of 22',jsonb_array_length(j->'rows')=20 and (j->>'hasMore')::boolean and (j->'counts'->>'open')::int=22,left(res,100));
 res:=pg_temp.act(ld4,'authenticated','select public.get_maintenance_inbox(20)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8q ... and the last 2 on the second page, with no more',jsonb_array_length(j->'rows')=2 and not (j->>'hasMore')::boolean,left(res,100));
 -- the real flow: the landlord's own inbox now shows the requests created above
 res:=pg_temp.act(ld,'authenticated','select public.get_maintenance_inbox(0)::text');j:=pg_temp.body(res);
 perform pg_temp.chk('8r the flow''s requests appear in the landlord''s inbox, the urgent open one (the in-progress mice request) first',pg_temp.state(res)='OK' and (j->'rows'->0->>'priority')='urgent' and (j->'rows'->0->>'status')='in_progress',left(res,160));

 -- ---------------------------------------------------------------- 9 request read: thread oldest first, roles
 res:=pg_temp.act(tn3,'authenticated',format('select public.get_maintenance_request(%L,0)::text',u1));j:=pg_temp.body(res);
 perform pg_temp.chk('9a the thread is oldest first with a role per entry: tenant, tenant, landlord',pg_temp.state(res)='OK' and (select array_agg(x->>'role' order by ord) from jsonb_array_elements(j->'thread') with ordinality t(x,ord))=array['tenant','tenant','landlord'] and j->'thread'->2->>'note'='On my way',left(res,160));
 perform pg_temp.chk('9b the request carries the viewer''s role, the revision and no actor ids',j->'request'->>'role'='tenant' and (j->'request'->>'revision') is not null and (j::text !~ ('"actorId"|'||ld3::text)) and (select string_agg(k,',' order by k) from jsonb_object_keys(j->'thread'->0) k)='at,fromStatus,id,note,role,status','');
 res:=pg_temp.act(ld3,'authenticated',format('select public.get_maintenance_request(%L,0)::text',u1));j:=pg_temp.body(res);
 perform pg_temp.chk('9c the landlord reads the same request with role landlord',pg_temp.state(res)='OK' and j->'request'->>'role'='landlord' and (select string_agg(k,',' order by k) from jsonb_object_keys(j->'request') k)='category,createdAt,description,id,landlordResponse,priority,propertyId,resolvedAt,revision,role,scheduledFor,status,tenancyEnded,tenancyId,tenantConfirmedAt,title,updatedAt','');
 res:=pg_temp.act(tn3,'authenticated',format('select public.get_maintenance_request(%L,-1)::text',u1));
 perform pg_temp.chk('9d a negative page is refused (22023)',pg_temp.state(res)='22023',left(res,100));
 res:=pg_temp.act(null,'anon',format('select public.get_maintenance_request(%L,0)::text',u1));
 perform pg_temp.chk('9e anon is refused (42501)',pg_temp.state(res)='42501',left(res,100));

 -- ---------------------------------------------------------------- 10 existing reads, the trigger without the setting, grants
 res:=pg_temp.act(tn,'authenticated',format('select public.get_tenancy_care(%L,0)::text',tA));j:=pg_temp.body(res);
 perform pg_temp.chk('10a the existing get_tenancy_care still works and now shows the stored priority and the new categories',pg_temp.state(res)='OK' and exists(select 1 from jsonb_array_elements(j->'requests') x where x->>'priority'='urgent') and exists(select 1 from jsonb_array_elements(j->'requests') x where x->>'category'='pests'),left(res,100));
 perform pg_temp.chk('10b get_tenancy_care and get_tenancy_maintenance_history are untouched (pins)',md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_care(uuid,integer)')))='624c3bf0ce0f129f504c674330466c72' and md5((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_maintenance_history(uuid,integer)')))='78ac0cab8cd962a3a687d0501be8eeb0','');
 res:=pg_temp.act(tn3,'authenticated',format('select public.get_tenancy_maintenance_history(%L,0)::text',u1));
 perform pg_temp.chk('10c get_tenancy_maintenance_history still works',pg_temp.state(res)='OK' and jsonb_array_length(pg_temp.body(res))=3,left(res,100));
 -- a status change made outside the RPC (no setting) still logs the old note rule
 update public.maintenance_requests set status='acknowledged',last_updated_by=ld3,landlord_response='Direct change note' where id=(select v::uuid from mc_ctx where k='u2');
 perform pg_temp.chk('10d a status change without the care setting logs the landlord response as before (unchanged behavior)',(select note from public.maintenance_updates where maintenance_request_id=(select v::uuid from mc_ctx where k='u2') and to_status='acknowledged')='Direct change note','');
 perform pg_temp.chk('10e the care setting does not leak out of an action (empty after every status change)',coalesce(current_setting('rentlease.care_note',true),'')='','');
 begin
  insert into public.maintenance_requests(tenancy_id,requested_by,title,description,category) values(tA,tn,'Bad category row','Direct insert with a bad category','electric');
  perform pg_temp.chk('10f the category check rejects an unknown category even without the RPC',false,'inserted');
 exception when check_violation then perform pg_temp.chk('10f the category check rejects an unknown category even without the RPC',true,'');
 when others then perform pg_temp.chk('10f the category check rejects an unknown category even without the RPC',false,sqlstate||' '||sqlerrm);
 end;
 perform pg_temp.chk('10g the new reads are authenticated-only; the writes keep their ACL; the backups table is closed',
  has_function_privilege('authenticated',to_regprocedure('public.get_maintenance_inbox(integer)'),'EXECUTE') and not has_function_privilege('anon',to_regprocedure('public.get_maintenance_inbox(integer)'),'EXECUTE') and not has_function_privilege('service_role',to_regprocedure('public.get_maintenance_inbox(integer)'),'EXECUTE')
  and has_function_privilege('authenticated',to_regprocedure('public.get_maintenance_request(uuid,integer)'),'EXECUTE') and not has_function_privilege('anon',to_regprocedure('public.get_maintenance_request(uuid,integer)'),'EXECUTE')
  and (select proacl::text from pg_proc where oid=to_regprocedure('public.write_tenancy_care(uuid,uuid,text,jsonb)'))='{postgres=X/postgres,authenticated=X/postgres}'
  and (select proacl is null from pg_proc where oid=to_regprocedure('public.log_maintenance_status_change()'))
  and not has_table_privilege('authenticated','rentlease_tenancy_care.function_backups','SELECT') and (select count(*) from rentlease_tenancy_care.function_backups)=2,'');
 perform pg_temp.chk('10h no photo object was created (no table or function with photo in the care schema or public maintenance functions)',not exists(select 1 from pg_class c where c.relnamespace in('rentlease_tenancy_care'::regnamespace) and c.relname ilike '%photo%') and not exists(select 1 from pg_proc p where p.proname ilike '%maintenance%photo%'),'');
 perform pg_temp.chk('10i the notification text is the existing generic one for every action (unchanged trigger)',not exists(select 1 from public.notifications where type::text='maintenance_update' and (title<>'Maintenance update' or body<>'Open RentLease to review this update.')) and md5((select prosrc from pg_proc where oid=to_regprocedure('rentlease_notifications.generate()')))='08b686c7868662747ec9bf3f119c6177','');
end$t2$;

-- Deliberate abort: carries the results out and guarantees the whole batch (fixture, migration objects if run pre-apply) rolls back.
do $out$
declare report text; bad int;
begin
 select count(*) filter (where not ok) into bad from mc_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when detail is not null and detail<>'' then ' :: '||left(detail,64) else '' end,E'
' order by n) into report from mc_res /*WHERE*/;
 raise exception E'MAINTENANCE_CHECKS total=% failed=%
%',(select count(*) from mc_res),bad,report using errcode='P0001';
end$out$;
