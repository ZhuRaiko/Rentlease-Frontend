// Same idea as hooksStability.test.ts, for the screens that render twice with different data: each view runs once in its loading or empty
// state, then again with loaded data, then with a bare record (every optional field missing). The number of hooks must not change and
// nothing may throw. A view that calls a hook after an early return fails here before it reaches a device.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import ts from 'typescript';
import {createCareJournal} from '../src/features/tenancy/services/tenancyCareJournal';
import {createTenancyCareWorkflow} from '../src/features/tenancy/viewModels/tenancyCareWorkflow';
import {createMaintenanceRequestWorkflow} from '../src/features/tenancy/viewModels/maintenanceRequestWorkflow';
import {createMaintenanceInboxWorkflow} from '../src/features/tenancy/viewModels/maintenanceInboxWorkflow';
import {emptyFacts,type ManagedFacts} from '../src/features/property-listing/models/PropertyManagement';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TENANT=id(1),LANDLORD=id(2),TENANCY=id(3),REQ=id(4),REV=id(5),PROP=id(7);
const tick=()=>new Promise(r=>setImmediate(r));
const store=()=>{const values=new Map<string,string>();return{getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v);},removeItem:async(k:string)=>{values.delete(k);}};};

/** Runs real view sources with a hook-counting React: state persists between renders, every hook call is counted. */
function harness(mocks:Record<string,(count:()=>void)=>any>={}){
  const slots:any[]=[];let cursor=0,hooks=0;const cache=new Map<string,any>();
  const count=()=>{hooks++;cursor++;};
  const keep=(make:()=>any)=>{hooks++;const i=cursor++;if(!(i in slots))slots[i]=make();return slots[i];};
  const react={
    useState:(v:any)=>keep(()=>{const cell:any=[typeof v==='function'?v():v,undefined];cell[1]=(n:any)=>{cell[0]=typeof n==='function'?n(cell[0]):n;};return cell;}),
    useRef:(v:any)=>keep(()=>({current:v})),useEffect:()=>{count();},useMemo:(f:any)=>{count();return f();},useCallback:(f:any)=>{count();return f;},
  };
  const native=new Proxy({StyleSheet:{create:(v:any)=>v,flatten:(v:any)=>v},Platform:{OS:'android'},useWindowDimensions:()=>{count();return{width:411,height:900,fontScale:1};}},{get:(v:any,k)=>v[k]??k});
  const load=(file:string):any=>{
    const path=resolve(file);if(cache.has(path))return cache.get(path).exports;
    const mod={exports:{} as any};cache.set(path,mod);
    const req=(key:string):any=>{
    if(/\/useBottomClearance$/.test(key))return{useBottomClearance:()=>56};
      if(key==='react')return react;
      if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>({type,props});return{jsx,jsxs:jsx,Fragment:'Fragment'};}
      if(key==='react-native')return native;
      for(const [name,make] of Object.entries(mocks))if(key.includes(name))return make(count);
      if(key.startsWith('.')){
        const base=resolve(dirname(path),key);
        if(/\/components\//.test(base.replace(/\\/g,'/')))return new Proxy({},{get:(_t,name:string)=>name==='__esModule'?false:name});
        const real=['.ts','.tsx','/index.ts'].map(e=>base+e).find(existsSync);if(real)return load(real);
      }
      return new Proxy({},{get:(_t,name:string)=>name});
    };
    new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(req,mod,mod.exports);
    return mod.exports;
  };
  return{render(file:string,name:string,props:any){cursor=0;hooks=0;const tree=load(file)[name](props);return{tree,hooks};}};
}
const tree=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(tree)]:[];

// ---------------------------------------------------------------- Manage (occupied and vacant)
const owner='10000000-0000-4000-8000-000000000001';
const item=(status:string|null,over:any={}):any=>{
  const listing=status?{id:'l-1',property_id:'p1',title:'Garcia Apartment',status,asking_rent_monthly:14500,completeness_score:0.8,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',...over}:null;
  return{propertyId:'p1',property:{id:'p1',landlord_id:owner,property_type:'apartment',city:'imus',barangay:'Bayan Luma',is_active:true},listings:listing?[listing]:[],currentListing:listing,coverPhoto:null,tier3:{status:'approved',submissionId:null,updatedAt:null}};
};
const stay=(over:any={}):ManagedFacts=>({...emptyFacts(),stay:{tenancyId:'t1',tenantId:'u2',tenantName:'Samuel',startDate:'2026-11-12',endDate:'2026-12-12',rent:10000,nextDue:'2026-12-02',conversationId:'c1'},...over});
const manageVm=(it:any):any=>({portfolioState:{items:it?[it]:[]},workspacePropertyId:'p1',realListing:it?.currentListing??null,notice:null,lifecycleState:{confirmation:null,error:null,busy:false},lifecycleBlocked:false,lifecycleLabel:{pause:'Pause',reactivate:'Reactivate',archive:'Archive'},lifecycle:{request(){},confirm(){},cancel(){}},goBack(){},goDashboard(){},editManagedListing(){},editPortfolioPropertyDetails(){},estimationProperty:null});
const port=(facts:ManagedFacts):any=>({factsOf:()=>facts,loading:false,error:null,refresh(){},openTarget(){},openTenancy(){},message(){},reviewRequests(){},loadReviews(){},decline:async()=>null,acknowledgeRent:async()=>null,reviewsFor:()=>null});
const MANAGE='src/features/property-listing/views/ManagePropertyView.tsx';
const manageCases:[string,string,ManagedFacts,ManagedFacts][]=[
  ['occupied','rented',stay({maintenance:{open:2,urgent:[{id:'m1',title:'Leaking faucet',createdAt:'2026-11-16T08:00:00Z'}]},endRequest:{tenancyId:'t1',fromTenant:true},rentAwaiting:{tenancyId:'t1',dueDate:'2026-11-02',revision:id(9),paidAt:null}}),stay({stay:{tenancyId:'t1',tenantId:'u2',tenantName:null,startDate:'2026-11-12',endDate:null,rent:null,nextDue:null,conversationId:null}} as any)],
  ['vacant','active',{...emptyFacts(),reservations:[{id:'r1',conversationId:'c2',applicantName:'Em Cee',moveInDate:'2026-11-25',endDate:'2026-12-25',applicantTier1:true}]},emptyFacts()],
];
for(const [name,status,loaded,bare] of manageCases){
  test(`Manage (${name}): loading, then loaded, then a bare record, run the same hooks and do not throw`,()=>{
    const h=harness();
    const loading=h.render(MANAGE,'ManagePropertyView',{viewModel:manageVm(null),management:port(emptyFacts()),accountId:owner});
    assert.ok(tree(loading.tree).some(n=>n.type==='Text'),'the checking state shows');
    const full=h.render(MANAGE,'ManagePropertyView',{viewModel:manageVm(item(status)),management:port(loaded),accountId:owner});
    const empty=h.render(MANAGE,'ManagePropertyView',{viewModel:manageVm(item(status,{title:'',asking_rent_monthly:null})),management:port(bare),accountId:owner});
    const noPort=h.render(MANAGE,'ManagePropertyView',{viewModel:manageVm(item(status)),accountId:owner});
    assert.equal(full.hooks,loading.hooks,'loading -> loaded');assert.equal(empty.hooks,loading.hooks,'loaded -> bare');assert.equal(noPort.hooks,loading.hooks,'with no management port');
  });
}

// ---------------------------------------------------------------- Maintenance report (the tenant's Report an issue)
const careData=(status:string,requests:any[]=[])=>({tenancyId:TENANCY,tenantId:TENANT,landlordId:LANDLORD,status,today:'2026-11-17',schedule:[],obligations:[],obligationsLimited:false,reminders:[],requests});
const request=(o:any={})=>({id:REQ,title:'Leaking faucet',description:'The kitchen faucet leaks badly.',category:'plumbing',priority:'normal',status:'submitted',response:null,revision:REV,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',...o});
test('maintenance report: loading, then loaded, then an upcoming tenancy with no requests, run the same hooks',async()=>{
  const make=(data:any)=>createTenancyCareWorkflow({read:async()=>data,request:async()=>({request:{tenantConfirmedAt:null}}),write:async()=>({}),history:async()=>[]} as any,createCareJournal(store()),TENANT,TENANCY,()=>REQ);
  const h=harness(),FILE='src/features/tenancy/views/MaintenanceReportView.tsx',props=(w:any)=>({care:{...w.getSnapshot(),workflow:w},propertyTitle:'Miguel House',landlordName:'Nightcity'});
  const w=make(careData('active',[request()]));
  const loading=h.render(FILE,'MaintenanceReportView',props(w));
  await w.load();await tick();await tick();
  const loaded=h.render(FILE,'MaintenanceReportView',props(w));
  const bare=make(careData('pending_confirmation'));await bare.load();await tick();await tick();
  const upcoming=h.render(FILE,'MaintenanceReportView',props(bare));
  assert.equal(loaded.hooks,loading.hooks,'loading -> loaded');assert.equal(upcoming.hooks,loading.hooks,'loaded -> bare');
});

// ---------------------------------------------------------------- Request detail
const read=(o:any={},thread:any[]=[])=>({hasMore:false,thread,request:{id:REQ,tenancyId:TENANCY,propertyId:PROP,title:'Leaking faucet',description:'The kitchen faucet leaks.',category:'plumbing',priority:'urgent',status:'submitted',landlordResponse:null,scheduledFor:null,resolvedAt:null,tenantConfirmedAt:null,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',revision:REV,tenancyEnded:false,role:'tenant',...o}});
for(const role of ['tenant','landlord'] as const){
  test(`request detail (${role}): loading, then loaded with a thread, then a bare request, run the same hooks`,async()=>{
    let current=read({role});
    const wf=createMaintenanceRequestWorkflow({request:async()=>current} as any,createCareJournal(store()),role==='tenant'?TENANT:LANDLORD,REQ,()=>REQ);
    const FILE='src/features/tenancy/views/MaintenanceRequestView.tsx';
    const h=harness({useMaintenanceViewModels:count=>({useMaintenanceRequestViewModel:()=>{count();return{...wf.getSnapshot(),workflow:wf};}})});
    const render=()=>h.render(FILE,'MaintenanceRequestView',{accountId:'a',requestId:REQ,otherName:'Nightcity'});
    const loading=render();
    current=read({role,status:'acknowledged'},[{id:id(50),role:'landlord',fromStatus:'submitted',status:'acknowledged',note:'Seen',at:'2026-11-17T02:00:00Z'}]);await wf.load();
    const loaded=render();
    current=read({role,status:'resolved',description:'',category:null as any,landlordResponse:null,scheduledFor:null,resolvedAt:null,tenantConfirmedAt:null},[]);await wf.load();
    const bare=render();
    assert.equal(loaded.hooks,loading.hooks,'loading -> loaded');assert.equal(bare.hooks,loading.hooks,'loaded -> bare');
  });
}

// ---------------------------------------------------------------- Landlord inbox
const row=(n:number,o:any={})=>({id:id(300+n),tenancyId:TENANCY,propertyId:PROP,title:`Request ${n}`,category:'plumbing',priority:'normal',status:'submitted',tenantConfirmedAt:null,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',revision:REV,tenancyEnded:false,lastNote:null,...o});
test('inbox: loading, then loaded, then empty and bare rows, run the same hooks',async()=>{
  let rows:any[]=[row(1,{priority:'urgent'}),row(2,{status:'resolved',tenantConfirmedAt:'2026-11-17T02:00:00Z'})];
  const wf=createMaintenanceInboxWorkflow({inbox:async()=>({counts:{open:1,inProgress:0,awaitingConfirmation:0,resolved:1,urgentOpen:1},rows,hasMore:false})} as any,createCareJournal(store()),LANDLORD,null,()=>REQ);
  const FILE='src/features/tenancy/views/MaintenanceInboxView.tsx';
  const h=harness({useMaintenanceViewModels:count=>({useMaintenanceInboxViewModel:()=>{count();return{...wf.getSnapshot(),workflow:wf};},useTenantNames:()=>{count();return()=>'Samuel';}})});
  const render=()=>h.render(FILE,'MaintenanceInboxView',{accountId:LANDLORD,propertyId:null,onOpen(){}});
  const loading=render();
  await wf.load();const loaded=render();
  rows=[];await wf.load();const empty=render();
  rows=[row(3,{tenancyEnded:true,lastNote:null,status:'in_progress'})];await wf.load();const bare=render();
  assert.equal(loaded.hooks,loading.hooks,'loading -> loaded');assert.equal(empty.hooks,loading.hooks,'loaded -> empty');assert.equal(bare.hooks,loading.hooks,'empty -> bare row');
});
