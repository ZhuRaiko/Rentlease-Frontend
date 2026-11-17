import {test} from 'node:test';import assert from 'node:assert/strict';
import {createCareJournal} from '../src/features/tenancy/services/tenancyCareJournal';
import {createMaintenanceRequestWorkflow} from '../src/features/tenancy/viewModels/maintenanceRequestWorkflow';
import {createMaintenanceInboxWorkflow} from '../src/features/tenancy/viewModels/maintenanceInboxWorkflow';
import {createTenancyCareWorkflow} from '../src/features/tenancy/viewModels/tenancyCareWorkflow';
import {CareError,type CareContext} from '../src/features/tenancy/models/TenancyCare';
import type {RequestRead} from '../src/features/tenancy/models/Maintenance';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TENANT=id(1),LANDLORD=id(2),TENANCY=id(3),REQ=id(4),REV=id(5),REV2=id(6),PROP=id(7);
const memory=()=>{const values=new Map<string,string>();return{values,getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v);},removeItem:async(k:string)=>{values.delete(k);}};};
const tick=()=>new Promise(r=>setImmediate(r));
const read=(o:any={},thread:any[]=[]):RequestRead=>({hasMore:false,thread,request:{id:REQ,tenancyId:TENANCY,propertyId:PROP,title:'Leaking faucet',description:'The kitchen faucet leaks.',category:'plumbing',priority:'urgent',status:'submitted',landlordResponse:null,scheduledFor:null,resolvedAt:null,tenantConfirmedAt:null,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',revision:REV,tenancyEnded:false,role:'tenant',...o}});
const svc=(o:any={})=>({request:async()=>read(),inbox:async()=>({counts:{open:0,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:0},rows:[],hasMore:false}),write:async()=>({requestId:REQ}),read:async()=>({}),history:async()=>[],list:async()=>[],...o}) as any;
const ids=()=>{let n=100;return()=>id(n++);};

test('tenant actions on a request need the right status; a wrong one sends nothing',async()=>{
  let writes=0;const w=createMaintenanceRequestWorkflow(svc({write:async()=>{writes++;return{};}}),createCareJournal(memory()),TENANT,REQ,ids());
  await w.load();
  await w.confirmFixed();await w.notFixed('Still leaks');await w.setStatus('in_progress','');   // submitted: no confirm, no reopen, tenants cannot respond
  assert.equal(writes,0);
  await w.cancel();assert.equal(writes,1);w.dispose();
});
test('Not fixed needs a note and sends reopen with the request and revision',async()=>{
  const sent:any[]=[];const w=createMaintenanceRequestWorkflow(svc({request:async()=>read({status:'resolved'}),write:async(_a:string,op:any)=>{sent.push(op);return{};}}),createCareJournal(memory()),TENANT,REQ,ids());
  await w.load();
  await w.notFixed('   ');assert.equal(sent.length,0);assert.match(w.getSnapshot().error??'',/still wrong/);
  await w.notFixed('Still dripping');
  assert.equal(sent.length,1);assert.equal(sent[0].action,'reopen');assert.deepEqual(sent[0].payload,{requestId:REQ,revision:REV,note:'Still dripping'});w.dispose();
});
test('Confirm fixed sends confirm_resolved without a required note',async()=>{
  const sent:any[]=[];const w=createMaintenanceRequestWorkflow(svc({request:async()=>read({status:'resolved'}),write:async(_a:string,op:any)=>{sent.push(op);return{};}}),createCareJournal(memory()),TENANT,REQ,ids());
  await w.load();await w.confirmFixed();assert.equal(sent[0].action,'confirm_resolved');assert.deepEqual(sent[0].payload,{requestId:REQ,revision:REV});w.dispose();
});
test('a confirmed fix and an ended tenancy offer no reply, reopen or confirm',async()=>{
  const w=createMaintenanceRequestWorkflow(svc({request:async()=>read({status:'resolved',tenantConfirmedAt:'2026-11-17T02:00:00Z'})}),createCareJournal(memory()),TENANT,REQ,ids());await w.load();
  assert.ok(Object.values(w.actions()!).every(v=>!v));w.dispose();
  const e=createMaintenanceRequestWorkflow(svc({request:async()=>read({status:'in_progress',tenancyEnded:true})}),createCareJournal(memory()),TENANT,REQ,ids());await e.load();
  assert.equal(e.actions()!.reply,false);e.dispose();
});
test('landlord status control sends respond with the typed note, or the default note when empty',async()=>{
  const sent:any[]=[];const w=createMaintenanceRequestWorkflow(svc({request:async()=>read({role:'landlord'}),write:async(_a:string,op:any)=>{sent.push(op);return{};}}),createCareJournal(memory()),LANDLORD,REQ,ids());
  await w.load();await w.setStatus('acknowledged','');
  assert.deepEqual(sent[0].payload,{requestId:REQ,revision:REV,status:'acknowledged',note:'Seen'});
  await w.setStatus('in_progress','Plumber tomorrow');assert.equal(sent.length,2);assert.equal(sent[1].payload.note,'Plumber tomorrow');
  w.dispose();
});
test('operation id is reused when the outcome is unknown and new after success',async()=>{
  const ops:string[]=[];let fail=true;const store=memory();
  const w=createMaintenanceRequestWorkflow(svc({write:async(_a:string,op:any)=>{ops.push(op.operationId);if(fail)throw new CareError('Outcome not confirmed. Retry.',true);return{};}}),createCareJournal(store),TENANT,REQ,ids());
  await w.load();await w.reply('Hello');assert.ok(w.getSnapshot().pending);assert.equal(store.values.size,1);
  fail=false;await w.retry();assert.equal(ops.length,2);assert.equal(ops[0],ops[1]);assert.equal(w.getSnapshot().pending,null);assert.equal(store.values.size,0);
  await w.reply('Again');assert.notEqual(ops[2],ops[1]);w.dispose();
});
test('buttons are locked while a write is in flight: a second tap sends nothing',async()=>{
  let calls=0,done:any;const w=createMaintenanceRequestWorkflow(svc({write:()=>{calls++;return new Promise(r=>done=r);}}),createCareJournal(memory()),TENANT,REQ,ids());
  await w.load();const first=w.reply('One');await tick();assert.equal(w.getSnapshot().saving,true);await w.reply('Two');assert.equal(calls,1);done({});await first;w.dispose();
});
test('a stale revision (40001) reloads the request and says so; an already-updated one (22023) reloads too',async()=>{
  for(const code of ['40001','22023']){
    let loads=0;const w=createMaintenanceRequestWorkflow(svc({request:async()=>{loads++;return read({revision:loads>1?REV2:REV});},write:async()=>{throw new CareError(code==='40001'?'This changed while you were looking. Updated.':'This request was already updated.',false,code);}}),createCareJournal(memory()),TENANT,REQ,ids());
    await w.load();await w.reply('Hi');
    assert.equal(loads,2,code);assert.equal(w.getSnapshot().data!.request.revision,REV2);assert.equal(w.getSnapshot().pending,null);
    assert.equal(w.getSnapshot().error,code==='40001'?'This changed while you were looking. Updated.':'This request was already updated.');w.dispose();
  }
});
test('a refused write (42501) shows one plain sentence and does not reload',async()=>{
  let loads=0;const w=createMaintenanceRequestWorkflow(svc({request:async()=>{loads++;return read();},write:async()=>{throw new CareError('This isn’t available right now.',false,'42501');}}),createCareJournal(memory()),TENANT,REQ,ids());
  await w.load();await w.reply('Hi');assert.equal(w.getSnapshot().error,'This isn’t available right now.');assert.equal(loads,1);w.dispose();
});
test('the whole thread is read page by page',async()=>{
  const offsets:number[]=[];const w=createMaintenanceRequestWorkflow(svc({request:async(_a:string,_i:string,offset:number)=>{offsets.push(offset);return{...read({},[{id:id(200+offset),role:'tenant',fromStatus:null,status:'submitted',note:`n${offset}`,at:'2026-11-17T01:00:00Z'}]),hasMore:offset<20};}}),createCareJournal(memory()),TENANT,REQ,ids());
  await w.load();assert.deepEqual(offsets,[0,20]);assert.equal(w.getSnapshot().data!.thread.length,2);w.dispose();
});

const inboxRow=(n:number,o:any={})=>({id:id(300+n),tenancyId:TENANCY,propertyId:n%2?PROP:id(8),title:`Request ${n}`,category:'plumbing',priority:'normal',status:'submitted',tenantConfirmedAt:null,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',revision:REV,tenancyEnded:false,lastNote:null,...o});
test('inbox keeps loading pages until done, keeps server order, and filters to a property',async()=>{
  const offsets:number[]=[];const pages=[Array.from({length:20},(_,i)=>inboxRow(i)),Array.from({length:5},(_,i)=>inboxRow(20+i))];
  const s=svc({inbox:async(_a:string,offset:number)=>{offsets.push(offset);const page=pages[offset/20]!;return{counts:{open:25,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:0},rows:page,hasMore:offset===0};}});
  const all=createMaintenanceInboxWorkflow(s,createCareJournal(memory()),LANDLORD,null,ids());await all.load();
  assert.deepEqual(offsets,[0,20]);assert.equal(all.getSnapshot().rows.length,25);assert.equal(all.getSnapshot().rows[0]!.title,'Request 0');assert.equal(all.getSnapshot().counts!.open,25);all.dispose();
  const one=createMaintenanceInboxWorkflow(s,createCareJournal(memory()),LANDLORD,PROP,ids());await one.load();
  assert.ok(one.getSnapshot().rows.every(r=>r.propertyId===PROP));assert.equal(one.getSnapshot().rows.length,12);assert.equal(one.getSnapshot().counts!.open,12);one.dispose();
});
test('inbox empty state has no rows and no error',async()=>{
  const w=createMaintenanceInboxWorkflow(svc(),createCareJournal(memory()),LANDLORD,null,ids());await w.load();
  assert.equal(w.getSnapshot().ready,true);assert.equal(w.getSnapshot().rows.length,0);assert.equal(w.getSnapshot().error,null);w.dispose();
});
test('inbox read failure is an amber line with Retry, not an empty list',async()=>{
  let fail=true;const w=createMaintenanceInboxWorkflow(svc({inbox:async()=>{if(fail)throw new Error('network');return{counts:{open:0,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:0},rows:[],hasMore:false};}}),createCareJournal(memory()),LANDLORD,null,ids());
  await w.load();assert.equal(w.getSnapshot().ready,false);assert.match(w.getSnapshot().error??'',/Retry/);assert.doesNotMatch(w.getSnapshot().error??'',/network/);
  fail=false;await w.retry();assert.equal(w.getSnapshot().ready,true);w.dispose();
});
test('inbox card actions follow the status and send the default note',async()=>{
  const sent:any[]=[];const row=inboxRow(1) as any;
  const w=createMaintenanceInboxWorkflow(svc({inbox:async()=>({counts:{open:1,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:0},rows:[row],hasMore:false}),write:async(_a:string,op:any)=>{sent.push(op);return{};}}),createCareJournal(memory()),LANDLORD,null,ids());
  await w.load();await w.act(row,'in_progress');assert.deepEqual(sent[0].payload,{requestId:row.id,revision:REV,status:'in_progress',note:'Work started'});
  await w.act({...row,status:'resolved'},'in_progress');assert.equal(sent.length,1);
  await w.act({...row,tenancyEnded:true},'acknowledged');assert.equal(sent.length,1);w.dispose();
});

const ctx=(requests:any[]):CareContext=>({tenancyId:TENANCY,tenantId:TENANT,landlordId:LANDLORD,status:'active',today:'2026-11-17',schedule:[],obligations:[],obligationsLimited:false,reminders:[],requests});
const careReq=(o:any={})=>({id:REQ,title:'Leaking faucet',description:'The kitchen faucet leaks.',category:'plumbing',priority:'urgent',status:'resolved',response:'Fixed it',revision:REV,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',...o});
test('tenant list: a resolved request is treated as confirmed until its confirmation is known, so no Confirm or Not fixed is offered early',async()=>{
  let release:any;const gate=new Promise(r=>release=r);
  const w=createTenancyCareWorkflow(svc({read:async()=>ctx([careReq()]),request:async()=>{await gate;return read({status:'resolved',tenantConfirmedAt:null});}}),createCareJournal(memory()),TENANT,TENANCY,ids());
  await w.load();assert.equal(w.confirmedOf(careReq()),true);
  release();await tick();await tick();assert.equal(w.confirmedOf(careReq()),false);w.dispose();
});
test('tenant creates a request once per tap and the new id is kept for the detail screen',async()=>{
  const sent:any[]=[];const w=createTenancyCareWorkflow(svc({read:async()=>ctx([]),write:async(_a:string,op:any)=>{sent.push(op);return{requestId:REQ};}}),createCareJournal(memory()),TENANT,TENANCY,ids());
  await w.load();const payload={title:'Leaking faucet',description:'The kitchen faucet leaks badly.',category:'plumbing',priority:'urgent'};
  await w.submit('create',payload);assert.equal(sent.length,1);assert.equal(w.getSnapshot().created,REQ);w.dispose();
});
test('a landlord cannot create, and an ended tenancy refuses a new report',async()=>{
  let writes=0;const s=svc({read:async()=>ctx([]),write:async()=>{writes++;return{};}});
  const l=createTenancyCareWorkflow(s,createCareJournal(memory()),LANDLORD,TENANCY,ids());await l.load();await l.submit('create',{title:'x y z',description:'The kitchen faucet leaks badly.',category:'plumbing'});assert.equal(writes,0);l.dispose();
  const ended=svc({read:async()=>({...ctx([]),status:'ended'}),write:async()=>{writes++;return{};}});
  const t=createTenancyCareWorkflow(ended,createCareJournal(memory()),TENANT,TENANCY,ids());await t.load();await t.submit('create',{title:'x y z',description:'The kitchen faucet leaks badly.',category:'plumbing'});assert.equal(writes,0);t.dispose();
});

import {propertyMaintenance} from '../src/features/tenancy/models/MaintenanceInbox';
import {readFileSync} from 'node:fs';
test('Manage tile count equals the open cards the inbox shows for the same property, and the urgent item comes from the same rows',async()=>{
  const rows=[inboxRow(1,{priority:'urgent'}),inboxRow(3,{status:'in_progress'}),inboxRow(5,{status:'resolved',tenantConfirmedAt:'2026-11-17T02:00:00Z'}),inboxRow(7,{status:'resolved'}),inboxRow(2),inboxRow(9,{status:'cancelled'})] as any[];   // odd n = PROP, n=2 is another property
  const s=svc({inbox:async()=>({counts:{open:99,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:0},rows,hasMore:false})});
  const w=createMaintenanceInboxWorkflow(s,createCareJournal(memory()),LANDLORD,PROP,ids());await w.load();
  const cards=w.getSnapshot().rows,tile=propertyMaintenance(rows,PROP);
  const openCards=cards.filter(r=>r.status!=='cancelled'&&r.status!=='rejected'&&!(r.status==='resolved'&&r.tenantConfirmedAt));
  assert.equal(tile.open,openCards.length);assert.equal(tile.open,w.getSnapshot().counts!.open);assert.equal(tile.open,3);
  assert.deepEqual(tile.urgent.map(u=>u.id),[rows[0].id]);
  assert.equal(propertyMaintenance(rows,id(8)).open,1);assert.equal(propertyMaintenance(rows,id(77)).open,0);
  w.dispose();
});
test('the occupied Manage screen no longer has Back to My properties, and Manage counts no longer read get_tenancy_care',()=>{
  assert.doesNotMatch(readFileSync('src/features/property-listing/views/ManagePropertyView.tsx','utf8'),/Back to My properties/);
  const hook=readFileSync('src/app/usePropertyManagement.ts','utf8');assert.match(hook,/careService\.inbox/);assert.doesNotMatch(hook,/activity\.care|CLOSED/);
});

// ---- mutation pass: a refused action sends nothing
test('a landlord cannot mark a new request fixed, and nobody replies once the tenancy ended',async()=>{
  const sent:any[]=[];const write=async(_a:string,op:any)=>{sent.push(op);return{};};
  const l=createMaintenanceRequestWorkflow(svc({request:async()=>read({role:'landlord'}),write}),createCareJournal(memory()),LANDLORD,REQ,ids());
  await l.load();await l.setStatus('resolved','');assert.equal(sent.length,0,'submitted cannot jump to fixed');l.dispose();
  const t=createMaintenanceRequestWorkflow(svc({request:async()=>read({status:'in_progress',tenancyEnded:true}),write}),createCareJournal(memory()),TENANT,REQ,ids());
  await t.load();await t.reply('Any news?');assert.equal(sent.length,0,'ended tenancy: no reply');t.dispose();
});
