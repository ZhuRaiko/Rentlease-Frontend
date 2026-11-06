"""Local disposable UC-08 contract tests. No live URLs, credentials, ports, or data."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--container',required=True);p.add_argument('--realtime',action='store_true');p.add_argument('--viewings',action='store_true');a=p.parse_args()
assert a.container.startswith('rentlease-messaging-test-')
info=json.loads(subprocess.check_output(['docker','inspect',a.container],text=True))[0]
assert not info['Mounts'] and not info['HostConfig']['PortBindings'] and info['Config']['Image'].startswith('public.ecr.aws/supabase/postgres:17.')
root=Path(__file__).resolve().parents[2];db='messaging_contract'
subprocess.run(['docker','exec',a.container,'dropdb','-U','postgres','--if-exists',db],check=True,capture_output=True)
subprocess.run(['docker','exec',a.container,'createdb','-U','postgres',db],check=True,capture_output=True)
base=['docker','exec',a.container,'psql','-U','postgres','-d',db,'-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
def sql(q,ok=True):
 r=subprocess.run(base+['-c',q],text=True,capture_output=True)
 if ok:assert r.returncode==0,r.stderr
 return r.stdout.strip() if ok else r

def load(path):
 subprocess.run(['docker','cp',str(path),a.container+':/tmp/'+path.name],check=True,capture_output=True)
 r=subprocess.run(base+['-f','/tmp/'+path.name],text=True,capture_output=True);assert r.returncode==0,r.stderr
sql("""
create schema auth;do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;end $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create type app_role as enum('tenant','landlord','admin');create type listing_status as enum('draft','active','paused','archived');
create type conversation_status as enum('open','closed','blocked');create type message_type as enum('text','image','file','system');
create table profiles(id uuid primary key,display_name text,tier1_verified_at timestamptz,account_status text default 'active');
create view public_profiles as select id,display_name from profiles where account_status<>'deleted';
create table user_roles(user_id uuid,role app_role);
create table properties(id uuid primary key,landlord_id uuid,is_active boolean);
create table listings(id uuid primary key,property_id uuid,landlord_id uuid,title text,status listing_status,published_at timestamptz,available_from date);
create table conversations(id uuid primary key default gen_random_uuid(),listing_id uuid references listings(id),tenant_id uuid references profiles(id),landlord_id uuid references profiles(id),status conversation_status not null default 'open',created_at timestamptz not null default now(),updated_at timestamptz default now(),last_message_at timestamptz,closed_at timestamptz,unique(listing_id,tenant_id));
create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),sender_id uuid references profiles(id),message_type message_type default 'text',body text,created_at timestamptz not null default now(),deleted_at timestamptz,attachment_path text,reply_to_message_id uuid,read_at timestamptz,edited_at timestamptz);
alter table conversations enable row level security;alter table messages enable row level security;
""")
load(root/'supabase/test-support/messaging_live_functions.sql')
for table,fn,event in [('conversations','validate_conversation_participants','insert or update'),('conversations','prevent_conversation_identity_changes','update'),('conversations','set_updated_at','update'),('messages','validate_message_sender','insert')]:sql(f'create trigger test_{fn} before {event} on {table} for each row execute function {fn}()')
sql('create trigger touch after insert on messages for each row execute function touch_conversation_after_message()')
load(next((root/'supabase/migrations').glob('*_property_inquiry_messaging.sql')))
uid=lambda n:f'00000000-0000-4000-8000-{n:012d}'
A,B,C,U,S,D=[uid(i) for i in range(1,7)];L,L2,L3=[uid(i) for i in range(101,104)]
for i in range(1,7):sql(f"insert into profiles values('{uid(i)}','Synthetic account {i}',{'null' if i==4 else 'now()'},'{ 'suspended' if i==5 else 'active'}')")
sql(f"insert into user_roles values('{B}','landlord'),('{C}','tenant'),('{D}','admin')")
for lid,owner in [(L,B),(L2,A),(L3,C)]:sql(f"insert into properties values('{lid}','{owner}',true);insert into listings values('{lid}','{lid}','{owner}','Synthetic rental','active',now(),null)")
def auth(actor,q,ok=True):
 r=sql(f"begin;set local role authenticated;set local request.jwt.claim.sub='{actor}';{q};commit",ok)
 if not ok:return r
 return '\n'.join(x for x in r.splitlines() if x not in ['BEGIN','SET','COMMIT'])
count=0
def check(v,label):
 global count
 assert v,label;count+=1;print('PASS',label,flush=True)
def denied(actor,q,code='42501'):
 r=auth(actor,q,False);return r.returncode!=0 and code in r.stderr
cid=auth(A,f"select public.start_property_inquiry('{L}')")
check(len(cid)==36,'role-free Tier1 creates actual property inquiry')
check(auth(A,f"select public.start_property_inquiry('{L}')")==cid,'duplicate inquiry reuses unique conversation')
check(denied(B,f"select public.start_property_inquiry('{L}')",'22023'),'self inquiry denied')
for actor,label in [(U,'unverified'),(S,'suspended')]:check(denied(actor,f"select public.start_property_inquiry('{L}')"),label+' denied')
check(denied('',f"select public.start_property_inquiry('{L}')"),'missing identity denied')
check(denied(C,f"select public.get_conversation_messages('{cid}')"),'nonparticipant cannot read history')
check(denied(D,f"select public.get_conversation_messages('{cid}')"),'Admin not implicitly a consumer participant')
mid=uid(201);body="Synthetic local inquiry"
receipt=json.loads(auth(A,f"select public.send_property_message('{cid}','{mid}','{body}')"))
check(receipt['sender_id']==A,'sender derived from authenticated identity')
check(json.loads(auth(A,f"select public.send_property_message('{cid}','{mid}','{body}')"))['id']==mid,'retry is idempotent')
check(denied(A,f"select public.send_property_message('{cid}','{mid}','Different body')"),'idempotency collision denied')
check(denied(C,f"select public.send_property_message('{cid}','{uid(202)}','Impersonation')"),'nonparticipant send denied')
check(denied(A,f"insert into public.messages(conversation_id,sender_id,body) values('{cid}','{B}','Spoof')"),'direct sender impersonation denied without table grants')
check(denied(A,'select * from public.messages'),'private message table not publicly exposed')
reply=json.loads(auth(B,f"select public.send_property_message('{cid}','{uid(203)}','Synthetic reply')"))
check(reply['sender_id']==B,'actual owner can reply without renter role')
check(reply['created_at']>receipt['created_at'],'serialized server timestamps advance for reliable incremental delivery')
for actor in [A,B]:check(len(json.loads(auth(actor,f"select public.get_conversation_messages('{cid}')")))==2,'participant sees persisted history after reopening')
check(json.loads(auth(B,'select public.get_messaging_inbox()'))[0]['latest_body']=='Synthetic reply','inbox latest message and participant summary')
check(json.loads(auth(C,'select public.get_messaging_inbox()'))==[],'inbox excludes other participants')
check(len(auth(B,f"select public.start_property_inquiry('{L2}')"))==36,'legacy landlord may inquire about another property')
check(len(auth(C,f"select public.start_property_inquiry('{L2}')"))==36,'legacy tenant inquiry remains compatible')
for q in [f"select public.send_property_message('{cid}','{uid(204)}',' ')",f"select public.send_property_message('{cid}','{uid(204)}',repeat('x',4001))",f"select public.get_conversation_messages('{cid}','bad')",'select public.get_messaging_inbox(-1)']:check(denied(A,q,'22023'),'invalid text/pagination rejected')
sql(f"update conversations set status='closed' where id='{cid}'")
check(denied(A,f"select public.send_property_message('{cid}','{uid(205)}','Closed')"),'closed thread cannot receive new messages')
check(json.loads(auth(A,f"select public.send_property_message('{cid}','{mid}','{body}')"))['id']==mid,'closed thread still reconciles earlier successful receipt')
for change in ["status='paused'","status='active',published_at=null","published_at=now(),available_from=current_date+2"]:
 sql(f'update listings set {change} where id=\'{L3}\'');check(denied(A,f"select public.start_property_inquiry('{L3}')",'22023'),'ineligible listing cannot open inquiry')
check(sql("select count(*) from user_roles where role='admin'")=='1','Admin assignments preserved')
check(sql("select has_table_privilege('authenticated','public.messages','insert')")=='f','migration grants no direct message table writes')
check(sql("select has_function_privilege('anon','public.start_property_inquiry(uuid)','execute')")=='f','anonymous RPC access denied')

latest=json.loads(auth(B,f"select public.get_conversation_messages('{cid}','latest',null,null,1)"))
check(latest[0]['id']==uid(203),'latest history page returns newest server message')
older=json.loads(auth(A,f"select public.get_conversation_messages('{cid}','older','{latest[0]['created_at']}','{latest[0]['id']}',50)"))
check(older[0]['id']==mid,'older cursor returns earlier history without duplication')
newer=json.loads(auth(B,f"select public.get_conversation_messages('{cid}','newer','{older[0]['created_at']}','{older[0]['id']}',50)"))
check(newer[0]['id']==uid(203),'incremental poll returns new incoming messages')
check(denied(S,f"select public.get_conversation_messages('{cid}')"),'restricted account cannot retain access')
check(json.loads(auth(C,f"select public.get_messaging_inbox(0,20,'{cid}')"))==[],'direct conversation lookup hides unrelated thread')
sql(f"update messages set deleted_at=now() where id='{uid(203)}'")
redacted=json.loads(auth(B,f"select public.get_conversation_messages('{cid}')"))
check(redacted[-1]['body'] is None,'deleted message body is redacted')
sql(f"update listings set status='active',published_at=now(),available_from=null where id='{L3}';update properties set is_active=false where id='{L3}'")
check(denied(A,f"select public.start_property_inquiry('{L3}')",'22023'),'inactive property cannot open inquiry')
sql(f"update properties set is_active=true,landlord_id='{B}' where id='{L3}'")
check(denied(A,f"select public.start_property_inquiry('{L3}')",'22023'),'listing and actual property owner must match')
check(sql("select bool_and(not has_function_privilege('anon',oid,'execute')) from pg_proc where proname in ('start_property_inquiry','get_messaging_inbox','get_conversation_messages','send_property_message')")=='t','all consumer RPCs reject anonymous execution')

reconciled=json.loads(auth(B,f"select public.get_conversation_messages('{cid}','reconcile',null,null,100,array['{uid(203)}']::uuid[])"))
check(len(reconciled)==1 and reconciled[0]['body'] is None,'reconciliation returns tombstones for already-loaded messages')
check(denied(A,f"select public.get_conversation_messages('{cid}','reconcile',null,null,100,array_fill('{mid}'::uuid,array[101]))",'22023'),'reconciliation batch is bounded')
check(denied(C,f"select public.get_conversation_messages('{cid}','reconcile',null,null,100,array['{mid}']::uuid[])"),'unrelated reconciliation is denied')

if a.realtime:
 sql("""
 create function public.can_access_conversation(conversation_uuid uuid,requested_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path='public' as $$ select public.is_admin(requested_user) or exists(select 1 from conversations c where c.id=conversation_uuid and requested_user in(c.tenant_id,c.landlord_id)) $$;
 create policy messages_read_participants_admin on messages for select to authenticated using(can_access_conversation(conversation_id));
 create policy conversations_read_participants_admin on conversations for select to authenticated using(auth.uid() in(tenant_id,landlord_id) or is_admin());
 create publication supabase_realtime for table public.messages;
 """)
 load(next((root/'supabase/migrations').glob('*_property_inquiry_realtime_metadata.sql')))
 for actor in [A,B]:
  check(auth(actor,f"select count(*) from (select id,conversation_id from messages where conversation_id='{cid}')s")=='2','participant reads only permitted message metadata')
  check(auth(actor,f"select count(*) from (select id,tenant_id,landlord_id from conversations where id='{cid}')s")=='1','participant reads own conversation metadata')
  check(denied(actor,f"select body from messages where conversation_id='{cid}'"),'message bodies remain RPC-only')
 for actor in [C,D,U,S]:
  check(auth(actor,f"select count(*) from (select id,conversation_id from messages where conversation_id='{cid}')s")=='0','unrelated Admin unverified and suspended metadata readers denied')
  check(auth(actor,f"select count(*) from (select id,tenant_id,landlord_id from conversations where id='{cid}')s")=='0','foreign conversation metadata denied')
 check(auth('',"select count(*) from (select id from messages)s")=='0','missing authenticated identity sees no metadata')
 check(sql("select has_any_column_privilege('anon','messages','select')")=='f','anonymous has no metadata grant')
 check(sql("select has_table_privilege('authenticated','messages','select')")=='f','no full message-table SELECT grant')
 check(sql("select has_column_privilege('authenticated','messages','body','select')")=='f','body column privilege absent')
 check(sql("select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename in('messages','conversations')")=='2','both metadata sources published')
 check(denied(A,f"insert into messages(conversation_id,sender_id,body) values('{cid}','{A}','Blocked')"),'no new direct write grants')
 check(len(json.loads(auth(A,f"select public.get_conversation_messages('{cid}')")))==2,'protected history RPC remains compatible')
 load(root/'supabase/test-support/property_inquiry_realtime_metadata_rollback.sql')

if a.viewings:
 exec(compile((root/'supabase/tests/viewing_contract_cases.py').read_text(), 'viewing_contract_cases.py', 'exec'))

counts_before=sql('select jsonb_build_array((select count(*) from conversations),(select count(*) from messages))')
load(root/'supabase/test-support/property_inquiry_messaging_rollback.sql')
check(sql('select jsonb_build_array((select count(*) from conversations),(select count(*) from messages))')==counts_before,'coordinated rollback preserves all persistent conversation and message records')
check(sql("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('start_property_inquiry','get_messaging_inbox','get_conversation_messages','send_property_message')")=='0','rollback removes only prepared consumer RPC entry points')
check(sql("select count(*) from pg_trigger where not tgisinternal and tgrelid in ('public.conversations'::regclass,'public.messages'::regclass)")=='5','rollback preserves existing participant and message safeguards')
print(f'FINAL: {count} messaging PostgreSQL checks passed / 0 failed')
