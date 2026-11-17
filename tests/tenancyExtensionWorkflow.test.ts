import test from 'node:test';
import assert from 'node:assert/strict';
import {createTenancyExtensionWorkflow} from '../src/features/tenancy/viewModels/tenancyExtensionWorkflow';
import {createTenancyExtensionService} from '../src/features/tenancy/services/tenancyExtensionService';
import {createTenancyActivityService} from '../src/features/tenancy/services/tenancyActivityService';
import {ExtensionError,GENERIC_ERROR,NOT_ALLOWED,RELOADING,type ExtensionOperation,type ExtensionRead} from '../src/features/tenancy/models/TenancyExtension';

const U=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TENANT=U(1),OWNER=U(2),TEN=U(3),REQ=U(4),REV=U(5),REV2=U(6),PROP=U(7);
const tick=()=>new Promise<void>(r=>setImmediate(r));
const pending=(over:object={})=>({id:REQ,status:'pending',requestedEndDate:'2027-03-17',baseEndDate:'2027-02-17',note:null,decisionNote:null,whoDecided:null,revision:REV,createdAt:'2026-11-17T01:00:00Z',decidedAt:null,conflictDate:null,canAccept:true,canDecline:true,canWithdraw:true,...over});
const readOf=(role:'tenant'|'landlord',request:object|null=null,over:object={}):ExtensionRead=>({tenancyId:TEN,role,currentEndDate:'2027-02-17',latestEndDate:'2027-08-17',canRequest:!request,cannotRequestReason:request?'request_pending':null,request:request as never,...over});
/** A fake service: reads come from `reads`, writes from `writes` (an Error rejects). Every write is recorded. */
function fake(opts:{reads?:(ExtensionRead|Error)[];writes?:(object|Error)[]}={}){
  const reads=[...(opts.reads??[readOf('tenant')])],writes=[...(opts.writes??[])],ops:ExtensionOperation[]=[];let readCalls=0;
  const service:any={
    read:async()=>{readCalls++;const next=reads.length>1?reads.shift()!:reads[0]!;if(next instanceof Error)throw next;return next;},
    write:async(_a:string,op:ExtensionOperation)=>{ops.push(op);const next=writes.shift();if(next instanceof Error)throw next;return next??{requestId:REQ,status:'pending',requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',revision:REV};},
  };
  return {service,ops,readCalls:()=>readCalls};
}
const ids=()=>{let n=100;return()=>U(n++);};
const make=(f:ReturnType<typeof fake>,over:Partial<{actor:string|undefined;enabled:boolean}>={})=>createTenancyExtensionWorkflow(f.service,{actor:TENANT,tenancyId:TEN,enabled:true,...over},ids());

test('a read fills the state; a tenancy that is not enabled reads nothing; a failed read hides the feature quietly',async()=>{
  const f=fake();const w=make(f);await w.load();assert.equal(w.getSnapshot().read?.role,'tenant');assert.equal(w.getSnapshot().ready,true);w.dispose();
  const off=fake();const n=make(off,{enabled:false});await n.load();assert.equal(off.readCalls(),0);assert.equal(n.getSnapshot().read,null);
  const down=fake({reads:[new ExtensionError('Could not find the function',null,true)]});const d=make(down);await d.load();
  assert.equal(d.getSnapshot().read,null);assert.equal(d.getSnapshot().error,null,'no error text: the RPCs may not be deployed yet');assert.equal(d.getSnapshot().ready,true);
});
test('a request sends a fresh operation id and exactly the date, then reads again',async()=>{
  const f=fake({reads:[readOf('tenant'),readOf('tenant',pending())]});const w=make(f);await w.load();
  assert.equal(await w.request('2027-03-17'),true);
  assert.deepEqual(f.ops.map(o=>[o.action,o.payload,o.tenancyId]),[['request',{requestedEndDate:'2027-03-17'},TEN]]);assert.ok(/^[0-9a-f-]{36}$/.test(f.ops[0]!.operationId));
  assert.equal(w.getSnapshot().read?.request?.status,'pending');assert.equal(w.getSnapshot().pending,null);assert.equal(f.readCalls(),2);
  assert.equal(await w.request('2027-03-20'),true);assert.notEqual(f.ops[1]!.operationId,f.ops[0]!.operationId,'a new action gets a new id');
});
test('withdraw, accept and decline use the pending request\'s id and revision from the read; they do nothing without one',async()=>{
  const t=fake({reads:[readOf('tenant',pending())],writes:[{requestId:REQ,status:'withdrawn',requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',revision:REV2}]});const tw=make(t);await tw.load();
  await tw.withdraw();assert.deepEqual([t.ops[0]!.action,t.ops[0]!.payload],['withdraw',{requestId:REQ,revision:REV}]);
  const o=fake({reads:[readOf('landlord',pending())],writes:[{requestId:REQ,status:'accepted',requestedEndDate:'2027-03-17',currentEndDate:'2027-03-17',revision:REV2},{requestId:REQ,status:'declined',requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',revision:REV2}]});
  const ow=createTenancyExtensionWorkflow(o.service,{actor:OWNER,tenancyId:TEN,enabled:true},ids());await ow.load();
  await ow.accept();await ow.decline('  Not this time  ');
  assert.deepEqual(o.ops.map(x=>[x.action,x.payload]),[['accept',{requestId:REQ,revision:REV}],['decline',{requestId:REQ,revision:REV,note:'Not this time'}]]);assert.notEqual(o.ops[0]!.operationId,o.ops[1]!.operationId);
  const none=fake({reads:[readOf('landlord',null)]});const nw=createTenancyExtensionWorkflow(none.service,{actor:OWNER,tenancyId:TEN,enabled:true},ids());await nw.load();
  assert.deepEqual([await nw.accept(),await nw.decline(),await nw.withdraw()],[false,false,false]);assert.equal(none.ops.length,0);
});
test('an unknown outcome keeps the SAME operation id for Retry; nothing else can start until it is resolved; nothing retries by itself',async()=>{
  const f=fake({reads:[readOf('tenant')],writes:[new ExtensionError('Outcome not confirmed.',null,true)]});const w=make(f);await w.load();
  assert.equal(await w.request('2027-03-17'),false);
  const s=w.getSnapshot();assert.equal(s.error,GENERIC_ERROR);assert.ok(s.pending);assert.equal(f.ops.length,1,'nothing retried by itself');await tick();await tick();assert.equal(f.ops.length,1);
  assert.equal(await w.request('2027-03-20'),false,'a different action is refused while one is unresolved');assert.equal(f.ops.length,1);
  assert.equal(await w.retry(),true);assert.equal(f.ops.length,2);assert.equal(f.ops[1]!.operationId,f.ops[0]!.operationId,'the same id');assert.deepEqual(f.ops[1],f.ops[0]);
  assert.equal(w.getSnapshot().pending,null);assert.equal(w.getSnapshot().error,null);
  assert.equal(await w.request('2027-03-20'),true);assert.notEqual(f.ops[2]!.operationId,f.ops[0]!.operationId,'after success a new tap is a new action');
});
test('a definite refusal ends the action: one mapped sentence, no retry id kept, the next tap is a new action',async()=>{
  const f=fake({reads:[readOf('tenant')],writes:[new ExtensionError('extension_date_invalid:beyond_limit','22023'),new ExtensionError('Tenant required','42501')]});const w=make(f);await w.load();
  assert.equal(await w.request('2027-12-01'),false);assert.equal(w.getSnapshot().error,'You can extend up to 6 months at a time. Pick an earlier date.');assert.equal(w.getSnapshot().pending,null);assert.equal(w.getSnapshot().conflictDate,null);
  assert.equal(await w.request('2027-03-17'),false);assert.equal(w.getSnapshot().error,NOT_ALLOWED);assert.notEqual(f.ops[1]!.operationId,f.ops[0]!.operationId);
  w.clearError();assert.equal(w.getSnapshot().error,null);
  for(const raw of ['extension_date_invalid:beyond_limit','Tenant required'])assert.ok(!JSON.stringify(w.getSnapshot()).includes(raw),'raw server text is never kept in the state');
});
test('a clash (23P01) keeps the first clashing date and no reload; the sheet stays where it is',async()=>{
  const f=fake({reads:[readOf('tenant')],writes:[new ExtensionError('extension_conflict:2027-03-10','23P01')]});const w=make(f);await w.load();const before=f.readCalls();
  assert.equal(await w.request('2027-03-17'),false);const s=w.getSnapshot();
  assert.deepEqual([s.conflictDate,s.error,s.notice],['2027-03-10','Another stay starts Mar 10.',null]);assert.equal(f.readCalls(),before,'no reload for a clash');assert.equal(s.pending,null);
  assert.equal(await w.request('2027-03-09'),true,'a different date is a new action (this one goes through)');assert.equal(f.ops.length,2);assert.notEqual(f.ops[1]!.operationId,f.ops[0]!.operationId);
});
test('an accept that finds a clash shows it and leaves the request pending; Accept was never blocked up front',async()=>{
  const f=fake({reads:[readOf('landlord',pending({conflictDate:'2027-03-10',canAccept:false}))],writes:[new ExtensionError('extension_conflict:2027-03-10','23P01')]});
  const w=createTenancyExtensionWorkflow(f.service,{actor:OWNER,tenancyId:TEN,enabled:true},ids());await w.load();
  assert.equal(await w.accept(),false,'the tap was allowed even though the read carries a conflictDate');assert.equal(f.ops.length,1);assert.equal(w.getSnapshot().conflictDate,'2027-03-10');assert.equal(w.getSnapshot().read?.request?.status,'pending');
});
test('40001 says "This changed. Reloading." and reads again, keeping that line after the reload',async()=>{
  const f=fake({reads:[readOf('tenant'),readOf('tenant',pending({revision:REV2}))],writes:[new ExtensionError('Extension request changed. Reload.','40001')]});const w=make(f);await w.load();
  assert.equal(await w.request('2027-03-17'),false);const s=w.getSnapshot();
  assert.equal(s.notice,RELOADING);assert.equal(s.error,null);assert.equal(f.readCalls(),2);assert.equal(s.read?.request?.revision,REV2,'the screen now shows the current state');assert.equal(s.pending,null);
});
test('nothing starts while loading, saving or before the first read; disposal suppresses late results',async()=>{
  const f=fake();const w=make(f);assert.equal(await w.request('2027-03-17'),false,'before the first read');assert.equal(f.ops.length,0);
  let finish!:(v:object)=>void;const slow:any={read:async()=>readOf('tenant'),write:()=>new Promise(r=>{finish=r as (v:object)=>void;})};
  const s=createTenancyExtensionWorkflow(slow,{actor:TENANT,tenancyId:TEN,enabled:true},ids());await s.load();
  const first=s.request('2027-03-17');await tick();assert.equal(s.getSnapshot().saving,true);assert.equal(await s.request('2027-03-20'),false,'no double submit');
  s.dispose();finish({requestId:REQ,status:'pending',requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',revision:REV});await first;assert.equal(s.getSnapshot().read,null);
});

// ---------------------------------------------------------------- the service
function clientWith(rpcs:Record<string,(args:any)=>{data?:any;error?:{code:string;message:string}|null}>,user:string|null=TENANT){
  const calls:{name:string;args:any}[]=[];
  const client:any={auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},rpc:(name:string,args:any)=>{calls.push({name,args});const out=rpcs[name]?.(args)??{data:null,error:{code:'PGRST202',message:'not found'}};return{abortSignal:async()=>({data:out.data??null,error:out.error??null})};}};
  return {client,calls};
}
const sig=()=>new AbortController().signal;
test('service: calls only the three RPCs with the documented argument names, and refuses an account that changed',async()=>{
  const {client,calls}=clientWith({get_tenancy_extension:()=>({data:readOf('tenant')}),get_pending_tenancy_extensions:()=>({data:{rows:[],hasMore:false}}),write_tenancy_extension:()=>({data:{requestId:REQ,status:'pending',requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',revision:REV}})});
  const s=createTenancyExtensionService(()=>client);
  await s.read(TENANT,TEN,sig());await s.pending(OWNER===TENANT?OWNER:TENANT,sig());await s.write(TENANT,{tenancyId:TEN,operationId:U(50),action:'request',payload:{requestedEndDate:'2027-03-17'}},sig());
  assert.deepEqual(calls,[{name:'get_tenancy_extension',args:{p_tenancy_id:TEN}},{name:'get_pending_tenancy_extensions',args:undefined},{name:'write_tenancy_extension',args:{p_tenancy_id:TEN,p_operation_id:U(50),p_action:'request',p_payload:{requestedEndDate:'2027-03-17'}}}]);
  await assert.rejects(s.read(OWNER,TEN,sig()),ExtensionError,'the signed-in account is not the one asking');
});
test('service: definite codes keep their SQLSTATE and message for mapping; an unknown failure is "not confirmed"; a mismatched result is "not confirmed"',async()=>{
  const out:any[]=[{error:{code:'23P01',message:'extension_conflict:2027-03-10'}},{error:{code:'XX000',message:'boom'}},{data:{requestId:REQ,status:'accepted',requestedEndDate:'2027-03-17',currentEndDate:null,revision:REV}}];
  const {client}=clientWith({write_tenancy_extension:()=>out.shift()});const s=createTenancyExtensionService(()=>client);
  const op:ExtensionOperation={tenancyId:TEN,operationId:U(51),action:'request',payload:{requestedEndDate:'2027-03-17'}};
  await assert.rejects(s.write(TENANT,op,sig()),(e:any)=>e instanceof ExtensionError&&e.code==='23P01'&&e.message==='extension_conflict:2027-03-10'&&!e.uncertain);
  await assert.rejects(s.write(TENANT,op,sig()),(e:any)=>e instanceof ExtensionError&&e.uncertain&&e.code===null);
  await assert.rejects(s.write(TENANT,op,sig()),(e:any)=>e instanceof ExtensionError&&e.uncertain);
  await assert.rejects(s.write(TENANT,{...op,operationId:'nope'},sig()),ExtensionError,'an invalid operation id never reaches the server');
});
test('activity read: an owner with an active rental also gets the pending extensions; a failed or missing function gives an empty list; a tenant never asks',async()=>{
  const tenancy=(over:object)=>({id:TEN,property_id:PROP,listing_id:U(8),conversation_id:null,tenant_id:TENANT,landlord_id:OWNER,status:'active',start_date:'2026-11-12',expected_end_date:'2027-02-17',actual_end_date:null,agreed_monthly_rent:10000,rent_due_day:2,...over}) as any;
  const row={tenancyId:TEN,propertyId:PROP,requestId:REQ,requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',createdAt:'2026-11-17T01:00:00Z',conflictDate:null};
  const a=clientWith({get_pending_tenancy_extensions:()=>({data:{rows:[row],hasMore:false}})},OWNER);
  const got=await createTenancyActivityService(()=>a.client).read(OWNER,[tenancy({})],sig());assert.deepEqual(got.extensions,[row]);assert.ok(a.calls.some(c=>c.name==='get_pending_tenancy_extensions'));
  const missing=clientWith({},OWNER);assert.deepEqual((await createTenancyActivityService(()=>missing.client).read(OWNER,[tenancy({})],sig())).extensions,[],'the function is not deployed yet');
  const asTenant=clientWith({get_pending_tenancy_extensions:()=>({data:{rows:[row],hasMore:false}})},TENANT);
  const t=await createTenancyActivityService(()=>asTenant.client).read(TENANT,[tenancy({})],sig());assert.equal(asTenant.calls.some(c=>c.name==='get_pending_tenancy_extensions'),false);assert.equal(t.extensions,undefined);
  const ended=clientWith({get_pending_tenancy_extensions:()=>({data:{rows:[row],hasMore:false}})},OWNER);
  await createTenancyActivityService(()=>ended.client).read(OWNER,[tenancy({status:'ended'})],sig());assert.equal(ended.calls.some(c=>c.name==='get_pending_tenancy_extensions'),false,'no active rental, nothing to ask');
});
