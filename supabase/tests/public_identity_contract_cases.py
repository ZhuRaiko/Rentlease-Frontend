"""Consent and Storage/RLS fixtures; no live files/accounts or external connections."""
sql("""
alter table profiles add column avatar_path text,add column bio text,add column trust_score numeric(3,2),add column created_at timestamptz default now();
drop view public_profiles;
create view public_profiles as select id,display_name,avatar_path,bio,account_status,trust_score,null::text trust_badge,created_at from profiles;
grant select on public_profiles to authenticated;
alter table profiles enable row level security;
-- Match inspected production SELECT grant; own-row RLS remains authoritative.
grant select on profiles to authenticated;
grant update(display_name,avatar_path,bio) on profiles to authenticated;
create policy profiles_select_own on profiles for select to authenticated using(id=auth.uid());
create policy profiles_update_own on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text);
-- Same profile-insertion behavior as the inspected production Auth hook.
create function public.test_create_auth_profile() returns trigger language plpgsql as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)));return new;end $$;
create trigger test_auth_profile after insert on auth.users for each row execute function public.test_create_auth_profile();
create schema storage;
create table storage.buckets(id text primary key,public boolean,file_size_limit bigint,allowed_mime_types text[]);
insert into storage.buckets values('avatars',true,null,null);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,unique(bucket_id,name));
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;
alter table storage.objects enable row level security;
create policy storage_avatars_insert_own on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy storage_avatars_update_own on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy storage_avatars_delete_own on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
""")
sql(f"update profiles set display_name='Synthetic legal name',avatar_path='{A}/legacy.jpg' where id='{A}'")
load(next((root/'supabase/migrations').glob('*_public_identity_nicknames_avatars.sql')))
if a.public_profile_invoker:
 invoker_before=sql("select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p),'functions',(select jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid),proacl::text) order by oid) from pg_proc where pronamespace='public'::regnamespace),'acl',(select relacl::text from pg_class where oid='public.public_profiles'::regclass))::text")
 load(next((root/'supabase/migrations').glob('*_public_profiles_security_invoker.sql')))
# New profiles publish only acknowledged registration intent, atomically with signup.
for n,meta,expected in [
 (950,{'display_name':'Private Legal Name','first_name':'Private','last_name':'Name','public_display_name':'Friendly Renter','public_display_name_acknowledged':True,'public_identity_source':'registration_v1'},'Friendly Renter'),
 (951,{'display_name':'Private Legal Name'},None),
 (952,{'display_name':'Legacy Nickname'},None),
 (953,{'public_display_name':'No Consent','public_display_name_acknowledged':False,'public_identity_source':'registration_v1'},None),
 (954,{'public_display_name':'Wrong Origin','public_display_name_acknowledged':True},None),
 (955,{'public_display_name':'bad@example.test','public_display_name_acknowledged':True,'public_identity_source':'registration_v1'},None),
 (956,{'public_display_name':'String Ack','public_display_name_acknowledged':'true','public_identity_source':'registration_v1'},None)]:
 encoded=json.dumps(meta).replace("'","''")
 sql(f"insert into auth.users values('{uid(n)}','{encoded}'::jsonb,'synthetic@example.test')")
 value=json.loads(auth(uid(n),'select get_own_public_identity()'))
 check(value['nickname']==expected,'new signup public name requires valid explicit acknowledgement and source')
check(sql(f"select display_name from profiles where id='{uid(950)}'")=='Private Legal Name','registration private name is preserved separately from public presentation')
check(json.loads(auth(uid(950),'select get_own_public_identity()'))['nickname']=='Friendly Renter','signup display name survives later sign-in without a local draft or re-entry')
sql(f"update auth.users set raw_user_meta_data=jsonb_build_object('public_display_name','Changed Metadata','public_display_name_acknowledged',true,'public_identity_source','registration_v1') where id='{uid(950)}'")
check(json.loads(auth(uid(950),'select get_own_public_identity()'))['nickname']=='Friendly Renter','later editable Auth metadata cannot overwrite saved identity or bypass CAS')
sql(f"begin;insert into auth.users values('{uid(957)}','{{}}','synthetic@example.test');rollback")
check(sql(f"select count(*) from profiles where id='{uid(957)}'")=='0','interrupted signup transaction leaves no partially initialized profile')
sql('update conversations set status=\'open\'')
own=lambda actor:json.loads(auth(actor,'select get_own_public_identity()'))
def publish(actor,n,nick='Friendly Renter',path=None,confirmed=True,version=None):
 version=version or own(actor)['version'];name='null' if nick is None else "'"+nick.replace("'","''")+"'";photo='null' if path is None else "'"+path+"'"
 return f"select set_own_public_identity('{uid(n)}','{version}',{name},{photo},{str(confirmed).lower()})"
check(own(A)['nickname'] is None and own(A)['avatar_path'] is None,'ambiguous legacy name and photo are not auto-published')
check(json.loads(auth(B,f"select get_public_identities(array['{A}']::uuid[])"))[0]['nickname'] is None,'conversation counterpart sees no legal-name fallback')
check(denied(A,publish(A,800,confirmed=False),'22023'),'explicit public visibility confirmation required')
query=publish(A,801);r=json.loads(auth(A,query));check(r['nickname']=='Friendly Renter','user explicitly publishes public nickname')
check(json.loads(auth(A,query))['version']==r['version'],'same request retry is idempotent')
check(denied(A,publish(A,801,nick='Different',version=r['version']),'23505'),'operation UUID cannot be reused for a different request')
old=r['version'];r=json.loads(auth(A,publish(A,802,nick='Peña Rentals')));check(r['nickname']=='Peña Rentals','nickname change supports Filipino accented letters')
check(denied(A,publish(A,803,nick='Another',version=old),'40001'),'stale profile version cannot overwrite newer identity')
for nick in ['x','user@example.test','bad/name','x'*31]:check(denied(A,publish(A,804,nick=nick),'22023'),'invalid nickname length/characters rejected')
for actor in [U,S,'']:check(denied(actor,'select get_own_public_identity()'),'missing or restricted account cannot edit public identity') if actor!=U else check(own(U)['nickname'] is None,'active unverified user can manage own identity without granting verification')
check(denied(C,f"select display_name from profiles where id='{A}'") or auth(C,f"select count(*) from profiles where id='{A}'")=='0','profile-table private data remains owner-only')
check(sql(f"select display_name from profiles where id='{A}'")=='Synthetic legal name','legal/account display name remains unchanged')
check(json.loads(auth(A,publish(A,805,nick=None,confirmed=False)))['nickname'] is None,'public nickname may be cleared without republishing private display name')
for viewer in [B,C]:
 # C has a real conversation with A from the original messaging fixture.
 check(json.loads(auth(viewer,f"select get_public_identities(array['{A}']::uuid[])"))[0]['nickname'] is None,'actual counterpart gets neutral fallback after nickname removal')
check(json.loads(auth(D,f"select get_public_identities(array['{U}']::uuid[])"))==[],'nonparticipant Admin has no public-identity relationship bypass')
check(denied(A,"select get_public_identities(array_fill('ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,array[51]))",'22023'),'identity batches bounded')
path=f'{A}/public/{uid(901)}.jpg'
insert=lambda owner,path,mime='image/jpeg',size=100:f"insert into storage.objects(bucket_id,name,owner_id,metadata) values('avatars','{path}','{owner}',jsonb_build_object('mimetype','{mime}','size',{size}))"
check(denied(B,insert(B,path)),'foreign user cannot upload into another owner namespace')
check(denied(A,insert(A,f'{A}/public/../../bad.jpg')),'full avatar path traversal rejected')
auth(A,insert(A,path));check(json.loads(auth(A,f"select get_own_avatar_upload('{path}')"))['exists'],'owner can reconcile real upload metadata')
check(denied(B,f"select get_own_avatar_upload('{path}')"),'foreign upload metadata inaccessible')
r=json.loads(auth(A,publish(A,806,nick=None,path=path)));check(r['avatar_path']==path,'owner confirms uploaded public avatar')
check(json.loads(auth(B,f"select get_public_identities(array['{A}']::uuid[])"))[0]['avatar_path']==path,'eligible counterpart receives explicitly public avatar only')
auth(A,f"delete from storage.objects where name='{path}'");check(sql(f"select count(*) from storage.objects where name='{path}'")=='1','currently linked photo cannot be deleted before unlinking')
check(denied(A,f"update profiles set avatar_path='{B}/legacy.jpg' where id='{A}'"),'direct profile avatar assignment denied')
auth(A,f"update storage.objects set metadata='{{}}' where name='{path}'");check(sql(f"select metadata->>'mimetype' from storage.objects where name='{path}'")=='image/jpeg','public files cannot be overwritten')
next_path=f'{A}/public/{uid(902)}.png';auth(A,insert(A,next_path,'image/png'))
json.loads(auth(A,publish(A,807,nick=None,path=next_path)));auth(A,f"delete from storage.objects where name='{path}'");check(sql(f"select count(*) from storage.objects where name='{path}'")=='0','old photo may be removed after safe replacement')
json.loads(auth(A,publish(A,808,nick=None,path=None,confirmed=False)));auth(A,f"delete from storage.objects where name='{next_path}'");check(sql(f"select count(*) from storage.objects where name='{next_path}'")=='0','public avatar may be unlinked and deleted')
bad=f'{A}/public/{uid(903)}.jpg';auth(A,insert(A,bad,size=3145729));check(denied(A,publish(A,809,nick=None,path=bad),'22023'),'oversized avatar metadata rejected by profile binding')
sql(f"update storage.objects set metadata=jsonb_build_object('mimetype','text/html','size',100) where name='{bad}'");check(denied(A,publish(A,809,nick=None,path=bad),'22023'),'unsupported avatar MIME rejected')
check(sql("select file_size_limit=3145728 and allowed_mime_types=array['image/jpeg','image/png'] from storage.buckets where id='avatars'")=='t','Storage bucket size and MIME limits configured')
check(sql("select bool_and(not has_function_privilege('anon',oid,'execute')) from pg_proc where proname in('get_public_identities','get_own_public_identity','set_own_public_identity','get_own_avatar_upload')")=='t','anonymous public-identity RPC access denied')
check(auth(B,f"select coalesce(display_name,'NULL') from public_profiles where id='{A}'")==('' if a.public_profile_invoker else 'NULL'),'direct legacy view never exposes foreign legal name')
check(len(json.loads(auth(A,f"select get_conversation_messages('{cid}')")))==2,'protected messaging continues with sanitized identity projection')
if a.public_profile_invoker:
 exec(compile((root/'supabase/tests/public_profiles_invoker_contract_cases.py').read_text(encoding='utf-8'), 'public_profiles_invoker_contract_cases.py','exec'))
before=sql(f"select display_name from profiles where id='{A}'");load(root/'supabase/test-support/public_identity_rollback.sql');check(sql(f"select display_name from profiles where id='{A}'")==before,'privacy-preserving rollback retains records and legal names')
check(sql("select not has_function_privilege('authenticated','public.set_own_public_identity(uuid,uuid,text,text,boolean)','execute')")=='t','rollback disables public identity writes without restoring legacy exposure')
