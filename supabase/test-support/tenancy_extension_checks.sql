-- Tenancy extension checks. NOT RUN YET. Needs the migration objects to exist in the same transaction (pre-apply: run the migration body
-- + this file as one batch with the migration's begin/commit removed) or in the database (post-apply: run this file alone). Run it against a
-- scratch database or branch, never against the hosted project that is serving a live test.
-- Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the results, so NOTHING can commit.
--
-- HOW THE FIXTURE MEETS THE TENANCY GATES (stated once, relied on throughout)
--  * The gates: aaa_tenancy_property_gate and aab_tenancy_identity_gate raise 40001 on INSERT, or on an UPDATE that changes status,
--    tenant_confirmed_at, landlord_confirmed_at or the accepted_* columns, unless accepted_property_edit_version and
--    accepted_identity_revision_id equal the property's CURRENT edit_version / identity revision (a missing property or identity row fails too).
--  * The fixture does NOT satisfy them: it BYPASSES them. Every row is created or mutated between a top-level
--    "set local session_replication_role = replica" and "= origin" (the same top-level SET the rent ledger checks use), so triggers and FK
--    checks are off. The fixture property rows are minimal (no edit-version or identity history behind them) and accepted_* stay null, on purpose.
--  * After "= origin" the only writes to public.tenancies are the extension accepts themselves. An accept updates expected_end_date ONLY: status,
--    both confirmation timestamps and accepted_* are unchanged, so neither gate evaluates (the commitment guard, listing sync, validation and
--    updated_at triggers still run, which is the point of running a real accept).
--  * Mid-test fixture changes that would trip a gate (ending a tenancy, changing an end date, adding reservations or early-end requests) run in
--    their own blocks between top-level SET replica / SET origin, never inside a DO block.
-- Every expected-error check matches the exact SQLSTATE and the exact message (pg_temp.is_err / is_conflict); a different exception fails it.
-- FOREIGN KEYS THAT ARE RE-CHECKED IN THE SAME TRANSACTION. Postgres re-runs a foreign-key check on UPDATE for a row inserted by the current
-- transaction even when the key did not change. The updates that happen with triggers ON are the accepts: they update a public.tenancies row, and
-- the listing sync updates the matching public.listings row. Both were inserted here, so every FK of those rows must resolve. Every FK below was read
-- from the catalog (pg_constraint) and each target exists or the column is NULL:
--   public.tenancies: property_id -> public.properties (row created from the tenancy, fixture block); listing_id -> public.listings (one per tenancy,
--     same block); tenant_id, landlord_id, created_by -> public.profiles (tn, ot, nt / ld: profiles insert); conversation_id -> conversations: NULL;
--     accepted_identity_revision_id -> rentlease_property_identity.revisions: NULL.
--   public.listings: landlord_id -> public.profiles (ld); property_id -> public.properties (the same property as the tenancy or reservation).
--   public.properties: landlord_id -> public.profiles (ld).
--   public.rental_reservations: property_id -> properties (above); tenant_id, landlord_id -> profiles; listing_id -> a new listing and conversation_id
--     -> a new conversation, both made by pg_temp.fx_resv for every reservation (unique (listing_id, tenant_id) holds: one new listing each);
--     responded_by -> NULL. Reservations are inserted and deleted, never updated, but their keys resolve anyway.
--   rentlease_tenancy_end.requests and rentlease_tenancy_extension.requests / events -> public.tenancies (exists).
--   public.conversations (created by fx_resv): listing_id -> listings, tenant_id and landlord_id -> profiles.
-- Fixture inserts, against the real column lists:
--  * public.profiles(id, account_status, tier1_verified_at): the same three columns the ledger fixture uses.
--  * public.tenancies: every NOT NULL column is given (id, property_id, listing_id, tenant_id, landlord_id, status, start_date, agreed_monthly_rent,
--    rent_due_day, created_by); also expected_end_date, actual_end_date, ended_at, tenant_confirmed_at, landlord_confirmed_at, activated_at.
--  * public.listings: validate_tenancy (BEFORE UPDATE) raises 'Listing does not exist' unless a listings row has id = tenancy.listing_id, with the same
--    property_id and landlord_id. The fixture inserts one listing per fixture tenancy, selected FROM that tenancy row (fixture block, right after the
--    tenancies insert), giving only the columns without a default (property_id, landlord_id, title, description, asking_rent_monthly) plus id.
--  * public.rental_reservations: id, conversation_id, listing_id, property_id, tenant_id, landlord_id, move_in_date, duration_months (1 to 120),
--    end_date (> move_in_date), status, expires_at: all NOT NULL columns; revision, created_at and updated_at take their defaults.
--  * rentlease_tenancy_end.requests (early-end): tenancy_id, initiator_id, proposed_end_date, reason (1 to 1000), base_version, original_terms: all
--    NOT NULL, all given; id, revision, status and created_at take their defaults.
--  * rentlease_tenancy_extension.requests: tenancy_id, requester_id, requested_end_date, base_end_date (> requested is refused by a check, so
--    requested > base); the rest default.
create temp table te_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create temp table te_ctx(k text primary key,v text not null) on commit drop;

create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into te_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
create function pg_temp.c(p_k text) returns uuid language sql as $$ select v::uuid from te_ctx where k=p_k $$;
create function pg_temp.cv(p_k text) returns text language sql as $$ select v from te_ctx where k=p_k $$;
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
-- Exact-match error checks: the SQLSTATE AND the whole message must be the expected ones; any other exception (or success) fails the check.
create function pg_temp.is_err(p text,p_state text,p_msg text) returns boolean language sql as $$ select p like 'ERR|%' and split_part(p,'|',2)=p_state and split_part(p,'|',3)=p_msg $$;
create function pg_temp.is_conflict(p text,p_date date) returns boolean language sql as $$
 select p like 'ERR|23P01|%' and split_part(p,'|',3)~'^extension_conflict:[0-9]{4}-[0-9]{2}-[0-9]{2}$' and split_part(p,'|',3)='extension_conflict:'||to_char(p_date,'YYYY-MM-DD') $$;
create function pg_temp.req(p_end date,p_note text default null) returns jsonb language sql as $$
 select jsonb_strip_nulls(jsonb_build_object('requestedEndDate',to_char(p_end,'YYYY-MM-DD'),'note',p_note)) $$;
create function pg_temp.dec(p_id text,p_rev text) returns jsonb language sql as $$ select jsonb_build_object('requestId',p_id,'revision',p_rev) $$;
-- A reservation plus the listing and conversation rows its foreign keys point at (listing_id and conversation_id are NOT NULL). Called only
-- between the top-level replica/origin SETs, so triggers are off while it inserts. The listing belongs to the same property and landlord, the
-- conversation to the reservation's tenant and landlord; (listing_id, tenant_id) is unique and every call makes a new listing, so it never collides.
create function pg_temp.fx_resv(p_id uuid,p_property uuid,p_tenant uuid,p_landlord uuid,p_move_in date,p_months int,p_end date,p_status text,p_expires timestamptz) returns void language plpgsql as $$
declare l uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
begin
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly) values(l,p_property,p_landlord,'Fixture listing for a reservation','Fixture listing for the extension checks',10000);
 insert into public.conversations(id,listing_id,tenant_id,landlord_id) values(c,l,p_tenant,p_landlord);
 insert into public.rental_reservations(id,conversation_id,listing_id,property_id,tenant_id,landlord_id,move_in_date,duration_months,end_date,status,expires_at) values(p_id,c,l,p_property,p_tenant,p_landlord,p_move_in,p_months,p_end,p_status,p_expires);
end$$;
create function pg_temp.rid(p_tenancy uuid) returns text language sql as $$ select id::text from rentlease_tenancy_extension.requests where tenancy_id=p_tenancy and status='pending' $$;
create function pg_temp.rrev(p_tenancy uuid) returns text language sql as $$ select revision::text from rentlease_tenancy_extension.requests where tenancy_id=p_tenancy and status='pending' $$;

-- ---------------------------------------------------------------- fixture (triggers off)
set local session_replication_role = replica;
do $f$
declare
 tn uuid:=gen_random_uuid(); ld uuid:=gen_random_uuid(); st uuid:=gen_random_uuid(); nt uuid:=gen_random_uuid(); ot uuid:=gen_random_uuid();
 ta uuid:=gen_random_uuid(); tb uuid:=gen_random_uuid(); tc uuid:=gen_random_uuid(); td uuid:=gen_random_uuid(); te uuid:=gen_random_uuid(); tf uuid:=gen_random_uuid();
 tg uuid:=gen_random_uuid(); th uuid:=gen_random_uuid(); ti uuid:=gen_random_uuid(); tj uuid:=gen_random_uuid(); tk uuid:=gen_random_uuid(); tm uuid:=gen_random_uuid();
 tq uuid:=gen_random_uuid(); tr uuid:=gen_random_uuid(); ts uuid:=gen_random_uuid(); tu uuid:=gen_random_uuid(); tw uuid:=gen_random_uuid(); tx uuid:=gen_random_uuid();
 p_a uuid:=gen_random_uuid(); p_g uuid:=gen_random_uuid(); p_h uuid:=gen_random_uuid(); p_j uuid:=gen_random_uuid(); p_r uuid:=gen_random_uuid(); p_w uuid:=gen_random_uuid();
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; y int:=extract(year from (statement_timestamp() at time zone 'Asia/Manila'))::int+1; ea date:=today+30;
begin
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
  (tw,p_w,gen_random_uuid(),tn,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now()),
  (tx,gen_random_uuid(),gen_random_uuid(),nt,ld,'active',today-60,ea,null,null,10000,5,ld,now(),now(),now());
 -- Properties. Postgres re-runs foreign-key checks on UPDATE for a row that was inserted in the same transaction even when the key did not change, and
 -- the accepts (and the listing sync they trigger) update tenancy and listing rows created here, so tenancies_property_id_fkey and listings_property_id_fkey
 -- need a real properties row. One per distinct fixture property id (the three reservation properties p_g, p_w, p_r and p_j are tenancy properties too),
 -- built from the tenancy rows. Only the NOT NULL columns without a default are given: landlord_id (the fixture owner), property_type 'house' and city
 -- 'imus' (labels read from pg_enum: property_type = apartment, boarding_house, bedspace, room, studio, condominium, house, dormitory, other; cavite_city
 -- = imus, dasmarinas, tagaytay), barangay, and public_location (a geography(Point,4326), type in the extensions schema; not an enum). property_subtype
 -- stays NULL, which properties_model_subtype_check allows. No other constraint applies to these values (bedrooms, bathrooms and floor_area_sqm are NULL
 -- and their checks pass on NULL). Triggers on public.properties: the INSERT ones (rental_location_revision, unfinished_post_register) would write rows in
 -- other schemas, so this insert must run, and does run, between the top-level replica/origin SETs with the other fixtures; the UPDATE ones
 -- (property_details_rotate, updated_at, completeness, identity_canonical_property) never fire because nothing here updates a property.
 insert into public.properties(id,landlord_id,property_type,city,barangay,public_location)
  select distinct t.property_id,t.landlord_id,'house','imus','Fixture Barangay','SRID=4326;POINT(120.9 14.3)'::extensions.geography from public.tenancies t where t.id in(ta,tb,tc,td,te,tf,tg,th,ti,tj,tk,tm,tq,tr,ts,tu,tw,tx);
 -- Listings (validate_tenancy raises 'Listing does not exist' unless public.listings has a row with id = tenancy.listing_id, and requires
 -- listing.property_id = tenancy.property_id and listing.landlord_id = tenancy.landlord_id). ONE listing per fixture tenancy, built FROM the tenancy
 -- row just inserted, so the three values match by construction. Only the columns without a default are given: property_id, landlord_id, title,
 -- description, asking_rent_monthly (plus id). Created here, in the fixture block, right after the tenancies insert; there is no other listing insert.
 insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly) select t.listing_id,t.property_id,t.landlord_id,'Fixture listing','Fixture listing for the extension checks',t.agreed_monthly_rent from public.tenancies t where t.id in(ta,tb,tc,td,te,tf,tg,th,ti,tj,tk,tm,tq,tr,ts,tu,tw,tx);
 -- Stale updated_at, so the updated_at trigger's work is visible on an accept.
 update public.tenancies set updated_at=now()-interval '2 days' where id in(ta,tb,tc,td,te,tf,tg,th,ti,tj,tk,tm,tq,tr,ts,tu,tw,tx);
 -- Reservations. Only an APPROVED, UNEXPIRED reservation by ANOTHER party blocks.
 --  p_g: one such reservation from today+40 (blocks).                   p_w: only a PENDING one from today+40 (does not block).
 --  p_r: five reservations, only the first counts: (1) approved, unexpired, other party, from today+45 -> blocks; (2) pending, unexpired, other party,
 --       from today+36 -> does not block (it would give an earlier date if it did); (3) approved but EXPIRED, from today+37 -> does not block;
 --       (4) approved, unexpired, the SAME tenant and landlord as the tenancy, from today+35 -> ignored; (5) declined, from today+31 -> ignored.
 perform pg_temp.fx_resv(gen_random_uuid(),p_g,ot,ld,today+40,2,today+100,'approved',now()+interval '100 days');
 perform pg_temp.fx_resv(gen_random_uuid(),p_w,ot,ld,today+40,2,today+100,'pending',now()+interval '3 days');
 perform pg_temp.fx_resv(gen_random_uuid(),p_r,ot,ld,today+45,2,today+105,'approved',now()+interval '100 days');
 perform pg_temp.fx_resv(gen_random_uuid(),p_r,ot,ld,today+36,1,today+60,'pending',now()+interval '3 days');
 perform pg_temp.fx_resv(gen_random_uuid(),p_r,ot,ld,today+37,1,today+61,'approved',now()-interval '1 day');
 perform pg_temp.fx_resv(gen_random_uuid(),p_r,tn,ld,today+35,2,today+80,'approved',now()+interval '100 days');
 perform pg_temp.fx_resv(gen_random_uuid(),p_r,ot,ld,today+31,1,today+50,'declined',now()+interval '3 days');
 -- tk: an early-end request is already pending. tb: an extension request made earlier, now past the tenancy's end (for the accept-time date check).
 insert into rentlease_tenancy_end.requests(tenancy_id,initiator_id,proposed_end_date,reason,base_version,original_terms) values(tk,tn,today,'Moving out','v','{}'::jsonb);
 insert into rentlease_tenancy_extension.requests(tenancy_id,requester_id,requested_end_date,base_end_date) values(tb,tn,today+10,today-3);
 insert into te_ctx values('tn',tn::text),('ld',ld::text),('st',st::text),('nt',nt::text),('ot',ot::text),('ta',ta::text),('tb',tb::text),('tc',tc::text),('td',td::text),('te',te::text),('tf',tf::text),
  ('tg',tg::text),('th',th::text),('ti',ti::text),('tj',tj::text),('tk',tk::text),('tm',tm::text),('tq',tq::text),('tr',tr::text),('ts',ts::text),('tu',tu::text),('tw',tw::text),('tx',tx::text),
  ('p_j',p_j::text),('resv',gen_random_uuid()::text),('y',y::text);
end$f$;
set local session_replication_role = origin;

-- ---------------------------------------------------------------- block A: entry rules, bounds, retries, reads, accept, conflicts that exist from the start
do $a$
declare
 tn uuid:=pg_temp.c('tn'); ld uuid:=pg_temp.c('ld'); st uuid:=pg_temp.c('st'); nt uuid:=pg_temp.c('nt');
 ta uuid:=pg_temp.c('ta'); tb uuid:=pg_temp.c('tb'); tc uuid:=pg_temp.c('tc'); td uuid:=pg_temp.c('td'); te uuid:=pg_temp.c('te'); tf uuid:=pg_temp.c('tf');
 tg uuid:=pg_temp.c('tg'); th uuid:=pg_temp.c('th'); tj uuid:=pg_temp.c('tj'); tk uuid:=pg_temp.c('tk'); tm uuid:=pg_temp.c('tm'); tq uuid:=pg_temp.c('tq');
 tr uuid:=pg_temp.c('tr'); ts uuid:=pg_temp.c('ts'); tu uuid:=pg_temp.c('tu'); tw uuid:=pg_temp.c('tw'); tx uuid:=pg_temp.c('tx'); y int:=pg_temp.cv('y')::int;
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; ea date:=today+30; bound date; res text; res2 text; j jsonb; r1 text; r1rev text; op uuid;
 ledger_before int; ledger_after int; before_n int; after_n int; raw_md5 text; stripped_md5 text; trg record; upd_before timestamptz; accept_ok boolean; moved boolean;
begin
 perform pg_temp.chk('fixture: the extension tables hold only the one pre-made request on tb, and no events or receipts',(select count(*) from rentlease_tenancy_extension.requests)=1 and (select count(*) from rentlease_tenancy_extension.events)=0 and (select count(*) from rentlease_tenancy_extension.receipts)=0,'');

 -- ---------------------------------------------------------------- 1 grants, entry rules, pins
 perform pg_temp.chk('1a anon, service_role and PUBLIC have no execute on any of the three RPCs; authenticated has',
  not exists(select 1 from unnest(array['public.write_tenancy_extension(uuid,uuid,text,jsonb)','public.get_tenancy_extension(uuid)','public.get_pending_tenancy_extensions()']) f where has_function_privilege('anon',f::regprocedure,'EXECUTE') or has_function_privilege('service_role',f::regprocedure,'EXECUTE') or not has_function_privilege('authenticated',f::regprocedure,'EXECUTE'))
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a where p.pronamespace in('public'::regnamespace) and p.proname in('write_tenancy_extension','get_tenancy_extension','get_pending_tenancy_extensions') and a.grantee=0),'');
 res:=pg_temp.act(tn,'anon',format('select public.get_tenancy_extension(%L)::text',ta));
 perform pg_temp.chk('1b the anon role is refused by the database',pg_temp.is_err(res,'42501','permission denied for function get_tenancy_extension'),res);
 perform pg_temp.chk('1c the private schema and its tables are closed to client roles',
  not has_schema_privilege('authenticated','rentlease_tenancy_extension','USAGE') and not has_table_privilege('authenticated','rentlease_tenancy_extension.requests','SELECT,INSERT,UPDATE,DELETE')
  and not exists(select 1 from pg_proc p where p.pronamespace='rentlease_tenancy_extension'::regnamespace and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE'))),'');
 -- The guard compares the three CR-carrying functions with the CRs removed. Same expression here, so this passes whether or not the live bodies contain CRs.
 perform pg_temp.chk('1d the three pinned bodies match their CR-stripped fingerprints (what the migration guard compares)',
  md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.write_tenancy_lifecycle(uuid,uuid,text,text,uuid,text)')),chr(13),''))='312e8bdaee38ba3b762a55b1635b2c63'
  and md5(replace((select prosrc from pg_proc where oid=to_regprocedure('public.get_tenancy_lifecycle(uuid,integer)')),chr(13),''))='c0eacfc87a52d0731a2e0eab2b34baee'
  and md5(replace((select prosrc from pg_proc where oid=to_regprocedure('rentlease_rent_ledger.due_dates(date,date,integer,date)')),chr(13),''))='8d82e44cbc7b94bf538608aefe1b48ce','');
 perform pg_temp.chk('1e the two CR-free pins are compared as stored',
  md5((select prosrc from pg_proc where oid=to_regprocedure('rentlease_reservations.guard_tenancy_commitment()')))='7f3420d0026e508c25b240f0bae7e96c'
  and md5((select prosrc from pg_proc where oid=to_regprocedure('public.is_tier1_verified(uuid)')))='ddd2c8ed28b61e30e23e4f3ddefe4590','');
 -- A body that really contains CRs: the raw md5 differs from the CR-stripped one, and the stripped one equals the md5 of the same text written with LFs only.
 execute 'create function pg_temp.crf() returns int language sql as '||quote_literal('select 1'||chr(13)||chr(10)||' ');
 select md5(prosrc),md5(replace(prosrc,chr(13),'')) into raw_md5,stripped_md5 from pg_proc where oid=to_regprocedure('pg_temp.crf()');
 perform pg_temp.chk('1f a body that contains CRs: the guard expression still matches the LF-only fingerprint',(select prosrc from pg_proc where oid=to_regprocedure('pg_temp.crf()')) like '%'||chr(13)||'%' and raw_md5<>stripped_md5 and stripped_md5=md5('select 1'||chr(10)||' '),raw_md5||' / '||stripped_md5);

 -- ---------------------------------------------------------------- 2 actor rules
 res:=pg_temp.w(ld,ta,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('2a the owner cannot request',pg_temp.is_err(res,'42501','Tenant required'),res);
 res:=pg_temp.w(st,ta,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('2b a stranger is refused',pg_temp.is_err(res,'42501','Access unavailable'),res);
 res:=pg_temp.w(nt,tx,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('2c a participant without Tier 1 is refused',pg_temp.is_err(res,'42501','Access unavailable'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'accept',pg_temp.dec(gen_random_uuid()::text,gen_random_uuid()::text));
 perform pg_temp.chk('2d the tenant cannot accept',pg_temp.is_err(res,'42501','Owner required'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'decline',pg_temp.dec(gen_random_uuid()::text,gen_random_uuid()::text));
 perform pg_temp.chk('2e the tenant cannot decline',pg_temp.is_err(res,'42501','Owner required'),res);
 res:=pg_temp.w(ld,ta,gen_random_uuid(),'withdraw',pg_temp.dec(gen_random_uuid()::text,gen_random_uuid()::text));
 perform pg_temp.chk('2f the owner cannot withdraw',pg_temp.is_err(res,'42501','Tenant required'),res);
 res:=pg_temp.g(st,ta);
 perform pg_temp.chk('2g a stranger cannot read',pg_temp.is_err(res,'42501','Access unavailable'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'bogus','{}'::jsonb);
 perform pg_temp.chk('2h an unknown action is refused',pg_temp.is_err(res,'22023','Invalid operation'),res);

 -- ---------------------------------------------------------------- 3 date bounds (ta ends today+30)
 bound:=((ea+1)::timestamp+interval '6 months')::date-1;
 perform pg_temp.chk('3a the latest end date is (end + 1 day) + 6 months - 1 day',rentlease_tenancy_extension.latest_end(ea)=bound,'end='||ea||' bound='||bound||' fn='||rentlease_tenancy_extension.latest_end(ea));
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea));
 perform pg_temp.chk('3b a request equal to the current end is refused',pg_temp.is_err(res,'22023','extension_date_invalid:not_after_end'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea-1));
 perform pg_temp.chk('3c a request before the current end is refused',pg_temp.is_err(res,'22023','extension_date_invalid:not_after_end'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(bound+1));
 perform pg_temp.chk('3d six months and a day is refused',pg_temp.is_err(res,'22023','extension_date_invalid:beyond_limit'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request','{}'::jsonb);
 perform pg_temp.chk('3e a missing date is refused',pg_temp.is_err(res,'22023','extension_date_invalid:missing'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request','{"requestedEndDate":"2027-02-30"}'::jsonb);
 perform pg_temp.chk('3f an impossible date is refused',pg_temp.is_err(res,'22023','extension_date_invalid:malformed'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',jsonb_build_object('requestedEndDate',to_char(ea+10,'YYYY-MM-DD'),'extra',1));
 perform pg_temp.chk('3g an unknown payload field is refused',pg_temp.is_err(res,'22023','Unexpected fields'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+10,''));
 perform pg_temp.chk('3h an empty note is refused',pg_temp.is_err(res,'22023','Note must be 1 to 1000 characters'),res);
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+10,repeat('x',1001)));
 perform pg_temp.chk('3i a note over 1000 characters is refused',pg_temp.is_err(res,'22023','Note must be 1 to 1000 characters'),res);
 perform pg_temp.chk('3j refusals left nothing behind on ta',(select count(*) from rentlease_tenancy_extension.requests where tenancy_id=ta)=0 and (select count(*) from rentlease_tenancy_extension.receipts)=0,'');
 res:=pg_temp.w(tn,tb,gen_random_uuid(),'request',pg_temp.req(today+10));
 perform pg_temp.chk('3k an active tenancy past its end date is refused',pg_temp.is_err(res,'22023','extension_unavailable:past_end_date'),res);
 res:=pg_temp.w(tn,tc,gen_random_uuid(),'request',pg_temp.req(today+100));
 perform pg_temp.chk('3l a tenancy that has not started is refused',pg_temp.is_err(res,'22023','extension_unavailable:not_active'),res);
 res:=pg_temp.w(tn,td,gen_random_uuid(),'request',pg_temp.req(today+10));
 perform pg_temp.chk('3m an ended tenancy is refused',pg_temp.is_err(res,'22023','extension_unavailable:not_active'),res);
 res:=pg_temp.w(tn,te,gen_random_uuid(),'request',pg_temp.req(make_date(y,7,31)+1));
 perform pg_temp.chk('3n Jan 31: Aug 1 is beyond the limit',pg_temp.is_err(res,'22023','extension_date_invalid:beyond_limit'),res);
 res:=pg_temp.w(tn,te,gen_random_uuid(),'request',pg_temp.req(make_date(y,7,31)));
 perform pg_temp.chk('3o Jan 31: Jul 31 is the latest allowed',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='pending',res);
 res:=pg_temp.w(tn,tf,gen_random_uuid(),'request',pg_temp.req(make_date(y,8,31)+1));
 perform pg_temp.chk('3p last day of Feb: Sep 1 is beyond the limit',pg_temp.is_err(res,'22023','extension_date_invalid:beyond_limit'),res);
 res:=pg_temp.w(tn,tf,gen_random_uuid(),'request',pg_temp.req(make_date(y,8,31)));
 perform pg_temp.chk('3q last day of Feb: Aug 31 is the latest allowed (not Aug 28)',pg_temp.state(res)='OK',res);
 op:=gen_random_uuid(); res:=pg_temp.w(tn,ta,op,'request',pg_temp.req(bound,'Staying for the semester'));
 perform pg_temp.chk('3r exactly six months is accepted as a request',pg_temp.state(res)='OK' and (pg_temp.body(res)->>'requestedEndDate')::date=bound and (pg_temp.body(res)->>'currentEndDate')::date=ea,res);
 r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';

 -- ---------------------------------------------------------------- 4 one pending request, retry, stale, reads, withdraw, decline, ask again
 res2:=pg_temp.w(tn,ta,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('4a a second request while one is pending is refused',pg_temp.is_err(res2,'22023','extension_unavailable:request_pending'),res2);
 res2:=pg_temp.w(tn,ta,op,'request',pg_temp.req(bound,'Staying for the semester'));
 perform pg_temp.chk('4b the same operation id with the same input returns the same result and writes nothing',res2=res and (select count(*) from rentlease_tenancy_extension.requests where tenancy_id=ta)=1 and (select count(*) from rentlease_tenancy_extension.events where tenancy_id=ta)=1,res2);
 res2:=pg_temp.w(tn,ta,op,'request',pg_temp.req(bound-1));
 perform pg_temp.chk('4c the same operation id with different input is refused',pg_temp.is_err(res2,'22023','Conflicting retry'),res2);
 res2:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(r1,gen_random_uuid()::text));
 perform pg_temp.chk('4d a stale revision is refused with 40001',pg_temp.is_err(res2,'40001','Extension request changed. Reload.'),res2);
 res2:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(gen_random_uuid()::text,r1rev));
 perform pg_temp.chk('4e an unknown request id is refused with 40001',pg_temp.is_err(res2,'40001','Extension request changed. Reload.'),res2);
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
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('4k the tenant withdraws',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='withdrawn',res);
 res:=pg_temp.g(tn,ta); j:=pg_temp.body(res);
 perform pg_temp.chk('4l after a withdrawal the read shows it and the tenant can ask again',j#>>'{request,status}'='withdrawn' and j#>>'{request,whoDecided}'='tenant' and (j->>'canRequest')::boolean,left(res,200));
 res:=pg_temp.w(tn,ta,gen_random_uuid(),'withdraw',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('4m withdrawing again is refused (not pending any more)',pg_temp.is_err(res,'40001','Extension request changed. Reload.'),res);
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
 select updated_at into upd_before from public.tenancies where id=tm;
 op:=gen_random_uuid(); res:=pg_temp.w(tn,tm,gen_random_uuid(),'request',pg_temp.req(ea+60)); r1:=pg_temp.body(res)->>'requestId'; r1rev:=pg_temp.body(res)->>'revision';
 perform pg_temp.chk('5a the tenant asks for 60 more days',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(ld,tm,op,'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('5b the owner accepts',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='accepted' and (pg_temp.body(res)->>'currentEndDate')::date=ea+60,res);
 accept_ok:=pg_temp.state(res)='OK';
 perform pg_temp.chk('5c the tenancy end date moved and nothing else did (this accept ran through every tenancy trigger)',
  (select expected_end_date from public.tenancies where id=tm)=ea+60 and (select actual_end_date from public.tenancies where id=tm) is null and (select status from public.tenancies where id=tm)='active'
  and (select agreed_monthly_rent from public.tenancies where id=tm)=10000 and (select rent_due_day from public.tenancies where id=tm)=5 and (select start_date from public.tenancies where id=tm)=today-60,'');
 select count(*) into ledger_after from rentlease_rent_ledger.due_dates((select start_date from public.tenancies where id=tm),(select coalesce(actual_end_date,expected_end_date) from public.tenancies where id=tm),5,today+400);
 perform pg_temp.chk('5d the rent ledger schedule (coalesce(actual, expected)) now has the extra months',ledger_after>ledger_before,'before='||ledger_before||' after='||ledger_after);
 select count(*) into after_n from public.notifications;
 perform pg_temp.chk('5e no notification was created',after_n=before_n,'before='||before_n||' after='||after_n);
 moved:=(select expected_end_date from public.tenancies where id=tm)=ea+60;
 -- One check per trigger that runs on an UPDATE of public.tenancies. Each proves: the trigger exists, is enabled for origin sessions (the session is
 -- in origin mode, set at top level above), fires on UPDATE, and the end-date-only accept above succeeded and moved the date, i.e. it passed this trigger.
 for trg in select * from (values('aaa_tenancy_property_gate','property gate'),('aab_tenancy_identity_gate','identity gate'),('aac_reservation_tenancy_commitment','guard_tenancy_commitment'),
   ('trg_sync_listing_from_tenancy','listing sync'),('trg_tenancies_updated_at','set_updated_at'),('trg_validate_tenancy','validate_tenancy'),('inapp_tenancy','notifications trigger')) v(tgname,label) loop
  perform pg_temp.chk('5k '||trg.label||' ('||trg.tgname||') is enabled on UPDATE and the end-date-only accept passed it',
   accept_ok and moved and current_setting('session_replication_role')='origin'
   and exists(select 1 from pg_trigger where tgrelid='public.tenancies'::regclass and tgname=trg.tgname and tgenabled='O' and not tgisinternal and (tgtype & 16)=16),'accept='||accept_ok||' moved='||moved);
 end loop;
 perform pg_temp.chk('5l set_updated_at ran: updated_at moved forward on the accept',(select updated_at from public.tenancies where id=tm)>upd_before,'before='||upd_before||' after='||(select updated_at from public.tenancies where id=tm));
 perform pg_temp.chk('5m the notifications trigger ran and created nothing for an end-date-only update',accept_ok and after_n=before_n,'before='||before_n||' after='||after_n);
 begin
  update public.tenancies set expected_end_date=today+60 where id=tg;
  perform pg_temp.chk('5n guard_tenancy_commitment is live: a direct update into another party''s approved reservation is refused',false,'the update succeeded');
 exception when others then
  perform pg_temp.chk('5n guard_tenancy_commitment is live: a direct update into another party''s approved reservation is refused',sqlstate='23P01' and sqlerrm='Unit has an overlapping reservation commitment',sqlstate||' '||sqlerrm);
 end;
 res:=pg_temp.w(ld,tm,op,'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('5f retrying the accept with the same operation id returns the stored result',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='accepted',res);
 res:=pg_temp.w(ld,tm,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('5g accepting again with a new operation id is refused (not pending)',pg_temp.is_err(res,'40001','Extension request changed. Reload.'),res);
 res:=pg_temp.g(tn,tm); j:=pg_temp.body(res);
 perform pg_temp.chk('5h the read shows the accepted request, the new end date and a new limit',j#>>'{request,status}'='accepted' and (j->>'currentEndDate')::date=ea+60 and (j->>'latestEndDate')::date=rentlease_tenancy_extension.latest_end(ea+60) and j#>>'{request,whoDecided}'='landlord',left(res,240));
 res:=pg_temp.w(tn,tm,gen_random_uuid(),'request',pg_temp.req(ea+70));
 perform pg_temp.chk('5i the tenant can ask again from the new end date',pg_temp.state(res)='OK' and (pg_temp.body(res)->>'currentEndDate')::date=ea+60,res);

 -- ---------------------------------------------------------------- 6 conflicts that exist from the start
 res:=pg_temp.w(tn,tg,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('6a an APPROVED reservation by another party blocks, and the error carries the first conflicting date',pg_temp.is_conflict(res,today+40),res);
 res:=pg_temp.w(tn,tg,gen_random_uuid(),'request',pg_temp.req(today+39));
 perform pg_temp.chk('6b a request that stops the day before the reservation is allowed',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(tn,th,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('6c another tenancy in pending_confirmation blocks, with its start date',pg_temp.is_conflict(res,today+50),res);
 res:=pg_temp.w(tn,tr,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('6d of five reservations only the approved, unexpired, other-party one counts: not the pending, the expired, the same pair''s or the declined',pg_temp.is_conflict(res,today+45),res);
 res:=pg_temp.w(tn,tw,gen_random_uuid(),'request',pg_temp.req(ea+60));
 perform pg_temp.chk('6e a PENDING reservation request by another party does NOT block',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='pending',res);
 -- requests that the next blocks use after the calendar or the tenancy changes underneath them
 res:=pg_temp.w(tn,tj,gen_random_uuid(),'request',pg_temp.req(ea+40));
 perform pg_temp.chk('6f tj: a request with a clear calendar is pending (a booking will appear before the accept)',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(tn,tq,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('6g tq: a request is pending (an early-end request will appear)',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(tn,ts,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('6h ts: a request is pending (the tenancy will end)',pg_temp.state(res)='OK',res);
 res:=pg_temp.w(tn,tu,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('6i tu: a request is pending (its end date will change)',pg_temp.state(res)='OK',res);
 -- 7a: tk already has an early-end request (fixture)
 res:=pg_temp.w(tn,tk,gen_random_uuid(),'request',pg_temp.req(ea+10));
 perform pg_temp.chk('7a a tenant cannot ask while an early-end request is pending',pg_temp.is_err(res,'22023','extension_unavailable:early_end_pending'),res);
 res:=pg_temp.g(tn,tk); j:=pg_temp.body(res);
 perform pg_temp.chk('7b the read says so',not (j->>'canRequest')::boolean and j->>'cannotRequestReason'='early_end_pending',left(res,200));
end$a$;

-- ---------------------------------------------------------------- mutations 1 (triggers off): the world changes under the pending requests
set local session_replication_role = replica;
do $m1$
declare tj uuid:=pg_temp.c('tj'); tq uuid:=pg_temp.c('tq'); ts uuid:=pg_temp.c('ts'); tu uuid:=pg_temp.c('tu'); tn uuid:=pg_temp.c('tn'); ld uuid:=pg_temp.c('ld'); ot uuid:=pg_temp.c('ot');
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; ea date:=today+30;
begin
 -- another party's APPROVED reservation appears on tj's property after the request
 perform pg_temp.fx_resv(pg_temp.c('resv'),pg_temp.c('p_j'),ot,ld,today+45,2,today+105,'approved',now()+interval '100 days');
 -- an early-end request appears on tq after its extension request (reason, base_version, original_terms are NOT NULL)
 insert into rentlease_tenancy_end.requests(tenancy_id,initiator_id,proposed_end_date,reason,base_version,original_terms) values(tq,tn,today,'Moving out','v','{}'::jsonb);
 -- ts ends; tu's end date moves
 update public.tenancies set status='ended',actual_end_date=today,ended_at=now() where id=ts;
 update public.tenancies set expected_end_date=ea+1 where id=tu;
end$m1$;
set local session_replication_role = origin;

-- ---------------------------------------------------------------- block B: the conflict that appeared, the early-end request, the ended tenancy, the moved end date, the late date
do $b$
declare tn uuid:=pg_temp.c('tn'); ld uuid:=pg_temp.c('ld'); tb uuid:=pg_temp.c('tb'); tj uuid:=pg_temp.c('tj'); tq uuid:=pg_temp.c('tq'); ts uuid:=pg_temp.c('ts'); tu uuid:=pg_temp.c('tu');
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; res text; j jsonb; r1 text; r1rev text;
begin
 -- tj: the booking appeared between the request and the accept
 r1:=pg_temp.rid(tj); r1rev:=pg_temp.rrev(tj);
 res:=pg_temp.g(ld,tj); j:=pg_temp.body(res);
 perform pg_temp.chk('6j the owner read now carries conflictDate live and canAccept is false',j#>>'{request,conflictDate}'=to_char(today+45,'YYYY-MM-DD') and not (j#>>'{request,canAccept}')::boolean and (j#>>'{request,canDecline}')::boolean,left(res,240));
 res:=pg_temp.gp(ld); j:=pg_temp.body(res);
 perform pg_temp.chk('6k the pending feed carries the same conflictDate',exists(select 1 from jsonb_array_elements(j->'rows') e where e->>'requestId'=r1 and e->>'conflictDate'=to_char(today+45,'YYYY-MM-DD')),left(res,240));
 res:=pg_temp.w(ld,tj,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('6l accept checks again and refuses with the conflicting date',pg_temp.is_conflict(res,today+45),res);
 perform pg_temp.chk('6m the refused accept moved nothing',(select expected_end_date from public.tenancies where id=tj)=today+30 and (select status from rentlease_tenancy_extension.requests where id=r1::uuid)='pending','');
 -- tq: an early-end request appeared after the extension request
 r1:=pg_temp.rid(tq); r1rev:=pg_temp.rrev(tq);
 res:=pg_temp.w(ld,tq,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7c the owner cannot accept while an early-end request is pending',pg_temp.is_err(res,'22023','extension_unavailable:early_end_pending'),res);
 res:=pg_temp.g(ld,tq); j:=pg_temp.body(res);
 perform pg_temp.chk('7d the owner read shows canAccept false, but the owner can still decline',not (j#>>'{request,canAccept}')::boolean and (j#>>'{request,canDecline}')::boolean,left(res,240));
 -- ts: the tenancy ended while the extension was pending
 r1:=pg_temp.rid(ts); r1rev:=pg_temp.rrev(ts);
 res:=pg_temp.gp(ld);
 perform pg_temp.chk('7f the pending feed no longer lists a request on an ended tenancy',not exists(select 1 from jsonb_array_elements(pg_temp.body(res)->'rows') e where e->>'tenancyId'=ts::text),left(res,160));
 res:=pg_temp.w(ld,ts,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7g accept refuses because the tenancy is no longer active',pg_temp.is_err(res,'22023','extension_unavailable:not_active'),res);
 res:=pg_temp.w(ld,ts,gen_random_uuid(),'decline',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7h the owner can still clear it by declining',pg_temp.state(res)='OK' and pg_temp.body(res)->>'status'='declined',res);
 -- tu: the tenancy's end date moved under the request
 r1:=pg_temp.rid(tu); r1rev:=pg_temp.rrev(tu);
 res:=pg_temp.w(ld,tu,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7i accept refuses with 40001 when the tenancy end date is no longer the one the request was made against',pg_temp.is_err(res,'40001','Tenancy changed. Reload.'),res);
 -- tb: today is past the end date (the request row was made in the fixture)
 r1:=pg_temp.rid(tb); r1rev:=pg_temp.rrev(tb);
 res:=pg_temp.w(ld,tb,gen_random_uuid(),'accept',pg_temp.dec(r1,r1rev));
 perform pg_temp.chk('7j accept refuses once today is past the current end date',pg_temp.is_err(res,'22023','extension_unavailable:past_end_date'),res);
 res:=pg_temp.gp(ld);
 perform pg_temp.chk('7k the pending feed does not list a request past its end date',not exists(select 1 from jsonb_array_elements(pg_temp.body(res)->'rows') e where e->>'tenancyId'=tb::text),left(res,160));
end$b$;

-- ---------------------------------------------------------------- mutations 2 (triggers off): the conflict goes away, the early-end request is withdrawn
set local session_replication_role = replica;
do $m2$
begin
 delete from public.rental_reservations where id=pg_temp.c('resv');
 update rentlease_tenancy_end.requests set status='withdrawn',resolved_at=now(),resolved_by=pg_temp.c('tn') where tenancy_id=pg_temp.c('tq') and status='pending';
end$m2$;
set local session_replication_role = origin;

-- ---------------------------------------------------------------- block C: accepts that now succeed, and evidence that cannot change
do $c$
declare tn uuid:=pg_temp.c('tn'); ld uuid:=pg_temp.c('ld'); tj uuid:=pg_temp.c('tj'); tq uuid:=pg_temp.c('tq');
 today date:=(statement_timestamp() at time zone 'Asia/Manila')::date; ea date:=today+30; res text;
begin
 res:=pg_temp.w(ld,tj,gen_random_uuid(),'accept',pg_temp.dec(pg_temp.rid(tj),pg_temp.rrev(tj)));
 perform pg_temp.chk('6n once the conflict is gone the same request can be accepted',pg_temp.state(res)='OK' and (select expected_end_date from public.tenancies where id=tj)=ea+40,res);
 res:=pg_temp.w(ld,tq,gen_random_uuid(),'accept',pg_temp.dec(pg_temp.rid(tq),pg_temp.rrev(tq)));
 perform pg_temp.chk('7e once the early-end request is resolved the extension can be accepted',pg_temp.state(res)='OK' and (select expected_end_date from public.tenancies where id=tq)=ea+10,res);

 perform pg_temp.chk('8a there is evidence to protect',(select count(*) from rentlease_tenancy_extension.events)>0 and (select count(*) from rentlease_tenancy_extension.receipts)>0,'');
 begin update rentlease_tenancy_extension.events set note='x';perform pg_temp.chk('8b events cannot be updated',false,'updated');exception when others then perform pg_temp.chk('8b events cannot be updated',sqlstate='42501' and sqlerrm='Extension evidence is immutable',sqlstate||' '||sqlerrm);end;
 begin delete from rentlease_tenancy_extension.receipts;perform pg_temp.chk('8c receipts cannot be deleted',false,'deleted');exception when others then perform pg_temp.chk('8c receipts cannot be deleted',sqlstate='42501' and sqlerrm='Extension evidence is immutable',sqlstate||' '||sqlerrm);end;
 begin delete from rentlease_tenancy_extension.requests;perform pg_temp.chk('8d requests cannot be deleted',false,'deleted');exception when others then perform pg_temp.chk('8d requests cannot be deleted',sqlstate='42501' and sqlerrm='Extension request cannot be deleted',sqlstate||' '||sqlerrm);end;
 begin update rentlease_tenancy_extension.requests set requested_end_date=requested_end_date+1 where status='accepted';perform pg_temp.chk('8e an original request field cannot be changed',false,'changed');exception when others then perform pg_temp.chk('8e an original request field cannot be changed',sqlstate='42501' and sqlerrm='Original extension request cannot be changed',sqlstate||' '||sqlerrm);end;
 begin update rentlease_tenancy_extension.requests set status='pending' where status='accepted';perform pg_temp.chk('8f a decided request cannot be reopened',false,'reopened');exception when others then perform pg_temp.chk('8f a decided request cannot be reopened',sqlstate='42501' and sqlerrm='Original extension request cannot be changed',sqlstate||' '||sqlerrm);end;
 perform pg_temp.chk('8g a tenancy with extension history cannot be deleted (RESTRICT)',(select count(*) from pg_constraint where conrelid='rentlease_tenancy_extension.requests'::regclass and contype='f' and confdeltype='r')=1 and (select count(*) from pg_constraint where conrelid='rentlease_tenancy_extension.events'::regclass and contype='f' and confdeltype='r')=2,'');
 perform pg_temp.chk('8h every extension table has row level security and no policy',not exists(select 1 from pg_tables where schemaname='rentlease_tenancy_extension' and not rowsecurity) and not exists(select 1 from pg_policies where schemaname='rentlease_tenancy_extension'),'');
end$c$;

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
