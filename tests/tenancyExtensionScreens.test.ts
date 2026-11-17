// A render test for each screen state in docs/design/rentlease_f1c_stay_longer_v11.html, run with a hook-counting React: every screen renders in its
// loading or empty state first and then in each loaded state with the SAME number of hooks, and nothing throws. Interactions (press Ask, pick a
// date, press Send) go through the real component code. Plus the two feeds that list a pending request for the owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import ts from 'typescript';
import {attentionItems,type WorkspaceInput} from '../src/features/tenancy/models/TenancyWorkspaceScreen';
import {emptyActivity} from '../src/features/tenancy/services/tenancyActivityService';
import {emptyFacts,needsYou} from '../src/features/property-listing/models/PropertyManagement';
import type {ExtensionRead,ExtensionRequest} from '../src/features/tenancy/models/TenancyExtension';

const U=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TENANT=U(1),OWNER=U(2),TEN=U(3),REQ=U(4),REV=U(5),PROP=U(7),CONV=U(9);
const NOW=Date.parse('2026-11-17T04:00:00Z');
const request=(over:Partial<ExtensionRequest>={}):ExtensionRequest=>({id:REQ,status:'pending',requestedEndDate:'2027-03-17',baseEndDate:'2027-02-17',note:null,decisionNote:null,whoDecided:null,revision:REV,createdAt:'2026-11-17T01:00:00Z',decidedAt:null,conflictDate:null,canAccept:true,canDecline:true,canWithdraw:true,...over});
const read=(role:'tenant'|'landlord',over:Partial<ExtensionRead>={}):ExtensionRead=>({tenancyId:TEN,role,currentEndDate:'2027-02-17',latestEndDate:'2027-08-17',canRequest:true,cannotRequestReason:null,request:null,...over});

/** Real component sources with a hook-counting React (state persists between renders). Shared components and sibling feature components become tags named after themselves. */
function harness(mocks:Record<string,(count:()=>void)=>any>={},stubViews:RegExp=/$^/){
  const slots:any[]=[];let cursor=0,hooks=0;const cache=new Map<string,any>(),alerts:any[][]=[];
  const count=()=>{hooks++;cursor++;};
  const keep=(make:()=>any)=>{hooks++;const i=cursor++;if(!(i in slots))slots[i]=make();return slots[i];};
  const react={useState:(v:any)=>keep(()=>{const cell:any=[typeof v==='function'?v():v,undefined];cell[1]=(n:any)=>{cell[0]=typeof n==='function'?n(cell[0]):n;};return cell;}),useRef:(v:any)=>keep(()=>({current:v})),useEffect:()=>{count();},useMemo:(f:any)=>{count();return f();},useCallback:(f:any)=>{count();return f;}};
  const native=new Proxy({StyleSheet:{create:(v:any)=>v,flatten:(v:any)=>v},Platform:{OS:'android'},Alert:{alert:(...a:any[])=>{alerts.push(a);}},useWindowDimensions:()=>{count();return{width:411,height:900,fontScale:1};}},{get:(v:any,k)=>v[k]??k});
  const load=(file:string):any=>{
    const path=resolve(file);if(cache.has(path))return cache.get(path).exports;
    const mod={exports:{} as any};cache.set(path,mod);
    const req=(key:string):any=>{
      if(key==='react')return react;
      if(key==='react/jsx-runtime'){const jsx=(type:any,props:any):any=>typeof type==='function'?type(props):({type,props});return{jsx,jsxs:jsx,Fragment:'Fragment'};}
      if(key==='react-native')return native;
      if(key==='react-native-safe-area-context')return{useSafeAreaInsets:()=>{count();return{top:0,bottom:0,left:0,right:0};}};
      for(const [name,make] of Object.entries(mocks))if(key.includes(name))return make(count);
      if(key.startsWith('.')){
        const base=resolve(dirname(path),key),norm=base.replace(/\\/g,'/');
        if(/\/components\//.test(norm)||stubViews.test(norm))return new Proxy({},{get:(_t,name:string)=>name==='__esModule'?false:name});
        const real=['.ts','.tsx','/index.ts'].map(e=>base+e).find(existsSync);if(real)return load(real);
      }
      return new Proxy({},{get:(_t,name:string)=>name});
    };
    new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(req,mod,mod.exports);
    return mod.exports;
  };
  return{alerts,render(file:string,name:string,props:any){cursor=0;hooks=0;const tree=load(file)[name](props);return{tree,hooks};}};
}
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
const texts=(tree:any)=>nodes(tree).filter(n=>n.type==='Text').map(n=>[n.props.children].flat(Infinity).join(''));
const byLabel=(tree:any,label:string)=>nodes(tree).find(n=>n.props?.label===label||n.props?.accessibilityLabel===label);
const labels=(tree:any)=>nodes(tree).filter(n=>n.type==='StatusButton').map(n=>n.props.label);

// ---------------------------------------------------------------- tenant: v11 screens 1, 5, 6 (the stay card block)
const BLOCK='src/features/tenancy/components/ExtensionStayBlock.tsx';
import {tenantExtensionView} from '../src/features/tenancy/models/TenancyExtension';
test('v11 screen 1: "Ask to extend" under the stay card; nothing at all when the tenancy is not active',()=>{
  const h=harness();const props=(view:any)=>({view,saving:false,notice:null,error:null,onAsk(){},onCancel(){}});
  const ask=h.render(BLOCK,'ExtensionStayBlock',props(tenantExtensionView({read:read('tenant'),tenancyActive:true,ownerName:'Samuel',now:NOW})));
  assert.deepEqual(labels(ask.tree),['Ask to extend']);
  const none=h.render(BLOCK,'ExtensionStayBlock',props(tenantExtensionView({read:read('tenant'),tenancyActive:false,ownerName:'Samuel',now:NOW})));
  assert.equal(none.tree,null,'an ended or upcoming tenancy shows no button and no request');assert.equal(none.hooks,ask.hooks);
  assert.equal(h.render(BLOCK,'ExtensionStayBlock',props(tenantExtensionView({read:read('tenant',{canRequest:false,cannotRequestReason:'early_end_pending'}),tenancyActive:true,ownerName:'Samuel',now:NOW}))).tree,null,'hidden while an early-end request is pending');
  assert.equal(h.render(BLOCK,'ExtensionStayBlock',props(tenantExtensionView({read:null,tenancyActive:true,ownerName:'Samuel',now:NOW}))).tree,null,'hidden when the feature could not be read');
});
test('v11 screen 5: Waiting for <owner>, the old end date still shown, Cancel request withdraws, no Ask button',()=>{
  const h=harness();let cancelled=0;
  const view=tenantExtensionView({read:read('tenant',{canRequest:false,cannotRequestReason:'request_pending',request:request()}),tenancyActive:true,ownerName:'Samuel',now:NOW});
  const w=h.render(BLOCK,'ExtensionStayBlock',{view,saving:false,notice:null,error:null,onAsk(){},onCancel(){cancelled++;}});
  const all=texts(w.tree).join('|');
  assert.ok(nodes(w.tree).some(n=>n.type==='StatusChip'&&n.props.chip.label==='Waiting for Samuel'));assert.ok(all.includes('You asked to stay until Mar 17'));assert.ok(all.includes('Your stay still ends Feb 17 until Samuel agrees.'));
  assert.deepEqual(labels(w.tree),['Cancel request']);byLabel(w.tree,'Cancel request').props.onPress();assert.equal(cancelled,1);
  const busy=h.render(BLOCK,'ExtensionStayBlock',{view,saving:true,notice:null,error:null,onAsk(){},onCancel(){}});assert.equal(byLabel(busy.tree,'Cancel request').props.disabled,true,'locked while it is being sent');
});
test('v11 screen 6: after the owner accepts, the new end date shows and "Ask to extend" returns',()=>{
  const decided=new Date(NOW-3600000).toISOString();
  const view=tenantExtensionView({read:read('tenant',{currentEndDate:'2027-03-17',latestEndDate:'2027-09-17',request:request({status:'accepted',decidedAt:decided,whoDecided:'landlord'})}),tenancyActive:true,ownerName:'Samuel',now:NOW});
  const b=harness().render(BLOCK,'ExtensionStayBlock',{view,saving:false,notice:null,error:null,onAsk(){},onCancel(){}});
  assert.ok(nodes(b.tree).some(n=>n.type==='StatusChip'&&n.props.chip.label==='Extended'));assert.ok(texts(b.tree).includes('Your stay now ends Mar 17'));assert.deepEqual(labels(b.tree),['Ask to extend']);
});

// ---------------------------------------------------------------- the sheet: v11 screens 2, 3 and 4
const SHEET_FILE='src/features/tenancy/components/ExtensionSheet.tsx';
test('v11 screen 2: +1, +3, +6 months each with its date, Pick a date, New end date, Rent stays, Send request; sending closes the sheet on success',async()=>{
  const sent:string[]=[];let closed=0;const h=harness();
  const props=(over:object={})=>({visible:true,read:read('tenant'),ownerName:'Samuel',rent:25000,saving:false,error:null,conflictDate:null,onSend:async(d:string)=>{sent.push(d);return true;},onClose(){closed++;},...over});
  const hidden=h.render(SHEET_FILE,'ExtensionSheet',props({visible:false}));assert.equal(hidden.tree,null);
  const s=h.render(SHEET_FILE,'ExtensionSheet',props()),all=texts(s.tree).join('|');
  assert.equal(s.hooks,hidden.hooks,'the same hooks whether or not the sheet is showing');
  for(const t of ['How much longer do you want to stay?','+1 month','to Mar 17','+3 months','to May 17','+6 months','to Aug 17','Pick a date','New end date','Mar 17','Rent','Stays ₱25,000','Samuel has to agree. Nothing changes until Samuel does. You can ask again later.'])assert.ok(all.includes(t),t);
  assert.deepEqual(labels(s.tree),['Send request','Not now']);assert.equal(byLabel(s.tree,'Send request').props.disabled,false,'+1 month is preselected');
  byLabel(s.tree,'+3 months, to May 17').props.onPress();const m3=h.render(SHEET_FILE,'ExtensionSheet',props());assert.ok(texts(m3.tree).includes('May 17'),'the new end date follows the choice');
  byLabel(m3.tree,'Send request').props.onPress();await new Promise(r=>setImmediate(r));assert.deepEqual(sent,['2027-05-17']);assert.equal(closed,1);
  byLabel(m3.tree,'Not now').props.onPress();assert.equal(closed,2);
  assert.equal(byLabel(h.render(SHEET_FILE,'ExtensionSheet',props({saving:true})).tree,'Sending…').props.disabled,true);
});
test('v11 screen 3: Pick a date opens the calendar limited to the window; picking a day sets the new end date; Back returns',async()=>{
  const sent:string[]=[];const h=harness();
  const props=()=>({visible:true,read:read('tenant'),ownerName:'Samuel',rent:25000,saving:false,error:null,conflictDate:null,onSend:async(d:string)=>{sent.push(d);return true;},onClose(){}});
  const first=h.render(SHEET_FILE,'ExtensionSheet',props());byLabel(first.tree,'Pick a date').props.onPress();
  const p=h.render(SHEET_FILE,'ExtensionSheet',props());assert.equal(p.hooks,first.hooks);
  assert.ok(texts(p.tree).includes('Pick the new end date'));assert.ok(texts(p.tree).includes('You can pick Feb 18 to Aug 17, up to 6 months at a time.'));
  const cal=nodes(p.tree).find(n=>n.type==='ExtensionCalendar')!;assert.deepEqual(cal.props.bounds,{earliest:'2027-02-18',latest:'2027-08-17'});assert.deepEqual(cal.props.month,{year:2027,month:2});
  assert.equal(byLabel(p.tree,'Send request').props.disabled,true,'nothing is picked yet');
  cal.props.onSelect('2027-03-17');const picked=h.render(SHEET_FILE,'ExtensionSheet',props());assert.ok(texts(picked.tree).includes('Mar 17'));assert.equal(byLabel(picked.tree,'Send request').props.disabled,false);
  byLabel(picked.tree,'Send request').props.onPress();await new Promise(r=>setImmediate(r));assert.deepEqual(sent,['2027-03-17']);
  byLabel(picked.tree,'Back').props.onPress();assert.ok(texts(h.render(SHEET_FILE,'ExtensionSheet',props()).tree).includes('How much longer do you want to stay?'));
});
test('the calendar itself: days outside the window are greyed text, not buttons; inside they are 48dp buttons; month buttons stop at the window',()=>{
  const CAL='src/features/tenancy/components/ExtensionCalendar.tsx';const h=harness();
  const feb=h.render(CAL,'ExtensionCalendar',{bounds:{earliest:'2027-02-18',latest:'2027-08-17'},selected:'2027-02-20',month:{year:2027,month:2},onMonth(){},onSelect(){}});
  const days=nodes(feb.tree).filter(n=>n.type==='Pressable'&&/^Feb \d+$/.test(String(n.props.accessibilityLabel)));assert.equal(days.length,11,'Feb 18 to Feb 28');assert.ok(days.every(d=>[d.props.style].flat(Infinity).some((x:any)=>x?.height===48)),'every day is 48dp tall');
  assert.equal(nodes(feb.tree).find(n=>n.props?.accessibilityLabel==='Feb 20').props.accessibilityState.selected,true);
  assert.equal(nodes(feb.tree).find(n=>n.props?.accessibilityLabel==='Previous month').props.disabled,true,'nothing earlier than the window');assert.equal(nodes(feb.tree).find(n=>n.props?.accessibilityLabel==='Next month').props.disabled,false);
  assert.ok(!nodes(feb.tree).some(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Feb 17'),'the current end date is not selectable');
});
test('v11 screen 4: a clash stays on the sheet as a red alert with the first clashing date only; Send stays off until the date changes',async()=>{
  const h=harness();let result=false;const calls:string[]=[];
  const props=(over:object={})=>({visible:true,read:read('tenant'),ownerName:'Samuel',rent:25000,saving:false,error:'Another stay starts Mar 10.',conflictDate:null as string|null,onSend:async(d:string)=>{calls.push(d);return result;},onClose(){calls.push('close');},...over});
  const s0=h.render(SHEET_FILE,'ExtensionSheet',props({error:null}));byLabel(s0.tree,'+1 month, to Mar 17').props.onPress();
  const s1=h.render(SHEET_FILE,'ExtensionSheet',props({error:null}));byLabel(s1.tree,'Send request').props.onPress();await new Promise(r=>setImmediate(r));
  assert.deepEqual(calls,['2027-03-17'],'a refused send does not close the sheet');
  const clash=h.render(SHEET_FILE,'ExtensionSheet',props({conflictDate:'2027-03-10'})),all=texts(clash.tree).join('|');
  assert.equal(clash.hooks,s0.hooks);assert.ok(all.includes('Another stay starts Mar 10'));assert.ok(all.includes('Pick a date before Mar 10. Dates from then on are not available.'));
  assert.ok(nodes(clash.tree).some(n=>n.props?.accessibilityRole==='alert'));assert.ok(!all.includes('Samuel'.concat(' declined')),'no names in the alert');assert.equal(byLabel(clash.tree,'Send request').props.disabled,true,'Send is off until the date changes');
  assert.ok(texts(clash.tree).includes('Mar 17'),'the sheet is still open on the same date');
  byLabel(clash.tree,'+1 month, to Mar 17').props.onPress();
  const other=h.render(SHEET_FILE,'ExtensionSheet',props({conflictDate:'2027-03-10'}));byLabel(other.tree,'+3 months, to May 17').props.onPress();
  const changed=h.render(SHEET_FILE,'ExtensionSheet',props({conflictDate:'2027-03-10'}));assert.equal(byLabel(changed.tree,'Send request').props.disabled,false,'a different date can be sent');
  const generic=h.render(SHEET_FILE,'ExtensionSheet',props({error:'Something went wrong. Try again.',conflictDate:null}));assert.ok(texts(generic.tree).includes('Something went wrong. Try again.'));
});

// ---------------------------------------------------------------- owner: v11 screens 7 and 8
const OWNER_PANEL='src/features/tenancy/views/TenancyExtensionRequestPanel.tsx';
import {acceptClash,ownerExtensionView} from '../src/features/tenancy/models/TenancyExtension';
test('v11 screen 7: Now ends, Asks until, extra time, rent stays, rent due, an optional note, Accept, Message and Decline',()=>{
  const view=ownerExtensionView({read:read('landlord',{request:request()}),tenancyActive:true,tenantName:'Maria',propertyTitle:'Fully Furnished Condominium',rent:25000,dueDay:17})!;
  const h=harness();const calls:string[]=[];
  const p=(over:object={})=>({view,asksTitle:'Maria asks to stay until Mar 17',clash:null,saving:false,error:null,notice:null,canMessage:true,onAccept(){calls.push('accept');},onDecline:(n:string)=>calls.push(`decline:${n}`),onMessage(){calls.push('message');},...over});
  const empty=h.render(OWNER_PANEL,'TenancyExtensionRequestPanel',p({view:null}));assert.ok(texts(empty.tree).includes('No extension request is waiting for you.'));
  const r=h.render(OWNER_PANEL,'TenancyExtensionRequestPanel',p()),all=texts(r.tree).join('|');
  assert.equal(r.hooks,empty.hooks,'the empty state and the request run the same hooks');
  for(const t of ['Maria asks to stay longer','Fully Furnished Condominium','Now ends','Feb 17','Asks until','Mar 17','Extra time','1 month','Rent','Stays ₱25,000 / month','Rent due','The 17th, as now','Optional note to Maria if you decline'])assert.ok(all.includes(t),t);
  assert.ok(nodes(r.tree).some(n=>n.type==='StatusChip'&&n.props.chip.label==='Needs your OK'));assert.deepEqual(labels(r.tree),['Accept','Message Maria','Decline']);
  assert.ok(!labels(r.tree).some(l=>/counter|offer/i.test(l)),'no counter-offer');
  assert.equal(byLabel(r.tree,'Accept').props.disabled,false,'Accept is always tappable');byLabel(r.tree,'Accept').props.onPress();byLabel(r.tree,'Message Maria').props.onPress();byLabel(r.tree,'Decline').props.onPress();
  nodes(r.tree).find(n=>n.props?.accessibilityLabel==='Optional note to Maria if you decline').props.onChangeText('Not this time');const typed=h.render(OWNER_PANEL,'TenancyExtensionRequestPanel',p());byLabel(typed.tree,'Decline').props.onPress();
  assert.deepEqual(calls,['accept','message','decline:','decline:Not this time']);
  assert.ok(!labels(h.render(OWNER_PANEL,'TenancyExtensionRequestPanel',p({canMessage:false})).tree).includes('Message Maria'),'no Message without a conversation');
  assert.equal(byLabel(h.render(OWNER_PANEL,'TenancyExtensionRequestPanel',p({saving:true})).tree,'Working…').props.disabled,true);
});
test('v11 screen 8: Accept stays tappable; if the server finds a clash the banner shows on the same screen with the first clashing date',()=>{
  const view=ownerExtensionView({read:read('landlord',{request:request({conflictDate:'2027-03-10',canAccept:false})}),tenancyActive:true,tenantName:'Maria',propertyTitle:'Fully Furnished Condominium',rent:25000,dueDay:17})!;
  const h=harness();const p=(over:object={})=>({view,asksTitle:'Maria asks to stay until Mar 17',clash:null,saving:false,error:null,notice:null,canMessage:true,onAccept(){},onDecline(){},onMessage(){},...over});
  const before=h.render(OWNER_PANEL,'TenancyExtensionRequestPanel',p());
  assert.ok(!texts(before.tree).join('|').includes('Another stay starts'),'the clash is never shown up front, even though the read carries conflictDate');assert.equal(byLabel(before.tree,'Accept').props.disabled,false);
  const clash=acceptClash({conflictDate:'2027-03-10',asks:'Mar 17',tenantName:'Maria',reference:'2027-02-17'});
  const after=h.render(OWNER_PANEL,'TenancyExtensionRequestPanel',p({clash})),all=texts(after.tree).join('|');
  assert.equal(after.hooks,before.hooks);assert.ok(all.includes('Maria asks to stay until Mar 17'));assert.ok(all.includes('Another stay starts Mar 10'));
  assert.ok(all.includes('Accept did not go through. Another stay starts Mar 10, so Mar 17 is not available. Decline and ask Maria to pick an earlier date.'));
  assert.ok(nodes(after.tree).some(n=>n.props?.accessibilityRole==='alert'));assert.deepEqual(labels(after.tree),['Accept','Message Maria','Decline']);assert.equal(byLabel(after.tree,'Accept').props.disabled,false,'Accept stays tappable after the clash');
});

// ---------------------------------------------------------------- tenancy details: the whole screen, loading then each state, the same hooks
const DETAILS='src/features/tenancy/views/TenancyDetailsView.tsx';
const STUB=/\/views\/(TenancyLifecyclePanel|MaintenanceFlowView|RentLedgerPanel|TenancyExtensionRequestPanel)$/;
const tenancyRow=(over:object={})=>({id:TEN,property_id:PROP,listing_id:U(8),conversation_id:CONV,tenant_id:TENANT,landlord_id:OWNER,status:'active',start_date:'2026-11-12',expected_end_date:'2027-02-17',actual_end_date:null,agreed_monthly_rent:25000,rent_due_day:17,tenant_confirmed_at:null,landlord_confirmed_at:null,...over});
const detailsData=(over:object={})=>({tenancy:tenancyRow(over),context:{title:'Fully Furnished Condominium',property:null,photos:[],notice:null},reservation:null,conversationId:CONV,conversationNotice:null,reservationNotice:null});
function detailsHarness(){
  const state={phase:'loading' as string,data:null as any,panel:'details',ext:{read:null as any,conflictDate:null as any,error:null as any,notice:null as any,saving:false},calls:[] as string[]};
  const ext=()=>({...state.ext,ready:true,busy:false,pending:null,workflow:{accept:async()=>{state.calls.push('accept');return true;},decline:async(n?:string)=>{state.calls.push(`decline:${n??''}`);return true;},withdraw:async()=>{state.calls.push('withdraw');return true;},request:async(d:string)=>{state.calls.push(`request:${d}`);return true;},clearError(){state.calls.push('clearError');},load:async()=>{}}});
  const h=harness({
    useTenancyDetailsViewModel:c=>({useTenancyDetailsViewModel:()=>{c();return{phase:state.phase,data:state.data,error:null,panel:state.panel,identities:{},workflow:{back(){state.calls.push('back');state.panel='details';return true;},load:async()=>{state.calls.push('load');},open(p:string){state.calls.push(`open:${p}`);state.panel=p;}}};}}),
    useTenancyCareViewModel:c=>({useTenancyCareViewModel:()=>{c();return{data:null};}}),useTenancyLifecycleViewModel:c=>({useTenancyLifecycleViewModel:()=>{c();return{data:null};}}),
    useRentalReviews:c=>({useRentalReviews:()=>{c();return{data:null};}}),
    useRentLedgerViewModel:c=>({useRentLedgerViewModel:()=>{c();return{rows:[],notice:null,error:null,saving:false,busy:false,pending:null,workflow:{act:async()=>true,retry:async()=>true}};}}),
    useTenancyExtensionViewModel:c=>({useTenancyExtensionViewModel:()=>{c();return ext();}}),
  },STUB);
  return {state,render:(actor:string)=>h.render(DETAILS,'TenancyDetailsView',{accountId:actor,tenancyId:TEN,reservationId:null,onBack(){},onOpenConversation(id:string){state.calls.push(`chat:${id}`);},registerBackAction(){}})};
}
test('tenancy details, tenant: loading, then Ask to extend, the sheet, waiting, an ended tenancy, run the same hooks; the button follows the rules',()=>{
  const d=detailsHarness();const loading=d.render(TENANT);
  d.state.phase='success';d.state.data=detailsData();d.state.ext.read=read('tenant');
  const ask=d.render(TENANT);assert.equal(ask.hooks,loading.hooks,'loading -> loaded');
  const block=nodes(ask.tree).find(n=>n.type==='ExtensionStayBlock')!;assert.equal(block.props.view.state,'ask');assert.equal(block.props.view.canAsk,true);
  assert.ok(texts(ask.tree).some(t=>/^Ends (in \d+ days|tomorrow|today)$/.test(t))||texts(ask.tree).some(t=>/^Ends /.test(t)),'an "Ends in N days" line');
  assert.equal(nodes(ask.tree).find(n=>n.type==='ExtensionSheet')!.props.visible,false);
  block.props.onAsk();const open=d.render(TENANT);assert.equal(open.hooks,loading.hooks);const sheet=nodes(open.tree).find(n=>n.type==='ExtensionSheet')!;
  assert.equal(sheet.props.visible,true);assert.equal(sheet.props.rent,25000);assert.equal(sheet.props.ownerName,'Property Owner');assert.equal(sheet.props.conflictDate,null);
  d.state.ext.read=read('tenant',{canRequest:false,cannotRequestReason:'request_pending',request:request()});const waiting=d.render(TENANT);
  assert.equal(waiting.hooks,loading.hooks);const wb=nodes(waiting.tree).find(n=>n.type==='ExtensionStayBlock')!;assert.deepEqual([wb.props.view.state,wb.props.view.canAsk,wb.props.view.canCancel],['waiting',false,true]);
  wb.props.onCancel();assert.deepEqual(d.state.calls.filter(c=>c==='withdraw'),['withdraw']);
  d.state.data=detailsData({status:'ended',actual_end_date:'2027-02-10'});const ended=d.render(TENANT);
  assert.equal(ended.hooks,loading.hooks);assert.equal(nodes(ended.tree).find(n=>n.type==='ExtensionStayBlock')!.props.view.state,'hidden','hidden when the tenancy is not active, whatever the read says');
  d.state.data=detailsData({status:'active'});d.state.ext.read=read('tenant',{canRequest:false,cannotRequestReason:'early_end_pending'});
  assert.equal(nodes(d.render(TENANT).tree).find(n=>n.type==='ExtensionStayBlock')!.props.view.state,'hidden','hidden while an early-end request is pending');
  d.state.ext.read=null;assert.equal(nodes(d.render(TENANT).tree).find(n=>n.type==='ExtensionStayBlock')!.props.view.state,'hidden','hidden when the RPC is missing');
});
test('tenancy details, owner: a pending request shows a Review request card; the Extension request panel answers it and returns to the details',async()=>{
  const d=detailsHarness();const loading=d.render(OWNER);
  d.state.phase='success';d.state.data=detailsData();d.state.ext.read=read('landlord');
  const none=d.render(OWNER);assert.equal(none.hooks,loading.hooks);assert.ok(!labels(none.tree).includes('Review request'),'nothing is waiting');
  d.state.ext.read=read('landlord',{request:request()});const pending=d.render(OWNER);assert.equal(pending.hooks,loading.hooks);
  assert.ok(texts(pending.tree).includes('Renter asks to stay longer'),'the Review request card names the tenant');byLabel(pending.tree,'Review request').props.onPress();assert.ok(d.state.calls.includes('open:extension'));
  const panel=d.render(OWNER);assert.equal(panel.hooks,loading.hooks);const p=nodes(panel.tree).find(n=>n.type==='TenancyExtensionRequestPanel')!;
  assert.equal(p.props.view.asks,'Mar 17');assert.equal(p.props.canMessage,true);assert.equal(p.props.clash,null);
  assert.equal(nodes(panel.tree).find(n=>n.type==='ScreenHeader').props.title,'Extension request');
  p.props.onAccept();await new Promise(r=>setImmediate(r));assert.deepEqual(d.state.calls.filter(c=>/accept|^back$|^load$/.test(c)),['accept','back','load'],'after an accept: back to the details and read them again');
  p.props.onMessage();assert.ok(d.state.calls.includes(`chat:${CONV}`));
  d.state.panel='extension';d.state.ext.conflictDate='2027-03-10';const clash=d.render(OWNER);assert.equal(clash.hooks,loading.hooks);
  assert.equal(nodes(clash.tree).find(n=>n.type==='TenancyExtensionRequestPanel')!.props.clash.title,'Another stay starts Mar 10');
  d.state.ext.conflictDate=null;d.state.data=detailsData({status:'ended',actual_end_date:'2027-02-10'});
  const ended=d.render(OWNER);assert.equal(ended.hooks,loading.hooks);assert.equal(nodes(ended.tree).find(n=>n.type==='TenancyExtensionRequestPanel')!.props.view,null,'a request whose tenancy is no longer active is not shown');
});

// ---------------------------------------------------------------- the owner's lists: Tenancy tab "Needs your attention" and Manage "Needs you"
const tenancy=(over:object={})=>({id:TEN,property_id:PROP,listing_id:U(8),conversation_id:CONV,tenant_id:TENANT,landlord_id:OWNER,status:'active',start_date:'2026-11-12',expected_end_date:'2027-02-17',actual_end_date:null,agreed_monthly_rent:25000,rent_due_day:17,tenant_confirmed_at:'2026-11-11T00:00:00Z',landlord_confirmed_at:'2026-11-11T00:00:00Z',...over}) as any;
const pendingRow={tenancyId:TEN,propertyId:PROP,requestId:REQ,requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',createdAt:'2026-11-17T01:00:00Z',conflictDate:null};
const input=(actor:string,over:Partial<WorkspaceInput>={}):WorkspaceInput=>({actor,tenancies:[tenancy()],reservations:[],links:[],contexts:{[TEN]:{title:'Fully Furnished Condominium',listingStatus:'active',property:null,photos:[],notice:null} as any},identities:{[TENANT]:{id:TENANT,nickname:'Maria',avatarUrl:null,avatarPath:null}},activity:{...emptyActivity(),extensions:[pendingRow]},now:NOW,...over});
test('Tenancy tab: the owner sees the request under Needs your attention and it opens the Extension request panel; the tenant and inactive rentals do not',()=>{
  const items=attentionItems(input(OWNER)).filter(i=>i.kind==='extension_request');
  assert.equal(items.length,1);const x=items[0]!;
  assert.deepEqual([x.title,x.buttonLabel,x.chip,x.role],['Extension request','Review',{label:'Needs your OK',tone:'warning'},'landlord']);assert.equal(x.subtitle,'Fully Furnished Condominium · Maria asks to stay until Mar 17');
  assert.deepEqual(x.action,{kind:'details',tenancyId:TEN,panel:'extension'});
  assert.deepEqual(attentionItems(input(TENANT)).filter(i=>i.kind==='extension_request'),[],'a tenant is never asked to answer');
  assert.deepEqual(attentionItems(input(OWNER,{tenancies:[tenancy({status:'ended',actual_end_date:'2027-02-10'})]})).filter(i=>i.kind==='extension_request'),[],'hidden once the tenancy is no longer active');
  assert.deepEqual(attentionItems(input(OWNER,{activity:emptyActivity()})),[],'no feed, no item (an older server, a failed read)');
  assert.equal(attentionItems(input(OWNER,{activity:{...emptyActivity(),extensions:[pendingRow,{...pendingRow,tenancyId:U(60),requestId:U(61)}]}})).filter(i=>i.kind==='extension_request').length,1,'a request for a tenancy that is not in the list is ignored');
});
test('Manage: the pending request is a Needs you row that opens the same panel; nothing without it',()=>{
  const stay={tenancyId:TEN,tenantId:TENANT,tenantName:'Maria',startDate:'2026-11-12',endDate:'2027-02-17',rent:25000,nextDue:'2026-12-17',conversationId:CONV};
  const withRequest=needsYou({...emptyFacts(),stay,extension:{tenancyId:TEN,requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17'}},NOW);
  assert.deepEqual(withRequest.map(i=>[i.chip,i.tone,i.text,i.target]),[['Extension','attention','Maria asks to stay until Mar 17',{kind:'extension',tenancyId:TEN}]]);
  assert.deepEqual(needsYou({...emptyFacts(),stay},NOW),[]);assert.deepEqual(needsYou({...emptyFacts(),extension:{tenancyId:TEN,requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17'}},NOW),[],'no active stay, no row');
  assert.equal(emptyFacts().extension,null);
});
