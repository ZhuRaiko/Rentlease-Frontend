"""Disposable PostgreSQL fixture only. No live URL or credentials accepted."""
import subprocess,json,argparse,time,uuid
p=argparse.ArgumentParser();p.add_argument('--container',required=True);a=p.parse_args()
assert a.container.startswith('rentlease-routine-test-')
info=json.loads(subprocess.check_output(['docker','inspect',a.container],text=True))[0]
assert info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.')
db='routine_milestone3';owner='90000000-0000-4000-8000-000000000001';other='90000000-0000-4000-8000-000000000002';prop='10000000-0000-4000-8000-000000000001';listing='20000000-0000-4000-8000-000000000001'
base=['docker','exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c']
def run(sql,ok=True):
 r=subprocess.run(base+[sql],capture_output=True,text=True)
 if ok:assert r.returncode==0,r.stderr
 return r
checks=0
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS ROUTINE',label,flush=True)
def scalar(q):return run(q).stdout.strip()
def auth(user=owner,tier='true',role='landlord'):return f"begin;set local role authenticated;set local request.jwt.claim.sub='{user}';set local test.tier1='{tier}';set local test.role='{role}';"
def token():return scalar(f"select edit_version from public.properties where id='{prop}'")
def command(v=None,req=None,bed=1,bath='1.5',area='30',cap='2',floors='5',furnish='unfurnished',amenities='array[1]::bigint[]',access="'Entrance'"):
 return f"select public.update_property_details('{prop}','{v or token()}','{req or uuid.uuid4()}',{bed}::smallint,{bath}::numeric,{area}::numeric,{cap}::smallint,{floors}::smallint,'{furnish}',{amenities},{access});"
def reject(q,code,label):
 r=run(q,False);check(r.returncode!=0 and code in r.stderr,label)
def fingerprint():return scalar(f"select md5(row_to_json(p)::text) from (select p.id,p.landlord_id,p.property_type,p.city,p.barangay,p.floor_number,p.public_location,pl.address_line_1,pl.exact_location,(select json_agg(l order by id)::text from public.listings l where l.property_id=p.id) listing,(select json_agg(v order by id)::text from public.verification_submissions v where v.property_id=p.id) verification,(select json_agg(ph order by id)::text from public.property_photos ph where ph.property_id=p.id) photos from public.properties p join public.property_private_locations pl on pl.property_id=p.id where p.id='{prop}')p")
run(f"insert into public.properties(id,landlord_id,floor_area_sqm,max_occupants) values('{prop}','{owner}',30,2);insert into public.property_private_locations(property_id,address_line_1) values('{prop}','Fixture address');insert into public.property_amenities values('{prop}',1,'Retained detail');insert into public.property_photos(id,property_id,is_cover) values(gen_random_uuid(),'{prop}',true);insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,available_from) values('{listing}','{prop}','{owner}','Title',repeat('x',30),9000,current_date);update public.listings set status='active' where id='{listing}';insert into public.verification_submissions(property_id,status) values('{prop}','approved')")
loaded=run(auth()+f"select public.get_owned_property_edit_context('{prop}');commit;").stdout
ctx=json.loads(next(line for line in loaded.splitlines() if line.startswith('{')))
check(ctx['property_id']==prop and ctx['owner_id']==owner and ctx['open_tenancy'] is False,'owner edit context hydrates exact property and tenancy state')
check('access_instructions' in ctx and 'address_line_1' not in ctx and 'exact_location' not in ctx and isinstance(ctx['catalog'],list),'private read allowlist excludes identity coordinates and address')
before=fingerprint();v=token();req=str(uuid.uuid4());sql=command(v,req)
run(auth()+sql+'commit;');check(token()!=v,'physical/private change rotates version');after=fingerprint();check(before==after,'identity/listing UUID status publication time/photo association/Tier 3 preserved')
check(scalar(f"select details from public.property_amenities where property_id='{prop}' and amenity_id=1")=='Retained detail','retained amenity details preserved')
run(auth()+sql+'commit;');check(scalar(f"select count(*) from public.listings where property_id='{prop}'")=='1','operation replay cannot create listings')
reject(auth()+command(v,bed=2)+'commit;','40001','stale edits rejected')
reject(auth(other)+command()+'commit;','42501','unrelated owner rejected')
reject(auth(tier='false')+command()+'commit;','42501','Tier 1 required')
reject(auth(role='tenant')+command()+'commit;','42501','current landlord eligibility retained')
reject(auth()+command(floors='1')+'commit;','22023','unit floor cannot exceed building floors')
reject(auth()+command(bath="'NaN'")+'commit;','22023','nonfinite bathroom count rejected')
reject(auth()+command(area='0.001')+'commit;','22023','area rounding to zero rejected')
reject(auth()+command(amenities='array[3]::bigint[]')+'commit;','22023','new inactive amenity rejected')
reject(auth()+command(amenities='array[1,1]::bigint[]')+'commit;','22023','duplicate amenities rejected')
reject(auth()+command(area='null',cap='null',amenities='array[]::bigint[]')+'commit;','P0001','active completeness violation rolls back')
check(scalar(f"select floor_area_sqm from public.properties where id='{prop}'")=='30','failed edit preserves saved values')
run(f"update public.listings set status='paused' where id='{listing}'")
reject(auth()+command(area='null',cap='null',amenities='array[]::bigint[]')+'commit;','22023','paused completeness violation rolls back')
for state in ['proposed','pending_confirmation','active']:
 run(f"insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version) values('{prop}','{listing}','{state}','{token()}')")
 for values,label in [({'bed':2},'bedrooms'),({'bath':'2'},'bathrooms'),({'area':'31'},'area'),({'cap':'3'},'capacity')]:reject(auth()+command(**values)+'commit;','22023',state+' freezes '+label)
 tenancy_before=scalar(f"select md5(string_agg(row_to_json(t)::text,'' order by id)) from public.tenancies t where property_id='{prop}'")
 run(auth()+command(furnish='furnished',floors='6',amenities='array[1,2]::bigint[]')+'commit;')
 check(tenancy_before==scalar(f"select md5(string_agg(row_to_json(t)::text,'' order by id)) from public.tenancies t where property_id='{prop}'"),state+' tenancy agreement and confirmation evidence unchanged')
 check(scalar(f"select furnishing_status from public.properties where id='{prop}'")=='furnished',state+' permits routine furnishing/building/amenity changes')
 run(f"update public.tenancies set status='ended' where property_id='{prop}'")
reject(f"insert into public.tenancies(property_id,listing_id,status) values('{prop}','{listing}','proposed')",'40001','new tenancy must explicitly accept property version')
old=token();run(auth()+command(bed=2)+'commit;')
reject(f"insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version) values('{prop}','{listing}','proposed','{old}')",'40001','stale tenancy acceptance rejected after edit')
check(scalar("select has_function_privilege('anon','public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,bigint[],text)','execute')")=='f','anonymous update denied')
# Two real connections: edit obtains gate first, stale tenancy waits then rejects.
v=token();p1=subprocess.Popen(base+[auth()+command(bed=3)+"select pg_sleep(1.5);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.4)
r=run(f"insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version) values('{prop}','{listing}','proposed','{v}')",False)
_,err=p1.communicate(timeout=10);check(p1.returncode==0,err);check(r.returncode!=0 and '40001' in r.stderr,'edit first serializes and rejects stale concurrent tenancy')
# Tenancy wins gate first: material edit waits, then sees the open row.
v=token();p1=subprocess.Popen(base+[f"begin;insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version) values('{prop}','{listing}','proposed','{v}');select pg_sleep(1.5);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.4);r=run(auth()+command(bed=4)+'commit;',False);_,err=p1.communicate(timeout=10);check(p1.returncode==0,err);check(r.returncode!=0 and '22023' in r.stderr,'tenancy first blocks concurrent material edit')
# Final count is printed after the preservation cases below.
# Additional preservation and lifecycle cases, all inside the disposable fixture.
run(f"update public.tenancies set status='ended' where property_id='{prop}'")
for state in ['ended','cancelled']:
 run(f"insert into public.tenancies(property_id,listing_id,status) values('{prop}','{listing}','{state}')")
 run(auth()+command(bed=5)+'commit;')
 check(scalar(f"select bedrooms from public.properties where id='{prop}'")=='5',state+' tenancy permits material correction')
run(f"update public.properties set is_active=false where id='{prop}'")
reject(auth()+command(bed=6)+'commit;','42501','inactive property cannot be edited')
run(f"update public.properties set is_active=true where id='{prop}'")
media=scalar(f"select media_version from public.properties where id='{prop}'")
run(auth()+command(bed=6,area='null',cap='2',amenities='array[1,2]::bigint[]')+'commit;')
check(scalar(f"select media_version from public.properties where id='{prop}'")==media,'routine update leaves media token unchanged')
edit=token();run(f"update public.property_photos set alt_text='Fixture' where property_id='{prop}'")
check(token()==edit,'photo metadata does not invalidate property token')
# Optional values clear without fabricating zero; paused completeness remains >=80.
run(auth()+command(bed=6,area='null',cap='null',floors='null',amenities='array[1,2]::bigint[]')+'commit;')
check(scalar(f"select floor_area_sqm is null and max_occupants is null and total_floors is null from public.properties where id='{prop}'")=='t','optional values persist as null when completeness permits')
old=token();req=str(uuid.uuid4());run(auth()+command(old,req,bed=6)+'commit;')
reject(auth()+command(old,req,bed=7)+'commit;','22023','receipt operation cannot be reused with different content')
# Same expected version, two updates: exactly one commits.
v=token();p1=subprocess.Popen(base+[auth()+command(v,bed=7)+"select pg_sleep(1.5);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.4);r=run(auth()+command(v,bed=8)+'commit;',False);_,err=p1.communicate(timeout=10)
check(p1.returncode==0 and r.returncode!=0 and '40001' in r.stderr,'concurrent exact-target edits have one winner')
check(scalar(f"select count(*) from public.listings where property_id='{prop}'")=='1','all edits retain one original listing')
check(scalar(f"select status from public.verification_submissions where property_id='{prop}'")=='approved','approval retained after every routine edit')
check(scalar(f"select pg_typeof(edit_version)::text from public.properties where id='{prop}'")=='uuid','opaque UUID property version')
reject(auth(other)+f"select public.get_owned_property_edit_context('{prop}');commit;",'42501','private edit context denied to unrelated user')
reject(auth()+"set transaction isolation level repeatable read;"+command()+'commit;','25001','stale-snapshot isolation rejected')
checks_sql=run("select * from extensions.plpgsql_check_function_tb('public.update_property_details(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,public.furnishing_status,bigint[],text)'::regprocedure)").stdout.strip()
check(not checks_sql,'routine RPC has zero plpgsql_check findings')
print(f'FINAL: {checks} PostgreSQL routine checks passed / 0 failed')
