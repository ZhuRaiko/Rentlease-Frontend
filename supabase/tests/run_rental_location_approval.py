import subprocess,time
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[2])
name='rentlease-phase2c-check'
def call(args,**kwargs):return subprocess.run(args,capture_output=True,text=True,**kwargs)
def sql(text,ok=True):
 r=call(['docker','exec','-i',name,'psql','-U','postgres','-d','phase2c','-v','ON_ERROR_STOP=1','-qAt'],input=text)
 if ok and r.returncode:raise RuntimeError(r.stderr)
 if not ok and not r.returncode:raise RuntimeError('Expected denial')
 return r.stdout.strip()
try:
 r=call(['docker','run','--rm','-d','--network','none','--name',name,'-e','POSTGRES_PASSWORD=local-fixture-only','public.ecr.aws/supabase/postgres:17.6.1.155'])
 if r.returncode:raise RuntimeError(r.stderr)
 for i in range(40):
  if call(['docker','exec',name,'pg_isready','-U','postgres']).returncode==0:break
  time.sleep(.5)
 time.sleep(5)
 r=call(['docker','exec',name,'createdb','-U','postgres','-T','template0','phase2c']);assert r.returncode==0,r.stderr
 sql("""create schema if not exists extensions;create extension if not exists postgis with schema extensions;
 create schema if not exists auth;create or replace function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function public.is_tier1_verified(uuid) returns boolean language sql as $$select $1 is not null and $1<>'00000000-0000-4000-8000-000000000099'::uuid$$;
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean,edit_version uuid default gen_random_uuid(),public_location extensions.geography(point,4326),updated_at timestamptz,media_version uuid,property_type text,city text,barangay text,floor_number smallint,bedrooms smallint,furnishing_status text,parking_spaces integer);
 create table public.listings(id uuid primary key,property_id uuid,landlord_id uuid,status text,published_at timestamptz,available_from date);
 create table public.property_private_locations(property_id uuid,access_instructions text,address_line_1 text,address_line_2 text,postal_code text,exact_location extensions.geography(point,4326),updated_at timestamptz);
 create schema rentlease_property_identity;create table rentlease_property_identity.current_identity(property_id uuid,revision_id uuid,approved_submission_id uuid);
 """)
 # Actual existing feature-version rotation functions; do not replace with approximations.
 import re
 sql('create schema rentlease_property_edit;')
 routine=Path('supabase/migrations/20261102044416_property_routine_details_update_and_tenancy_guard.sql').read_text()
 for function in ['rotate_property_details','rotate_related_details']:
  sql(re.search(r'create function rentlease_property_edit\.'+function+r'\(\).*?end\$\$;',routine,re.S).group())
 sql('create trigger property_details_rotate before update on public.properties for each row execute function rentlease_property_edit.rotate_property_details();create trigger property_private_details_rotate after insert or update or delete on public.property_private_locations for each row execute function rentlease_property_edit.rotate_related_details();')
 sql(Path('supabase/migrations/20261110100000_rental_location_approval.sql').read_text())
 A='00000000-0000-4000-8000-000000000001';B='00000000-0000-4000-8000-000000000002';P='00000000-0000-4000-8000-000000000003';L='00000000-0000-4000-8000-000000000004'
 def auth(a):return f"set role authenticated;set test.actor='{a}';"
 def reset():sql('reset role')
 sql(f"insert into public.properties(id,landlord_id,is_active,public_location) values('{P}','{A}',true,extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint(13463250,1621650),3857),4326)::extensions.geography);insert into public.listings values('{L}','{P}','{A}','active',now(),null);")
 import json
 state=json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"));assert state['eligible'] and not state['approved']
 version=sql(f"select edit_version from public.properties where id='{P}'")
 project=lambda actor,listing='null',ver=None:auth(actor)+f"select public.get_rental_prediction_coordinates('{P}',{listing},'{ver or sql(f'select edit_version from public.properties where id=' + chr(39)+P+chr(39))}') is null;"
 assert sql(project(A))=='t'
 def save(yes,revision=None):return auth(A)+f"select public.set_rental_location_approval('{P}','{revision or state['revision']}',{str(yes).lower()},'rental-public-location-v1');"
 assert json.loads(sql(save(True)))['approved']
 assert sql(project(A))=='f';assert sql(project(B,f"'{L}'"))=='f'
 sql(project(B),False);sql(project('00000000-0000-4000-8000-000000000099',f"'{L}'"),False)
 assert sql(project(A,ver=A))=='t'
 assert not json.loads(sql(save(False)))['approved'];assert sql(project(A))=='t'
 sql(save(True));sql(f"update public.property_private_locations set access_instructions='x';insert into public.property_private_locations(property_id,access_instructions) values('{P}','x');")
 assert sql(project(A))=='t';sql(save(True),False)
 state=json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"));sql(save(True))
 sql(f"insert into rentlease_property_identity.current_identity(property_id,revision_id) values('{P}',gen_random_uuid());")
 assert sql(project(A))=='t'
 state=json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"));sql(save(True))
 # Unrelated feature and access-instruction changes must preserve location consent.
 before=state['revision'];old_feature=sql(f"select edit_version from public.properties where id='{P}'")
 sql(f"update public.properties set bedrooms=2,furnishing_status='furnished',parking_spaces=3 where id='{P}';update public.property_private_locations set access_instructions='Door code omitted' where property_id='{P}';update rentlease_property_identity.current_identity set approved_submission_id=gen_random_uuid() where property_id='{P}';")
 current=json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"));assert current['approved'] and current['revision']==before and current['point']
 assert sql(project(A))=='f';assert sql(project(A,ver=old_feature))=='t'
 sql(f"update public.property_private_locations set address_line_1='Changed fixture address' where property_id='{P}';")
 assert sql(project(A))=='t';sql(save(True),False)
 state=json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"));sql(save(True))
 # Invalid partial provenance must fail the database CHECK, not pass via SQL NULL logic.
 sql(f"update rentlease_rental_location.approvals set approved_revision=null where property_id='{P}';",False)
 # READ COMMITTED is mandatory for post-lock freshness, including direct RPC calls.
 sql('begin isolation level repeatable read;'+auth(A)+f"select public.get_rental_prediction_coordinates('{P}',null,'{version}');commit;",False)
 # A committed withdrawal observed after waiting on the shared property advisory lock wins.
 command='begin;'+save(False)+'select pg_sleep(0.8);commit;'
 process=subprocess.Popen(['docker','exec',name,'psql','-U','postgres','-d','phase2c','-qAt','-v','ON_ERROR_STOP=1','-c',command],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 for _ in range(40):
  if sql("select exists(select 1 from pg_locks where locktype='advisory' and granted)")=='t':break
  time.sleep(.02)
 else:raise AssertionError('Withdrawal transaction did not acquire its lock')
 assert sql(project(B,f"'{L}'"))=='t'
 _,error=process.communicate(timeout=10);assert process.returncode==0,error
 state=json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"));sql(save(True))
 # Concurrent feature edit also waits under the same lock and rejects the old feature token.
 old_feature=sql(f"select edit_version from public.properties where id='{P}'")
 command=f"begin;select pg_advisory_xact_lock(hashtextextended('{P}',0));update public.properties set bedrooms=3 where id='{P}';select pg_sleep(0.8);commit;"
 process=subprocess.Popen(['docker','exec',name,'psql','-U','postgres','-d','phase2c','-qAt','-v','ON_ERROR_STOP=1','-c',command],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 for _ in range(40):
  if sql("select exists(select 1 from pg_locks where locktype='advisory' and granted)")=='t':break
  time.sleep(.02)
 else:raise AssertionError('Edit transaction did not acquire its lock')
 assert sql(project(A,ver=old_feature))=='t'
 _,error=process.communicate(timeout=10);assert process.returncode==0,error
 assert json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"))['approved']
 sql(f"update public.properties set public_location=extensions.st_setsrid(extensions.st_makepoint(120.94,14.42),4326)::extensions.geography where id='{P}';")
 assert sql(project(A))=='t';state=json.loads(sql(auth(A)+f"select public.get_rental_location_approval('{P}');"));assert not state['eligible'];sql(save(True),False)
 sql(auth(A)+"select * from rentlease_rental_location.approvals;",False)
 assert sql("select has_function_privilege('anon','public.get_rental_prediction_coordinates(uuid,uuid,uuid)','execute')")=='f'
 sql(f"delete from public.properties where id='{P}';");assert sql('select count(*) from rentlease_rental_location.approvals')=='0'
 print('PASS: focused SQL approval, routine-edit preservation, version rotation, provenance invalidation, concurrent withdrawal/edit, authorization, isolation, grid, ACL and deletion checks.')
finally:
 call(['docker','rm','-f',name])
 assert call(['docker','inspect',name]).returncode!=0
 print('Disposable container removal confirmed.')
