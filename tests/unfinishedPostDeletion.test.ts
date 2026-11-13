/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeletionHandler} from '../supabase/functions/delete-unfinished-post/handler';
import {createUnfinishedPostWorkflow} from '../src/features/property-listing/viewModels/unfinishedPostWorkflow';
import {createUnfinishedPostService} from '../src/features/property-listing/services/unfinishedPostService';
import {UnfinishedPostError} from '../src/features/property-listing/models/UnfinishedPostDeletion';
import {readFileSync} from 'node:fs';
const id='10000000-0000-4000-8000-000000000001',owner='90000000-0000-4000-8000-000000000001',photo='20000000-0000-4000-8000-000000000001';
const status=(state:'live'|'cleanup_pending'|'completed'='live',eligible=true)=>({propertyId:id,state,eligible,reason:null});
const request=(body:unknown={propertyId:id},auth=true)=>new Request('https://edge.test/delete',{method:'POST',headers:auth?{Authorization:'Bearer synthetic-test'}:{},body:JSON.stringify(body)});
function edge(options:{denied?:boolean;storageFail?:boolean;path?:string;finishFail?:boolean;completed?:boolean}={}){
 const calls:{url:string;body:any}[]=[];
 const send:typeof fetch=async(input,init)=>{
  const url=String(input);calls.push({url,body:init?.body?JSON.parse(String(init.body)):null});
  const json=(body:unknown,code=200)=>new Response(JSON.stringify(body),{status:code});
  if(url.endsWith('/auth/v1/user'))return json({id:owner});
  if(url.endsWith('/delete_unfinished_post'))return options.denied?json({code:'42501'},403):json({propertyId:id,state:options.completed?'completed':'cleanup_pending'});
  if(url.endsWith('/get_unfinished_post_cleanup'))return json({state:'cleanup_pending',paths:[options.path??`${owner}/${id}/${photo}.jpg`]});
  if(url.includes('/storage/'))return json({},options.storageFail?503:200);
  if(url.endsWith('/finish_unfinished_post_cleanup'))return json(null,options.finishFail?409:200);
  throw Error('Unexpected request');
 };
 return {calls,handle:createDeletionHandler({url:'https://backend.test',anonKey:'public-test',serviceKey:'server-only-test'},send)};
}
test('deletion Edge verifies identity, starts owner RPC, uses only queued Storage paths then finalizes',async()=>{
 const e=edge();const r=await e.handle(request());assert.equal(r.status,200);assert.equal((await r.json()).state,'completed');assert.equal(e.calls.length,5);const storage=e.calls.find(c=>c.url.includes('/storage/'))!;assert.deepEqual(storage.body,{prefixes:[`${owner}/${id}/${photo}.jpg`]});
});
test('Edge rejects anonymous and extra privileged fields without backend calls',async()=>{
 for(const [body,auth] of [[{propertyId:id},false],[{propertyId:id,paths:['other']},true],[{propertyId:'bad'},true]] as const){const e=edge();assert.ok((await e.handle(request(body,auth))).status>=400);assert.equal(e.calls.length,0);}
});
test('server owner denial never reaches worker or Storage',async()=>{const e=edge({denied:true});assert.equal((await e.handle(request())).status,403);assert.equal(e.calls.length,2);});
for(const options of [{storageFail:true},{finishFail:true},{path:`${owner}/other/shared.jpg`}])test('cleanup failure or unsafe path stays pending and never reports full deletion '+JSON.stringify(options),async()=>{
 const e=edge(options);const r=await e.handle(request());assert.equal(r.status,202);assert.equal((await r.json()).state,'cleanup_pending');if(options.path)assert.ok(!e.calls.some(c=>c.url.includes('/storage/')));if(options.storageFail)assert.ok(!e.calls.some(c=>c.url.endsWith('/finish_unfinished_post_cleanup')));
});
test('already completed deletion retry skips Storage',async()=>{const e=edge({completed:true});assert.equal((await e.handle(request())).status,200);assert.equal(e.calls.length,2);});
test('workflow requires server eligibility and explicit confirmation; duplicate taps issue one request',async()=>{
 let calls=0,completed=0,release!:(v:any)=>void;const wait=new Promise<any>(r=>release=r);
 const w=createUnfinishedPostWorkflow({inspect:async()=>status(),pending:async()=>[],remove:async()=>{calls++;return wait;}},()=>completed++);
 await w.open(id);await w.confirm();assert.equal(calls,0);w.requestConfirmation();const first=w.confirm();await w.confirm();assert.equal(calls,1);release(status('completed',false));await first;assert.equal(completed,1);assert.equal(w.getSnapshot().busy,false);
});
test('denied, pending cleanup and uncertain responses never navigate as completed',async()=>{
 let complete=0;const w=createUnfinishedPostWorkflow({inspect:async()=>status('live',false),pending:async()=>[],remove:async()=>status('cleanup_pending',false)},()=>complete++);
 await w.open(id);w.requestConfirmation();assert.equal(w.getSnapshot().confirming,false);
 const p=createUnfinishedPostWorkflow({inspect:async()=>status(),pending:async()=>[status('cleanup_pending',false)],remove:async()=>status('cleanup_pending',false)},()=>complete++);
 await p.open(id);p.requestConfirmation();await p.confirm();assert.equal(complete,0);assert.equal(p.getSnapshot().pending.length,1);assert.match(p.getSnapshot().error!,/cleanup is pending/);
});
test('stale or disposed deletion response cannot navigate another property/account workspace',async()=>{
 let release!:(v:any)=>void,complete=0;const w=createUnfinishedPostWorkflow({inspect:async()=>status(),pending:async()=>[],remove:()=>new Promise(r=>release=r)},()=>complete++);
 await w.open(id);w.requestConfirmation();const call=w.confirm();w.dispose();release(status('completed',false));await call;assert.equal(complete,0);
});
test('pending cleanup reloads from server and resumes idempotently',async()=>{
 let complete=0;const w=createUnfinishedPostWorkflow({inspect:async()=>status(),pending:async()=>[status('cleanup_pending',false)],remove:async()=>status('completed',false)},()=>complete++);
 await w.refreshPending();await w.resume(id);assert.equal(complete,1);assert.equal(w.getSnapshot().pending.length,0);
});
test('client checks account after response and blocks deletion with unresolved saves',async()=>{
 const stored=new Map<string,string>();let user=owner,calls=0;
 const c:any={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async()=>({data:status(),error:null}),functions:{invoke:async()=>{calls++;user='another';return {data:{propertyId:id,state:'completed'},error:null};}}};
 const service=createUnfinishedPostService(()=>c,{getItem:async k=>stored.get(k)??null,removeItem:async k=>{stored.delete(k);}});
 stored.set(`rentlease:property-photos:${owner}:${id}`,'pending');await assert.rejects(service.remove(id),/earlier save/);assert.equal(calls,0);stored.clear();await assert.rejects(service.remove(id),/account changed/);assert.equal(calls,1);
});
test('unknown Edge outcome reconciles read-only instead of resending; confirmed cleanup clears only matching creation receipt',async()=>{
 const store=new Map([[`rentlease:property-creation:${owner}`,JSON.stringify({propertyId:id})]]);let calls=0;
 const c:any={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},rpc:async()=>({data:status('cleanup_pending',false),error:null}),functions:{invoke:async()=>{calls++;return {data:null,error:new Error('lost')};}}};
 const service=createUnfinishedPostService(()=>c,{getItem:async k=>store.get(k)??null,removeItem:async k=>{store.delete(k);}});
 assert.equal((await service.remove(id)).state,'cleanup_pending');assert.equal(calls,1);assert.equal(store.size,0);
});
test('UI uses restrained destructive action and explicit irreversible confirmation; wording distinguishes property/listing',()=>{
 const ui=readFileSync('src/features/property-listing/components/UnfinishedPostDeletionAction.tsx','utf8');assert.match(ui,/Delete Unfinished Post/);assert.match(ui,/Delete Permanently/);assert.match(ui,/This cannot be undone/);assert.match(ui,/state.status.eligible/);assert.match(ui,/state.pending.filter/);
 const dashboard=readFileSync('src/features/property-listing/views/PropertyDashboardView.tsx','utf8')+readFileSync('src/features/property-listing/models/PortfolioCardPresentation.ts','utf8');for(const label of ['Continue Editing','Edit Property','Edit Rental','Not Listed','My Rentals'])assert.ok(dashboard.includes(label),label);assert.ok(!dashboard.includes('Post a Rental'),'posting stays in the navbar');assert.ok(!dashboard.includes('Continue draft'));
});


test('checking an uncertain deletion can complete recovery without resending the mutation',async()=>{
 let complete=0,calls=0;
 const w=createUnfinishedPostWorkflow({inspect:async()=>status('completed',false),pending:async()=>[],remove:async()=>{calls++;throw new UnfinishedPostError('Unknown');}},()=>complete++);
 await w.open(id);await w.retry();assert.equal(calls,0);assert.equal(complete,1);
});


test('server-confirmed tombstone permits cleanup despite a stale local save journal, without clearing that unrelated journal',async()=>{
 const key=`rentlease:property-details:${owner}:${id}`,store=new Map([[key,'unknown']]);let calls=0;
 const c:any={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},rpc:async()=>({data:status('cleanup_pending',false),error:null}),functions:{invoke:async()=>{calls++;return {data:{propertyId:id,state:'completed'},error:null};}}};
 const service=createUnfinishedPostService(()=>c,{getItem:async k=>store.get(k)??null,removeItem:async k=>{store.delete(k);}});
 assert.equal((await service.remove(id)).state,'completed');assert.equal(calls,1);assert.equal(store.get(key),'unknown');
});
