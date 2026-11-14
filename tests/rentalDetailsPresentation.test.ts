import {createInlineRentalEstimate} from '../src/shared/viewModels/inlineRentalEstimate';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
const nodes=(t:any):any[]=>t&&typeof t==='object'?[t,...[t.props?.children].flat(Infinity).flatMap(nodes)]:[];
function harness(file:string,name:string,estimate?:{workflow:ReturnType<typeof createInlineRentalEstimate>;bindings:any[]}){
 const full=resolve(file),actual=createRequire(full),m={exports:{} as any},slots:any[]=[];let cursor=0;
 const mock=(key:string):any=>{
  if(key==='react')return{useState:(v:any)=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],(value:any)=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect:()=>{}};
  if(key==='react/jsx-runtime')return{jsx:(type:any,props:any)=>typeof type==='function'?type(props):({type,props}),jsxs:(type:any,props:any)=>typeof type==='function'?type(props):({type,props})};
  if(key==='react-native')return{Text:'Text',View:'View',Image:'Image',ScrollView:'ScrollView',ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',FlatList:'FlatList',TextInput:'TextInput',StyleSheet:{create:(x:any)=>x},useWindowDimensions:()=>({width:320,fontScale:1.5})};
  const mocks:any={Reporting:{ReportAction:'ReportAction'},SaveListingButton:{SaveListingButton:'Heart',SavedListingsFeedback:'SavedFeedback'},RentalFeedbackSection:{RentalFeedbackSection:'Feedback'},PublicLocationMap:{PublicLocationMap:'PublicMap'},InlineRentalEstimate:{InlineRentalEstimate:'Estimate'},PublicIdentityBadge:{PublicAvatar:'Avatar'},KeyboardAwareScrollView:{KeyboardAwareScrollView:'ScrollView'},FullscreenDocumentImage:{FullscreenDocumentImage:'Fullscreen'},DiscoveryControls:{DiscoveryHeader:'Header',DiscoveryButton:'Button',DiscoveryChip:'Chip',DiscoverySearchBar:'Search'},SearchListingCard:{SearchListingCard:'Card'},RentalReviews:{PublishedRentalReviews:'Reviews'},PropertyReviewWordCloud:{PropertyReviewWordCloud:'Cloud'}};
  const tail=key.split('/').at(-1)!;
  if(estimate&&tail==='useInlineRentalEstimate')return {useInlineRentalEstimate:(accountId:any,target:any)=>{estimate.bindings.push({accountId,target});return {...estimate.workflow.getSnapshot(),workflow:estimate.workflow};}};
  if(estimate&&tail==='InlineRentalEstimate'){
   const nested={exports:{} as any},source=resolve('src/shared/components/InlineRentalEstimate.tsx');
   new Function('require','module','exports',ts.transpileModule(readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)((dependency:string)=>dependency==='./AppButton'?{AppButton:'Button'}:dependency==='./RangeEstimateCard'?{RangeEstimateCard:'RangeCard'}:dependency==='../theme/colors'?actual(resolve('src/shared/theme/colors.ts')):dependency==='../theme/ui'?actual(resolve('src/shared/theme/ui.ts')):mock(dependency),nested,nested.exports);
   return nested.exports;
  }
  if(estimate&&tail==='RentalPrediction')return actual(resolve('src/shared/models/RentalPrediction.ts'));
  if(estimate&&tail==='Currency')return actual(resolve('src/shared/models/Currency.ts'));
  if(tail==='RentalReviews')return {PublishedRentalReviews:(props:any)=>({type:'Reviews',props:{...props,children:props.navigation}})};return mocks[tail]??actual(key);
 };
 new Function('require','module','exports',ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(mock,m,m.exports);
 return(props:any)=>{cursor=0;return m.exports[name](props);};
}
const detail={listingId:'listing',propertyId:'property',ownerId:'owner',title:'A long actual rental title',rent:1234567,city:'imus',barangay:'A long public barangay',propertyType:'house',furnishing:'unfurnished',bedrooms:0,bathrooms:0,floorArea:null,photos:[{id:'cover',url:'https://example.test/cover',alt:'Actual cover'}],amenities:['Wi-Fi'],description:'Original Filipino text\nSecond paragraph',rentalTerm:'long_term',availableFrom:null,minimumStay:223,depositMonths:12,advanceMonths:1,houseRules:'Actual rules',publicLocation:{latitude:14.4,longitude:120.9}};
function vm(extra:any={}){return{manualState:{detail,placesRows:[],placesPhase:'success'},manual:{loadPlaces(){}},isOwnListing:false,listingOwnerLabel:'Consented nickname',goBack(){},...extra};}
function bareCheck(t:any):void{if(!t||typeof t!=='object')return;const children=[t.props?.children].flat(Infinity);if(t.type!=='Text')for(const c of children)assert.ok(typeof c!=='string'&&typeof c!=='number',`Raw child ${JSON.stringify(c)} under ${t.type}`);children.forEach(bareCheck);}
test('detail spotlights follow summary; amenities and neighborhood mount once without raw zero children',()=>{
 const render=harness('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView'),tree=render({viewModel:vm(),accountId:'tenant'}),all=nodes(tree);bareCheck(tree);
 const headings=all.filter(n=>n.type==='Text').map(n=>n.props.children);assert.equal(headings.filter(t=>t==='Amenities').length,1);assert.equal(headings.filter(t=>t==='Location & Nearby Places').length,1);assert.equal(all.filter(n=>n.type==='Feedback').length,1);assert.ok(all.findIndex(n=>n.type==='Estimate')<all.findIndex(n=>n.type==='Avatar'));assert.ok(all.findIndex(n=>n.type==='Feedback')<all.findIndex(n=>n.type==='PublicMap'));
 assert.equal(all.find(n=>n.type==='Estimate').props.variant,'spotlight');assert.equal(all.find(n=>n.type==='Estimate').props.askingRent,1234567);assert.equal(all.find(n=>n.type==='PublicMap').props.compact,true);assert.deepEqual(all.find(n=>n.type==='PublicMap').props.latitude,14.4);assert.doesNotMatch(JSON.stringify(tree),/exactLatitude|exact_location|confidence interval|Stock/);
});
test('heart and photo targets remain separate; own listing has management but no contact/report action',()=>{
 let saves=0,contacts=0,manage=0;const render=harness('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView'),tree=render({viewModel:vm({isOwnListing:true,contactOwner:()=>contacts++,savedControl:()=>({onPress:()=>saves++})}),accountId:'owner',onManageRental:()=>manage++});
 const all=nodes(tree);all.find(n=>n.type==='Heart').props.control.onPress();assert.equal(saves,1);assert.equal(contacts,0);assert.ok(!all.some(n=>n.type==='ReportAction'||n.props?.label==='Contact Owner'));all.find(n=>n.props?.label==='Manage in My Rentals').props.onPress();assert.equal(manage,1);
});
test('Nearby tab is independently recoverable and maps only actual returned places',()=>{
 let retries=0;const render=harness('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView'),props={viewModel:vm({manual:{loadPlaces:()=>retries++},manualState:{detail,placesPhase:'error',placesRows:[],placesError:'Timed out'}}),accountId:'tenant'};
 let tree=render(props);nodes(tree).find(n=>n.props?.accessibilityRole==='tab'&&n.props.children.props.children==='Nearby Places').props.onPress();tree=render(props);assert.equal(nodes(tree).filter(n=>n.type==='PublicMap').length,1);nodes(tree).find(n=>n.props?.accessibilityLabel==='Retry nearby places').props.onPress();assert.equal(retries,1);bareCheck(tree);
 props.viewModel.manualState.placesPhase='success';tree=render(props);assert.match(JSON.stringify(tree),/No named nearby places/);bareCheck(tree);
});
test('Property Landlord Themes tabs mount exactly one authorized source at a time',()=>{
 const render=harness('src/shared/components/RentalFeedbackSection.tsx','RentalFeedbackSection'),props={accountId:'tenant',propertyId:'property',ownerId:'owner'};
 let tree=render(props),reviews=nodes(tree).find(n=>n.type==='Reviews');assert.equal(reviews.props.kind,'property');assert.equal(reviews.props.targetId,'property');
 nodes(tree).find(n=>n.props?.accessibilityRole==='tab'&&n.props.children.props.children==='Landlord').props.onPress();tree=render(props);reviews=nodes(tree).find(n=>n.type==='Reviews');assert.equal(reviews.props.kind,'user');assert.equal(reviews.props.targetId,'owner');assert.equal(reviews.props.compact,true);
 nodes(tree).find(n=>n.props?.accessibilityRole==='tab'&&n.props.children.props.children==='Themes').props.onPress();tree=render(props);assert.equal(nodes(tree).filter(n=>n.type==='Reviews').length,0);assert.equal(nodes(tree).find(n=>n.type==='Cloud').props.propertyId,'property');bareCheck(tree);
});


test('public map centers only supplied public coordinates and has bounded independent retry',()=>{
 const m={exports:{} as any},slots:any[]=[],effects:any[]=[],timers=new Map<number,()=>void>();let cursor=0,id=0;
 const req=(key:string):any=>{
  if(key==='react')return{useState:(v:any)=>{const at=cursor++;if(!slots[at])slots[at]={value:v};return[slots[at].value,(next:any)=>slots[at].value=typeof next==='function'?next(slots[at].value):next];},useEffect:(fn:any,deps:any[])=>{const at=cursor++;if(!slots[at]||deps.some((v,i)=>v!==slots[at].deps[i]))effects.push(()=>{slots[at]?.cleanup?.();slots[at]={deps,cleanup:fn()};});}};
  if(key==='react/jsx-runtime')return{jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};
  if(key==='react-native')return{Text:'Text',View:'View',ActivityIndicator:'ActivityIndicator'};
  if(key==='@maplibre/maplibre-react-native')return{Map:'Map',Camera:'Camera'};
  if(key.endsWith('/usePublicLocationMap'))return{usePublicLocationMap:()=> 'approved-style'};
  if(key.endsWith('/AppButton'))return{AppButton:'Button'};if(key.endsWith('/ui'))return{ui:{}};throw Error(key);
 };
 new Function('require','module','exports','setTimeout','clearTimeout',ts.transpileModule(readFileSync('src/shared/components/PublicLocationMap.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,m,m.exports,(fn:()=>void,ms:number)=>{assert.equal(ms,20000);timers.set(++id,fn);return id;},(id:number)=>timers.delete(id));
 const render=()=>{cursor=0;const tree=m.exports.PublicLocationMap({latitude:14.4,longitude:120.9});effects.splice(0).forEach(f=>f());return tree;};
 let tree=render();assert.deepEqual(nodes(tree).find(n=>n.type==='Camera').props.initialViewState.center,[120.9,14.4]);assert.equal(timers.size,1);[...timers.values()][0]!();tree=render();assert.ok(!nodes(tree).some(n=>n.type==='ActivityIndicator'));nodes(tree).find(n=>n.props?.label==='Retry map').props.onPress();tree=render();assert.ok(nodes(tree).some(n=>n.type==='ActivityIndicator'));nodes(tree).find(n=>n.type==='Map').props.onDidFinishLoadingMap();tree=render();assert.ok(!nodes(tree).some(n=>n.type==='ActivityIndicator'));bareCheck(tree);slots.forEach(s=>s?.cleanup?.());
});


test('real Rental Details mounts real spotlight range after the existing prediction workflow succeeds',async()=>{
 let calls=0;const target={listingId:detail.listingId};
 const workflow=createInlineRentalEstimate({predict:async(actor,received)=>{calls++;assert.equal(actor,'tenant');assert.deepEqual(received,target);return {target,currency:'PHP',modelVersion:'integration-test',askingRent:detail.rent,predictedAt:'2026-11-11T00:00:00Z',illustrativeRange:{minimum:8000,maximum:15500}};}},'tenant',target);
 const bindings:any[]=[];
 const render=harness('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView',{workflow,bindings});
 const props={viewModel:vm(),accountId:'tenant'};
 let tree=render(props);assert.equal(calls,0);assert.ok(!nodes(tree).some(n=>n.type==='RangeCard'));
 const action=nodes(tree).find(n=>n.type==='Pressable'&&n.props.children?.props?.children==='Get Rental Price Estimate');assert.ok(action,'Actual detail screen must expose the spotlight action');
 action.props.onPress();await new Promise(resolve=>setImmediate(resolve));tree=render(props);bareCheck(tree);
 assert.equal(calls,1);assert.deepEqual(bindings[0],{accountId:'tenant',target});
 const all=nodes(tree),texts=all.filter(n=>n.type==='Text').map(n=>[n.props.children].flat().join(''));
 assert.equal(texts.filter(t=>t==='Is this rent fairly priced?').length,1);
 const cards=all.filter(n=>n.type==='RangeCard');assert.equal(cards.length,1);assert.deepEqual(cards[0].props.range,{minimum:8000,maximum:15500});assert.equal(cards[0].props.subject,'listing');assert.equal(cards[0].props.rent,detail.rent);assert.equal(cards[0].props.onUseRent,undefined,'tenants get a read-only bar');
 assert.ok(texts.includes('Estimate again'));assert.ok(!texts.some(x=>/11,747|point estimate|XGBoost/i.test(x)));
 workflow.dispose();
});
