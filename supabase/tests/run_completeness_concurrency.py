"""Extra real-Postgres checks; only a disposable rentlease-completeness-test-* container.
Run after fixture + migration + pgTAP. No remote URL is accepted.
"""
import argparse,json,subprocess,time
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--container',required=True);parser.add_argument('--database',default='postgres');args=parser.parse_args()
container=args.container
if not container.startswith('rentlease-completeness-test-'):raise SystemExit('Disposable test container required')
info=json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]
if not info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.'):raise SystemExit('Supabase Postgres 17 test image required')
def command(sql,db=None,app=None):
    db=db or args.database
    argv=['docker','exec']
    if app:argv+=['-e','PGAPPNAME='+app]
    return argv+[container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-c',sql]
def query(sql,db=None):
    result=subprocess.run(command(sql,db),capture_output=True,text=True)
    if result.returncode:raise RuntimeError(result.stderr)
    return result.stdout.strip()
root=Path(__file__).resolve().parents[2]
p='10000000-0000-4000-8000-000000000070';owner='90000000-0000-4000-8000-000000000001';l='20000000-0000-4000-8000-000000000070'
try:
    query(f"insert into public.properties(id,landlord_id,floor_area_sqm,max_occupants) values('{p}','{owner}',30,2); insert into public.property_photos(id,property_id) values('30000000-0000-4000-8000-000000000070','{p}'); insert into public.property_private_locations(property_id) values('{p}'); insert into public.property_amenities values('{p}',70); insert into public.listings(id,property_id,landlord_id,title,description,asking_rent_monthly,available_from) values('{l}','{p}','{owner}','Concurrency',repeat('x',30),100,current_date); update public.listings set status='active' where id='{l}';")
    a=subprocess.Popen(command(f"begin; delete from public.property_amenities where property_id='{p}'; select pg_sleep(3); commit;",app='rentlease_completeness_a'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    deadline=time.monotonic()+15
    while time.monotonic()<deadline:
        if query("select count(*) from pg_stat_activity where application_name='rentlease_completeness_a' and wait_event='PgSleep'")=='1':break
        time.sleep(.1)
    else:raise RuntimeError('First session did not reach synchronized lock hold')
    b=subprocess.run(command(f"delete from public.property_private_locations where property_id='{p}';",app='rentlease_completeness_b'),capture_output=True,text=True)
    out,err=a.communicate(timeout=15)
    assert a.returncode==0,err
    assert b.returncode!=0 and '80% completeness' in b.stderr,b.stderr
    assert query(f"select completeness_score::text||'|'||status::text from public.listings where id='{l}'")=='0.9000|active'
    assert query(f"select count(*) from public.property_private_locations where property_id='{p}'")=='1'
    print('PASS concurrent cross-table removals: one commits, invariant-breaking transaction rolls back')
finally:
    query(f"delete from public.properties where id='{p}'")
# A bad pre-existing active listing must block/back out migration deployment atomically.
db='rentlease_completeness_invalid_fixture'
for stored_score in ['0.0000','0.2000']:
    query('create database '+db)
    try:
        fixture=(root/'supabase/test-support/listing_completeness_schema.sql').read_text()
        query(fixture,db)
        query(f"update public.listings set completeness_score={stored_score},status='active' where id='20000000-0000-4000-8000-000000000099'",db)
        migration=(root/'supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql').read_text()
        result=subprocess.run(command(migration,db),capture_output=True,text=True)
        assert result.returncode!=0 and '80% completeness' in result.stderr,result.stderr
        assert query("select count(*) from pg_namespace where nspname='rentlease_completeness'",db)=='0'
        assert query("select completeness_score from public.listings where id='20000000-0000-4000-8000-000000000099'",db)==stored_score
        print(f'PASS invalid active backfill with stored {stored_score} aborts atomically')
    finally:
        query('drop database '+db)
result=subprocess.run(command("begin isolation level repeatable read; update public.properties set floor_area_sqm=5 where id='10000000-0000-4000-8000-000000000099'; commit;"),capture_output=True,text=True)
assert result.returncode!=0 and 'require READ COMMITTED' in result.stderr,result.stderr
print('PASS unsupported stale-snapshot isolation is rejected before related writes')
print('4/4 extra backend integration checks passed; committed local fixtures cleaned up')
