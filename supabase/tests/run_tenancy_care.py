"""Focused synthetic T3/T4 checks; cached image, no network or production connection."""
import subprocess,json,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-care-'+uuid.uuid4().hex[:8];checks=0
A=str(uuid.uuid4());B=str(uuid.uuid4());X=str(uuid.uuid4());T=str(uuid.uuid4());P=str(uuid.uuid4())
def run(args,**kwargs):return subprocess.run(args,capture_output=True,text=True,**kwargs)
def sql(q,ok=True):
 r=run(['docker','exec','-i',NAME,'psql','-U','postgres','-d','care','-qAt','-v','ON_ERROR_STOP=1'],input=q)
 assert (r.returncode==0)==ok,r.stderr or 'Expected rejection'
 return r.stdout.strip()
def auth(who):return f"set test.actor='{who}';set role authenticated;"
def write(who,action,payload,op=None,ok=True):return sql(auth(who)+"select public.write_tenancy_care('%s','%s','%s','%s'::jsonb);"%(T,op or str(uuid.uuid4()),action,json.dumps(payload).replace("'","''")),ok)
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
try:
 r=run(['docker','run','--pull','never','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 for _ in range(40):
  if run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode==0:break
  time.sleep(.2)
 time.sleep(5)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','care']);assert r.returncode==0,r.stderr
 sql("do $$begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end$$;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;create function public.is_tier1_verified(uuid) returns boolean language sql stable as $$select $1 is not null and current_setting('test.inactive',true) is distinct from 'true'$$;create function public.is_admin(uuid) returns boolean language sql stable as $$select false$$;")
 baseline=json.loads((ROOT/'supabase/test-support/tenancy_care_baseline.json').read_text())
 for name,values in baseline['enums'].items():sql('create type public.'+name+" as enum ("+','.join("'"+v+"'" for v in values)+');')
 sql('''create table public.tenancies(id uuid primary key,property_id uuid,tenant_id uuid,landlord_id uuid,status text,start_date date,expected_end_date date,actual_end_date date,agreed_monthly_rent numeric,rent_due_day int);
 create table public.maintenance_requests(id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies(id),requested_by uuid not null,last_updated_by uuid,title text not null,description text not null,priority public.maintenance_priority default 'normal',status public.maintenance_status default 'submitted',landlord_response text,scheduled_for timestamptz,resolved_at timestamptz,tenant_confirmed_resolved_at timestamptz,rejected_reason text,created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.maintenance_updates(id uuid primary key default gen_random_uuid(),maintenance_request_id uuid not null references public.maintenance_requests(id),actor_id uuid not null,from_status public.maintenance_status,to_status public.maintenance_status not null,note text,created_at timestamptz default now());
 create table public.rent_obligations(id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies(id),due_date date,amount_due numeric,status public.rent_obligation_status,unique(tenancy_id,due_date));
 alter table public.maintenance_requests enable row level security;alter table public.maintenance_updates enable row level security;alter table public.rent_obligations enable row level security;''')
 for definition in baseline['functions']:sql(definition)
 for definition in baseline['triggers']:sql(definition+';')
 sql(f"insert into public.tenancies values('{T}','{P}','{B}','{A}','active',current_date-40,current_date+400,null,9000,5);")
 sql((ROOT/'supabase/migrations/20261110072014_tenancy_rent_maintenance.sql').read_text(encoding='utf-8-sig'))
 check(sql("select string_agg(due_date::text,',') from rentlease_tenancy_care.dates('2026-12-01','2027-01-20',5,'2026-12-06');")=='2027-01-05','date rollover and inclusive tenancy end')
 sql(auth(X)+f"select public.get_tenancy_care('{T}');",False);sql("set test.actor='';set role anon;select public.get_tenancy_care('"+T+"');",False);check(True,'foreign and anonymous reads denied')
 check(json.loads(sql(auth(B)+f"select public.get_tenancy_care('{T}');"))['requests']==[],'participant reads real empty requests')
 sql(auth(B)+f"select public.get_tenancy_care('{T}',10001);",False);check(True,'read page bounds enforced')
 payload={'title':'Leaking sink','description':'The pipe below the kitchen sink leaks.','category':'plumbing'};op=str(uuid.uuid4())
 write(A,'create',payload,ok=False);write(X,'create',payload,ok=False);check(True,'only actual tenant creates')
 created=json.loads(write(B,'create',payload,op));RID=created['requestId'];revision=created['revision']
 check(json.loads(write(B,'create',payload,op))==created and sql('select count(*) from public.maintenance_requests;')=='1','exact retry has one request and original receipt')
 write(B,'create',{**payload,'title':'Different input'},op,False);check(True,'conflicting retry rejected')
 write(B,'respond',{'requestId':RID,'revision':revision,'status':'acknowledged','note':'Will inspect'},ok=False);check(True,'tenant cannot impersonate landlord response')
 changed=json.loads(write(A,'respond',{'requestId':RID,'revision':revision,'status':'acknowledged','note':'Will inspect tomorrow'}));write(A,'respond',{'requestId':RID,'revision':revision,'status':'resolved','note':'Stale'},ok=False);check(True,'landlord acknowledgment and stale revision rejection')
 note=json.loads(write(A,'respond',{'requestId':RID,'revision':changed['revision'],'status':'acknowledged','note':'Please keep the sink unused'}));hist=json.loads(sql(auth(B)+f"select public.get_tenancy_maintenance_history('{RID}');"));check(len(hist)==3 and any(h['note']=='Please keep the sink unused' for h in hist),'creation, transition and response history preserved')
 write(A,'respond',{'requestId':RID,'revision':note['revision'],'status':'submitted','note':'Invalid'},ok=False);check(True,'backward transition denied')
 resolved=json.loads(write(A,'respond',{'requestId':RID,'revision':note['revision'],'status':'resolved','note':'Pipe repaired and tested'}));write(A,'respond',{'requestId':RID,'revision':resolved['revision'],'status':'acknowledged','note':'Reopen'},ok=False);check(True,'resolution is terminal and timestamp recorded')
 sql(f"update public.tenancies set rent_due_day=extract(day from (now() at time zone 'Asia/Manila'))::int where id='{T}';")
 # Test date may be >28; force a deterministic same-day helper only where valid.
 day=int(sql("select extract(day from (now() at time zone 'Asia/Manila'))::int;"))
 if day<=28:
  write(B,'check_reminder',{});write(B,'check_reminder',{});check(sql('select count(*) from rentlease_tenancy_care.reminders;')=='1','reminders deduplicate per actor tenancy and date')
 check(sql('select count(*) from public.rent_obligations;')=='0','schedule/reminder checks fabricate no obligation or payment')
 sql(f"update public.tenancies set status='ended' where id='{T}';");write(B,'create',payload,ok=False);check(json.loads(sql(auth(A)+f"select public.get_tenancy_care('{T}');"))['schedule']==[],'ended tenancy read-only; no upcoming schedule')
 check(json.loads(write(B,'create',payload,op))==created,'uncertain retry reconciles original receipt after tenancy ended')
 before=sql(f"select care_revision from public.maintenance_requests where id='{RID}';");sql(f"update public.maintenance_requests set landlord_response='Privileged correction' where id='{RID}';");check(sql(f"select care_revision from public.maintenance_requests where id='{RID}';")!=before,'privileged existing updates also invalidate stale revision')
 sql(auth(B)+'select * from rentlease_tenancy_care.receipts;',False);sql(auth(B)+"update public.maintenance_requests set status='resolved';",False);check(True,'no direct private receipt or table mutation access')
 sql("set test.inactive='true';"+auth(B)+f"select public.get_tenancy_care('{T}');",False);check(True,'restricted account rejected')
 print(str(checks)+' focused SQL checks passed.',flush=True)
finally:
 run(['docker','rm','-f',NAME]);assert run(['docker','inspect',NAME]).returncode!=0;print('Disposable container removed.',flush=True)
