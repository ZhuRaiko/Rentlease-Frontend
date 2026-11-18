-- Room tour (property panoramas) checks. Run AFTER supabase/migrations/20261119100000_property_panoramas.sql and property_panoramas_fixture.sql, in a scratch
-- database only (supabase/tests/run_property_panoramas.py does exactly that). Never against the hosted project.
-- Everything runs in ONE implicit transaction and ends with a deliberate exception carrying the report, so nothing can commit.
-- Fixture rows are inserted by the superuser; every behavior under test runs as authenticated, anon or service_role with a JWT subject (pg_temp.act / acx).
-- Expected-error checks match the exact SQLSTATE and the exact message (or, for row-level-security refusals, the SQLSTATE and the phrase that Postgres uses).
create temp table pa_res(n serial primary key,name text not null,ok boolean not null,detail text) on commit drop;
create function pg_temp.chk(p_name text,p_ok boolean,p_detail text) returns void language sql as $$ insert into pa_res(name,ok,detail) values(p_name,coalesce(p_ok,false),p_detail) $$;
-- A statement that returns one value, run as a role with a JWT subject: 'OK|<value>' or 'ERR|<sqlstate>|<message>'.
create function pg_temp.act(p_uid uuid,p_role text,p_sql text) returns text language plpgsql as $f$
declare r text;
begin
 perform set_config('request.jwt.claim.sub',coalesce(p_uid::text,''),true);
 execute format('set local role %I',p_role);
 execute p_sql into r;
 execute 'reset role';
 return 'OK|'||coalesce(r,'');
exception when others then return 'ERR|'||sqlstate||'|'||sqlerrm;
end$f$;
-- A statement that changes rows, run the same way: 'OK|<rows affected>' or 'ERR|...'.
create function pg_temp.acx(p_uid uuid,p_role text,p_sql text) returns text language plpgsql as $f$
declare n bigint;
begin
 perform set_config('request.jwt.claim.sub',coalesce(p_uid::text,''),true);
 execute format('set local role %I',p_role);
 execute p_sql;
 get diagnostics n=row_count;
 execute 'reset role';
 return 'OK|'||n;
exception when others then return 'ERR|'||sqlstate||'|'||sqlerrm;
end$f$;
create function pg_temp.err(p_res text,p_code text,p_msg text) returns boolean language sql as $$ select p_res='ERR|'||p_code||'|'||p_msg $$;
create function pg_temp.errlike(p_res text,p_code text,p_frag text) returns boolean language sql as $$ select p_res like 'ERR|'||p_code||'|%'||p_frag||'%' $$;
create function pg_temp.j(p_res text) returns jsonb language sql as $$ select case when p_res like 'OK|%' then substr(p_res,4)::jsonb end $$;
create function pg_temp.pth(p_owner uuid,p_prop uuid,p_ext text default 'jpg') returns text language sql as $$ select p_owner||'/'||p_prop||'/'||gen_random_uuid()||'.'||p_ext $$;
create function pg_temp.up(p_owner uuid,p_path text) returns text language sql as $$
 select pg_temp.acx(p_owner,'authenticated',format('insert into storage.objects(bucket_id,name,owner) values(%L,%L,%L)','property-panoramas',p_path,p_owner)) $$;
create function pg_temp.setp(p_uid uuid,p_prop uuid,p_side text,p_path text,p_w integer,p_h integer,p_role text default 'authenticated') returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.set_property_panorama(%L,%L,%L,%L,%L)::text',p_prop,p_side,p_path,p_w,p_h)) $$;
create function pg_temp.remp(p_uid uuid,p_prop uuid,p_side text,p_role text default 'authenticated') returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select public.remove_property_panorama(%L,%L)::text',p_prop,p_side)) $$;
create function pg_temp.seen(p_uid uuid,p_role text,p_prop uuid) returns text language sql as $$
 select pg_temp.act(p_uid,p_role,format('select count(*) from public.property_panoramas where property_id=%L',p_prop)) $$;

do $c$
declare
 ow uuid:=gen_random_uuid(); ow2 uuid:=gen_random_uuid(); nt uuid:=gen_random_uuid(); ad uuid:=gen_random_uuid(); rt uuid:=gen_random_uuid(); tp uuid:=gen_random_uuid(); ou uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); pn uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid(); pu uuid:=gen_random_uuid(); pt uuid:=gen_random_uuid();
 f1 text; f2 text; f3 text; f4 text; b1 text; b2 text; x2 text; res text; r2 text; n int; pre bigint; inspect_msg text;
begin
 -- Fixture (superuser). ow, ow2, rt, ad are Tier 1; nt, tp, ou are not. ad is an admin.
 insert into public.profiles(id,tier1_verified_at,is_admin) values(ow,now(),false),(ow2,now(),false),(rt,now(),false),(ad,now(),true),(nt,null,false),(tp,null,false),(ou,null,false);
 insert into public.properties(id,landlord_id) values(p,ow),(p2,ow2),(pn,nt),(p3,ow),(pu,ow),(pt,ow);
 insert into public.listings(property_id,landlord_id,status,published_at) values(p,ow,'active',now()),(pu,ow,'draft',null);
 insert into public.tenancies(property_id,tenant_id,landlord_id,status) values(p2,tp,ow2,'active'),(pt,tp,ow,'active');
 insert into rentlease_unfinished_posts.records(property_id,owner_id) values(pu,ow),(pt,ow);

 -- 1. Set, replace and remove
 f1:=pg_temp.pth(ow,p);f2:=pg_temp.pth(ow,p);f3:=pg_temp.pth(ow,p);f4:=pg_temp.pth(ow,p);b1:=pg_temp.pth(ow,p,'png');b2:=pg_temp.pth(ow,p,'webp');
 perform pg_temp.chk('1a owner can upload an object into the own folder',pg_temp.up(ow,f1)='OK|1' and pg_temp.up(ow,f2)='OK|1' and pg_temp.up(ow,f3)='OK|1' and pg_temp.up(ow,f4)='OK|1' and pg_temp.up(ow,b1)='OK|1' and pg_temp.up(ow,b2)='OK|1','');
 res:=pg_temp.setp(ow,p,'front',f1,4000,1000);
 perform pg_temp.chk('1b set front returns side, path and no replaced path',pg_temp.j(res)->>'side'='front' and pg_temp.j(res)->>'storage_path'=f1 and (pg_temp.j(res)->'replaced_path')='null'::jsonb,res);
 perform pg_temp.chk('1c the row holds the size',(select width||'x'||height from public.property_panoramas where property_id=p and side='front')='4000x1000','');
 res:=pg_temp.setp(ow,p,'front',f2,4000,1000);
 perform pg_temp.chk('1d replacing front returns the previous path',pg_temp.j(res)->>'replaced_path'=f1 and (select count(*) from public.property_panoramas where property_id=p)=1,res);
 perform pg_temp.chk('1e replacing keeps one row and the new path',(select storage_path from public.property_panoramas where property_id=p and side='front')=f2,'');
 res:=pg_temp.setp(ow,p,'front',f2,4000,1000);
 perform pg_temp.chk('1f setting the same path again is not a replacement',(pg_temp.j(res)->'replaced_path')='null'::jsonb,res);
 res:=pg_temp.setp(ow,p,'back',b1,3000,1000);
 perform pg_temp.chk('1g exactly 3:1 is accepted, back side',pg_temp.j(res)->>'side'='back' and (select count(*) from public.property_panoramas where property_id=p)=2,res);
 res:=pg_temp.setp(ow,p,'back',b2,16384,5000);
 perform pg_temp.chk('1h width 16384 is accepted and returns the replaced back path',pg_temp.j(res)->>'replaced_path'=b1,res);
 res:=pg_temp.remp(ow,p,'back');
 perform pg_temp.chk('1i remove returns the removed path',pg_temp.j(res)->>'side'='back' and pg_temp.j(res)->>'removed_path'=b2 and (select count(*) from public.property_panoramas where property_id=p and side='back')=0,res);
 res:=pg_temp.remp(ow,p,'back');
 perform pg_temp.chk('1j removing an empty side is idempotent',(pg_temp.j(res)->'removed_path')='null'::jsonb,res);
 perform pg_temp.chk('1k remove never deletes the file',exists(select 1 from storage.objects where bucket_id='property-panoramas' and name=b2),'');

 -- 2. Denials: 42501
 perform pg_temp.chk('2a another owner cannot set',pg_temp.err(pg_temp.setp(ow2,p,'front',f3,4000,1000),'42501','Owned active property required'),pg_temp.setp(ow2,p,'front',f3,4000,1000));
 perform pg_temp.chk('2b another owner cannot remove',pg_temp.err(pg_temp.remp(ow2,p,'front'),'42501','Owned active property required'),'');
 perform pg_temp.chk('2c an owner who is not Tier 1 cannot set',pg_temp.err(pg_temp.setp(nt,pn,'front',pg_temp.pth(nt,pn),4000,1000),'42501','Tier 1 active landlord required'),'');
 perform pg_temp.chk('2d an owner who is not Tier 1 cannot remove',pg_temp.err(pg_temp.remp(nt,pn,'front'),'42501','Tier 1 active landlord required'),'');
 res:=pg_temp.setp(null,p,'front',f3,4000,1000,'anon');
 perform pg_temp.chk('2e anon cannot set',pg_temp.errlike(res,'42501','permission denied for function set_property_panorama'),res);
 res:=pg_temp.remp(null,p,'front','anon');
 perform pg_temp.chk('2f anon cannot remove',pg_temp.errlike(res,'42501','permission denied for function remove_property_panorama'),res);
 res:=pg_temp.setp(ow,p,'front',f3,4000,1000,'service_role');
 perform pg_temp.chk('2g service_role cannot set',pg_temp.errlike(res,'42501','permission denied for function set_property_panorama'),res);
 perform pg_temp.chk('2h the ownership check runs before input checks (bad side by a non-owner is 42501)',pg_temp.err(pg_temp.setp(ow2,p,'left',f3,4000,1000),'42501','Owned active property required'),'');
 perform pg_temp.chk('2i denied calls changed nothing',(select storage_path from public.property_panoramas where property_id=p and side='front')=f2,'');

 -- 3. Each exact 22023 message
 perform pg_temp.chk('3a side must be front or back',pg_temp.err(pg_temp.setp(ow,p,'left',f3,4000,1000),'22023','Side must be front or back') and pg_temp.err(pg_temp.setp(ow,p,null,f3,4000,1000),'22023','Side must be front or back') and pg_temp.err(pg_temp.remp(ow,p,'up'),'22023','Side must be front or back'),'');
 perform pg_temp.chk('3b invalid path: another owner folder',pg_temp.err(pg_temp.setp(ow,p,'back',pg_temp.pth(ow2,p),4000,1000),'22023','Invalid panorama path'),'');
 perform pg_temp.chk('3c invalid path: another property folder',pg_temp.err(pg_temp.setp(ow,p,'back',pg_temp.pth(ow,p3),4000,1000),'22023','Invalid panorama path'),'');
 perform pg_temp.chk('3d invalid path: name is not a uuid',pg_temp.err(pg_temp.setp(ow,p,'back',ow||'/'||p||'/photo.jpg',4000,1000),'22023','Invalid panorama path'),'');
 perform pg_temp.chk('3e invalid path: extension, null and extra folder',pg_temp.err(pg_temp.setp(ow,p,'back',pg_temp.pth(ow,p,'gif'),4000,1000),'22023','Invalid panorama path') and pg_temp.err(pg_temp.setp(ow,p,'back',null,4000,1000),'22023','Invalid panorama path') and pg_temp.err(pg_temp.setp(ow,p,'back',ow||'/'||p||'/x/'||gen_random_uuid()||'.jpg',4000,1000),'22023','Invalid panorama path'),'');
 perform pg_temp.chk('3f upload not found',pg_temp.err(pg_temp.setp(ow,p,'back',pg_temp.pth(ow,p),4000,1000),'22023','Upload not found'),'');
 perform pg_temp.chk('3g must be at least 3:1 wide',pg_temp.err(pg_temp.setp(ow,p,'back',f3,2999,1000),'22023','Panorama must be at least 3:1 wide'),pg_temp.setp(ow,p,'back',f3,2999,1000));
 perform pg_temp.chk('3h too wide',pg_temp.err(pg_temp.setp(ow,p,'back',f3,16385,3000),'22023','Panorama is too wide'),'');
 perform pg_temp.chk('3i size is required (extra message)',pg_temp.err(pg_temp.setp(ow,p,'back',f3,null,1000),'22023','Panorama size is required') and pg_temp.err(pg_temp.setp(ow,p,'back',f3,4000,null),'22023','Panorama size is required') and pg_temp.err(pg_temp.setp(ow,p,'back',f3,0,1000),'22023','Panorama size is required') and pg_temp.err(pg_temp.setp(ow,p,'back',f3,4000,-1),'22023','Panorama size is required'),'');
 perform pg_temp.chk('3j a file already registered to another side is refused (extra message)',pg_temp.err(pg_temp.setp(ow,p,'back',f2,4000,1000),'22023','Panorama file is already in use'),'');
 perform pg_temp.chk('3k refused calls wrote no back row',(select count(*) from public.property_panoramas where property_id=p and side='back')=0,'');

 -- 4. Read policy by actor. P: owner ow, active listing. P2: owner ow2, no listing, tenancy with tp.
 x2:=pg_temp.pth(ow2,p2);
 perform pg_temp.chk('4-fixture ow2 can set a panorama on the own property',pg_temp.up(ow2,x2)='OK|1' and pg_temp.j(pg_temp.setp(ow2,p2,'front',x2,4000,1000))->>'side'='front','');
 perform pg_temp.chk('4a the owner sees the own rows',pg_temp.seen(ow,'authenticated',p)='OK|1' and pg_temp.seen(ow2,'authenticated',p2)='OK|1','');
 perform pg_temp.chk('4b an admin sees every property',pg_temp.seen(ad,'authenticated',p)='OK|1' and pg_temp.seen(ad,'authenticated',p2)='OK|1','');
 perform pg_temp.chk('4c a Tier 1 user sees a property with an active listing, not one without',pg_temp.seen(rt,'authenticated',p)='OK|1' and pg_temp.seen(rt,'authenticated',p2)='OK|0','');
 perform pg_temp.chk('4d a party to a tenancy sees that property only',pg_temp.seen(tp,'authenticated',p2)='OK|1' and pg_temp.seen(tp,'authenticated',p)='OK|0','');
 perform pg_temp.chk('4e a user who is not Tier 1 and not a party sees nothing',pg_temp.seen(ou,'authenticated',p)='OK|0' and pg_temp.seen(nt,'authenticated',p)='OK|0' and pg_temp.seen(ou,'authenticated',p2)='OK|0','');
 res:=pg_temp.seen(null,'anon',p);
 perform pg_temp.chk('4f anon has no access to the table',pg_temp.errlike(res,'42501','permission denied for table property_panoramas'),res);
 res:=pg_temp.acx(ow,'authenticated',format('insert into public.property_panoramas(property_id,side,storage_path,width,height) values(%L,%L,%L,3000,1000)',p,'back',f3));
 perform pg_temp.chk('4g clients cannot insert directly',pg_temp.errlike(res,'42501','permission denied for table property_panoramas'),res);
 perform pg_temp.chk('4h clients cannot update or delete directly',pg_temp.errlike(pg_temp.acx(ow,'authenticated',format('update public.property_panoramas set width=1 where property_id=%L',p)),'42501','permission denied') and pg_temp.errlike(pg_temp.acx(ow,'authenticated',format('delete from public.property_panoramas where property_id=%L',p)),'42501','permission denied'),'');

 -- 5. Table constraints (superuser, so only the constraints themselves can refuse)
 begin insert into public.property_panoramas(property_id,side,storage_path,width,height) values(p,'left','a/b/c.jpg',3000,1000);perform pg_temp.chk('5a side is front or back',false,'inserted');exception when others then perform pg_temp.chk('5a side is front or back',sqlstate='23514',sqlstate);end;
 begin insert into public.property_panoramas(property_id,side,storage_path,width,height) values(p,'front','a/b/c.jpg',3000,1000);perform pg_temp.chk('5b one row per property and side',false,'inserted');exception when others then perform pg_temp.chk('5b one row per property and side',sqlstate='23505',sqlstate);end;
 begin insert into public.property_panoramas(property_id,side,storage_path,width,height) values(p,'back',f2,3000,1000);perform pg_temp.chk('5c a path is stored once',false,'inserted');exception when others then perform pg_temp.chk('5c a path is stored once',sqlstate='23505',sqlstate);end;
 begin insert into public.property_panoramas(property_id,side,storage_path,width,height) values(p,'back','a/b/d.jpg',0,1000);perform pg_temp.chk('5d width must be positive',false,'inserted');exception when others then perform pg_temp.chk('5d width must be positive',sqlstate='23514',sqlstate);end;

 -- 6. Storage policies (insert, select, update, delete, cap)
 perform pg_temp.chk('6a insert refused in another owner folder',pg_temp.errlike(pg_temp.up(ow,ow2||'/'||p2||'/'||gen_random_uuid()||'.jpg'),'42501','row-level security'),'');
 perform pg_temp.chk('6b insert refused under the own folder for a property the user does not manage',pg_temp.errlike(pg_temp.up(ow,ow||'/'||p2||'/'||gen_random_uuid()||'.jpg'),'42501','row-level security'),'');
 perform pg_temp.chk('6c a name that is not a uuid is refused with the policy error, not a cast error',pg_temp.errlike(pg_temp.up(ow,ow||'/'||p||'/photo.jpg'),'42501','row-level security') and pg_temp.errlike(pg_temp.up(ow,ow||'/not-a-uuid/'||gen_random_uuid()||'.jpg'),'42501','row-level security'),'');
 perform pg_temp.chk('6d wrong extension and extra folder are refused',pg_temp.errlike(pg_temp.up(ow,pg_temp.pth(ow,p,'gif')),'42501','row-level security') and pg_temp.errlike(pg_temp.up(ow,ow||'/'||p||'/x/'||gen_random_uuid()||'.jpg'),'42501','row-level security'),'');
 perform pg_temp.chk('6e anon cannot insert',pg_temp.errlike(pg_temp.acx(null,'anon',format('insert into storage.objects(bucket_id,name) values(%L,%L)','property-panoramas',pg_temp.pth(ow,p))),'42501','row-level security'),'');
 perform pg_temp.chk('6f the owner sees the own objects, another owner does not',pg_temp.act(ow,'authenticated',format('select count(*) from storage.objects where name=%L',f2))='OK|1' and pg_temp.act(ow2,'authenticated',format('select count(*) from storage.objects where name=%L',f2))='OK|0' and pg_temp.act(null,'anon',format('select count(*) from storage.objects where name=%L',f2))='OK|0','');
 pre:=(select count(*) from storage.objects where bucket_id='property-panoramas' and name=f3);
 res:=pg_temp.acx(ow,'authenticated',format('update storage.objects set metadata=%L::jsonb,name=name where name=%L','{"x":1}',f3));
 perform pg_temp.chk('6g update of a panorama object changes nothing (restrictive policy)',res='OK|0' and (select metadata from storage.objects where name=f3) is null,res);
 perform pg_temp.chk('6h the restrictive update policy leaves other buckets alone',pg_temp.acx(ow,'authenticated',format('insert into storage.objects(bucket_id,name,owner) values(%L,%L,%L)','avatars',ow||'/a.png',ow))='OK|1' and pg_temp.acx(ow,'authenticated',format('update storage.objects set metadata=%L::jsonb where bucket_id=%L',  '{"ok":1}','avatars'))='OK|1','');
 res:=pg_temp.acx(ow2,'authenticated',format('delete from storage.objects where name=%L',f3));
 perform pg_temp.chk('6i another owner cannot delete the object',res='OK|0' and exists(select 1 from storage.objects where name=f3),res);
 res:=pg_temp.acx(ow,'authenticated',format('delete from storage.objects where name=%L',f3));  -- separate statement: a later EXISTS in the same statement would use the old snapshot
 perform pg_temp.chk('6j the owner can delete an own, unregistered object',res='OK|1' and not exists(select 1 from storage.objects where name=f3),res);
 -- cap: six objects per owner/property folder, the seventh fails (folder of P3)
 n:=0;
 while n<6 loop perform pg_temp.chk('6k-'||(n+1)||' object '||(n+1)||' in the folder is accepted',pg_temp.up(ow,pg_temp.pth(ow,p3))='OK|1','');n:=n+1;end loop;
 res:=pg_temp.up(ow,pg_temp.pth(ow,p3));
 perform pg_temp.chk('6l the seventh insert in one folder fails',pg_temp.errlike(res,'42501','row-level security'),res);
 perform pg_temp.chk('6m the cap is per folder: another property folder still accepts',pg_temp.up(ow,pg_temp.pth(ow,pu))='OK|1','');
 perform pg_temp.chk('6n the cap helper is the only exposed function in its schema',(select count(*) from pg_proc x where x.pronamespace='rentlease_property_panorama'::regnamespace and has_function_privilege('authenticated',x.oid,'EXECUTE'))=1 and not has_function_privilege('anon','rentlease_property_panorama.folder_has_room(text)','EXECUTE'),'');
 res:=pg_temp.act(ow,'authenticated',format('select rentlease_property_panorama.folder_has_room(%L)',ow||'/'||p3||'/x.jpg'));
 perform pg_temp.chk('6o the helper answers false for a full folder, true for another',res='OK|false' and pg_temp.act(ow,'authenticated',format('select rentlease_property_panorama.folder_has_room(%L)',ow||'/'||p||'/x.jpg'))='OK|true',res);

 -- 7. Property delete cascades to the rows (files stay: SQL never deletes Storage objects)
 perform pg_temp.chk('7-fixture a panorama row exists on p3',pg_temp.j(pg_temp.setp(ow,p3,'front',(select name from storage.objects where name like ow||'/'||p3||'/%' limit 1),4000,1000))->>'side'='front','');
 n:=(select count(*) from storage.objects where name like ow||'/'||p3||'/%');
 delete from public.properties where id=p3;
 perform pg_temp.chk('7a deleting the property deletes its panorama rows',(select count(*) from public.property_panoramas where property_id=p3)=0,'');
 perform pg_temp.chk('7b the files are untouched by the delete',(select count(*) from storage.objects where name like ow||'/'||p3||'/%')=n and n=6,n::text);

 -- 8. rentlease_unfinished_posts.inspect: a panorama row is not protected history; a tenancy still is
 perform set_config('request.jwt.claim.sub',ow::text,true);
 insert into public.property_panoramas(property_id,side,storage_path,width,height) values(pu,'front',ow||'/'||pu||'/'||gen_random_uuid()||'.jpg',3000,1000),(pu,'back',ow||'/'||pu||'/'||gen_random_uuid()||'.jpg',3000,1000);
 perform pg_temp.chk('8a inspect returns null for an unfinished post with panorama rows',rentlease_unfinished_posts.inspect(pu) is null,coalesce(rentlease_unfinished_posts.inspect(pu),'null'));
 insert into public.property_panoramas(property_id,side,storage_path,width,height) values(pt,'front',ow||'/'||pt||'/'||gen_random_uuid()||'.jpg',3000,1000);
 inspect_msg:=rentlease_unfinished_posts.inspect(pt);
 perform pg_temp.chk('8b inspect still blocks a property with a tenancy: protected history',inspect_msg='This property has protected history or verification records and cannot be deleted.',coalesce(inspect_msg,'null'));
 perform pg_temp.chk('8c inspect still blocks a published listing',rentlease_unfinished_posts.inspect(p)='This property has publication history and cannot be deleted.','');
 perform pg_temp.chk('8d the patched body is the original plus the one allow-list entry',(select position('''price_estimates'',''property_panoramas''' in prosrc)>0 from pg_proc where oid='rentlease_unfinished_posts.inspect(uuid)'::regprocedure),'');

 -- 9. Final posture
 perform pg_temp.chk('9a the bucket contract',(select public and file_size_limit=15728640 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] and allowed_mime_types <@ array['image/jpeg','image/png','image/webp'] from storage.buckets where id='property-panoramas'),'');
 perform pg_temp.chk('9b table grants: authenticated reads only, nobody else has any',has_table_privilege('authenticated','public.property_panoramas','SELECT') and not has_table_privilege('authenticated','public.property_panoramas','INSERT,UPDATE,DELETE') and not has_table_privilege('anon','public.property_panoramas','SELECT') and not has_table_privilege('service_role','public.property_panoramas','SELECT,INSERT,UPDATE,DELETE'),'');
 perform pg_temp.chk('9c the read policy is for authenticated and uses can_view_property',(select count(*) from pg_policies where tablename='property_panoramas' and policyname='property_panoramas_read_allowed' and roles='{authenticated}' and qual like '%can_view_property(property_id)%')=1,'');
 perform pg_temp.chk('9d the four storage policies exist with the right command and permissiveness',(select string_agg(policyname||':'||cmd||':'||permissive,',' order by policyname) from pg_policies where schemaname='storage' and tablename='objects' and policyname like '%panorama%')='property_panoramas_immutable_update:UPDATE:RESTRICTIVE,storage_property_panoramas_delete_owner:DELETE:PERMISSIVE,storage_property_panoramas_insert_owner:INSERT:PERMISSIVE,storage_property_panoramas_select_owner:SELECT:PERMISSIVE','');
 perform pg_temp.chk('9e the RPCs are security definer, search_path pg_catalog, authenticated only',(select count(*) from pg_proc x where x.pronamespace='public'::regnamespace and x.proname in('set_property_panorama','remove_property_panorama') and x.prosecdef and x.proconfig=array['search_path=pg_catalog'] and has_function_privilege('authenticated',x.oid,'EXECUTE') and not has_function_privilege('anon',x.oid,'EXECUTE') and not has_function_privilege('service_role',x.oid,'EXECUTE'))=2,'');
end$c$;

-- Deliberate abort: carries the results out and guarantees the whole batch (fixture rows included) rolls back.
do $out$
declare report text; bad int;
begin
 select count(*) filter (where not ok) into bad from pa_res;
 select string_agg(n||' '||case when ok then 'PASS' else 'FAIL' end||' | '||name||case when not ok and detail is not null and detail<>'' then ' :: '||left(detail,120) else '' end,E'\n' order by n) into report from pa_res;
 raise exception E'PROPERTY_PANORAMAS_CHECKS total=% failed=%\n%',(select count(*) from pa_res),bad,report using errcode='P0001';
end$out$;
