"""Focused T7A review contracts with captured tenancy/review triggers. No production connection accepted."""
import subprocess,json,time,uuid,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];os.chdir(ROOT)
NAME='rentlease-reviews-'+uuid.uuid4().hex[:8]
checks=0
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
def sql(q,ok=True):
 r=run(['docker','exec','-i',NAME,'psql','-U','postgres','-d','t1','-qAt','-v','ON_ERROR_STOP=1'],input=q)
 if ok:assert r.returncode==0,r.stderr
 else:assert r.returncode!=0,'Expected rejection'
 return r.stdout.strip()
def check(condition,label):
 global checks
 assert condition,label
 checks+=1;print('PASS '+label,flush=True)
def uid():return str(uuid.uuid4())
A=uid();B=uid();X=uid()
def auth(actor):return f"set test.actor='{actor}';set role authenticated;"
def context(r,actor=A):return json.loads(sql(auth(actor)+f"select public.get_tenancy_establishment('{r}');"))
def create(r,ctx,actor=A,op=None,rent=10000):return auth(actor)+f"select public.establish_tenancy('{r}','{op or uid()}','{ctx['propertyVersion']}','{ctx['identityRevision']}',{rent},5);"
def respond(r,ctx,action,actor=B,op=None):return auth(actor)+f"select public.respond_tenancy_establishment('{r}','{op or uid()}','{ctx['setupRevision']}','{ctx['propertyVersion']}','{ctx['identityRevision']}','{action}');"
def fixture(future=0,property_id=None):
 p=property_id or uid();l=uid();c=uid();r=uid();i=uid()
 if not property_id:
  sql(f"insert into public.properties values('{p}','{A}',true,gen_random_uuid(),'apartment','imus','Fixture',1,1,35,'unfurnished');insert into rentlease_property_identity.revisions values('{i}');insert into rentlease_property_identity.current_identity values('{p}','{i}');")
 sql(f"insert into public.listings values('{l}','{p}','{A}','active',now(),null,10000,'Fixture rental',now(),null);insert into public.conversations values('{c}','{l}','{B}','{A}','open');insert into public.rental_reservations values('{r}','{c}','{l}','{p}','{B}','{A}',(now() at time zone 'Asia/Manila')::date+{future},(now() at time zone 'Asia/Manila')::date+{future}+30,'approved',now()+interval '60 days');")
 return r,p,l
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 info=json.loads(run(['docker','inspect',NAME]).stdout)[0];assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['HostConfig']['NetworkMode']=='none'
 for _ in range(60):
  if run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode==0:break
  time.sleep(.5)
 time.sleep(5)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','t1']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,active boolean not null);
 create function public.is_tier1_verified(uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and active)$$;
 create type public.tenancy_status as enum('proposed','pending_confirmation','active','ended','cancelled');
 create table public.properties(id uuid primary key,landlord_id uuid,is_active boolean,edit_version uuid,property_type text,city text,barangay text,bedrooms smallint,bathrooms numeric,floor_area_sqm numeric,furnishing_status text);
 create table public.listings(id uuid primary key,property_id uuid,landlord_id uuid,status text,published_at timestamptz,available_from date,asking_rent_monthly numeric,title text,updated_at timestamptz,archived_at timestamptz);
 create table public.conversations(id uuid primary key,listing_id uuid,tenant_id uuid,landlord_id uuid,status text);
 create table public.rental_reservations(id uuid primary key,conversation_id uuid,listing_id uuid,property_id uuid,tenant_id uuid,landlord_id uuid,move_in_date date,end_date date,status text,expires_at timestamptz);
 create schema rentlease_property_edit;create schema rentlease_reservations;create schema rentlease_property_identity;
 create table rentlease_property_identity.revisions(id uuid primary key);
 create table rentlease_property_identity.current_identity(property_id uuid primary key,revision_id uuid);
 create function rentlease_property_identity.verified(uuid) returns boolean language sql stable as $$select current_setting('test.identity',true) is distinct from 'false' and exists(select 1 from rentlease_property_identity.current_identity where property_id=$1)$$;
 """)
 catalog=json.loads((ROOT/'supabase/test-support/tenancy_establishment_baseline.json').read_text())
 columns=[]
 for col in catalog['columns']:
  columns.append(col['name']+' '+col['type']+(' not null' if not col['nullable'] else '')+(' default '+col['default'] if col['default'] else ''))
 sql('create table public.tenancies('+','.join(columns)+');alter table public.tenancies enable row level security;')
 for i,c in enumerate(catalog['constraints']):sql('alter table public.tenancies add constraint fixture_'+str(i)+' '+c+';')
 for trigger in catalog['triggers']:sql(trigger['function']);sql(trigger['definition']+';')
 sql(f"insert into public.profiles values('{A}',true),('{B}',true),('{X}',true);")
 sql((ROOT/'supabase/migrations/20261110055859_tenancy_establishment.sql').read_text())
 sql("alter table public.profiles add column account_status text not null default 'active';create function public.is_admin(uuid default auth.uid()) returns boolean language sql stable as $$select $1='"+X+"'::uuid$$;")
 review_catalog=json.loads((ROOT/'supabase/test-support/ratings_reviews_baseline.json').read_text())
 cols=[c['name']+' '+c['type']+(' not null' if c['notnull'] else '')+(' default '+c['default'] if c['default'] else '') for c in review_catalog['columns']]
 sql('create table public.reviews('+','.join(cols)+');alter table public.reviews enable row level security;')
 for i,c in enumerate(review_catalog['constraints']):sql('alter table public.reviews add constraint review_fixture_'+str(i)+' '+c+';')
 for tr in review_catalog['triggers']:sql(tr['function']);sql(tr['definition']+';')
 sql("create policy legacy_reviews_read on public.reviews for select to authenticated using(true);")
 def completed(ended=True):
  r,p,l=fixture();created=json.loads(sql(create(r,context(r))));actual=json.loads(sql(respond(r,created,'confirm')));t=actual['tenancy']['id']
  if ended:sql(f"update public.tenancies set status='ended',actual_end_date=(now() at time zone 'Asia/Manila')::date where id='{t}';")
  return t,p,l
 def rc(t,actor=B):return json.loads(sql(auth(actor)+f"select public.get_tenancy_reviews('{t}');"))
 def submit(t,kind='property',actor=B,op=None,text='Tahimik, maaliwalas ang room!'):
  return auth(actor)+f"select public.submit_tenancy_review('{t}','{op or uid()}','{kind}',4,'{text}');"
 def published(p,kind='property',actor=B):return json.loads(sql(auth(actor)+f"select public.get_published_rental_reviews('{kind}','{p}');"))
 def mod(e,status='approved',actor=X,op=None):return auth(actor)+f"select public.moderate_rental_review('{e['id']}','{op or uid()}','{e['revision']}','{status}','Internal moderation note');"
 legacy,lp,ll=completed();sql(f"insert into public.reviews(tenancy_id,reviewer_id,reviewee_id,rating,comment) values('{legacy}','{B}','{A}',5,'Legacy text');")
 sql((ROOT/'supabase/migrations/20261110125450_tenancy_ratings_reviews.sql').read_text(encoding='utf-8-sig'))
 check(rc(legacy)['own'][0]['status']=='pending' and published(lp,'property')['count']==0,'legacy user reviews are retained as pending, never automatically property ratings')
 t,p,l=completed();active,_,_=completed(False)
 sql(submit(active),False);sql(submit(t,actor=X),False);sql(submit(t,actor=A),False);check(True,'active/reservation-only, foreign and landlord property submissions rejected')
 sql(auth(X)+f"select public.get_tenancy_reviews('{t}');",False);check(True,'private eligibility is exact participant scoped')
 op=uid();first=json.loads(sql(submit(t,op=op)));check(first['own'][0]['status']=='pending' and published(p)['count']==0,'new property review remains unpublished')
 check(json.loads(sql(submit(t,op=op)))==first,'exact submission retry returns original receipt')
 sql(submit(t,op=op,text='Different body'),False);sql(submit(t),False);check(True,'conflicting retry and unauthorized duplicate rejected')
 user=json.loads(sql(submit(t,'user')));sql(submit(t,'user',A));check(sql(f"select reviewee_id from public.reviews where tenancy_id='{t}' and reviewer_id='{B}';")==A,'reciprocal target is server-derived; landlord and tenant can review only each other')
 check(len(rc(t)['own'])==2 and len(rc(t,A)['own'])==1,'authors cannot inspect another participant pending feedback')
 e=next(r for r in user['own'] if r['kind']=='property');sql(mod(e,actor=A),False);check(True,'ordinary participant cannot moderate')
 sql("create or replace function public.is_admin(uuid default auth.uid()) returns boolean language sql stable as $$select $1 in('"+A+"'::uuid,'"+X+"'::uuid)$$;")
 sql(mod(e,actor=A),False);check(True,'an Admin who owns the reviewed rental is not an independent moderator')
 sql(mod(e));approved=published(p);check(approved['count']==1 and approved['average']==4 and approved['rows'][0]['text']=='Tahimik, maaliwalas ang room!','approved property average/count use actual original multilingual text')
 check(all(k not in approved['rows'][0] for k in ['reviewer_id','tenancy_id','note','reviewerId']) and 'Internal moderation note' not in json.dumps(approved),'published projection excludes reviewer binding and internal moderation notes')
 sql(mod(e,'hidden'),False);check(True,'stale moderation revision rejected')
 current=rc(t)['own'][0];current=next(r for r in rc(t)['own'] if r['kind']=='property');old_revision=current['revision'];sql(mod(current,'hidden'));check(published(p)['count']==0,'hidden review immediately leaves count and future NLP input')
 current=next(r for r in rc(t)['own'] if r['kind']=='property');sql(mod(current));check(published(p)['rows'][0]['revision']!=old_revision,'reapproval rotates cache revision and preserves original review ID/text')
 check(published(A,'user')['count']==0,'property review text never contributes to reciprocal user ratings')
 ue=next(r for r in rc(t)['own'] if r['kind']=='user');sql(mod(ue));check(published(A,'user')['count']==1 and published(p)['count']==1,'approved property and user rating aggregates remain separate')
 sql(auth(B)+"select public.get_review_moderation();",False);sql(auth(B)+'select * from rentlease_reviews.entries;',False);sql(auth(B)+'select * from public.reviews;',False);check(True,'moderation/private/raw table access closed to ordinary clients')
 sql("update rentlease_reviews.entries set body='overwrite';",False);sql('delete from rentlease_reviews.events;',False);sql("update public.reviews set comment='overwrite';",False);check(True,'original content, user source and moderation history remain immutable')
 t2,p2,l2=completed()
 from concurrent.futures import ThreadPoolExecutor
 def competing(_):return run(['docker','exec','-i',NAME,'psql','-U','postgres','-d','t1','-qAt','-v','ON_ERROR_STOP=1'],input=submit(t2))
 with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(competing,[1,2]))
 check(sum(r.returncode==0 for r in results)==1 and len(rc(t2)['own'])==1,'concurrent submissions produce exactly one review')
 pending_two=rc(t2)['own'][0];sql(mod(pending_two,'rejected'));check(rc(t2)['own'][0]['status']=='rejected' and published(p2)['count']==0,'rejection is preserved in history and excluded from publication')
 sql('grant select on public.reviews to authenticated;');check(sql(auth(B)+'select count(*) from public.reviews;')=='0','restrictive policy prevents a future SELECT grant bypassing moderation');sql('revoke select on public.reviews from authenticated;')
 signatures=['public.get_tenancy_reviews(uuid)','public.submit_tenancy_review(uuid,uuid,text,integer,text)','public.get_published_rental_reviews(text,uuid,integer)','public.get_review_moderation(text,integer)','public.moderate_rental_review(uuid,uuid,uuid,text,text)']
 for signature in signatures:
  check(sql("select has_function_privilege('authenticated','"+signature+"','execute') and not has_function_privilege('anon','"+signature+"','execute') and exists(select 1 from pg_proc where oid='"+signature+"'::regprocedure and prosecdef and proconfig @> array['search_path=pg_catalog'] and pg_get_userbyid(proowner)='postgres');")=='t','restricted ownership and execution: '+signature.split('(')[0])
 sql(f"update public.tenancies set actual_end_date=(now() at time zone 'Asia/Manila')::date+1 where id='{t}';");check(published(p)['count']==0,'future/inconsistent completion evidence cannot remain public')
 sql(f"update public.profiles set active=false,account_status='restricted' where id='{B}';");sql(submit(t2,'user'),False);check(True,'restricted account cannot submit')
 check(sql("select has_function_privilege('anon','public.submit_tenancy_review(uuid,uuid,text,integer,text)','execute');")=='f','anonymous review entry point denied')
 print(str(checks)+' focused T7A SQL checks passed.')
finally:
 run(['docker','rm','-f',NAME]);assert run(['docker','inspect',NAME]).returncode!=0;print('Disposable container removed.')
