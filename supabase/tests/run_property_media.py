"""Local disposable PostgreSQL only; no remote connection or real listing accepted."""
import subprocess,argparse,json,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--container',required=True);a=p.parse_args()
assert a.container.startswith('rentlease-media-test-')
info=json.loads(subprocess.check_output(['docker','inspect',a.container],text=True))[0]
assert info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.')
db='media_milestone2'
def run(sql,ok=True):
 q=subprocess.run(['docker','exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',sql],capture_output=True,text=True)
 if ok: assert q.returncode==0,q.stderr
 return q
owner='90000000-0000-4000-8000-000000000001';other='90000000-0000-4000-8000-000000000002';prop='10000000-0000-4000-8000-000000000070'
photo='30000000-0000-4000-8000-000000000070';request='40000000-0000-4000-8000-000000000070'
def auth(user=owner,tier='true',role='landlord'):return f"begin;set local role authenticated;set local request.jwt.claim.sub='{user}';set local test.tier1='{tier}';set local test.role='{role}';"
def scalar(sql):return run(sql).stdout.strip()
def token():return scalar(f"select media_version from public.properties where id='{prop}'")
def command(action,version=None,req=request,args='{}'):
 return f"select public.manage_property_media('{prop}','{version or token()}','{req}','{action}','{args}'::jsonb);"
checks=0
def check(ok,label):
 global checks
 assert ok,label
 checks+=1;print('PASS MEDIA',label,flush=True)
def reject(sql,code,label):
 q=run(sql,False);check(q.returncode!=0 and code in q.stderr,label)
run(f"insert into public.properties(id,landlord_id,floor_area_sqm,max_occupants) values('{prop}','{owner}',30,2)")
reject(auth(other)+command('reserve',args='{"mime":"image/jpeg"}')+'commit;','42501','non-owner denied')
reject(auth(tier='false')+command('reserve',args='{"mime":"image/jpeg"}')+'commit;','42501','Tier 1 required')
reject(auth(role='tenant')+command('reserve',args='{"mime":"image/jpeg"}')+'commit;','42501','Landlord required')
v=token();payload=json.loads(run(auth()+command('reserve',v,args='{"mime":"image/jpeg"}')+'commit;').stdout.splitlines()[-2])
check(payload['media_version']!=v,'reservation rotates token')
path=payload['path'];pid=payload['photo_id']
reject(auth()+f"insert into storage.objects(bucket_id,name,metadata) values('property-media','{owner}/{prop}/unreserved.jpg','{{}}');commit;",'42501','unreserved upload denied')
run(auth()+f"insert into storage.objects(bucket_id,name,metadata) values('property-media','{path}','{{\"mimetype\":\"image/jpeg\",\"size\":24}}');commit;")
run(auth()+f"update storage.objects set metadata='{{}}' where name='{path}';commit;");check(scalar(f"select metadata->>'size' from storage.objects where name='{path}'")=='24','overwrite denied')
args=json.dumps({'photo_id':pid,'alt_text':'Bedroom'})
reg='40000000-0000-4000-8000-000000000071';rv=token()
run(auth()+command('register',rv,reg,args)+'commit;')
check(scalar(f"select count(*) from public.property_photos where property_id='{prop}' and is_cover")=='1','first registered photo becomes cover')
check(scalar(f"select count(*) from public.property_photos where property_id='{prop}'")=='1','real metadata created')
run(auth()+command('register',rv,reg,args)+'commit;');check(scalar(f"select count(*) from public.property_photos where property_id='{prop}'")=='1','same operation receipt prevents duplicate registration')
reject(auth()+command('alt',v,'40000000-0000-4000-8000-000000000072',args)+'commit;','40001','stale token rejected')
# Restrictive DELETE evaluates false and removes zero rows; no exception is required.
run(auth()+f"delete from storage.objects where name='{path}';commit;")
check(scalar(f"select count(*) from storage.objects where name='{path}'")=='1','registered bytes cannot be deleted directly')
reject(auth()+f"delete from public.property_photos where id='{pid}';commit;",'42501','legacy metadata delete denied')
reject(auth()+f"update public.property_photos set alt_text='bypass' where id='{pid}';commit;",'42501','legacy metadata update denied')
reject(auth()+f"select public.set_property_cover_photo('{pid}');commit;",'42501','legacy cover RPC bypass denied')
# Bring active listing to exactly 80%, with photo contribution required.
run(f"insert into public.property_private_locations(property_id) values('{prop}');insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly) values('20000000-0000-4000-8000-000000000070','{prop}','{owner}','Title',repeat('x',30),9000);update public.properties set max_occupants=null where id='{prop}';update public.listings set status='active' where property_id='{prop}'")
reject(auth()+command('remove',req='40000000-0000-4000-8000-000000000073',args=args)+'commit;','P0001','active completeness failure rolls back removal')
check(scalar(f"select count(*) from public.property_photos where id='{pid}'")=='1','rejected removal preserves metadata')
run(f"update public.listings set status='paused' where property_id='{prop}'")
run(auth()+command('remove',req='40000000-0000-4000-8000-000000000073',args=args)+'commit;')
check(scalar(f"select status from public.listings where property_id='{prop}'")=='paused','removal preserves paused status')
run(auth()+f"delete from storage.objects where name='{path}';commit;")
check(scalar(f"select count(*) from storage.objects where name='{path}'")=='0','cleanup allowed after metadata removal')
reject(auth()+f"insert into storage.objects(bucket_id,name) values('property-media','{path}');commit;",'42501','consumed path cannot be reused')
check(scalar("select has_function_privilege('anon','public.manage_property_media(uuid,uuid,uuid,text,jsonb)','EXECUTE')")=='f','anonymous command denied')
# Versioned receipt identity cannot be reused for another input.
reject(auth()+command('reserve',req=request,args='{"mime":"image/png"}')+'commit;','22023','request ID reuse with different content denied')
# Two registered PNGs exercise real atomic ordering, cover replacement and file validation.
ids=[]
for n in range(2):
 req=f'40000000-0000-4000-8000-{300+n*10:012}'
 out=run(auth()+command('reserve',req=req,args='{"mime":"image/png"}')+'commit;').stdout
 r=json.loads(next(line for line in out.splitlines() if line.startswith('{')));ids.append(r['photo_id'])
 invalid=json.dumps({'mimetype':'image/png','size':10485761})
 run(auth()+f"insert into storage.objects(bucket_id,name,metadata) values('property-media','{r['path']}','{invalid}'::jsonb);commit;")
 arg=json.dumps({'photo_id':r['photo_id'],'alt_text':'Window'})
 reject(auth()+command('register',req=f'40000000-0000-4000-8000-{301+n*10:012}',args=arg)+'commit;','22023','oversized object cannot register')
 # Trusted LOCAL fixture corrects metadata only; real app cannot overwrite immutable objects.
 run(f"update storage.objects set metadata='{json.dumps({'mimetype':'image/png','size':24})}'::jsonb where name='{r['path']}'")
 run(auth()+command('register',req=f'40000000-0000-4000-8000-{301+n*10:012}',args=arg)+'commit;')
run(auth()+command('reorder_cover',req='40000000-0000-4000-8000-000000000330',args=json.dumps({'photo_ids':ids[::-1]}))+'commit;')
check(scalar(f"select id from public.property_photos where property_id='{prop}' order by sort_order limit 1")==ids[1],'atomic order persists exact complete photo set')
check(scalar(f"select id from public.property_photos where property_id='{prop}' and is_cover")==ids[1],'order and sole first cover commit together')
reject(auth()+command('reorder',req='40000000-0000-4000-8000-000000000331',args=json.dumps({'photo_ids':[ids[0],ids[0]]}))+'commit;','40001','duplicate photo IDs rejected without partial order')
check(scalar(f"select id from public.property_photos where property_id='{prop}' and is_cover")==ids[1],'rejected reorder preserves previous cover')
run(auth()+command('cover',req='40000000-0000-4000-8000-000000000332',args=json.dumps({'photo_id':ids[1]}))+'commit;')
check(scalar(f"select id from public.property_photos where property_id='{prop}' and is_cover")==ids[1],'versioned cover picks exact owned photo')
check(scalar(f"select id from public.property_photos where property_id='{prop}' order by sort_order,created_at,id limit 1")==ids[1],'legacy explicit cover also moves photo first')
run(auth()+command('alt',req='40000000-0000-4000-8000-000000000333',args=json.dumps({'photo_id':ids[0],'alt_text':'  New text  '}))+'commit;')
check(scalar(f"select alt_text from public.property_photos where id='{ids[0]}'")=='New text','description updates only target metadata')
run(auth()+command('remove',req='40000000-0000-4000-8000-000000000334',args=json.dumps({'photo_id':ids[1]}))+'commit;')
check(scalar(f"select id from public.property_photos where property_id='{prop}' and is_cover")==ids[0],'removing cover atomically selects remaining photo')
check(scalar(f"select property_id from public.property_photos where id='{ids[0]}'")==prop,'photo property association unchanged')

# A second owner command with the same observed token must lose after the first commit.
v=token();req1='40000000-0000-4000-8000-000000000080';req2='40000000-0000-4000-8000-000000000081'
first=auth()+command('reserve',v,req1,'{"mime":"image/png"}')+'select pg_sleep(2);commit;'
proc=subprocess.Popen(['docker','exec','-e','PGAPPNAME=rentlease_media_race',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-c',first],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
deadline=time.monotonic()+12
while time.monotonic()<deadline:
 if scalar("select count(*) from pg_stat_activity where application_name='rentlease_media_race' and wait_event='PgSleep'")=='1':break
 time.sleep(.1)
else:raise AssertionError('race barrier missing')
q=run(auth()+command('reserve',v,req2,'{"mime":"image/png"}')+'commit;',False);out,err=proc.communicate(timeout=15)
check(proc.returncode==0 and q.returncode!=0 and '40001' in q.stderr,'two-session stale loser rejected after shared gate')
check(scalar(f"select count(*) from public.listings where property_id='{prop}'")=='1','no listing created by any media command')
# Pending reservation counts against capacity and can be canceled explicitly.
for n in range(8):run(auth()+command('reserve',req=f'40000000-0000-4000-8000-{100+n:012}',args='{"mime":"image/webp"}')+'commit;')
reject(auth()+command('reserve',req='40000000-0000-4000-8000-000000000200',args='{"mime":"image/jpeg"}')+'commit;','22023','ten-photo capacity includes pending intents')
reject(auth()+command('reorder',req='40000000-0000-4000-8000-000000000201',args='{"photo_ids":["bad"]}')+'commit;','40001','reorder cannot introduce foreign photo IDs')
reject(auth()+command('reserve',req='40000000-0000-4000-8000-000000000202',args='{"mime":"image/heic"}')+'commit;','22023','unsupported MIME rejected')
reject(auth()+command('alt',req='40000000-0000-4000-8000-000000000203',args='{"landlord_id":"bad"}')+'commit;','22023','unknown field rejected')
# Public raw grants remain narrowed, even if a permissive RLS policy exists.
check(scalar("select has_table_privilege('authenticated','public.property_photos','INSERT')")=='f','no legacy direct INSERT grant')
check(scalar("select has_column_privilege('authenticated','public.property_photos','alt_text','UPDATE')")=='f','no legacy column UPDATE grant')
check(scalar("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='manage_property_media' and p.proconfig=array['search_path=pg_catalog']")=='1','restricted command search path')
# Reapply ONLY the prepared follow-up in this disposable DB to test legacy cover normalization.
# These trusted test fixtures are never production records.
listing_before=scalar(f"select md5(to_jsonb(l)::text) from public.listings l where property_id='{prop}'")
run(f"update public.property_photos set is_cover=false where property_id='{prop}';insert into public.property_photos(id,property_id,sort_order,is_cover,storage_path) values('30000000-0000-4000-8000-000000000999','{prop}',99,true,'legacy-local-test-only')")
photos_before=scalar(f"select md5(string_agg((to_jsonb(p)-'is_cover')::text,'' order by id)) from public.property_photos p where property_id='{prop}'")
run(Path('supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql').read_text())
check(scalar(f"select is_cover from public.property_photos where property_id='{prop}' order by sort_order,created_at,id limit 1")=='t','migration normalizes legacy cover to first saved photo')
check(scalar(f"select count(*) from public.property_photos where property_id='{prop}' and is_cover")=='1','migration leaves exactly one cover')
check(scalar(f"select md5(string_agg((to_jsonb(p)-'is_cover')::text,'' order by id)) from public.property_photos p where property_id='{prop}'")==photos_before,'normalization preserves photo IDs paths descriptions and order')
check(scalar(f"select md5(to_jsonb(l)::text) from public.listings l where property_id='{prop}'")==listing_before,'normalization preserves listing content status and publication timestamp')
print(f'MEDIA BACKEND {checks} passed / 0 failed',flush=True)
