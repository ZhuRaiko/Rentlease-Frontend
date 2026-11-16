-- Rent ledger checks. Needs the migration objects to exist in the same transaction (pre-apply: run migration body + this file as one
-- batch with the migration's begin/commit removed) or in the database (post-apply: run this file alone).
-- Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results, so NOTHING can commit.
-- The fixture (three profiles, four tenancies) is built inside the transaction with triggers off, then triggers are switched back on
-- before any ledger RPC runs, so the real triggers (revision rotation, updated_at, immutability) are exercised.
set local session_replication_role = replica;
create temp table rl_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create temp table rl_ctx(k text primary key,v text not null) on commit drop;

create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into rl_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
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
create function pg_temp.w(p_uid uuid,p_role text,p_tenancy uuid,p_op uuid,p_action text,p_due date,p_rev uuid) returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.write_rent_ledger(%L,%L,%L,%L,%L)::text',p_tenancy,p_op,p_action,p_due,p_rev)) $$;
create function pg_temp.r(p_uid uuid,p_role text,p_tenancy uuid) returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.get_rent_ledger(%L,0)::text',p_tenancy)) $$;
create function pg_temp.body(p text) returns jsonb language sql as $$ select substr(p,4)::jsonb $$;
create function pg_temp.state(p text) returns text language sql as $$ select case when p like 'OK|%' then 'OK' else split_part(p,'|',2) end $$;

do $t1$
declare
 tn uuid:=gen_random_uuid(); ld uuid:=gen_random_uuid(); st uuid:=gen_random_uuid();
 ta uuid:=gen_random_uuid(); tb uuid:=gen_random_uuid(); tc uuid:=gen_random_uuid(); td uuid:=gen_random_uuid(); nt uuid:=gen_random_uuid(); te uuid:=gen_random_uuid();
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 s date[]; sd date[]; sb date[]; res text; j jsonb; row_j jsonb;
 r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; op uuid; writes int:=0; n int; msg text;
 before_cnt int; after_cnt int;
begin
 -- ---------------------------------------------------------------- fixture (triggers off)
 insert into public.profiles(id,account_status,tier1_verified_at) values(tn,'active',now()),(ld,'active',now()),(st,'active',now()),(nt,'active',null);
 insert into public.tenancies(id,property_id,listing_id,tenant_id,landlord_id,status,start_date,expected_end_date,actual_end_date,agreed_monthly_rent,rent_due_day,created_by) values
  (ta,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-100,null,null,10000,2,ld),
  (tb,gen_random_uuid(),gen_random_uuid(),tn,ld,'ended',today-100,null,today-20,10000,2,ld),
  (tc,gen_random_uuid(),gen_random_uuid(),tn,ld,'pending_confirmation',today+5,null,null,10000,2,ld),
  (td,gen_random_uuid(),gen_random_uuid(),tn,ld,'active',today-60,today+40,null,12000,15,ld),
  (te,gen_random_uuid(),gen_random_uuid(),nt,ld,'active',today-30,null,null,9000,2,ld);
 insert into rl_ctx values('tn',tn::text),('ld',ld::text),('st',st::text),('ta',ta::text),('tb',tb::text),('tc',tc::text),('td',td::text),('nt',nt::text),('te',te::text);
end$t1$;
-- Triggers back on (top-level SET: the CLI login role may not call set_config for this parameter).
set local session_replication_role = origin;
do $t$
declare
 tn uuid; ld uuid; st uuid; ta uuid; tb uuid; tc uuid; td uuid; nt uuid; te uuid;
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 s date[]; sd date[]; sb date[]; res text; j jsonb; row_j jsonb;
 r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; op uuid; writes int:=0; n int; msg text;
 before_cnt int; after_cnt int;
begin
 select v::uuid into tn from rl_ctx where k='tn'; select v::uuid into ld from rl_ctx where k='ld'; select v::uuid into st from rl_ctx where k='st';
 select v::uuid into ta from rl_ctx where k='ta'; select v::uuid into tb from rl_ctx where k='tb'; select v::uuid into tc from rl_ctx where k='tc'; select v::uuid into td from rl_ctx where k='td'; select v::uuid into nt from rl_ctx where k='nt'; select v::uuid into te from rl_ctx where k='te';

 select array_agg(due_date order by due_date desc) into s from rentlease_rent_ledger.due_dates(today-100,null,2,today);
 select array_agg(due_date order by due_date desc) into sd from rentlease_rent_ledger.due_dates(today-60,today+40,15,today);
 select array_agg(due_date order by due_date desc) into sb from rentlease_rent_ledger.due_dates(today-100,today-20,2,today);
 perform pg_temp.chk('fixture: schedule has a horizon and past months',array_length(s,1)>=4 and s[1]>today and s[2]<=today,'today='||today||' months='||s::text);
 perform pg_temp.chk('fixture: rent_obligations and events start empty',(select count(*) from public.rent_obligations)=0 and (select count(*) from rentlease_rent_ledger.events)=0,'');

 -- ---------------------------------------------------------------- 1 mark_paid
 op:=gen_random_uuid(); res:=pg_temp.w(tn,'authenticated',ta,op,'mark_paid',s[2],null);
 perform pg_temp.chk('1 tenant mark_paid on a past month',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='tenant_marked_paid',res);
 if pg_temp.state(res)='OK' then writes:=writes+1; r1:=(pg_temp.body(res)->>'revision')::uuid; end if;
 perform pg_temp.chk('1b the stored amount_due equals the tenancy rent at first action',
  (select o.amount_due from public.rent_obligations o where o.tenancy_id=ta and o.due_date=s[2])=(select agreed_monthly_rent from public.tenancies where id=ta)
  and (select o.amount_due from public.rent_obligations o where o.tenancy_id=ta and o.due_date=s[2])=10000,
  'stored='||coalesce((select o.amount_due::text from public.rent_obligations o where o.tenancy_id=ta and o.due_date=s[2]),'none')||' tenancy='||(select agreed_monthly_rent from public.tenancies where id=ta));

 -- ---------------------------------------------------------------- 2 ledger read for both parties
 res:=pg_temp.r(ld,'authenticated',ta); j:=pg_temp.body(res);
 select e into row_j from jsonb_array_elements(j->'rows') e where e->>'dueDate'=s[2]::text;
 perform pg_temp.chk('2a landlord sees Confirm state, awaiting set, acknowledge and dispute allowed',
  row_j->>'displayStatus'='tenant_marked_paid' and (j->'awaiting'->>'dueDate')=s[2]::text and (row_j->>'canAcknowledge')::boolean and (row_j->>'canDispute')::boolean and not (row_j->>'canMarkPaid')::boolean,row_j::text);
 res:=pg_temp.r(tn,'authenticated',ta); j:=pg_temp.body(res);
 select e into row_j from jsonb_array_elements(j->'rows') e where e->>'dueDate'=s[2]::text;
 perform pg_temp.chk('2b tenant sees no awaiting banner and no landlord actions',j->'awaiting'='null'::jsonb and not (row_j->>'canAcknowledge')::boolean and not (row_j->>'canDispute')::boolean and not (row_j->>'canMarkPaid')::boolean,row_j::text);
 perform pg_temp.chk('2c rows are newest first, horizon row on top, amounts from the tenancy',
  (j->'rows'->0->>'dueDate')=s[1]::text and (j->'rows'->0->>'amount')::numeric=10000 and jsonb_array_length(j->'rows')=least(12,array_length(s,1)),(j->'rows'->0)::text);

 -- ---------------------------------------------------------------- 3 dispute
 op:=gen_random_uuid(); res:=pg_temp.w(ld,'authenticated',ta,op,'dispute',s[2],r1);
 perform pg_temp.chk('3 landlord dispute (Not received)',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='disputed',res);
 if pg_temp.state(res)='OK' then writes:=writes+1; r2:=(pg_temp.body(res)->>'revision')::uuid; end if;
 perform pg_temp.chk('3b revision rotated and the tenant timestamp is kept',r2 is distinct from r1 and (select tenant_marked_paid_at is not null from public.rent_obligations where tenancy_id=ta and due_date=s[2]),'r1='||r1||' r2='||r2);

 -- ---------------------------------------------------------------- 4 tenant revises after dispute
 op:=gen_random_uuid(); res:=pg_temp.w(tn,'authenticated',ta,op,'mark_paid',s[2],r2);
 perform pg_temp.chk('4 tenant revises after dispute by marking paid again',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='tenant_marked_paid',res);
 if pg_temp.state(res)='OK' then writes:=writes+1; r3:=(pg_temp.body(res)->>'revision')::uuid; end if;

 -- ---------------------------------------------------------------- 5 acknowledge, then final
 op:=gen_random_uuid(); res:=pg_temp.w(ld,'authenticated',ta,op,'acknowledge',s[2],r3);
 perform pg_temp.chk('5 landlord acknowledges (Mark received)',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='landlord_acknowledged',res);
 if pg_temp.state(res)='OK' then writes:=writes+1; r4:=(pg_temp.body(res)->>'revision')::uuid; end if;
 res:=pg_temp.w(tn,'authenticated',ta,gen_random_uuid(),'mark_paid',s[2],r4);
 perform pg_temp.chk('5b landlord_acknowledged is final: tenant mark_paid refused',pg_temp.state(res)='22023' and res like '%Already confirmed%',res);
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'dispute',s[2],r4);
 perform pg_temp.chk('5c landlord_acknowledged is final: dispute refused',pg_temp.state(res)='22023' and res like '%Already confirmed%',res);
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'acknowledge',s[2],r4);
 perform pg_temp.chk('5d landlord_acknowledged is final: second acknowledge refused',pg_temp.state(res)='22023',res);

 -- ---------------------------------------------------------------- 6 landlord acknowledges a month the tenant never marked
 op:=gen_random_uuid(); res:=pg_temp.w(ld,'authenticated',ta,op,'acknowledge',s[3],null);
 perform pg_temp.chk('6 landlord acknowledges an unmarked month (cash)',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='landlord_acknowledged'
  and (select tenant_marked_paid_at is null and landlord_acknowledged_at is not null from public.rent_obligations where tenancy_id=ta and due_date=s[3]),res);
 if pg_temp.state(res)='OK' then writes:=writes+1; end if;
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'dispute',s[4],null);
 perform pg_temp.chk('6b dispute with nothing marked is refused and leaves no row',pg_temp.state(res)='22023' and not exists(select 1 from public.rent_obligations where tenancy_id=ta and due_date=s[4]),res);

 -- ---------------------------------------------------------------- 7 replay and conflicting retry
 select count(*) into before_cnt from rentlease_rent_ledger.events;
 res:=pg_temp.w(ld,'authenticated',ta,op,'acknowledge',s[3],null);
 select count(*) into after_cnt from rentlease_rent_ledger.events;
 perform pg_temp.chk('7a replay of the same operation id returns the stored result and writes nothing',pg_temp.state(res)='OK' and before_cnt=after_cnt and pg_temp.body(res)->>'status'='landlord_acknowledged','events '||before_cnt||'->'||after_cnt);
 res:=pg_temp.w(ld,'authenticated',ta,op,'acknowledge',s[4],null);
 perform pg_temp.chk('7b same operation id with different input is a conflicting retry',pg_temp.state(res)='22023' and res like '%Conflicting retry%',res);
 res:=pg_temp.w(tn,'authenticated',ta,op,'mark_paid',s[3],null);
 perform pg_temp.chk('7c operation ids are per actor: the tenant reusing the landlord operation id is not a replay',pg_temp.state(res)<>'OK' or (select count(*) from rentlease_rent_ledger.events)=after_cnt,res);

 -- ---------------------------------------------------------------- 8 stale revision
 op:=gen_random_uuid(); res:=pg_temp.w(tn,'authenticated',ta,op,'mark_paid',s[1],null);
 perform pg_temp.chk('8a tenant marks the horizon month paid',pg_temp.state(res)='OK',res);
 if pg_temp.state(res)='OK' then writes:=writes+1; r5:=(pg_temp.body(res)->>'revision')::uuid; end if;
 res:=pg_temp.w(tn,'authenticated',ta,gen_random_uuid(),'mark_paid',s[1],null);
 perform pg_temp.chk('8b a view from before the row existed (null revision) is stale',pg_temp.state(res)='40001',res);
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'acknowledge',s[1],r1);
 perform pg_temp.chk('8c an old revision is rejected',pg_temp.state(res)='40001',res);
 res:=pg_temp.w(tn,'authenticated',ta,gen_random_uuid(),'mark_paid',s[1],r5);
 perform pg_temp.chk('8d marking an already marked month again is refused',pg_temp.state(res)='22023' and res like '%Transition unavailable%',res);
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'acknowledge',s[4],gen_random_uuid());
 perform pg_temp.chk('8e a revision for a month with no row is rejected and leaves no row',pg_temp.state(res)='40001' and not exists(select 1 from public.rent_obligations where tenancy_id=ta and due_date=s[4]),res);

 -- ---------------------------------------------------------------- 9 wrong user
 res:=pg_temp.w(st,'authenticated',ta,gen_random_uuid(),'mark_paid',s[4],null);
 perform pg_temp.chk('9a a stranger (Tier 1, not a party) cannot write',pg_temp.state(res)='42501' and res like '%Access unavailable%',res);
 res:=pg_temp.r(st,'authenticated',ta);
 perform pg_temp.chk('9b a stranger cannot read the ledger',pg_temp.state(res)='42501' and res like '%Access unavailable%',res);
 res:=pg_temp.w(tn,'authenticated',ta,gen_random_uuid(),'acknowledge',s[4],null);
 perform pg_temp.chk('9c the tenant cannot acknowledge',pg_temp.state(res)='42501' and res like '%Landlord required%',res);
 res:=pg_temp.w(tn,'authenticated',ta,gen_random_uuid(),'dispute',s[4],null);
 perform pg_temp.chk('9d the tenant cannot dispute',pg_temp.state(res)='42501' and res like '%Landlord required%',res);
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'mark_paid',s[4],null);
 perform pg_temp.chk('9e the landlord cannot mark paid',pg_temp.state(res)='42501' and res like '%Tenant required%',res);
 res:=pg_temp.r(nt,'authenticated',te);
 perform pg_temp.chk('9f a party without active Tier 1 cannot read',pg_temp.state(res)='42501' and res like '%Access unavailable%',res);
 res:=pg_temp.w(nt,'authenticated',te,gen_random_uuid(),'mark_paid',(select max(due_date) from rentlease_rent_ledger.due_dates(today-30,null,2,today)),null);
 perform pg_temp.chk('9g a party without active Tier 1 cannot write',pg_temp.state(res)='42501' and res like '%Access unavailable%',res);

 -- ---------------------------------------------------------------- 10 anon and direct table access
 res:=pg_temp.act(null,'anon',format('select public.write_rent_ledger(%L,%L,%L,%L,null)::text',ta,gen_random_uuid(),'mark_paid',s[4]));
 perform pg_temp.chk('10a anon cannot call write_rent_ledger',pg_temp.state(res)='42501' and res like '%permission denied%',res);
 res:=pg_temp.act(null,'anon',format('select public.get_rent_ledger(%L,0)::text',ta));
 perform pg_temp.chk('10b anon cannot call get_rent_ledger',pg_temp.state(res)='42501' and res like '%permission denied%',res);
 res:=pg_temp.act(tn,'authenticated','select count(*)::text from public.rent_obligations');
 perform pg_temp.chk('10c authenticated cannot read rent_obligations directly',pg_temp.state(res)='42501',res);
 res:=pg_temp.act(ld,'authenticated','update public.rent_obligations set status=''landlord_acknowledged'' where true');
 perform pg_temp.chk('10d authenticated cannot update rent_obligations directly',pg_temp.state(res)='42501',res);
 res:=pg_temp.act(tn,'authenticated','select count(*)::text from rentlease_rent_ledger.events');
 perform pg_temp.chk('10e authenticated cannot read the events table',pg_temp.state(res)='42501',res);
 res:=pg_temp.act(tn,'authenticated','select count(*)::text from rentlease_rent_ledger.receipts');
 perform pg_temp.chk('10f authenticated cannot read the receipts table',pg_temp.state(res)='42501',res);
 res:=pg_temp.act(tn,'authenticated',format('select rentlease_rent_ledger.relationship(%L)::text',ta));
 perform pg_temp.chk('10g authenticated cannot call the private helper',pg_temp.state(res)='42501',res);

 -- ---------------------------------------------------------------- 11 due dates outside the tenancy
 res:=pg_temp.w(tn,'authenticated',td,gen_random_uuid(),'mark_paid',(date_trunc('month',(today-60)::timestamp)-interval '1 month'+interval '14 days')::date,null);
 perform pg_temp.chk('11a a due date before the tenancy starts is rejected',pg_temp.state(res)='22023' and res like '%Rent date unavailable%',res);
 res:=pg_temp.w(tn,'authenticated',td,gen_random_uuid(),'mark_paid',(date_trunc('month',(today+40)::timestamp)+interval '1 month'+interval '14 days')::date,null);
 perform pg_temp.chk('11b a due date after the tenancy ends is rejected',pg_temp.state(res)='22023' and res like '%Rent date unavailable%',res);
 res:=pg_temp.w(tn,'authenticated',td,gen_random_uuid(),'mark_paid',sd[2]+1,null);
 perform pg_temp.chk('11c a date that is not the due day is rejected',pg_temp.state(res)='22023' and res like '%Rent date unavailable%',res);
 res:=pg_temp.w(tn,'authenticated',ta,gen_random_uuid(),'mark_paid',(s[1]+interval '1 month')::date,null);
 perform pg_temp.chk('11d a month beyond the next upcoming one is rejected',pg_temp.state(res)='22023' and res like '%Rent date unavailable%',res);
 perform pg_temp.chk('11e none of the rejected writes left a row',not exists(select 1 from public.rent_obligations where tenancy_id=td),'');

 -- ---------------------------------------------------------------- 12 waive and unknown actions
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'waive',s[4],null);
 perform pg_temp.chk('12a waive is reserved and rejected',pg_temp.state(res)='22023' and res like '%Action unavailable%' and not exists(select 1 from public.rent_obligations where tenancy_id=ta and due_date=s[4]),res);
 res:=pg_temp.w(ld,'authenticated',ta,gen_random_uuid(),'refund',s[4],null);
 perform pg_temp.chk('12b an unknown action is rejected',pg_temp.state(res)='22023',res);
 res:=pg_temp.w(ld,'authenticated',ta,null,'acknowledge',s[4],null);
 perform pg_temp.chk('12c a missing operation id is rejected',pg_temp.state(res)='22023',res);

 -- ---------------------------------------------------------------- 13 past-due derivation
 perform pg_temp.chk('13a derived states: past_due the day after, due on the day and 3 days before, upcoming beyond',
  rentlease_rent_ledger.display_status(null,today-1,today)='past_due' and rentlease_rent_ledger.display_status(null,today,today)='due'
  and rentlease_rent_ledger.display_status(null,today+3,today)='due' and rentlease_rent_ledger.display_status(null,today+4,today)='upcoming',
  concat_ws(',',rentlease_rent_ledger.display_status(null,today-1,today),rentlease_rent_ledger.display_status(null,today,today),rentlease_rent_ledger.display_status(null,today+3,today),rentlease_rent_ledger.display_status(null,today+4,today)));
 perform pg_temp.chk('13b stored paid, confirmed, disputed and waived pass through; stored upcoming, due and overdue are re-derived',
  rentlease_rent_ledger.display_status('tenant_marked_paid',today-30,today)='tenant_marked_paid' and rentlease_rent_ledger.display_status('landlord_acknowledged',today-30,today)='landlord_acknowledged'
  and rentlease_rent_ledger.display_status('disputed',today-30,today)='disputed' and rentlease_rent_ledger.display_status('waived',today-30,today)='waived'
  and rentlease_rent_ledger.display_status('overdue',today+10,today)='upcoming' and rentlease_rent_ledger.display_status('due',today-2,today)='past_due','');
 res:=pg_temp.r(tn,'authenticated',td); j:=pg_temp.body(res);
 perform pg_temp.chk('13c an untouched tenancy: every past month reads past_due, the horizon is upcoming or due, nothing was written',
  (select bool_and(case when (e->>'dueDate')::date<today then e->>'displayStatus'='past_due' when (e->>'dueDate')::date=today then e->>'displayStatus'='due' else e->>'displayStatus' in('upcoming','due') end) from jsonb_array_elements(j->'rows') e)
  and (select count(*) from public.rent_obligations where tenancy_id=td)=0,(j->'rows')::text);
 perform pg_temp.chk('13d a finite tenancy never lists a month after its end date',(select max((e->>'dueDate')::date) from jsonb_array_elements(j->'rows') e)<=today+40,'');

 -- ---------------------------------------------------------------- 14 tenancy status gates
 res:=pg_temp.r(tn,'authenticated',tc); j:=pg_temp.body(res);
 perform pg_temp.chk('14a a pending_confirmation tenancy has an empty ledger',jsonb_array_length(j->'rows')=0,res);
 res:=pg_temp.w(tn,'authenticated',tc,gen_random_uuid(),'mark_paid',today+5,null);
 perform pg_temp.chk('14b a pending_confirmation tenancy refuses writes',pg_temp.state(res)='42501' and res like '%Rent ledger unavailable%',res);
 res:=pg_temp.w(ld,'authenticated',tb,gen_random_uuid(),'acknowledge',sb[1],null);
 perform pg_temp.chk('14c an ended tenancy still lets the landlord confirm its last month, and the schedule stops at the actual end date',pg_temp.state(res)='OK' and sb[1]<=today-20,res);
 if pg_temp.state(res)='OK' then writes:=writes+1; end if;
 res:=pg_temp.w(tn,'authenticated',tb,gen_random_uuid(),'mark_paid',sb[2],null);
 perform pg_temp.chk('14d an ended tenancy lets the tenant mark an earlier month',pg_temp.state(res)='OK',res);
 if pg_temp.state(res)='OK' then writes:=writes+1; end if;

 -- ---------------------------------------------------------------- 15 evidence is immutable and complete
 perform pg_temp.chk('15a every successful write has exactly one event and one receipt',(select count(*) from rentlease_rent_ledger.events)=writes and (select count(*) from rentlease_rent_ledger.receipts)>=writes,'writes='||writes||' events='||(select count(*) from rentlease_rent_ledger.events)||' receipts='||(select count(*) from rentlease_rent_ledger.receipts));
 perform pg_temp.chk('15b the dispute and the revision are both in the history, in order',
  (select string_agg(action||':'||from_status||'>'||to_status,' ' order by created_at,id) from rentlease_rent_ledger.events where tenancy_id=ta and obligation_id=(select id from public.rent_obligations where tenancy_id=ta and due_date=s[2]))
  ='mark_paid:past_due>tenant_marked_paid dispute:tenant_marked_paid>disputed mark_paid:disputed>tenant_marked_paid acknowledge:tenant_marked_paid>landlord_acknowledged',
  (select string_agg(action||':'||from_status||'>'||to_status,' ' order by created_at,id) from rentlease_rent_ledger.events where tenancy_id=ta));
 begin update rentlease_rent_ledger.events set actor_id=actor_id; perform pg_temp.chk('15c events cannot be updated',false,'update succeeded'); exception when others then perform pg_temp.chk('15c events cannot be updated',sqlstate='42501',sqlerrm); end;
 begin delete from rentlease_rent_ledger.receipts; perform pg_temp.chk('15d receipts cannot be deleted',false,'delete succeeded'); exception when others then perform pg_temp.chk('15d receipts cannot be deleted',sqlstate='42501',sqlerrm); end;
 begin delete from public.tenancies where id=ta; perform pg_temp.chk('15e a tenancy with ledger history cannot be deleted',false,'delete succeeded'); exception when others then perform pg_temp.chk('15e a tenancy with ledger history cannot be deleted',sqlstate='23503',sqlerrm); end;
 begin update public.rent_obligations set status='landlord_acknowledged',landlord_acknowledged_at=null where tenancy_id=ta and due_date=s[1]; perform pg_temp.chk('15f the status/timestamp constraint holds',false,'update succeeded'); exception when others then perform pg_temp.chk('15f the status/timestamp constraint holds',sqlstate='23514',sqlerrm); end;

 -- ---------------------------------------------------------------- 16 privileges and definitions
 perform pg_temp.chk('16a EXECUTE: anon no, authenticated yes, service_role no (both RPCs)',
  not has_function_privilege('anon','public.get_rent_ledger(uuid,integer)','EXECUTE') and has_function_privilege('authenticated','public.get_rent_ledger(uuid,integer)','EXECUTE') and not has_function_privilege('service_role','public.get_rent_ledger(uuid,integer)','EXECUTE')
  and not has_function_privilege('anon','public.write_rent_ledger(uuid,uuid,text,date,uuid)','EXECUTE') and has_function_privilege('authenticated','public.write_rent_ledger(uuid,uuid,text,date,uuid)','EXECUTE') and not has_function_privilege('service_role','public.write_rent_ledger(uuid,uuid,text,date,uuid)','EXECUTE'),'');
 perform pg_temp.chk('16b both RPCs: security definer, search_path=pg_catalog, owner postgres',
  (select count(*) from pg_proc p where p.oid in('public.get_rent_ledger(uuid,integer)'::regprocedure,'public.write_rent_ledger(uuid,uuid,text,date,uuid)'::regprocedure) and p.prosecdef and p.proconfig=array['search_path=pg_catalog'] and pg_get_userbyid(p.proowner)='postgres')=2,'');
 perform pg_temp.chk('16c private schema and tables are closed to every client role',
  not has_schema_privilege('anon','rentlease_rent_ledger','USAGE') and not has_schema_privilege('authenticated','rentlease_rent_ledger','USAGE')
  and not has_table_privilege('authenticated','rentlease_rent_ledger.events','SELECT') and not has_table_privilege('authenticated','rentlease_rent_ledger.receipts','SELECT')
  and (select relrowsecurity from pg_class where oid='rentlease_rent_ledger.events'::regclass) and (select relrowsecurity from pg_class where oid='rentlease_rent_ledger.receipts'::regclass),'');
 perform pg_temp.chk('16d rent_obligations still has no client table privilege and the existing policies are untouched',
  not has_table_privilege('authenticated','public.rent_obligations','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('anon','public.rent_obligations','SELECT,INSERT,UPDATE,DELETE')
  and (select count(*) from pg_policies where schemaname='public' and tablename='rent_obligations')=2,'');
 perform pg_temp.chk('16e dependencies are unchanged (md5 of prosrc)',
  md5((select prosrc from pg_proc where oid='public.is_tier1_verified(uuid)'::regprocedure))='ddd2c8ed28b61e30e23e4f3ddefe4590'
  and md5((select prosrc from pg_proc where oid='public.get_tenancy_care(uuid,integer)'::regprocedure))='624c3bf0ce0f129f504c674330466c72','');
 perform pg_temp.chk('16f new function fingerprints (md5 of prosrc), recorded for re-verification',true,
  'get_rent_ledger='||md5((select prosrc from pg_proc where oid='public.get_rent_ledger(uuid,integer)'::regprocedure))||' write_rent_ledger='||md5((select prosrc from pg_proc where oid='public.write_rent_ledger(uuid,uuid,text,date,uuid)'::regprocedure)));
 res:=pg_temp.act(tn,'authenticated',format('select public.get_tenancy_care(%L,0)::text',ta));
 perform pg_temp.chk('16g get_tenancy_care (unchanged) still runs for a party and now reports the stored months',pg_temp.state(res)='OK' and jsonb_array_length(pg_temp.body(res)->'obligations')>=3,left(res,200));
end$t$;

-- The tenancy rent is changed inside the transaction (an admin-style edit; clients cannot do this). Triggers are switched off only for that
-- one UPDATE because the fixture's property and identity rows are synthetic; they are switched back on before the ledger is read.
set local session_replication_role = replica;
update public.tenancies set agreed_monthly_rent=11000 where id=(select v::uuid from rl_ctx where k='ta');
set local session_replication_role = origin;
do $t3$
declare
 tn uuid; ld uuid; ta uuid; today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
 s date[]; res text; j jsonb; acted jsonb; untouched jsonb; stored_amt numeric;
begin
 select v::uuid into tn from rl_ctx where k='tn'; select v::uuid into ld from rl_ctx where k='ld'; select v::uuid into ta from rl_ctx where k='ta';
 select array_agg(due_date order by due_date desc) into s from rentlease_rent_ledger.due_dates(today-100,null,2,today);
 select amount_due into stored_amt from public.rent_obligations where tenancy_id=ta and due_date=s[2];
 perform pg_temp.chk('17a after the tenancy rent changes, a stored row keeps its amount_due',stored_amt=10000 and (select agreed_monthly_rent from public.tenancies where id=ta)=11000,'stored='||stored_amt);
 res:=pg_temp.r(tn,'authenticated',ta); j:=pg_temp.body(res);
 select e into acted from jsonb_array_elements(j->'rows') e where e->>'dueDate'=s[2]::text;
 select e into untouched from jsonb_array_elements(j->'rows') e where e->>'dueDate'=s[4]::text;
 perform pg_temp.chk('17b the ledger shows the old amount for the acted month and the new rent for a month with no row (known limit: mixed amounts)',
  (acted->>'amount')::numeric=10000 and acted->>'storedStatus' is not null and (untouched->>'amount')::numeric=11000 and untouched->>'storedStatus' is null,
  'acted='||(acted->>'amount')||' untouched='||(untouched->>'amount'));
 perform pg_temp.chk('17c the header monthlyRent is the current tenancy rent',(j->>'monthlyRent')::numeric=11000,j->>'monthlyRent');
 res:=pg_temp.w(tn,'authenticated',ta,gen_random_uuid(),'mark_paid',s[4],null);
 perform pg_temp.chk('17d a month first acted on after the change stores the new rent',pg_temp.state(res)='OK'
  and (select amount_due from public.rent_obligations where tenancy_id=ta and due_date=s[4])=11000,res);
end$t3$;

-- Deliberate abort: carries the results out and guarantees the whole batch (fixture, migration objects if run pre-apply) rolls back.
do $out$
declare report text; bad int;
begin
 select count(*) filter (where not ok) into bad from rl_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when detail is not null and detail<>'' then ' :: '||left(detail,64) else '' end,E'
' order by n) into report from rl_res /*WHERE*/;
 raise exception E'RENT_LEDGER_CHECKS total=% failed=%
%',(select count(*) from rl_res),bad,report using errcode='P0001';
end$out$;
