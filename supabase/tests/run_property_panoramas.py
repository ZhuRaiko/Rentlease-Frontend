"""Network-isolated synthetic checks for 20261119100000_property_panoramas.sql and its two rollbacks. No hosted connection accepted.

Requires Docker. A disposable container with no network, mounts or published ports; the hosted project is never contacted.
Fixture: supabase/test-support/property_panoramas_fixture.sql (lock_owner and is_tier1_verified are the live bodies; can_view_property and
can_manage_property are semantic stubs, see that file). inspect() is extracted from the real unfinished-post migration.
Because the stubs cannot have the live md5, the runner applies a COPY of the migration with those two pins replaced by the fixture md5s, and
separately asserts that the checked-in migration carries the live pins. Everything else in the migration runs byte for byte.
Run: python supabase/tests/run_property_panoramas.py
"""
import hashlib,json,re,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-panorama-'+uuid.uuid4().hex[:8];checks=0
MIGRATION='supabase/migrations/20261119100000_property_panoramas.sql'
LIVE={'can_manage_property(uuid,uuid)':'67764c2e0245324ba5c10b56c21eaced','can_view_property(uuid,uuid)':'a871fda6e96411b0bfa2c4c68f78c6ab'}
PINS={'is_tier1_verified':'f839df2bff48c4b5880a1794b6d101d5','lock_owner':'d92dbc08d296168776d7fa49e96b321c','inspect_before':'05d843208715e6122ea53beec8165989'}
def raw(path):return (ROOT/path).read_bytes().decode('utf-8')
def md5(s):return hashlib.md5(s.replace('\r','').encode()).hexdigest()
def run(args,**kw):return subprocess.run(args,capture_output=True,**kw)
class Result:
 def __init__(self,p):self.returncode=p.returncode;self.stdout=p.stdout.decode('utf-8','replace');self.stderr=p.stderr.decode('utf-8','replace')
# Bytes, not text mode: a Windows text pipe rewrites LF as CRLF, which would change md5(prosrc).
def psql(q,db='pano'):return Result(run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d',db,'-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input=q.encode('utf-8')))
def sql(q,ok=True,db='pano'):
 r=psql(q,db);assert (r.returncode==0)==ok,(r.stderr if ok else 'Expected failure but succeeded: '+q[:140])
 return r.stdout.strip()
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
def inspect_statement():
 m=re.search(r"create function rentlease_unfinished_posts\.inspect\(p_property_id uuid\)[^$]*?\$\$.*?\$\$;",raw('supabase/migrations/20261109171826_unfinished_property_deletion.sql'),re.S|re.I)
 return m.group(0).replace('\r','')
try:
 # ---- static: the checked-in migration carries the live pins, the rollbacks carry the right md5s, no forbidden statements ----
 text=raw(MIGRATION)
 for sig,pin in LIVE.items():check(pin in text,'migration pins live '+sig)
 for label,pin in PINS.items():
  if label!='inspect_before':check(pin in text,'migration pins live '+label)
 check(PINS['inspect_before'] in text,'migration pins the original inspect body')
 check('\r' not in text,'migration file has LF line endings')
 check(re.search(r'delete\s+from\s+storage\.objects',text,re.I) is None and re.search(r'service_role[^;]*\bto\b',text,re.I) is None,'migration never deletes storage objects or grants to service_role')
 check(text.lstrip().startswith('-- PREPARED LOCAL ONLY. NOT APPLIED.'),'migration header says prepared local, not applied')
 for rb in ('property_panoramas_rollback.sql','property_panoramas_rollback_full.sql'):
  rt=raw('supabase/test-support/'+rb)
  check(re.search(r'delete\s+from\s+storage\.objects',re.sub(r'--[^\n]*','',rt),re.I) is None,rb+' never deletes storage objects in SQL')
  check('Dashboard' in rt and 'manual' in rt.lower(),rb+' describes emptying the bucket as a manual Storage step')
 # ---- container ----
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode==0:break
  time.sleep(.5)
 time.sleep(8)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','pano']);assert r.returncode==0,r.stderr
 sql(raw('supabase/test-support/property_panoramas_fixture.sql'))
 sql(inspect_statement()+"revoke all on function rentlease_unfinished_posts.inspect(uuid) from public,anon,authenticated,service_role;")
 fx=json.loads(sql("select jsonb_object_agg(p.proname,md5(replace(p.prosrc,chr(13),''))) from pg_proc p where p.oid in('public.is_tier1_verified(uuid)'::regprocedure,'rentlease_property_edit.lock_owner(uuid)'::regprocedure,'public.can_view_property(uuid,uuid)'::regprocedure,'public.can_manage_property(uuid,uuid)'::regprocedure,'rentlease_unfinished_posts.inspect(uuid)'::regprocedure)"))
 check(fx['is_tier1_verified']==PINS['is_tier1_verified'],'fixture is_tier1_verified reproduces the live pin')
 check(fx['lock_owner']==PINS['lock_owner'],'fixture lock_owner reproduces the live pin')
 check(fx['inspect']==PINS['inspect_before'],'fixture inspect reproduces the pinned original body')
 # ---- apply a copy with the two stubbed pins replaced; refuse if the pins are not where expected ----
 applied=text
 for sig,pin in LIVE.items():
  assert applied.count("'"+pin+"'")==1,'pin placement '+sig
  applied=applied.replace(pin,fx[sig.split('(')[0]])
 # a baseline drift must stop the migration: flip one live pin and expect the guard to refuse, before anything is applied
 drift=applied.replace(PINS['lock_owner'],'0'*32)
 r=psql(drift);check(r.returncode!=0 and 'lock_owner drifted' in r.stderr,'guard refuses a drifted lock_owner')
 check(sql("select to_regclass('public.property_panoramas') is null and to_regnamespace('rentlease_property_panorama') is null and not exists(select 1 from storage.buckets where id='property-panoramas')")=='t','refused migration left nothing behind')
 sql("insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('property-panoramas','property-panoramas',false,1,array['image/gif'])")
 r=psql(applied);check(r.returncode!=0 and 'Unexpected property-panoramas bucket contract; stop for review' in r.stderr,'guard refuses a bucket with a different contract')
 sql("delete from storage.buckets where id='property-panoramas'")
 sql("insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('property-panoramas','property-panoramas',true,15728640,array['image/webp','image/jpeg','image/png'])")
 sql(applied);check(sql("select count(*) from storage.buckets where id='property-panoramas'")=='1','a pre-existing bucket with the exact contract is accepted, not duplicated')
 sql("delete from storage.buckets where id='property-panoramas';drop schema rentlease_property_panorama cascade;drop table public.property_panoramas;drop function public.set_property_panorama(uuid,text,text,integer,integer);drop function public.remove_property_panorama(uuid,text);drop policy storage_property_panoramas_select_owner on storage.objects;drop policy storage_property_panoramas_delete_owner on storage.objects;drop policy property_panoramas_immutable_update on storage.objects;"+inspect_statement().replace('create function','create or replace function',1))
 check(sql("select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='rentlease_unfinished_posts.inspect(uuid)'::regprocedure")==PINS['inspect_before'],'fixture reset to the pre-migration state')
 sql(applied)   # the real apply, bucket created by the migration itself
 new_md5=sql("select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='rentlease_unfinished_posts.inspect(uuid)'::regprocedure")
 check(new_md5 in text,'patched inspect body md5 is the one pinned in the migration: '+new_md5)
 check(sql("select id||' '||public||' '||file_size_limit||' '||array_to_string(allowed_mime_types,',') from storage.buckets where id='property-panoramas'")=='property-panoramas true 15728640 image/jpeg,image/png,image/webp','bucket created with the exact contract')
 r=psql(applied);check(r.returncode!=0 and 'Room tour objects already exist' in r.stderr,'re-running the guard on an already migrated database refuses')
 # clones taken now, before any check data, for the rollback tests
 for n in ('rb1','rb2'):
  r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','pano',n]);assert r.returncode==0,r.stderr
 # ---- the checks file: one transaction, ends in a deliberate exception that carries the report ----
 r=psql('begin;'+raw('supabase/test-support/property_panoramas_checks.sql'))   # one transaction: temp tables are on commit drop
 m=re.search(r'PROPERTY_PANORAMAS_CHECKS total=(\d+) failed=(\d+)\n(.*)',r.stderr,re.S)
 check(m is not None,'checks file produced its report: '+r.stderr[:1500])
 report=m.group(3).split('CONTEXT:')[0].strip();print(report)
 total,failed=int(m.group(1)),int(m.group(2));checks+=total
 assert failed==0,f'{failed} of {total} SQL checks FAILED'
 print(f'SQL checks: {total} passed')
 # ---- rollbacks on the clones ----
 sql("insert into public.profiles(id,tier1_verified_at) values('00000000-0000-4000-8000-0000000000a1',now());insert into public.properties(id,landlord_id) values('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1');insert into rentlease_unfinished_posts.records(property_id,owner_id) values('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1');insert into storage.objects(bucket_id,name) values('property-panoramas','x/y/z.jpg')",db='rb2')
 sql("set session_replication_role=replica;insert into public.property_panoramas(property_id,side,storage_path,width,height) values('00000000-0000-4000-8000-0000000000b1','front','x/y/z.jpg',3000,1000)",db='rb2')
 hold=raw('supabase/test-support/property_panoramas_rollback.sql');full=raw('supabase/test-support/property_panoramas_rollback_full.sql')
 sql(hold,db='rb2')
 check(sql("select to_regprocedure('public.set_property_panorama(uuid,text,text,integer,integer)') is null and to_regprocedure('public.remove_property_panorama(uuid,text)') is null and (select count(*) from public.property_panoramas)=1 and exists(select 1 from storage.objects where bucket_id='property-panoramas')",db='rb2')=='t','data-retaining rollback drops only the RPCs; row and file stay')
 r=psql(hold,'rb2');check(r.returncode!=0 and 'not installed' in r.stderr,'data-retaining rollback refuses a second run')
 r=psql(full,'rb2');check(r.returncode!=0 and 'panorama rows exist' in r.stderr,'full rollback refuses while a row exists')
 sql("set session_replication_role=replica;delete from public.property_panoramas",db='rb2')
 r=psql(full,'rb2');check(r.returncode!=0 and 'still holds files' in r.stderr,'full rollback refuses while the bucket has objects')
 check(sql("select count(*) from storage.objects where bucket_id='property-panoramas'",db='rb2')=='1','full rollback did not delete the storage object')
 sql(full,db='rb1')
 check(sql("select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='rentlease_unfinished_posts.inspect(uuid)'::regprocedure",db='rb1')==PINS['inspect_before'],'full rollback restores the original inspect body')
 check(sql("select to_regclass('public.property_panoramas') is null and to_regnamespace('rentlease_property_panorama') is null and to_regprocedure('public.set_property_panorama(uuid,text,text,integer,integer)') is null and (select count(*) from pg_policies where schemaname='storage' and policyname like '%panorama%')=0",db='rb1')=='t','full rollback removes table, helper schema, RPCs and policies')
 check(sql("select count(*) from storage.buckets where id='property-panoramas'",db='rb1')=='1','full rollback leaves the bucket in place')
 check(sql("select pg_get_userbyid(proowner)||has_function_privilege('authenticated',oid,'EXECUTE')::text||prosecdef::text||proconfig::text from pg_proc where oid='rentlease_unfinished_posts.inspect(uuid)'::regprocedure",db='rb1')=='postgresfalsetrue{search_path=pg_catalog}','restored inspect keeps its posture')
 print(f'\nALL PASSED: {checks} checks (runner assertions plus SQL checks)')
except AssertionError as e:
 print('FAILED:',e);sys.exit(1)
finally:
 run(['docker','rm','-f',NAME])
