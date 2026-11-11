"""Network-isolated synthetic notification checks. No hosted connection accepted."""
import json,subprocess,time,uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];NAME='rentlease-notification-'+uuid.uuid4().hex[:8];checks=0
A,B,X,Y,Z,P,L,C=[str(uuid.uuid4()) for _ in range(8)]
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,**kw)
def sql(q,ok=True):
 r=run(['docker','exec','-i',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','reporttest','-qAt','-v','ON_ERROR_STOP=1'],input=q)
 assert (r.returncode==0)==ok,r.stderr if ok else 'Expected denial'
 return r.stdout.strip()
def auth(a):return f"set role authenticated;set test.actor='{a}';"
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS '+label,flush=True)
try:
 r=run(['docker','run','--rm','-d','--network','none','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.155']);assert r.returncode==0,r.stderr
 for _ in range(60):
  if run(['docker','exec',NAME,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-qAt','-c','select 1']).returncode==0:break
  time.sleep(.5)
 time.sleep(10)
 r=run(['docker','exec',NAME,'createdb','-U','postgres','-T','template0','reporttest']);assert r.returncode==0,r.stderr
 sql("""create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;
 create table public.profiles(id uuid primary key,active boolean);
 create function public.is_tier1_verified(uuid) returns boolean language sql security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=$1 and active)$$;
 create type public.notification_type as enum('new_message','viewing_update','tenancy_update','maintenance_update','rent_due','report_update');
 create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,type public.notification_type not null,title text not null,body text not null,data jsonb not null default '{}',read_at timestamptz,created_at timestamptz not null default now());
 alter table public.notifications enable row level security;revoke all on public.notifications from public,anon,authenticated,service_role;
 create table public.conversations(id uuid primary key,tenant_id uuid,landlord_id uuid);
 create table public.messages(id uuid primary key,conversation_id uuid,sender_id uuid,message_type text,body text,deleted_at timestamptz);
 create table public.viewing_schedules(id uuid primary key,conversation_id uuid,tenant_id uuid,landlord_id uuid,proposed_by uuid,starts_at timestamptz,ends_at timestamptz,status text,responded_by uuid,cancelled_by uuid,revision int);
 create table public.rental_reservations(id uuid primary key,conversation_id uuid,tenant_id uuid,landlord_id uuid);
 create schema rentlease_reservations;create table rentlease_reservations.events(operation_id uuid primary key,reservation_id uuid,actor_id uuid);
 create table public.tenancies(id uuid primary key,tenant_id uuid,landlord_id uuid,created_by uuid,status text,tenant_confirmed_at timestamptz,landlord_confirmed_at timestamptz,ended_at timestamptz);
 create table public.maintenance_requests(id uuid primary key,tenancy_id uuid);
 create table public.maintenance_updates(id uuid primary key,maintenance_request_id uuid,actor_id uuid,note text);
 create schema rentlease_tenancy_care;create table rentlease_tenancy_care.reminders(actor_id uuid,tenancy_id uuid,due_date date,primary key(actor_id,tenancy_id,due_date));
 create table public.reports(id uuid primary key,reporter_id uuid);
 create schema rentlease_reporting;create table rentlease_reporting.events(id uuid primary key,report_id uuid,status text,note text);
 """)
 sql(f"insert into public.profiles values('{A}',true),('{B}',true),('{X}',true),('{Z}',false);insert into public.conversations values('{C}','{B}','{A}');")
 sql((ROOT/'supabase/migrations/20261111035305_in_app_notifications.sql').read_text())
 def page(actor,cursor=''):return json.loads(sql(auth(actor)+'select public.get_in_app_notifications('+cursor+');'))
 check(page(B)['rows']==[],'honest empty notification center')
 sql('set role anon;select public.get_in_app_notifications();',False);check(True,'anonymous read denied')
 sql(auth(Z)+'select public.get_in_app_notifications();',False);check(True,'inactive account denied')
 mid=str(uuid.uuid4());sql(f"reset role;insert into public.messages values('{mid}','{C}','{A}','text','Private message',null);")
 n=page(B)['rows'][0];check(n['title']=='New message' and 'Private message' not in json.dumps(n),'message counterpart notification excludes message body')
 check(page(A)['rows']==[],'message sender not notified')
 check(page(X)['rows']==[],'unrelated account isolated')
 sql(auth(X)+f"select public.read_in_app_notifications('{n['id']}',null);",False);check(True,'foreign read update denied')
 sql(auth(X)+f"select public.get_in_app_notification_target('{n['id']}');",False);check(True,'foreign destination denied')
 check(json.loads(sql(auth(B)+f"select public.get_in_app_notification_target('{n['id']}');"))['id']==C,'authorized exact conversation target')
 sql(f"reset role;select rentlease_notifications.emit('{B}','message:{mid}','new_message','New message','conversation','{C}');")
 check(page(B)['unread']==1,'stable event retry deduplicates')
 sql(auth(B)+f"select public.read_in_app_notifications('{n['id']}',null);select public.read_in_app_notifications('{n['id']}',null);");check(page(B)['unread']==0,'read persists across new sessions and retries')
 sql(auth(B)+"insert into public.notifications(user_id,type,title,body) values(auth.uid(),'new_message','Forged','Forged');",False);sql(auth(B)+f"select rentlease_notifications.emit('{X}','fake','new_message','Fake','conversation','{C}');",False);check(True,'clients cannot assign recipients or generate notifications')
 v=str(uuid.uuid4());sql(auth(B)+f"reset role;insert into public.viewing_schedules values('{v}','{C}','{B}','{A}','{B}',now(),now()+interval '1 hour','pending',null,null,1);")
 check(page(A)['rows'][0]['title']=='Viewing update','viewing request notifies owner')
 sql(auth(A)+f"reset role;update public.viewing_schedules set status='accepted',responded_by='{A}',revision=2 where id='{v}';");check(page(B)['unread']==1,'viewing decision notifies tenant')
 before=sql('reset role;select count(*) from public.notifications;');sql(f"update public.viewing_schedules set revision=3 where id='{v}';");check(sql('select count(*) from public.notifications;')==before,'non-event updates do not notify')
 res=str(uuid.uuid4());sql(f"insert into public.rental_reservations values('{res}','{C}','{B}','{A}');insert into rentlease_reservations.events values(gen_random_uuid(),'{res}','{A}');");check(page(B)['rows'][0]['title']=='Reservation update','reservation committed receipt creates notification')
 sql(auth(A)+f"reset role;insert into public.tenancies values('{P}','{B}','{A}','{A}','pending_confirmation',null,now(),null);");check(page(B)['rows'][0]['title']=='Tenancy update','tenancy proposal notifies renter')
 sql(auth(B)+f"reset role;update public.tenancies set tenant_confirmed_at=now() where id='{P}';");check(page(A)['rows'][0]['title']=='Tenancy update','tenancy confirmation notifies owner')
 m=str(uuid.uuid4());sql(f"insert into public.maintenance_requests values('{m}','{P}');insert into public.maintenance_updates values(gen_random_uuid(),'{m}','{B}','Private maintenance text');");check(page(A)['rows'][0]['title']=='Maintenance update','maintenance history drives owner notification')
 sql(f"insert into public.maintenance_updates values(gen_random_uuid(),'{m}','{A}','Private response');");check(page(B)['rows'][0]['title']=='Maintenance update','maintenance response notifies tenant')
 sql(f"insert into rentlease_tenancy_care.reminders values('{B}','{P}',current_date) on conflict do nothing;insert into rentlease_tenancy_care.reminders values('{B}','{P}',current_date) on conflict do nothing;");check(sum(x['title']=='Scheduled rent reminder' for x in page(B)['rows'])==1,'existing reminder uniqueness retained')
 rid=str(uuid.uuid4());sql(f"insert into public.reports values('{rid}','{B}');insert into rentlease_reporting.events values(gen_random_uuid(),'{rid}','under_review','Private investigation');");before=page(B)['unread'];sql(f"insert into rentlease_reporting.events values(gen_random_uuid(),'{rid}','upheld','Private resolution');");check(page(B)['unread']==before+1 and 'Private' not in json.dumps(page(B)),'only reporter-safe final resolution notified')
 before=sql('reset role;select count(*) from public.notifications;');sql(f"begin;insert into public.messages values(gen_random_uuid(),'{C}','{A}','text','Rolled back',null);rollback;");check(sql('select count(*) from public.notifications;')==before,'rolled-back business action produces no notification')
 sql(f"insert into public.messages select gen_random_uuid(),'{C}','{A}','text','Private',null from generate_series(1,25);")
 first=page(B);cur=first['next'];second=page(B,f"'{cur['createdAt']}','{cur['id']}'");check(len(first['rows'])==20 and not set(x['id'] for x in first['rows'])&set(x['id'] for x in second['rows']),'stable keyset pagination without duplicate delivery')
 sql(auth(B)+f"select public.read_in_app_notifications(null,'{first['through']}');");check(page(B)['unread']==0,'mark all read persists')
 # Independent sessions delivering the same event converge on one stored notification.
 gate=Barrier(2)
 def deliver():
  gate.wait()
  return sql(f"reset role;select rentlease_notifications.emit('{B}','race','new_message','New message','conversation','{C}');")
 with ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(deliver) for _ in range(2)]
  [f.result() for f in futures]
 check(sql("reset role;select count(*) from public.notifications where event_key='race';")=='1','concurrent event delivery creates only one notification')
 original=sql(f"select read_at from public.notifications where id='{n['id']}';")
 def reread():return sql(auth(B)+f"select public.read_in_app_notifications('{n['id']}',null);")
 with ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(reread) for _ in range(2)]
  [f.result() for f in futures]
 check(sql(f"reset role;select read_at from public.notifications where id='{n['id']}';")==original,'concurrent read retries preserve the first read timestamp')
 sql(f"reset role;delete from public.conversations where id='{C}';");check(sql(auth(B)+f"select public.get_in_app_notification_target('{n['id']}');")=='','deleted destination remains safe and unavailable')
 sql((ROOT/'supabase/test-support/in_app_notifications_rollback.sql').read_text());sql(auth(B)+'select public.get_in_app_notifications();',False);check(sql('reset role;select count(*) from public.notifications;')==str(int(before)+26),'withdrawal retains all notifications')
 print(f'{checks} notification SQL checks passed',flush=True)
finally:
 r=run(['docker','rm','-f',NAME]);assert r.returncode==0,r.stderr
 print('Disposable notification container removed',flush=True)
