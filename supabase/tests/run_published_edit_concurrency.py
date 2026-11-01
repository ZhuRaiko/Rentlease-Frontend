"""Local PostgreSQL only. Runs Stage 1 regressions then Stage 2 exact content checks."""
from pathlib import Path
import runpy
base=runpy.run_path(str(Path(__file__).with_name('run_draft_edit_concurrency.py')))
run,scalar,auth,race=map(base.get,['run','scalar','auth','race'])
owner,other,prop,listing=map(base.get,['owner','other','prop','listing'])
checks=0

def check(ok,label):
 global checks
 assert ok,label
 checks+=1;print('PASS PUBLISHED',label,flush=True)
def reject(sql,code,label):
 q=run(sql,False);check(q.returncode!=0 and code in q.stderr,label)
def version():return scalar(f"select edit_version from public.listings where id='{listing}'")
def call(v,title='Updated',rent='9000',extra=''):
 return f"select id from public.update_published_listing_content('{listing}','{v}','{title}',repeat('y',40),{rent}{extra});"
before=scalar(f"select published_at::text||'|'||property_id::text from public.listings where id='{listing}'")
v=version();run(auth()+call(v,extra=",p_available_from=>'2027-02-28',p_house_rules=>'Quiet',p_rental_term=>'either',p_security_deposit_months=>2,p_advance_rent_months=>1,p_minimum_stay_months=>6::smallint")+'commit;')
check(scalar(f"select status||'|'||asking_rent_monthly::text||'|'||available_from::text from public.listings where id='{listing}'")=='active|9000|2027-02-28','active rent and future date update persisted')
check(scalar(f"select published_at::text||'|'||property_id::text from public.listings where id='{listing}'")==before,'original publication timestamp/property retained')
check(version()!=v,'server trigger rotates edit token')
reject(auth()+call(v)+'commit;','40001','stale expected version rejected')
run(auth()+call(version())+'commit;');check(scalar(f"select available_from is null from public.listings where id='{listing}'")=='t','optional availability clears')
reject(auth('')+call(version())+'commit;','42501','unauthenticated denied')
reject(auth(other)+call(version())+'commit;','42501','foreign owner denied')
reject(auth(tier='false')+call(version())+'commit;','42501','Tier 1 required')
reject(auth(role='tenant')+call(version())+'commit;','42501','Landlord required')
for value in ['-1',"'NaN'::numeric","'Infinity'::numeric"]:reject(auth()+call(version(),rent=value)+'commit;','22023','invalid finite rent '+value)
reject(auth()+call(version(),extra=',p_security_deposit_months=>-1')+'commit;','22023','negative deposit denied')
reject(auth()+call(version(),extra=',p_minimum_stay_months=>0::smallint')+'commit;','22023','nonpositive stay denied')
# Real existing completeness trigger must roll back an edit taking active below 80%.
run(f"delete from public.property_amenities where property_id='{prop}';update public.properties set max_occupants=null where id='{prop}'")
check(scalar(f"select completeness_score::text from public.listings where id='{listing}'")=='0.8000','active fixture rests at exact publication threshold')
v=version();reject(auth()+call(v).replace("repeat('y',40)","'short'")+'commit;','P0001','active below 80 percent rejected atomically')
check(version()==v,'rejected completeness change preserves token and content')
# Paused content may be incomplete; reactivation still enforces its own rules.
run(f"update public.listings set status='paused',paused_at=now() where id='{listing}'")
run(auth()+call(version()).replace("repeat('y',40)","'short'")+'commit;')
check(scalar(f"select status||'|'||completeness_score::text from public.listings where id='{listing}'")=='paused|0.6500','paused status remains paused below publication threshold')
check(scalar(f"select published_at::text||'|'||property_id::text from public.listings where id='{listing}'")==before,'paused edit keeps first publication timestamp')
# Prepare complete fixture for real independent competing writers.
run(auth()+call(version())+'commit;')
v=version();race(auth()+call(v,'Concurrent first')+'select pg_sleep(2);commit;',auth()+call(v,'Concurrent second')+'commit;',False,'published concurrent editors: stale loser rejected');check(True,'two-session published writer race')
v=version();race(f"begin;update public.listings set status='archived' where id='{listing}';select pg_sleep(2);commit;",auth()+call(v)+'commit;',False,'lifecycle before edit rejects waiting content update');check(True,'status transition invalidates waiting published editor')
for status in ['archived','rented','removed','draft']:
 run(f"update public.listings set status='{status}' where id='{listing}'")
 reject(auth()+call(version())+'commit;','40001',status+' remains outside published edit contract')
check(scalar(f"select count(*) from public.listings where property_id='{prop}'")=='1','no replacement draft/listing after any failed edit')
check(scalar(f"select count(*) from public.property_photos where property_id='{prop}'")=='1','photos unchanged')
check(scalar("select has_table_privilege('authenticated','public.listings','UPDATE')")=='f','no direct UPDATE grant')
sig='public.update_published_listing_content(uuid,uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date)'
check(scalar(f"select has_function_privilege('anon','{sig}','EXECUTE')")=='f','anon execution denied')
check(scalar(f"select has_function_privilege('authenticated','{sig}','EXECUTE')")=='t','authenticated execution allowed')
print(f'PUBLISHED BACKEND {checks} passed / 0 failed',flush=True)
