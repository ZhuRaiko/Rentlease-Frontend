// "Rendered fewer hooks than expected" only shows on a device, so this renders TenancyWorkspaceView the way React does and counts the
// hooks each render calls. State is kept between renders (by call position), so pressing "Open" on an upcoming move-in really switches
// the component into its Set up tenancy early return. The count must be the same in every state.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {workspaceScreen,type WorkspaceInput} from '../src/features/tenancy/models/TenancyWorkspaceScreen';
import {emptyActivity} from '../src/features/tenancy/services/tenancyActivityService';

const L='00000000-0000-4000-8000-00000000000a',T='00000000-0000-4000-8000-00000000000b',P='00000000-0000-4000-8000-0000000000c1',LI='00000000-0000-4000-8000-0000000000d1',C='00000000-0000-4000-8000-0000000000e1';
const NOW=Date.parse('2026-11-16T04:00:00Z');
const ident=(nickname:string,uid:string):any=>({id:uid,nickname,avatarUrl:null,avatarPath:null});
const input=(actor:string,over:Partial<WorkspaceInput>={}):WorkspaceInput=>({actor,tenancies:[],reservations:[],links:[],contexts:{},identities:{[L]:ident('Nightcity',L),[T]:ident('Samuel',T)},activity:emptyActivity(),now:NOW,...over});
// An approved move-in with every optional field missing: no end date, no schedule, no counterpart confirmation, no tenancy yet.
const bare=(over:any={}):any=>({id:'00000000-0000-4000-8000-0000000000f1',conversationId:C,listingId:LI,propertyId:P,tenantId:T,landlordId:L,listingTitle:'Garcia Apartment',moveInDate:'2026-11-25',durationMonths:null,endDate:null,status:'approved',storedStatus:'approved',expiresAt:null,...over});
const pendingTenancy=(over:any={}):any=>({id:'00000000-0000-4000-8000-0000000000f2',property_id:P,listing_id:LI,conversation_id:C,tenant_id:T,landlord_id:L,status:'pending_confirmation',start_date:'2026-11-25',expected_end_date:null,actual_end_date:null,agreed_monthly_rent:null,rent_due_day:null,tenant_confirmed_at:null,landlord_confirmed_at:null,...over});

function mount(vmOf:()=>any,actor:string,width=411,scale=1){
  const file=resolve('src/features/tenancy/views/TenancyWorkspaceView.tsx'),mod={exports:{} as any};
  const slots:any[]=[];let cursor=0,hooks=0;
  const hook=<A>(make:()=>A):A=>{hooks++;const i=cursor++;if(!(i in slots))slots[i]=make();return slots[i];};
  const react={
    useEffect:()=>{hooks++;cursor++;},
    useState:(v:any)=>hook(()=>{const cell:any=[typeof v==='function'?v():v,undefined];cell[1]=(n:any)=>{cell[0]=typeof n==='function'?n(cell[0]):n;};return cell;}),
    useRef:(v:any)=>hook(()=>({current:v})),
  };
  const mock=(key:string):any=>{
    if(key==='react')return react;
    if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>({type,props});return{jsx,jsxs:jsx};}
    if(key==='react-native')return new Proxy({StyleSheet:{create:(x:any)=>x},useWindowDimensions:()=>{hooks++;cursor++;return{width,height:800,fontScale:scale};}},{get:(x:any,k)=>x[k]??k});
    if(key.includes('useTenancyWorkspaceViewModel'))return{useTenancyWorkspaceViewModel:()=>{hooks++;cursor++;return vmOf();}};
    if(key.includes('models/TenancyPresentation'))return require('../src/features/tenancy/models/TenancyPresentation');
    if(key.endsWith('/tileColors'))return require('../src/features/tenancy/components/tileColors');
    if(key.endsWith('/colors'))return{colors:{}};if(key.endsWith('/ui'))return{ui:{}};if(key.endsWith('/radius'))return{radius:{}};if(key.endsWith('/spacing'))return{spacing:{}};
    return new Proxy({},{get:(_x,k)=>String(k)});
  };
  new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(mock,mod,mod.exports);
  return{render(){cursor=0;hooks=0;const tree=mod.exports.TenancyWorkspaceView({accountId:actor,onBack(){},onDiscover(){},onListings(){},onPost(){},onChat(){},registerBackAction(){}});return{tree,hooks};}};
}
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
const vm=(actor:string,i:Partial<WorkspaceInput>={},over:any={})=>({actor,busy:false,error:null,contextWarning:null,links:i.links??[],screen:workspaceScreen(input(actor,i)),release:{request:null,saving:false,error:null,confirm(){},retry(){},keep(){}},startRequest(){},refresh(){},...over});

for(const [name,actor] of [['landlord',L],['tenant',T]] as const){
  test(`workspace hooks: ${name} loading, then an upcoming move-in with no optional fields, then Set up tenancy, run the same hooks every render`,()=>{
    let current:any=vm(actor,{},{busy:true});
    const view=mount(()=>current,actor);
    const loading=view.render();
    const data:Partial<WorkspaceInput>={reservations:[bare()],tenancies:[pendingTenancy()],links:[{reservation_id:bare().id,tenancy_id:pendingTenancy().id}]};
    current=vm(actor,data);
    const loaded=view.render();
    assert.equal(loaded.hooks,loading.hooks,'loading -> loaded');
    const open=nodes(loaded.tree).find(x=>x.type==='StatusButton'&&/^Open: /.test(String(x.props.accessibilityLabel)));
    assert.ok(open,'the upcoming move-in card is on screen');
    open.props.onPress();
    const setup=view.render();
    assert.ok(nodes(setup.tree).some(x=>x.type==='TenancySetupView'),'the Set up tenancy screen is showing');
    assert.equal(setup.hooks,loaded.hooks,'loaded -> Set up tenancy');
    const setupAgain=view.render();
    assert.equal(setupAgain.hooks,loading.hooks,'and it stays the same');
  });
}
test('workspace hooks: an upcoming move-in with only a reservation (no tenancy yet) opens setup without changing the hook count',()=>{
  let current:any=vm(L,{},{busy:true});const view=mount(()=>current,L,320,1.5);
  const first=view.render();current=vm(L,{reservations:[bare()]});const loaded=view.render();
  assert.equal(loaded.hooks,first.hooks);
  const open=nodes(loaded.tree).find(x=>x.type==='StatusButton'&&/^Open: /.test(String(x.props.accessibilityLabel)));
  if(open){open.props.onPress();assert.equal(view.render().hooks,first.hooks);}
});
