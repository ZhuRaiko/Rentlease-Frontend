"""Synthetic disposable PG only. Does not accept database URLs or production data."""
import subprocess,argparse,json,uuid
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--container',required=True);a=p.parse_args();assert a.container.startswith('rentlease-identity-test-')
info=json.loads(subprocess.check_output(['docker','inspect',a.container],text=True))[0];assert not info.get('Mounts') and not info['HostConfig']['PortBindings'];assert info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.')
root=Path(__file__).resolve().parents[2];db='identity_milestone4'
def call(args):
 r=subprocess.run(args,capture_output=True,text=True);assert r.returncode==0,r.stderr;return r.stdout
def sql(q,ok=True):
 r=subprocess.run(['docker','exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',q],capture_output=True,text=True)
 if ok:assert r.returncode==0,r.stderr
 return r
call(['docker','exec',a.container,'createdb','-U','postgres',db])
call(['docker','exec',a.container,'mkdir','-p','/fixture'])
for fixture in (root/'supabase/test-support').glob('*.sql'):call(['docker','cp',str(fixture),a.container+':/fixture/'+fixture.name])
def load(path):
 target='/tmp/'+Path(path).name;call(['docker','cp',str(root/path),a.container+':'+target]);return call(['docker','exec',a.container,'psql','-U','postgres','-d',db,'-X','-v','ON_ERROR_STOP=1','-f',target])
call(['docker','exec',a.container,'psql','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-f','/fixture/property_media_schema.sql'])
load('supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql')
load('supabase/migrations/20261101180736_property_media_versioned_management.sql')
load('supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql')
call(['docker','exec',a.container,'psql','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-f','/fixture/property_routine_schema.sql'])
load('supabase/migrations/20261102044416_property_routine_details_update_and_tenancy_guard.sql')
call(['docker','exec',a.container,'psql','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-f','/fixture/property_identity_schema.sql'])
load('supabase/migrations/20261020134152_get_admin_verification_queue.sql');load('supabase/migrations/20261021095753_require_qualifying_tier3_document_on_approval.sql')
owner='90000000-0000-4000-8000-000000000001';other='90000000-0000-4000-8000-000000000002';prop='10000000-0000-4000-8000-000000000001';legacy='52897654-d4f8-405e-b11e-44e57b4b4007';listing='20000000-0000-4000-8000-000000000001'
def auth(user=owner,role='landlord'):return f"begin;set local role authenticated;set local request.jwt.claim.sub='{user}';set local test.tier1='true';set local test.role='{role}';"
def scalar(q):return sql(q).stdout.strip()
checks=0
def check(v,msg):
 global checks
 assert v,msg;checks+=1;print('PASS IDENTITY',msg,flush=True)
def reject(q,code,msg):
 r=sql(q,False);check(r.returncode!=0 and code in r.stderr,msg+' '+r.stderr[:80])
sql(f"set test.tier1='true';set test.role='landlord';set request.jwt.claim.sub='{owner}';insert into public.profiles(id,display_name) values('{owner}','Fixture');insert into public.properties(id,landlord_id,floor_area_sqm,max_occupants,public_location) values('{prop}','{owner}',30,2,extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326)),('{legacy}','{owner}',30,2,null);insert into public.property_private_locations(property_id,address_line_1,exact_location) values('{prop}','Fixture address',extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326));insert into public.verification_submissions(property_id,user_id,status) values('{prop}','{owner}','approved'),('{legacy}','{owner}','approved');insert into public.verification_documents(submission_id,document_type,storage_path,file_name,mime_type) select id,'land_title','{owner}/'||id::text||'/fixture.pdf','Fixture','application/pdf' from public.verification_submissions;insert into storage.objects(bucket_id,name) select 'verification-documents',storage_path from public.verification_documents;insert into public.property_amenities values('{prop}',1,null);do $$declare r jsonb;begin r:=public.manage_property_media('{prop}',(select media_version from public.properties where id='{prop}'),gen_random_uuid(),'reserve',jsonb_build_object('mime','image/jpeg'));insert into storage.objects(bucket_id,name,metadata) values('property-media',r->>'path',jsonb_build_object('mimetype','image/jpeg','size',24));perform public.manage_property_media('{prop}',(r->>'media_version')::uuid,gen_random_uuid(),'register',jsonb_build_object('photo_id',r->>'photo_id'));end$$;insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,available_from) values('{listing}','{prop}','{owner}','Fixture title',repeat('x',30),9000,current_date);update public.listings set status='active',published_at=now() where id='{listing}';")
# Legacy pending metadata with a missing object must remain incomplete, not enter review.
legacy_pending='10000000-0000-4000-8000-000000000077'
sql(f"insert into public.properties(id,landlord_id,public_location) values('{legacy_pending}','{owner}',extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326));insert into public.property_private_locations(property_id,address_line_1,exact_location) values('{legacy_pending}','Incomplete proof fixture',extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326));insert into public.verification_submissions(user_id,property_id,status) values('{owner}','{legacy_pending}','pending');insert into public.verification_documents(submission_id,document_type,storage_path,file_name,mime_type) select id,'land_title','missing-private-object','Missing fixture.pdf','application/pdf' from public.verification_submissions where property_id='{legacy_pending}';")
load('supabase/migrations/20261102081459_property_identity_revision_verification.sql')
check(scalar(f"select ready_for_review_at is null from public.verification_submissions where property_id='{legacy_pending}'")=='t','legacy metadata without an object is not finalized evidence')
statuses=json.loads(next(x for x in sql(auth()+f"select jsonb_agg(s) from public.get_owned_property_identity_statuses(array['{prop}'::uuid,'{legacy}'::uuid]) s;commit;").stdout.splitlines() if x.startswith('[')))
check(any(r['property_id']==legacy and r['requires_repair'] and not r['verified'] for r in statuses),'owner batch read distinguishes legacy history from current binding')
reject(f"update rentlease_property_identity.revisions set provenance='rewritten' where property_id='{prop}'",'42501','revision history cannot be rewritten even through direct SQL')
check(scalar("select count(*) from pg_indexes where indexname='verification_tier3_one_open_identity'")=='1','database enforces one open Tier 3 attempt per property')
check(scalar(f"select rentlease_property_identity.verified('{prop}')")=='t','eligible observation binds qualifying approval')
check(scalar(f"select rentlease_property_identity.verified('{legacy}')")=='f','legacy approval does not create binding')
check(scalar(f"select status from public.verification_submissions where property_id='{legacy}'")=='approved','legacy approval preserved')
reject(auth()+f"select public.begin_property_identity_verification('{legacy}');commit;",'22023','legacy correction/verification fails closed')
def ctx():return json.loads(next(x for x in sql(auth()+f"select public.get_property_identity_context('{prop}');commit;").stdout.splitlines() if x.startswith('{')))
def request(c,identity=None,action='same_property_correction',op=None,q=None):
 return f"select public.manage_property_identity('{prop}','{c['edit_version']}','{op or uuid.uuid4()}','{action}',{('null' if identity is None else chr(39)+json.dumps(identity)+chr(39)+'::jsonb')},{('null' if q is None else chr(39)+q+chr(39))},{('null' if q is None else chr(39)+c['correction']['version']+chr(39))});"
c=ctx();before=scalar(f"select md5(row_to_json(x)::text) from (select id,property_id,status,published_at,title from public.listings where id='{listing}')x");proposal=dict(c['current']);proposal['floor_number']=3
op=str(uuid.uuid4());command=request(c,proposal,op=op);sql(auth()+command+'commit;');q=ctx()['correction'];check(q['status']=='draft' and ctx()['current']==c['current'],'pending correction preserves canonical identity')
sql(auth()+command+'commit;');check(scalar('select count(*) from rentlease_property_identity.corrections')=='1','idempotent request does not duplicate correction')
reject(auth(other)+request(c,proposal)+'commit;','42501','non-owner denied')
reject(auth()+request(c,proposal,action='relocation')+'commit;','22023','relocation/new asset denied')
def begin():
 c=ctx();r=c['correction']['candidate_revision_id'] if c.get('correction') and c['correction']['status'] in ['draft','submitted'] else c['current_revision_id']
 return json.loads(next(x for x in sql(auth()+f"select public.begin_property_identity_verification('{prop}','{r}');commit;").stdout.splitlines() if x.startswith('{')))
s=begin();check(s['identity_revision_id']==q['candidate_revision_id'],'submission bound to proposed revision')
canonical=json.loads(next(x for x in sql(auth()+f"select public.get_property_identity_submission('{prop}',true);commit;").stdout.splitlines() if x.startswith('{')))
check(canonical['status']=='approved' and canonical['identity_revision_id']!=s['identity_revision_id'],'canonical approval remains separate from pending correction evidence')
path=f"{owner}/{s['id']}/{uuid.uuid4()}.pdf";sql(f"insert into storage.objects(bucket_id,name) values('verification-documents','{path}')")
check(scalar(f"select count(*) from public.verification_submissions where id='{s['id']}' and ready_for_review_at is null")=='1','unfinished evidence remains unfinalized')
sql(auth()+f"select public.attach_property_identity_document('{s['id']}','land_title','{path}','Proof.pdf','application/pdf');commit;")
reject(f"delete from storage.objects where name='{path}'",'42501','finalized proof cannot be deleted')
def review_context():return json.loads(next(x for x in sql(auth(role='admin')+f"select public.get_admin_property_identity_review('{s['id']}');commit;").stdout.splitlines() if x.startswith('{')))
def decision(context,status,same=True):return f"select public.review_property_identity_verification('{s['id']}','{context['submission_version']}','{context['property_version']}','{context['correction_version']}','{status}',{str(same).lower()},null,'Fixture reason');"
rc=review_context();reject(auth()+decision(rc,'under_review')+'commit;','42501','ordinary owner cannot review')
sql(auth(role='admin')+decision(rc,'under_review')+'commit;');reject(auth(role='admin')+decision(rc,'approved')+'commit;','40001','stale review rejected')
rc=review_context();reject(auth(role='admin')+decision(rc,'approved',False)+'commit;','22023','same-asset evidence attestation required')
sql(auth(role='admin')+decision(rc,'approved')+'commit;');check(ctx()['current']['floor_number']==3 and ctx()['verified'],'approval atomically promotes and binds new evidence')
check(before==scalar(f"select md5(row_to_json(x)::text) from (select id,property_id,status,published_at,title from public.listings where id='{listing}')x"),'listing UUID status publication time preserved')
check(scalar(f"select count(*) from public.verification_submissions where property_id='{prop}' and status='approved'")=='2','prior approval history retained')
# Rejection, cancellation and resubmission use new immutable revisions, never old approvals.
c=ctx();proposal=dict(c['current']);proposal['floor_number']=4
sql(auth()+request(c,proposal)+'commit;');q=ctx()['correction'];sql(auth()+request(ctx(),action='cancel',q=q['id'])+'commit;')
check(ctx()['correction']['status']=='cancelled' and ctx()['current']['floor_number']==3,'cancellation leaves current approved identity unchanged')
reject(auth()+request(ctx(),action='cancel',q=q['id'])+'commit;','22023','terminal cancellation cannot be replayed under a new operation')
sql(auth()+request(ctx(),proposal)+'commit;');s=begin();path=f"{owner}/{s['id']}/{uuid.uuid4()}.pdf";sql(f"insert into storage.objects(bucket_id,name) values('verification-documents','{path}')")
sql(auth()+f"select public.attach_property_identity_document('{s['id']}','land_title','{path}','Proof.pdf','application/pdf');commit;")
rc=review_context();sql(auth(role='admin')+decision(rc,'under_review')+'commit;');rc=review_context();sql(auth(role='admin')+decision(rc,'rejected')+'commit;')
check(ctx()['current']['floor_number']==3 and ctx()['verified'] and ctx()['correction']['status']=='rejected','rejection preserves current binding and records terminal history')
sql(auth()+request(ctx(),proposal)+'commit;');s=begin();check(s['identity_revision_id']!=q['candidate_revision_id'],'resubmission receives a new immutable revision')
path=f"{owner}/{s['id']}/{uuid.uuid4()}.pdf";sql(f"insert into storage.objects(bucket_id,name) values('verification-documents','{path}')")
sql(auth()+f"select public.attach_property_identity_document('{s['id']}','land_title','{path}','Proof.pdf','application/pdf');commit;")
rc=review_context();sql(auth(role='admin')+decision(rc,'under_review')+'commit;');rc=review_context()
v=ctx()['edit_version'];revision=ctx()['current_revision_id']
reject(f"insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version) values('{prop}','{listing}','proposed','{v}')",'40001','future tenancy requires explicit identity revision evidence')
sql(f"insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version,accepted_identity_revision_id) values('{prop}','{listing}','proposed','{v}','{revision}')")
reject(auth(role='admin')+decision(rc,'approved')+'commit;','22023','open tenancy blocks identity promotion atomically')
check(ctx()['current']['floor_number']==3,'tenancy denial preserves canonical identity')
sql(f"update public.tenancies set status='ended' where property_id='{prop}'")
sql(auth(role='admin')+decision(review_context(),'approved')+'commit;');check(ctx()['current']['floor_number']==4,'ended tenancy permits explicit reviewed correction')
invalid=dict(ctx()['current']);invalid['floor_number']=6
reject(auth()+request(ctx(),invalid)+'commit;','22023','floor consistency enforced on server')
invalid=dict(ctx()['current']);invalid['bedrooms']=9
reject(auth()+request(ctx(),invalid)+'commit;','22023','routine fields cannot be smuggled into identity payload')
invalid=dict(ctx()['current']);invalid['address_line_1']='Corrected fixture';invalid['exact_lat']=14.41
reject(auth()+request(ctx(),invalid)+'commit;','22023','address changes cannot reuse an unconfirmed public location')
reject(f"begin;update public.properties set floor_number=1 where id='{prop}';commit;",'42501','direct canonical identity mutation rejected at transaction boundary')
reject(auth()+"select * from rentlease_property_identity.revisions;commit;",'42501','private revision table not client-readable')
reject(auth()+f"insert into public.verification_submissions(property_id,user_id,tier) values('{prop}','{owner}','tier_3_property');commit;",'42501','direct Tier 3 submission bypass denied')
reject(auth(role='admin')+f"select public.review_verification_submission('{s['id']}','approved',null,null);commit;",'22023','legacy review cannot bypass versioned Tier 3 binding')
check(scalar("select has_function_privilege('anon','public.manage_property_identity(uuid,uuid,uuid,text,jsonb,uuid,uuid)','execute')")=='f','anonymous correction denied')
# New unverified records get a real creation snapshot, not approval.
unverified='10000000-0000-4000-8000-000000000088'
sql(f"insert into public.properties(id,landlord_id,public_location) values('{unverified}','{owner}',extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326));insert into public.property_private_locations(property_id,address_line_1,exact_location) values('{unverified}','Unverified fixture',extensions.st_setsrid(extensions.st_makepoint(120.9,14.4),4326));")
uc=json.loads(next(x for x in sql(auth()+f"select public.get_property_identity_context('{unverified}');commit;").stdout.splitlines() if x.startswith('{')));uj=dict(uc['current']);uj['floor_number']=3
sql(auth()+f"select public.manage_property_identity('{unverified}','{uc['edit_version']}','{uuid.uuid4()}','same_property_correction','{json.dumps(uj)}');commit;")
check(scalar(f"select floor_number from public.properties where id='{unverified}'")=='3' and scalar(f"select rentlease_property_identity.verified('{unverified}')")=='f','unverified correction applies without inventing approval')
# Initial verification can be resumed but freezes its identity before evidence is submitted.
ur=scalar(f"select revision_id from rentlease_property_identity.current_identity where property_id='{unverified}'")
sql(auth()+f"select public.begin_property_identity_verification('{unverified}','{ur}');commit;")
uv=scalar(f"select edit_version from public.properties where id='{unverified}'");uj['floor_number']=4
reject(auth()+f"select public.manage_property_identity('{unverified}','{uv}','{uuid.uuid4()}','same_property_correction','{json.dumps(uj)}');commit;",'22023','open initial verification freezes its identity target')
# Existing published status/history and photo associations remain unaffected throughout.
check(before==scalar(f"select md5(row_to_json(x)::text) from (select id,property_id,status,published_at,title from public.listings where id='{listing}')x"),'all correction paths preserve publication state')
check(scalar(f"select count(*) from public.property_photos where property_id='{prop}'")=='1','photo association preserved')
# Existing routine/media operations still work with canonical identity triggers installed.
prior=ctx()['current'];v=ctx()['edit_version']
sql(auth()+f"select public.update_property_details('{prop}','{v}','{uuid.uuid4()}',2::smallint,1::numeric,30::numeric,2::smallint,5::smallint,'furnished',array[1]::bigint[],'Fixture entrance');commit;")
check(ctx()['current']==prior and ctx()['verified'],'routine update preserves current identity binding with new triggers')
photo=scalar(f"select id from public.property_photos where property_id='{prop}' limit 1");mv=scalar(f"select media_version from public.properties where id='{prop}'")
sql(auth()+f"select public.manage_property_media('{prop}','{mv}','{uuid.uuid4()}','alt','{{\"photo_id\":\"{photo}\",\"alt_text\":\"Fixture description\"}}');commit;")
check(ctx()['current']==prior and ctx()['verified'],'versioned media edit preserves identity approval')
# True two-connection contention: exactly one same-version correction request survives.
import time
c=ctx();j=dict(c['current']);j['floor_number']=5
base=['docker','exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c']
p1=subprocess.Popen(base+[auth()+request(c,j)+"select pg_sleep(1);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.25);r=sql(auth()+request(c,j)+'commit;',False);out,err=p1.communicate(timeout=10)
check(p1.returncode==0 and r.returncode!=0 and '22023' in r.stderr,'concurrent corrections have one open request')
q=ctx()['correction'];sql(auth()+request(ctx(),action='cancel',q=q['id'])+'commit;')
# Real local address/map handoff: use the exact approved 300m projection, then review.
import math
c=ctx();j=dict(c['current']);j['address_line_1']='Corrected same-asset fixture';j['exact_lat']=14.401;j['exact_lng']=120.901
x=6378137*math.radians(j['exact_lng']);y=6378137*math.asinh(math.tan(math.radians(j['exact_lat'])))
j['public_lng']=math.degrees((math.floor(x/300)*300+150)/6378137);j['public_lat']=math.degrees(math.atan(math.sinh((math.floor(y/300)*300+150)/6378137)))
sql(auth()+request(c,j)+'commit;');s=begin();path=f"{owner}/{s['id']}/{uuid.uuid4()}.pdf";sql(f"insert into storage.objects(bucket_id,name) values('verification-documents','{path}')")
sql(auth()+f"select public.attach_property_identity_document('{s['id']}','land_title','{path}','Proof.pdf','application/pdf');commit;")
sql(auth(role='admin')+decision(review_context(),'under_review')+'commit;');sql(auth(role='admin')+decision(review_context(),'approved')+'commit;')
check(ctx()['current']['address_line_1']==j['address_line_1'] and abs(ctx()['current']['exact_lat']-j['exact_lat'])<1e-10 and ctx()['verified'],'address and exact/public points promote atomically after explicit approval')
check(before==scalar(f"select md5(row_to_json(x)::text) from (select id,property_id,status,published_at,title from public.listings where id='{listing}')x"),'coordinate promotion does not change listing lifecycle')
# Promotion versus a new tenancy uses the same property gate and rejects stale consent.
c=ctx();j=dict(c['current']);j['floor_number']=5
sql(auth()+request(c,j)+'commit;');s=begin();path=f"{owner}/{s['id']}/{uuid.uuid4()}.pdf";sql(f"insert into storage.objects(bucket_id,name) values('verification-documents','{path}')")
sql(auth()+f"select public.attach_property_identity_document('{s['id']}','land_title','{path}','Proof.pdf','application/pdf');commit;")
sql(auth(role='admin')+decision(review_context(),'under_review')+'commit;');rc=review_context();v=ctx()['edit_version'];r=ctx()['current_revision_id']
p1=subprocess.Popen(base+[auth(role='admin')+decision(rc,'approved')+"select pg_sleep(1);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.25);denied=sql(f"insert into public.tenancies(property_id,listing_id,status,accepted_property_edit_version,accepted_identity_revision_id) values('{prop}','{listing}','proposed','{v}','{r}')",False);_,err=p1.communicate(timeout=10)
check(p1.returncode==0 and denied.returncode!=0 and '40001' in denied.stderr,'concurrent promotion rejects tenancy consent to the previous identity')
for fn in ['manage_property_identity(uuid,uuid,uuid,text,jsonb,uuid,uuid)','review_property_identity_verification(uuid,uuid,uuid,uuid,public.verification_status,boolean,text,text)']:
 findings=scalar(f"select count(*) from extensions.plpgsql_check_function_tb('public.{fn}'::regprocedure)")
 check(findings=='0','zero plpgsql_check findings: '+fn.split('(')[0])
print(f'FINAL: {checks} PostgreSQL identity checks passed / 0 failed')
