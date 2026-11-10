"""Disposable synthetic PostgreSQL only. No URLs, mounted backups or production rows."""
import subprocess,json,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NAME='rentlease-unfinished-test-'+uuid.uuid4().hex[:8]
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.141'
def docker(*args,ok=True):
 r=subprocess.run(['docker','--context','desktop-linux',*args],capture_output=True,text=True,encoding='utf-8')
 if ok:assert r.returncode==0,r.stderr
 return r
def sql(query,ok=True):return docker('exec',NAME,'psql','-U','postgres','-d','unfinished_posts_test','-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',query,ok=ok)
def load(path):
 docker('cp',str(ROOT/path),NAME+':/tmp/'+Path(path).name)
 return docker('exec',NAME,'psql','-U','postgres','-d','unfinished_posts_test','-X','-v','ON_ERROR_STOP=1','-f','/tmp/'+Path(path).name)
OWNER='90000000-0000-4000-8000-000000000001'
OTHER='90000000-0000-4000-8000-000000000002'
checks=0
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS',label,flush=True)
def auth(q,user=OWNER):return "begin;set local role authenticated;set local request.jwt.claim.sub='"+user+"';set local test.tier1='true';set local test.role='landlord';"+q+';commit;'
def scalar(q):return sql(q).stdout.strip()
def make():
 p=str(uuid.uuid4());sql(f"insert into public.properties(id,landlord_id,is_active) values('{p}','{OWNER}',true)");return p
def remove(p):return sql(auth(f"select public.delete_unfinished_post('{p}')"))
def denied(p):
 r=sql(auth(f"select public.delete_unfinished_post('{p}')"),False);check(r.returncode!=0,'protected deletion denied');check(scalar(f"select exists(select 1 from public.properties where id='{p}')")=='t','denied row retained')
try:
 docker('run','-d','--rm','--name',NAME,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE)
 info=json.loads(docker('inspect',NAME).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if docker('exec',NAME,'pg_isready','-U','postgres',ok=False).returncode==0:break
  time.sleep(.5)
 else:raise RuntimeError('Disposable PostgreSQL did not start')
 for _ in range(60):
  created=docker('exec',NAME,'createdb','-U','postgres','unfinished_posts_test',ok=False)
  time.sleep(.5)
  if sql('select 1',False).returncode==0:
   time.sleep(1)
   if sql('select 1',False).returncode==0:break
 else:raise RuntimeError('Fresh disposable database did not become stable')
 for f in ['listing_completeness_schema.sql','property_media_schema.sql']:
  docker('cp',str(ROOT/'supabase/test-support'/f),NAME+':/tmp/'+f)
 load('supabase/test-support/property_media_schema.sql')
 load('supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql')
 load('supabase/migrations/20261101180736_property_media_versioned_management.sql')
 load('supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql')
 load('supabase/test-support/property_routine_schema.sql')
 load('supabase/migrations/20261102044416_property_routine_details_update_and_tenancy_guard.sql')
 sql("""do $$begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end$$;
 create schema rentlease_property_identity;
 create table rentlease_property_identity.revisions(id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id),identity jsonb not null default '{}',unique(property_id,id));
 create table rentlease_property_identity.current_identity(property_id uuid primary key references public.properties(id),revision_id uuid not null,foreign key(property_id,revision_id) references rentlease_property_identity.revisions(property_id,id));
 create table rentlease_property_identity.corrections(id uuid primary key default gen_random_uuid(),property_id uuid references public.properties(id));
 create table rentlease_property_identity.repairs(property_id uuid primary key references public.properties(id));
 create function rentlease_property_identity.immutable_revision() returns trigger language plpgsql as $$begin raise exception 'Immutable' using errcode='42501';end$$;
 create trigger identity_revision_immutable before update or delete on rentlease_property_identity.revisions for each row execute function rentlease_property_identity.immutable_revision();
 create table public.admin_audit_logs(entity_id uuid);
 create table public.notifications(data jsonb);
 create table public.conversations(listing_id uuid references public.listings(id) on delete restrict);
 create table public.viewing_schedules(listing_id uuid references public.listings(id) on delete restrict);
 create table public.rental_reservations(property_id uuid references public.properties(id),listing_id uuid references public.listings(id));
 create table public.reports(reported_listing_id uuid references public.listings(id) on delete set null);
 create table public.property_nearby_places(property_id uuid references public.properties(id) on delete cascade);
 create table public.price_estimates(property_id uuid references public.properties(id) on delete cascade,listing_id uuid references public.listings(id) on delete cascade);
 """)
 migration=next(ROOT.glob('supabase/migrations/*_unfinished_property_deletion.sql'))
 load(str(migration.relative_to(ROOT)))
 check(scalar("select not has_table_privilege('authenticated','public.properties','DELETE')")=='t','no direct client delete grant')
 check(scalar("select not has_function_privilege('authenticated','public.finish_unfinished_post_cleanup(uuid,uuid)','EXECUTE')")=='t','worker completion service-only')
 check(scalar("select not has_function_privilege('anon','public.delete_unfinished_post(uuid)','EXECUTE')")=='t','anonymous RPC denied')
 p=make();r=sql(auth(f"select public.delete_unfinished_post('{p}')",OTHER),False);check(r.returncode!=0,'non-owner denied')
 r=sql("begin;set local role authenticated;set local request.jwt.claim.sub='"+OWNER+"';set local test.tier1='false';select public.delete_unfinished_post('"+p+"');commit;",False);check(r.returncode!=0,'inactive/unverified account denied')
 sql(f"insert into rentlease_property_identity.revisions(property_id) values('{p}');insert into rentlease_property_identity.current_identity select property_id,id from rentlease_property_identity.revisions where property_id='{p}'")
 remove(p);check(scalar(f"select state from rentlease_unfinished_posts.records where property_id='{p}'")=='completed','never-listed deletion complete')
 check(scalar(f"select count(*) from public.properties where id='{p}'")=='0','physical row deleted')
 check(scalar(f"select count(*) from rentlease_property_identity.revisions where property_id='{p}'")=='1','immutable revision retained with registry FK')
 check(scalar(f"select count(*) from rentlease_property_identity.current_identity where property_id='{p}'")=='1','identity binding retained')
 remove(p);check(scalar(f"select count(*) from rentlease_unfinished_posts.records where property_id='{p}'")=='1','duplicate retry idempotent')
 r=sql(f"delete from rentlease_property_identity.revisions where property_id='{p}'",False);check(r.returncode!=0,'immutable revision trigger unchanged')
 p=make();l=str(uuid.uuid4());sql(f"insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status) values('{l}','{p}','{OWNER}','Synthetic draft','Fixture',5000,'draft')")
 remove(p);check(scalar(f"select count(*) from public.listings where id='{l}'")=='0','never-published draft cascades safely')
 for table,column in [('verification_submissions','property_id'),('tenancies','property_id'),('rental_reservations','property_id'),('rentlease_property_identity.repairs','property_id'),('rentlease_property_identity.corrections','property_id')]:
  p=make();extra=",status" if table=='tenancies' else '';value=",'ended'" if table=='tenancies' else '';sql(f"insert into {table}({column}{extra}) values('{p}'{value})");denied(p)
 p=make();l=str(uuid.uuid4());sql(f"insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status,published_at) values('{l}','{p}','{OWNER}','Old listing','Fixture',5000,'archived',now());update public.listings set status='draft',published_at=null where id='{l}'")
 denied(p);check(scalar(f"select ever_published from rentlease_unfinished_posts.records where property_id='{p}'")=='t','publication latch cannot reset by clearing current status')
 for table,column in [('conversations','listing_id'),('viewing_schedules','listing_id'),('reports','reported_listing_id')]:
  p=make();l=str(uuid.uuid4());sql(f"insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,status) values('{l}','{p}','{OWNER}','Draft','Fixture',5000,'draft');insert into {table}({column}) values('{l}')");denied(p)
 p=make();sql(f"create table public.future_protected_reference(property_id uuid references public.properties(id));insert into public.future_protected_reference values('{p}')");denied(p)
 p=make();sql(f"insert into public.admin_audit_logs values('{p}')");denied(p)
 p=make();photo=str(uuid.uuid4());path=f'{OWNER}/{p}/{photo}.jpg'
 sql(f"insert into rentlease_property_edit.media_intents values('{photo}','{p}','{OWNER}','{path}','image/jpeg','reserved',now())");denied(p)
 sql(f"update rentlease_property_edit.media_intents set state='registered' where property_id='{p}';insert into storage.objects(bucket_id,name,metadata) values('property-media','{path}','{{}}');insert into public.property_photos(id,property_id,storage_path) values('{photo}','{p}','property-media/{path}')")
 remove(p);check(scalar(f"select state from rentlease_unfinished_posts.records where property_id='{p}'")=='cleanup_pending','database deletion remains pending media cleanup')
 check(scalar(f"select count(*) from storage.objects where name='{path}'")=='1','SQL never deletes Storage objects')
 check(scalar(f"select count(*) from public.property_photos where property_id='{p}'")=='0','photo metadata disposed')
 check(scalar(f"select count(*) from rentlease_property_edit.media_intents where property_id='{p}'")=='0','upload intents disposed')
 r=sql(f"select public.finish_unfinished_post_cleanup('{p}','{OWNER}')",False);check(r.returncode!=0,'cannot report completion while object exists')
 # Synthetic Storage API transport stand-in: production SQL must never do this.
 sql(f"delete from storage.objects where name='{path}';select public.finish_unfinished_post_cleanup('{p}','{OWNER}')")
 check(scalar(f"select state from rentlease_unfinished_posts.records where property_id='{p}'")=='completed','worker completes after confirmed object absence')
 check(scalar("select count(*) from pg_constraint where conname in ('revisions_property_id_fkey','current_identity_property_id_fkey','media_receipts_property_id_fkey','detail_receipts_property_id_fkey') and confrelid='rentlease_unfinished_posts.records'::regclass")=='4','all retained evidence has registry FK targets')
 # Same-key deletion requests serialize and return the same durable result.
 p=make()
 command=auth(f"select public.delete_unfinished_post('{p}');select pg_sleep(.3)")
 first=subprocess.Popen(['docker','--context','desktop-linux','exec',NAME,'psql','-U','postgres','-d','unfinished_posts_test','-XAt','-v','ON_ERROR_STOP=1','-c',command],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 time.sleep(.1)
 second=remove(p);out,err=first.communicate(timeout=15)
 check(first.returncode==0 and second.returncode==0,'concurrent duplicate requests converge without errors')
 check(scalar(f"select count(*) from rentlease_unfinished_posts.records where property_id='{p}' and state='completed'")=='1','concurrent deletion leaves one completed tombstone')
 p=make();q=make();photo=str(uuid.uuid4());path=f'{OWNER}/{p}/{photo}.jpg'
 sql(f"insert into rentlease_property_edit.media_intents values('{photo}','{p}','{OWNER}','{path}','image/jpeg','registered',now());insert into public.property_photos(id,property_id,storage_path) values('{photo}','{q}','property-media/{path}')")
 denied(p)
 p=make();sql(f"insert into storage.objects(bucket_id,name,metadata) values('property-media','{OWNER}/{p}/untracked.jpg','{{}}')");denied(p)
 # New guarded reference races behind the parent row lock, then fails its FK.
 p=make();command=auth(f"select public.delete_unfinished_post('{p}');select pg_sleep(.3)")
 first=subprocess.Popen(['docker','--context','desktop-linux','exec',NAME,'psql','-U','postgres','-d','unfinished_posts_test','-XAt','-v','ON_ERROR_STOP=1','-c',command],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 time.sleep(.1)
 added=sql(f"insert into public.rental_reservations(property_id) values('{p}')",False)
 out,err=first.communicate(timeout=15)
 check(first.returncode==0 and added.returncode!=0,'concurrent protected insert cannot become orphaned')
 print(f'{checks} isolated PostgreSQL checks passed',flush=True)
finally:
 docker('rm','-f',NAME,ok=False)
 check(docker('inspect',NAME,ok=False).returncode!=0,'disposable container removed')
