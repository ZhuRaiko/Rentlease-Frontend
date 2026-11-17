import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';import {resolve,dirname} from 'node:path';import ts from 'typescript';
import {createTenancyCareWorkflow} from '../src/features/tenancy/viewModels/tenancyCareWorkflow';
import {createCareJournal} from '../src/features/tenancy/services/tenancyCareJournal';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TENANT=id(1),LANDLORD=id(2),TENANCY=id(3),REQ=id(4),REV=id(5),PROP=id(7);

// A small render harness: the real view and model sources run; shared components and hooks are replaced by tags and fixtures.
function load(file:string,mocks:Record<string,any>,cache=new Map<string,any>()):any{
  const path=resolve(file);if(cache.has(path))return cache.get(path).exports;
  const mod={exports:{} as any};cache.set(path,mod);
  const req=(key:string):any=>{
    if(/\/useBottomClearance$/.test(key))return{useBottomClearance:()=>56};
    if(key==='react')return{useState:(v:any)=>[typeof v==='function'?v():v,()=>{}],useMemo:(f:any)=>f(),useEffect:()=>{},useRef:(v:any)=>({current:v}),useCallback:(f:any)=>f};
    if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>typeof type==='function'?type(props):({type,props});return{jsx,jsxs:jsx,Fragment:'Fragment'};}
    if(key==='react-native')return new Proxy({StyleSheet:{create:(v:any)=>v,flatten:(v:any)=>v}},{get:(v:any,k)=>v[k]??k});
    for(const [name,value] of Object.entries(mocks))if(key.includes(name))return value;
    if(key.startsWith('.')){
      const base=resolve(dirname(path),key);
      if(/\/src\/shared\/components\/|\/components\/MaintenanceParts$/.test(base.replace(/\\/g,'/')))return new Proxy({},{get:(_t,name:string)=>name==='__esModule'?false:name});
      const real=['.ts','.tsx','/index.ts'].map(e=>base+e).find(existsSync);if(real)return load(real,mocks,cache);
    }
    return new Proxy({},{get:(_t,name:string)=>name});
  };
  new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(req,mod,mod.exports);
  return mod.exports;
}
const tree=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(tree)]:[];
const texts=(nodes:any[])=>nodes.filter(n=>n.type==='Text').map(n=>[n.props.children].flat(Infinity).join(''));
const labels=(nodes:any[])=>nodes.filter(n=>n.type==='StatusButton').map(n=>n.props.label);
const all=(nodes:any[])=>JSON.stringify(nodes.map(n=>[n.props?.label,n.props?.accessibilityLabel,n.props?.placeholder,[n.props?.children].flat(Infinity).filter(c=>typeof c==='string')]));

const store=()=>{const values=new Map<string,string>();return{getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v);},removeItem:async(k:string)=>{values.delete(k);}};};
const request=(o:any={})=>({id:REQ,title:'Leaking faucet',description:'The kitchen faucet leaks badly.',category:'plumbing',priority:'normal',status:'submitted',response:null,revision:REV,createdAt:new Date(Date.now()-2*3600000).toISOString(),updatedAt:new Date().toISOString(),...o});
async function careVm(requests:any[],o:{status?:string;confirmed?:boolean}={}){
  const data={tenancyId:TENANCY,tenantId:TENANT,landlordId:LANDLORD,status:o.status??'active',today:'2026-11-17',schedule:[],obligations:[],obligationsLimited:false,reminders:[],requests};
  const w=createTenancyCareWorkflow({read:async()=>data,request:async()=>({request:{tenantConfirmedAt:o.confirmed?'2026-11-17T02:00:00Z':null}}),write:async()=>({}),history:async()=>[]} as any,createCareJournal(store()),TENANT,TENANCY,()=>REQ);
  await w.load();await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  return{...w.getSnapshot(),workflow:w};
}
const listView=(care:any)=>load('src/features/tenancy/views/MaintenanceListView.tsx',{}).MaintenanceListView({care,propertyTitle:'Miguel House',landlordName:'Nightcity',onReport:()=>{},onOpen:()=>{}});
const reportView=(care:any)=>load('src/features/tenancy/views/MaintenanceReportView.tsx',{}).MaintenanceReportView({care,propertyTitle:'Miguel House',landlordName:'Nightcity'});
const inboxView=(vm:any)=>load('src/features/tenancy/views/MaintenanceInboxView.tsx',{useMaintenanceViewModels:{useMaintenanceInboxViewModel:()=>vm,useTenantNames:()=>()=>'Samuel'}}).MaintenanceInboxView({accountId:LANDLORD,propertyId:null,onOpen:()=>{}});

test('Report an issue shows property, who it goes to, six categories, three urgencies, hint and Send to landlord; no photos',async()=>{
  const nodes=tree(reportView(await careVm([]))),t=texts(nodes).join('|');
  assert.match(t,/Miguel House/);assert.match(t,/Goes to Nightcity/);assert.match(t,/What’s the problem\?/);assert.match(t,/How urgent is it\?/);assert.match(t,/Use Urgent for leaks, no power, or anything unsafe\./);assert.match(t,/What’s happening\?/);
  const chips=nodes.filter(n=>n.type==='ChoiceChip').map(n=>n.props.label);
  assert.deepEqual(chips,['Plumbing','Electrical','Appliance','Internet','Pests','Other','Urgent','Soon','Can wait']);
  assert.ok(labels(nodes).includes('Send to landlord'));
  assert.doesNotMatch(all(nodes),/photo|Photo/);
});
test('Send to landlord stays disabled until the description has 10 characters',async()=>{
  const nodes=tree(reportView(await careVm([])));assert.equal(nodes.find(n=>n.type==='StatusButton'&&n.props.label==='Send to landlord').props.disabled,true);
});
test('Report an issue retries the same send after an unknown outcome instead of making a new one',async()=>{
  const care=await careVm([]);const nodes=tree(reportView({...care,pending:{operationId:REQ,action:'create',payload:{},tenancyId:TENANCY},error:'Outcome not confirmed. Retry.'}));
  assert.ok(labels(nodes).includes('Retry sending'));assert.ok(nodes.some(n=>n.type==='Notice'&&n.props.onRetry));
});

test('tenant list: empty state offers Report an issue; Resolved tab is empty too',async()=>{
  const nodes=tree(listView(await careVm([]))),t=texts(nodes).join('|');
  assert.match(t,/No requests/);assert.ok(labels(nodes).includes('Report an issue'));assert.match(t,/Open · 0/);assert.match(t,/Resolved · 0/);
});
test('tenant list: card shows title, urgency and a Reply button; a submitted request can be cancelled, an in-progress one cannot',async()=>{
  const submitted=tree(listView(await careVm([request({priority:'urgent'})])));
  assert.deepEqual(labels(submitted).filter(l=>l!=='Report an issue'),['Reply','Cancel request']);
  assert.ok(submitted.some(n=>n.type==='StatusChip'&&n.props.chip.label==='Urgent'));assert.match(texts(submitted).join('|'),/Leaking faucet/);
  const working=tree(listView(await careVm([request({status:'in_progress'})])));
  assert.ok(!labels(working).includes('Cancel request'));
});
test('tenant list: resolved and not yet confirmed shows Confirm fixed and Not fixed and the waiting line; once confirmed it moves to Resolved',async()=>{
  const waiting=tree(listView(await careVm([request({status:'resolved',response:'Fixed it'})])));
  assert.ok(labels(waiting).includes('Confirm fixed'));assert.ok(labels(waiting).includes('Not fixed'));assert.match(texts(waiting).join('|'),/Waiting for your confirmation/);assert.match(texts(waiting).join('|'),/Open · 1/);
  const done=await careVm([request({status:'resolved'})],{confirmed:true}),nodes=tree(listView(done));
  assert.match(texts(nodes).join('|'),/Open · 0/);assert.match(texts(nodes).join('|'),/Resolved · 1/);assert.ok(!labels(nodes).includes('Confirm fixed'));
});
test('tenant list on an ended tenancy is read-only apart from confirm and cancel; no Report an issue',async()=>{
  const nodes=tree(listView(await careVm([request()],{status:'ended'})));
  assert.ok(!labels(nodes).includes('Reply'));assert.ok(!labels(nodes).includes('Report an issue'));assert.ok(labels(nodes).includes('Cancel request'));
});
test('landlord note appears in a bubble with the landlord’s name',async()=>{
  const nodes=tree(listView(await careVm([request({status:'acknowledged',response:'Plumber comes tomorrow.'})])));
  const bubble=nodes.find(n=>n.type==='NoteBubble');assert.equal(bubble.props.who,'Nightcity');assert.equal(bubble.props.text,'Plumber comes tomorrow.');
});
test('layout holds at large text: buttons wrap in rows, nothing is fixed-width, tap targets use the 48dp button family',async()=>{
  const src=readFileSync('src/features/tenancy/views/MaintenanceListView.tsx','utf8')+readFileSync('src/features/tenancy/views/MaintenanceRequestView.tsx','utf8');
  assert.match(src,/ButtonRow/);assert.doesNotMatch(src,/width:\s*\d{3,}/);assert.doesNotMatch(src,/numberOfLines/);
  const parts=readFileSync('src/features/tenancy/components/MaintenanceParts.tsx','utf8');assert.match(parts,/minHeight:\s*48/);assert.match(parts,/flexWrap:\s*'wrap'/);
});

const inboxRow=(o:any={})=>({id:REQ,tenancyId:TENANCY,propertyId:PROP,title:'Leaking faucet',category:'plumbing',priority:'urgent',status:'submitted',tenantConfirmedAt:null,createdAt:new Date(Date.now()-2*3600000).toISOString(),updatedAt:new Date().toISOString(),revision:REV,tenancyEnded:false,lastNote:null,...o});
const inboxState=(rows:any[],o:any={})=>({rows,counts:{open:rows.length,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:0},busy:false,error:null,saving:false,pending:null,ready:true,savingId:null,workflow:{act:()=>{},retry:()=>{}},...o});
test('inbox: empty state says Nothing needs you',()=>{
  const nodes=tree(inboxView(inboxState([])));assert.match(texts(nodes).join('|'),/Nothing needs you/);
});
test('inbox: counts, tenant name from the tenancy people, age, category, urgency, and Reply, Mark in progress and Seen on a new request',()=>{
  const nodes=tree(inboxView(inboxState([inboxRow()]))),t=texts(nodes).join('|');
  assert.match(t,/Samuel · 2h ago · Plumbing/);assert.ok(nodes.some(n=>n.props?.accessibilityLabel==='1 Open'));assert.ok(nodes.some(n=>n.props?.accessibilityLabel==='0 In progress'));assert.ok(nodes.some(n=>n.props?.accessibilityLabel==='0 Resolved'));
  assert.deepEqual(labels(nodes).filter(l=>l!==undefined),['Reply','Mark in progress','Seen']);assert.ok(nodes.some(n=>n.type==='StatusChip'&&n.props.chip.label==='Urgent'));
});
test('inbox: an in-progress request has Reply only, and a fix waiting for the tenant says who is awaited',()=>{
  const working=tree(inboxView(inboxState([inboxRow({status:'in_progress',priority:'normal'})])));assert.deepEqual(labels(working),['Reply']);
  const waiting=tree(inboxView(inboxState([inboxRow({status:'resolved',priority:'normal'})])));assert.match(texts(waiting).join('|'),/Waiting for Samuel to confirm/);
});
test('inbox: buttons are disabled while a write is in flight, and an error shows Retry',()=>{
  const nodes=tree(inboxView(inboxState([inboxRow()],{saving:true,error:'This changed while you were looking. Updated.'})));
  assert.ok(nodes.filter(n=>n.type==='StatusButton').every(n=>n.props.disabled));assert.ok(nodes.some(n=>n.type==='Notice'&&n.props.onRetry));
});

import {createMaintenanceRequestWorkflow} from '../src/features/tenancy/viewModels/maintenanceRequestWorkflow';
async function detail(role:'tenant'|'landlord',o:any={},thread:any[]=[]){
  const read={hasMore:false,thread,request:{id:REQ,tenancyId:TENANCY,propertyId:PROP,title:'Leaking faucet',description:'The kitchen faucet leaks badly.',category:'plumbing',priority:'urgent',status:'submitted',landlordResponse:null,scheduledFor:null,resolvedAt:null,tenantConfirmedAt:null,createdAt:new Date(Date.now()-3600000).toISOString(),updatedAt:new Date().toISOString(),revision:REV,tenancyEnded:false,role,...o}};
  const w=createMaintenanceRequestWorkflow({request:async()=>read} as any,createCareJournal(store()),role==='tenant'?TENANT:LANDLORD,REQ,()=>REQ);
  await w.load();const vm={...w.getSnapshot(),workflow:w};
  return tree(load('src/features/tenancy/views/MaintenanceRequestView.tsx',{useMaintenanceViewModels:{useMaintenanceRequestViewModel:()=>vm}}).MaintenanceRequestView({accountId:'a',requestId:REQ,otherName:role==='tenant'?'Nightcity':'Samuel'}));
}
const thread=[{id:id(50),role:'tenant',fromStatus:null,status:'submitted',note:'Sent the request.',at:new Date().toISOString()},{id:id(51),role:'landlord',fromStatus:'submitted',status:'acknowledged',note:'Seen',at:new Date().toISOString()}];
test('landlord request detail: status control, thread with "You" and the tenant name, quick replies and Send update',async()=>{
  const nodes=await detail('landlord',{},thread),b=labels(nodes);
  assert.deepEqual(b.filter(l=>['Seen','In progress','Fixed','Coming tomorrow','Need more info','Send update'].includes(l)),['Seen','In progress','Fixed','Coming tomorrow','Need more info','Send update']);
  assert.match(texts(nodes).join('|'),/Samuel confirms when it’s fixed\./);
  const bubbles=nodes.filter(n=>n.type==='NoteBubble');assert.deepEqual(bubbles.map(n=>n.props.who),['Samuel','You']);
  assert.equal(nodes.find(n=>n.type==='StatusButton'&&n.props.label==='Fixed').props.disabled,true);     // submitted: cannot jump to fixed
});
test('tenant request detail: steps, Cancel request before work starts, no landlord status control, Send reply',async()=>{
  const nodes=await detail('tenant',{},thread),b=labels(nodes);
  assert.ok(b.includes('Cancel request')&&b.includes('Send reply'));assert.ok(!b.includes('Fixed')&&!b.includes('Coming tomorrow'));assert.ok(nodes.some(n=>n.type==='StepList'));
});
test('tenant request detail: resolved and unconfirmed shows Confirm fixed and Not fixed; read-only after the tenancy ended',async()=>{
  const fixed=labels(await detail('tenant',{status:'resolved'},thread));assert.ok(fixed.includes('Confirm fixed')&&fixed.includes('Not fixed'));
  const ended=await detail('tenant',{status:'resolved',tenancyEnded:true},thread);assert.ok(labels(ended).includes('Confirm fixed'));assert.ok(!labels(ended).includes('Not fixed'));assert.ok(!labels(ended).includes('Send reply'));assert.match(texts(ended).join('|'),/read-only/);
  assert.doesNotMatch(all(ended),/photo|Photo/);
});
