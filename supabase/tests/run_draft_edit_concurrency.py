"""Disposable PostgreSQL draft-edit integration tests. No remote URL accepted."""
import argparse,json,subprocess,time
p=argparse.ArgumentParser();p.add_argument('--container',required=True);p.add_argument('--database',default='draft_edit_v2');a=p.parse_args()
if not a.container.startswith('rentlease-draft-edit-test-'):raise SystemExit('Disposable test container required')
info=json.loads(subprocess.check_output(['docker','inspect',a.container],text=True))[0]
if not info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.'):raise SystemExit('Local Supabase PostgreSQL 17 image required')
def cmd(sql,app=None):
 return ['docker','exec']+(['-e','PGAPPNAME='+app]if app else[])+[a.container,'psql','-U','postgres','-d',a.database,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',sql]
def run(sql,ok=True):
 q=subprocess.run(cmd(sql),capture_output=True,text=True)
 if ok and q.returncode:raise AssertionError(q.stderr)
 return q
owner='90000000-0000-4000-8000-000000000001';other='90000000-0000-4000-8000-000000000002'
prop='10000000-0000-4000-8000-000000000070';listing='20000000-0000-4000-8000-000000000070'
def auth(user=owner,tier='true',role='landlord'):
 return f"begin;set local role authenticated;set local \"request.jwt.claim.sub\"='{user}';set local \"test.tier1\"='{tier}';set local \"test.role\"='{role}';".replace('\"','"')
def call(token,title='Edited'):
 return f"select * from public.update_listing_draft('{listing}','{token}','{title}',repeat('x',30),12000);"
checks=0
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS',label,flush=True)
def scalar(sql):return run(sql).stdout.strip()
def version():return scalar(f"select edit_version from public.listings where id='{listing}'")
def reject(sql,code,label):
 q=run(sql,False);check(q.returncode!=0 and code in q.stderr,label)
run(f"insert into public.properties(id,landlord_id,floor_area_sqm,max_occupants) values('{prop}','{owner}',30,2);insert into public.property_photos(id,property_id) values('30000000-0000-4000-8000-000000000070','{prop}');insert into public.property_amenities values('{prop}',70);insert into public.property_private_locations(property_id) values('{prop}');insert into public.verification_submissions values('{owner}','{prop}','tier_3_property','approved');")
created=run(auth()+f"select listing_id from public.save_listing_draft('{prop}','Initial',repeat('x',30),12000);commit;").stdout
created_id=next(x for x in created.splitlines()if len(x)==36)
# Keep a deterministic test target, preserving production function behavior in fixture.
run(f"update public.listings set id='{listing}' where id='{created_id}'")
check(scalar(f"select count(*) from public.listings where property_id='{prop}'")=='1','legacy first-draft creation creates one draft')
run(f"delete from public.verification_submissions where property_id='{prop}'")
run(auth()+call(version(),'No Tier 3 required')+'commit;')
check(scalar(f"select status from public.listings where id='{listing}'")=='draft','draft update does not require Tier 3 approval')
run(f"insert into public.verification_submissions values('{owner}','{prop}','tier_3_property','approved')")
run(auth()+f"select * from public.update_listing_draft('{listing}','{version()}','Future date',repeat('x',30),12000,p_available_from=>'2026-12-01');commit;")
check(scalar(f"select available_from::text||'|'||completeness_score::text from public.listings where id='{listing}'")=='2026-12-01|1.0000','future availability remains valid and completeness is unchanged')
run(auth()+call(version(),'Clear optional date')+'commit;')
check(scalar(f"select available_from is null from public.listings where id='{listing}'")=='t','omitted optional date clears to SQL null')
v=version();run(auth()+call(v)+'commit;');v2=version();check(v2!=v,'successful exact update rotates token');check(scalar(f"select id||'|'||status||'|'||completeness_score::text from public.listings where id='{listing}'")==listing+'|draft|0.9500','same ID/status and completeness preserved')
reject(auth()+call(v)+'commit;','40001','stale version rejects without insert')
run(auth()+call(v2,'Second')+'commit;');check(scalar(f"select count(*) from public.listings where property_id='{prop}'")=='1','repeated update never creates a second draft')
# now() is transaction-scoped; UUID token must still detect two writes within it.
run(auth()+f"do $$declare v uuid;stamp timestamptz;begin select edit_version,updated_at into v,stamp from public.listings where id='{listing}';perform public.update_listing_draft('{listing}',v,'Third',repeat('x',30),12000);select edit_version,updated_at into v,stamp from public.listings where id='{listing}';perform public.update_listing_draft('{listing}',v,'Fourth',repeat('x',30),12000);if (select edit_version=v or updated_at<>stamp from public.listings where id='{listing}')then raise exception 'token/timestamp invariant failed';end if;end$$;commit;")
check(True,'same transaction timestamp does not repeat edit token')
v=version();run(f"delete from public.property_amenities where property_id='{prop}';insert into public.property_amenities values('{prop}',70);");check(version()==v,'derived media/amenity score refresh does not invalidate content token');reject(auth('')+call(v)+'commit;','42501','unauthenticated rejected');reject(auth(other)+call(v)+'commit;','42501','foreign owner rejected');reject(auth(tier='false')+call(v)+'commit;','42501','Tier 1 required');reject(auth(role='tenant')+call(v)+'commit;','42501','Landlord role required')
run(f"update public.properties set is_active=false where id='{prop}'");reject(auth()+call(v)+'commit;','42501','inactive property rejected');run(f"update public.properties set is_active=true where id='{prop}'")
reject(auth()+call(v).replace(listing,'20000000-0000-4000-8000-000000000071')+'commit;','42501','missing listing rejected without insert')
reject(auth()+call(v).replace('12000','-1')+'commit;','22023','invalid fields roll back')
check(scalar("select has_table_privilege('authenticated','public.listings','UPDATE')")=='f','no direct listing UPDATE granted')
check(scalar("select has_function_privilege('anon','public.update_listing_draft(uuid,uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date)','EXECUTE')")=='f','anonymous RPC execution denied')
# Parallel transactions synchronize on an observed server sleep holding the advisory lock.
def race(first_sql,second_sql,second_ok,label):
 proc=subprocess.Popen(cmd(first_sql,'rentlease_draft_edit_a'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 deadline=time.monotonic()+12
 while time.monotonic()<deadline:
  if scalar("select count(*) from pg_stat_activity where application_name='rentlease_draft_edit_a' and wait_event='PgSleep'")=='1':break
  time.sleep(.1)
 else:raise AssertionError('barrier not reached')
 q=run(second_sql,False);out,err=proc.communicate(timeout=15);assert proc.returncode==0,err
 check((q.returncode==0)if second_ok else(q.returncode!=0 and '40001'in q.stderr),label)
other_listing='20000000-0000-4000-8000-000000000072'
run(f"insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,created_at) values('{other_listing}','{prop}','{owner}','Other draft',repeat('x',30),100,now()+interval '1 day')")
run(auth()+call(version(),'Exact older draft')+'commit;')
check(scalar(f"select title from public.listings where id='{other_listing}'")=='Other draft','exact target is updated even with a newer draft for the same property')
run(f"delete from public.listings where id='{other_listing}'")
v=version();race(auth()+call(v,'Concurrent winner')+'select pg_sleep(2);commit;',auth()+call(v,'Concurrent loser')+'commit;',False,'concurrent writers: one token admits only one update')
v=version();race(auth()+call(v,'Before publish')+'select pg_sleep(2);commit;',auth()+f"select * from public.publish_listing('{listing}');commit;",True,'update then publication serialize successfully')
check(scalar(f"select title||'|'||status from public.listings where id='{listing}'")=='Before publish|active','publication preserves committed edit')
reject(auth()+call(v)+'commit;','40001','published target cannot create replacement draft')
# Test opposite lock order with a disposable reset of test fixture only.
run(f"update public.listings set status='draft' where id='{listing}'");v=version()
race(auth()+f"select * from public.publish_listing('{listing}');select pg_sleep(2);commit;",auth()+call(v)+'commit;',False,'publication first: waiting edit rejects and never inserts')
check(scalar(f"select count(*) from public.listings where property_id='{prop}'")=='1','all races retain exactly one listing')
check(scalar(f"select count(*) from public.property_photos where property_id='{prop}'")=='1' and scalar(f"select property_id from public.listings where id='{listing}'")==prop,'photos and property association unchanged')
print(f'BACKEND {checks} passed / 0 failed',flush=True)
