// Setup screen (f1b v10), Themes first (f4b v10) and List again: one test per rule, then render tests that rerender every changed screen
// from its loading state to its loaded states and count hooks the way hooksStability.test.ts does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import ts from 'typescript';
import {setupActions,type SetupContext} from '../src/features/tenancy/models/TenancyEstablishment';
import {CANCEL_SHEET,HOW_IT_WORKS,UNCERTAIN_COPY,propertyLine,setupScreen,stayLength} from '../src/features/tenancy/models/TenancySetupScreen';
import {NO_REVIEWS_CARD,THEMES_MIN_TAGS,cloudWords,feedbackLayout,type SummaryView} from '../src/shared/models/ReviewPresentation';
import {ARCHIVED_LISTING_NOTE,portfolioArchivedNote,portfolioCardActions} from '../src/features/property-listing/models/PortfolioCardPresentation';
import {lifecycleActions} from '../src/features/property-listing/models/ListingLifecycle';

const U=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const OWNER=U(1),RENTER=U(2),RES=U(3),V1=U(4),I1=U(5),V2=U(6),CONV=U(7),TEN=U(8);
const SUMMARY='condominium, tagaytay, Maharlika West, 1 bedrooms, 1.0 bathrooms, 45.00 sqm, furnished';
const ctx=(over:Partial<SetupContext>={}):SetupContext=>({reservationId:RES,tenantId:RENTER,landlordId:OWNER,listingTitle:'Fully Furnished Condominium',propertyVersion:V1,identityRevision:I1,eligible:true,reason:null,askingRent:25000,startDate:'2026-11-18',endDate:'2027-02-17',serverNow:'2026-11-17T04:00:00Z',propertySummary:SUMMARY,setupRevision:null,tenancy:null,...over});
const tn=(over:object={})=>({id:TEN,status:'pending_confirmation',rent:25000,dueDay:17,ownerConfirmed:true,tenantConfirmed:false,propertyVersion:V1,identityRevision:I1,...over});
const names={owner:'Nightcity',renter:'Maria'};
const show=(c:SetupContext,actor:string,conversationId:string|null=CONV)=>setupScreen({ctx:c,actor,actions:setupActions(c,actor),names,conversationId});

// ---------------------------------------------------------------- setup: one state at a time
test('setup, owner before proposing: the form, the dates read-only, and "Send terms to <renter>" as the one action',()=>{
  const s=show(ctx(),OWNER);
  assert.equal(s.state,'proposing');assert.equal(s.headerTitle,'Set up tenancy');assert.equal(s.form,true);
  assert.deepEqual(s.main,{action:'create',label:'Send terms to Maria',tone:'primary',disabled:false});
  assert.deepEqual([s.cancel,s.message,s.chip,s.steps],[false,false,null,null]);
  assert.deepEqual(s.stay,{start:'Nov 18, 2026',end:'Feb 17, 2027',length:'3 months'});assert.equal(s.note,'Nothing starts until Maria confirms.');
});
test('setup, owner who cannot propose yet: the reason, no button',()=>{
  const s=show(ctx({eligible:false,reason:'This property has an overlapping tenancy.'}),OWNER);
  assert.equal(s.state,'not_eligible');assert.equal(s.main,null);assert.equal(s.reason,'This property has an overlapping tenancy.');assert.equal(s.form,false);
});
test('setup, renter before the owner proposes: says it is waiting and that there is nothing to do; no action, no cancel',()=>{
  const s=show(ctx(),RENTER);
  assert.equal(s.state,'waiting_for_owner');assert.deepEqual(s.chip,{label:'Waiting for Nightcity',tone:'warning'});
  assert.equal(s.prompt?.title,'Nightcity has not sent terms yet');assert.match(s.prompt!.text,/Nothing to do now/);
  assert.deepEqual([s.main,s.cancel,s.form],[null,false,false]);
});
test('setup, owner waiting for the renter: three facts, a four-step line, Message only with a conversation, Cancel as a quiet link',()=>{
  const c=ctx({tenancy:tn()}),s=show(c,OWNER);
  assert.equal(s.state,'owner_waiting');assert.deepEqual(s.chip,{label:'Waiting for Maria',tone:'warning'});
  assert.deepEqual(s.facts,[{label:'Rent',value:'₱25,000 / month'},{label:'Rent due',value:'The 17th of each month'},{label:'Stay',value:'Nov 18 – Feb 17 (3 months)'}]);
  assert.deepEqual(s.steps!.map(x=>[x.label,x.state]),[['Terms sent','done'],['You confirmed','done'],['Maria confirms','current'],['Move-in Nov 18','upcoming']]);
  assert.deepEqual([s.main,s.message,s.cancel,s.cancelStyle],[null,true,true,'link']);
  assert.equal(show(c,OWNER,null).message,false,'no conversation, no Message');
});
test('setup, renter who needs to confirm: "Confirm terms" is the main action, Message when available, a red Cancel button',()=>{
  const c=ctx({tenancy:tn(),setupRevision:U(9)}),s=show(c,RENTER);
  assert.equal(s.state,'renter_confirms');assert.deepEqual(s.chip,{label:'Needs your OK',tone:'warning'});assert.equal(s.prompt?.text,'Nightcity sent these terms. Check them, then confirm.');
  assert.deepEqual(s.main,{action:'confirm',label:'Confirm terms',tone:'warning',disabled:false});
  assert.deepEqual([s.message,s.cancel,s.cancelStyle],[true,true,'button']);
  assert.deepEqual(s.steps!.map(x=>x.state),['done','current','upcoming']);assert.equal(show(c,RENTER,null).message,false);
});
test('setup, both confirmed before the start date: "Start stay" is greyed with its date, nobody can press it, Cancel is a quiet link',()=>{
  for(const actor of [OWNER,RENTER]){
    const c=ctx({tenancy:tn({tenantConfirmed:true})}),s=show(c,actor);
    assert.equal(s.state,'ready');assert.deepEqual(s.chip,{label:'Ready · starts tomorrow',tone:'info'});
    assert.deepEqual(s.main,{action:null,label:'Start stay · available Nov 18',tone:'primary',disabled:true});
    assert.ok(!setupActions(c,actor).includes('activate'),'the server rule: not before the start date');
    assert.deepEqual([s.cancel,s.cancelStyle],[true,'link']);
  }
});
test('setup, start date reached: either person can press "Start stay"',()=>{
  for(const actor of [OWNER,RENTER]){
    const c=ctx({serverNow:'2026-11-18T04:00:00Z',tenancy:tn({tenantConfirmed:true})}),s=show(c,actor);
    assert.equal(s.state,'start_now');assert.deepEqual(s.main,{action:'activate',label:'Start stay',tone:'primary',disabled:false});assert.equal(s.chip?.label,'Ready to start');
  }
});
test('setup, property changed since the proposal: the owner reviews it, the renter can only cancel',()=>{
  const c=ctx({propertyVersion:V2,tenancy:tn()}),o=show(c,OWNER),r=show(c,RENTER);
  assert.equal(o.state,'property_changed');assert.deepEqual(o.main,{action:'review',label:'Review updated property',tone:'warning',disabled:false});assert.equal(o.cancel,true);
  assert.equal(r.state,'property_changed');assert.equal(r.main,null);assert.equal(r.cancel,true);assert.match(r.prompt!.text,/Waiting for Nightcity to review the update/);
});
test('setup, proposal that is no longer eligible, an active tenancy and a closed one',()=>{
  const hold=show(ctx({eligible:false,reason:'This property has an overlapping tenancy.',tenancy:tn()}),OWNER);
  assert.equal(hold.state,'not_eligible');assert.equal(hold.main,null);assert.equal(hold.cancel,true);
  assert.equal(show(ctx({tenancy:tn({status:'active',tenantConfirmed:true})}),OWNER).state,'active');
  assert.deepEqual(show(ctx({tenancy:tn({status:'cancelled'})}),RENTER).chip,{label:'Cancelled',tone:'restricted'});
  assert.deepEqual(show(ctx({tenancy:tn({status:'ended'})}),RENTER).chip,{label:'Ended',tone:'neutral'});
});
test('setup text: the property card reads as a name and one short line, the stay length is whole months or days',()=>{
  assert.equal(propertyLine(SUMMARY),'Condominium · Maharlika West, Tagaytay');
  assert.equal(propertyLine('apartment, imus, 2 bedrooms, 1 bathrooms, 30 sqm, unfurnished'),'Apartment · Imus','no barangay');
  assert.equal(propertyLine('something odd'),'something odd','an unreadable summary is shown as it is');
  assert.equal(stayLength('2026-11-18','2027-02-17'),'3 months');assert.equal(stayLength('2026-11-18','2026-12-17'),'1 month');assert.equal(stayLength('2026-11-18','2026-12-30'),'43 days');
  assert.equal(HOW_IT_WORKS.length,4);assert.ok(HOW_IT_WORKS.every(l=>l.split(' ').length<=25),'plain, short lines');
  assert.match(CANCEL_SHEET.body,/cancels the setup for both of you/);assert.equal(UNCERTAIN_COPY.retry,'Try again');assert.equal(UNCERTAIN_COPY.check,'Check status');
});

// ---------------------------------------------------------------- Themes first
const view=(counts:number[],over:Partial<SummaryView>={}):SummaryView=>({empty:false,average:'4.6',starsFilled:5,countLine:`${counts.length} reviews`,tags:counts.map((count,i)=>({code:`t${i}`,label:`Tag ${i}`,count})),...over});
test('Themes default: tabs that open on Themes at 3 tag selections or more; below that Reviews only; none at all, one muted card',()=>{
  assert.equal(THEMES_MIN_TAGS,3);
  assert.deepEqual(feedbackLayout(view([3])),{mode:'tabs',defaultTab:'Themes'},'three selections of one tag');
  assert.deepEqual(feedbackLayout(view([2,1])),{mode:'tabs',defaultTab:'Themes'},'the sum counts, not the number of tags');
  assert.deepEqual(feedbackLayout(view([2])),{mode:'reviews_only',defaultTab:'Reviews'},'two selections');
  assert.deepEqual(feedbackLayout(view([])),{mode:'reviews_only',defaultTab:'Reviews'},'reviews but no tags');
  assert.deepEqual(feedbackLayout(view([],{empty:true,average:null,countLine:'No reviews yet'})),{mode:'empty',defaultTab:null});
  assert.equal(NO_REVIEWS_CARD,'No reviews yet. Reviews appear after a tenant finishes a stay.');
});
test('Themes default is decided after the summary loads: nothing before, and a failed summary still shows the reviews',()=>{
  assert.deepEqual(feedbackLayout(null),{mode:'loading',defaultTab:null});
  assert.deepEqual(feedbackLayout(null,true),{mode:'reviews_only',defaultTab:'Reviews'});
});
test('tag cloud: size follows the count, the most used words are bold and come first',()=>{
  const words=cloudWords([{code:'a',label:'Quiet',count:2},{code:'b',label:'Clean',count:12},{code:'c',label:'Good wifi',count:9}]);
  assert.deepEqual(words.map(w=>w.label),['Clean','Good wifi','Quiet']);
  assert.equal(words[0]!.fontSize,30);assert.ok(words[0]!.bold);assert.ok(words[1]!.fontSize<30&&words[1]!.fontSize>words[2]!.fontSize);assert.ok(words[2]!.fontSize>=15&&!words[2]!.bold);
});

// ---------------------------------------------------------------- List again
const property=(status:string|null,active=true):any=>({propertyId:'p',property:{id:'p',is_active:active,property_type:'apartment',city:'imus',barangay:'Bayan Luma'},currentListing:status?{id:'l',status}:null,listings:[],coverPhoto:null,tier3:{status:'approved',submissionId:null,updatedAt:null}});
test('List again: an archived listing on an active property says "List again" and promises its reviews stay; no lifecycle rule changes',()=>{
  assert.equal(portfolioCardActions(property('archived')).primary.label,'List again');assert.equal(portfolioCardActions(property('archived')).primary.key,'createListing');
  assert.equal(portfolioArchivedNote(property('archived')),ARCHIVED_LISTING_NOTE);assert.match(ARCHIVED_LISTING_NOTE,/Its reviews and rating stay with this property\./);
  assert.equal(portfolioArchivedNote(property('paused')),null,'only where List again is offered');
  assert.notEqual(portfolioCardActions(property('paused')).primary.label,'List again');
  assert.deepEqual([lifecycleActions('active'),lifecycleActions('paused'),lifecycleActions('archived')],[['pause','archive'],['reactivate','archive'],[]],'unchanged');
});
test('the old wording is gone: no "Refresh setup status", "Create a new listing" or "Refresh review themes" is shown anywhere',()=>{
  const files:string[]=[];const walk=(d:string)=>{for(const n of readdirSync(d)){const p=join(d,n);statSync(p).isDirectory()?walk(p):/\.(ts|tsx)$/.test(n)&&files.push(p);}};walk('src');
  // The word-cloud component keeps its code (unused), so its own button label is allowed there and nowhere else.
  for(const phrase of ['Refresh setup status','Create a new listing','Owner: confirmed','Propose tenancy','No payment processing, billing ledger'])
    assert.deepEqual(files.filter(f=>readFileSync(f,'utf8').includes(phrase)),[],phrase);
  assert.deepEqual(files.filter(f=>readFileSync(f,'utf8').includes('Refresh review themes')&&!f.endsWith('PropertyReviewWordCloud.tsx')),[]);
  const section=readFileSync('src/shared/components/RentalFeedbackSection.tsx','utf8');assert.ok(!/<PropertyReviewWordCloud/.test(section)&&!section.includes("from './PropertyReviewWordCloud'"),'the section no longer renders the word cloud');
});

// ---------------------------------------------------------------- hooks: the same hooks on every render
function harness(mocks:Record<string,(count:()=>void)=>any>={}){
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
      if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>({type,props});return{jsx,jsxs:jsx,Fragment:'Fragment'};}
      if(key==='react-native')return native;
      for(const [name,make] of Object.entries(mocks))if(key.includes(name))return make(count);
      if(key.startsWith('.')){
        const base=resolve(dirname(path),key);
        if(/\/components\//.test(base.replace(/\\/g,'/'))&&!/\/ReviewPresentation$/.test(base))return new Proxy({},{get:(_t,name:string)=>name==='__esModule'?false:name});
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
const SETUP='src/features/tenancy/views/TenancySetupView.tsx';
function setupVm(c:SetupContext|null,actor:string,over:any={}){
  const calls:string[]=[],workflow={submit:async(a:string)=>{calls.push(`submit:${a}`);},getSnapshot:()=>({notice:null}),load:async()=>{calls.push('load');},retry:async()=>{calls.push('retry');},setDraft(){}};
  return{calls,vm:{context:c,draft:{rent:'25000',dueDay:''},busy:!c,saving:false,uncertain:false,error:null,notice:null,actions:c?setupActions(c,actor):[],workflow,...over}};
}
test('setup view: loading, then every state, then the cancel sheet, run the same hooks; pull to refresh; no Refresh button; help is collapsed',()=>{
  const states:[string,SetupContext,string][]=[
    ['owner proposing',ctx(),OWNER],['renter waiting',ctx(),RENTER],['owner waiting',ctx({tenancy:tn()}),OWNER],['renter confirms',ctx({tenancy:tn(),setupRevision:U(9)}),RENTER],
    ['ready',ctx({tenancy:tn({tenantConfirmed:true})}),OWNER],['start now',ctx({serverNow:'2026-11-18T04:00:00Z',tenancy:tn({tenantConfirmed:true})}),RENTER],['changed',ctx({propertyVersion:V2,tenancy:tn()}),OWNER],
  ];
  for(const [label,c,actor] of states){
    const messages:string[]=[];let current=setupVm(null,actor);
    const h=harness({useTenancyEstablishmentViewModel:count=>({useTenancyEstablishmentViewModel:()=>{count();return current.vm;}})});
    const render=()=>h.render(SETUP,'TenancySetupView',{accountId:actor,reservationId:RES,onBack(){},onChanged(){},conversationId:CONV,names,onMessage:(id:string)=>messages.push(id)});
    const loading=render();
    current=setupVm(c,actor);const loaded=render();
    assert.equal(loaded.hooks,loading.hooks,`${label}: loading -> loaded`);
    const all=texts(loaded.tree).join('|');
    assert.ok(!all.includes('Refresh setup status')&&!all.includes('Owner: confirmed')&&!all.includes('No payment processing'),`${label}: the old text is gone`);
    assert.ok(nodes(loaded.tree).some(n=>n.props?.accessibilityLabel==='How this works'),`${label}: help row`);
    assert.ok(!all.includes(HOW_IT_WORKS[0]!),`${label}: help is collapsed`);
    assert.ok(nodes(loaded.tree).some(n=>n.props?.refreshControl),`${label}: pull to refresh`);
    const help=nodes(loaded.tree).find(n=>n.props?.accessibilityLabel==='How this works');help.props.onPress();
    const open=render();assert.equal(open.hooks,loading.hooks,`${label}: help opened`);assert.ok(texts(open.tree).join('|').includes(HOW_IT_WORKS[0]!));
    const cancel=nodes(open.tree).find(n=>n.props?.accessibilityLabel==='Cancel setup'||n.props?.label==='Cancel setup');
    if(cancel){cancel.props.onPress();const sheet=render();assert.equal(sheet.hooks,loading.hooks,`${label}: cancel sheet`);assert.ok(nodes(sheet.tree).some(n=>n.props?.visible===true&&n.props?.onConfirm),`${label}: the sheet opens`);
      nodes(sheet.tree).find(n=>n.props?.onConfirm).props.onConfirm();}
  }
});
test('setup view: pressing the main action asks first; Message opens the chat; cancel goes through the sheet and sends only on confirm; uncertain and error states have plain buttons',async()=>{
  const messages:string[]=[],c=ctx({tenancy:tn(),setupRevision:U(9)});let current=setupVm(c,RENTER);
  const h=harness({useTenancyEstablishmentViewModel:count=>({useTenancyEstablishmentViewModel:()=>{count();return current.vm;}})});
  const render=()=>h.render(SETUP,'TenancySetupView',{accountId:RENTER,reservationId:RES,onBack(){},onChanged(){},conversationId:CONV,names,onMessage:(id:string)=>messages.push(id)});
  let tree=render().tree;
  nodes(tree).find(n=>n.props?.label==='Confirm terms').props.onPress();
  assert.equal(h.alerts.length,1);assert.equal(h.alerts[0]![0],'Confirm terms');assert.deepEqual(current.calls,[],'nothing is sent before the person agrees');
  h.alerts[0]![2].find((b:any)=>b.text==='Confirm terms').onPress();await new Promise(r=>setImmediate(r));assert.deepEqual(current.calls,['submit:confirm']);
  nodes(tree).find(n=>n.props?.label==='Message').props.onPress();assert.deepEqual(messages,[CONV]);
  nodes(tree).find(n=>n.props?.label==='Cancel setup').props.onPress();tree=render().tree;
  assert.deepEqual(current.calls,['submit:confirm'],'the sheet only asks');nodes(tree).find(n=>n.props?.onConfirm).props.onConfirm();await new Promise(r=>setImmediate(r));assert.deepEqual(current.calls,['submit:confirm','submit:cancel']);
  current=setupVm(c,RENTER,{uncertain:true,error:'Outcome not confirmed.'});tree=render().tree;
  assert.ok(texts(tree).includes(UNCERTAIN_COPY.title));nodes(tree).find(n=>n.props?.label==='Try again').props.onPress();nodes(tree).find(n=>n.props?.label==='Check status').props.onPress();
  assert.deepEqual(current.calls,['retry','load'],'Try again retries the same operation, Check status reloads the saved status');
  current=setupVm(null,RENTER,{error:'Tenancy setup could not load. Retry.'});tree=render().tree;
  nodes(tree).find(n=>n.props?.label==='Reload').props.onPress();assert.deepEqual(current.calls,['retry']);
});
test('Themes section: loading, then tabs, then reviews only, then an empty section, run the same hooks and open on the right tab',()=>{
  const FILE='src/shared/components/RentalFeedbackSection.tsx';
  let summary:any=null,failed=false;
  const idle={busy:false,saving:false,ready:true,pending:null,offset:0,notice:null,workflow:{}};
  const h=harness({useRentalReviews:count=>({useRentalReviews:(_a:any,scope:any)=>{count();return scope.mode==='summary'?{...idle,busy:!summary&&!failed,error:failed?'x':null,data:summary?{type:'summary',value:summary}:null}:{...idle,error:null,data:{type:'public',value:{kind:'property',targetId:U(50),count:4,average:4.5,rows:[]}}};}})});
  const sum=(tags:{tag:string;count:number}[],count=4)=>({kind:'property',targetId:U(50),count,average:count?4.5:null,distribution:[0,0,0,2,2],tags});
  const render=()=>h.render(FILE,'RentalFeedbackSection',{accountId:OWNER,propertyId:U(50)});
  const loading=render();assert.equal(nodes(loading.tree).filter(n=>n.props?.accessibilityRole==='tab').length,0);
  summary=sum([{tag:'clean',count:3},{tag:'quiet',count:1}]);const tabs=render();
  assert.equal(tabs.hooks,loading.hooks);assert.deepEqual(nodes(tabs.tree).filter(n=>n.props?.accessibilityRole==='tab').map(n=>texts(n)[0]),['Themes','Reviews']);
  assert.ok(nodes(tabs.tree).find(n=>n.props?.accessibilityRole==='tab').props.accessibilityState.selected,'Themes is selected by default');
  summary=sum([{tag:'clean',count:2}]);const few=render();assert.equal(few.hooks,loading.hooks);assert.equal(nodes(few.tree).filter(n=>n.props?.accessibilityRole==='tab').length,0);assert.ok(texts(few.tree).join('|').includes('Themes appear once a few tenants have added tags.'));
  summary=sum([],0);const none=render();assert.equal(none.hooks,loading.hooks);assert.ok(texts(none.tree).includes(NO_REVIEWS_CARD));
  summary=null;failed=true;const broken=render();assert.equal(broken.hooks,loading.hooks);assert.ok(texts(broken.tree).includes('Ratings are not available right now.'));
});
