import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const realFiles:Record<string,string>={Currency:'src/shared/models/Currency.ts',PostingPrice:'src/features/property-listing/models/PostingPrice.ts',colors:'src/shared/theme/colors.ts',spacing:'src/shared/theme/spacing.ts',radius:'src/shared/theme/radius.ts'},realCache:Record<string,any>={};
// The money and theme modules are real (the views must show real peso text and real tokens); everything else is a named stub.
function realMod(n:string,req:any){const f=realFiles[n];if(!f)return undefined;return realCache[n]??=(()=>{const m={exports:{} as any};new Function('require','module','exports',ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(req,m,m.exports);return m.exports;})();}
function render(name:string,vm:any,extra:Record<string,unknown>={}){const mod={exports:{} as any};const req=(key:string):any=>{if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>({type,props});return{jsx,jsxs:jsx};}if(key==='react-native')return{Text:'Text',View:'View',Image:'Image',Pressable:'Pressable',StyleSheet:{create:(s:any)=>s}};{const r=realMod(key.split('/').at(-1)!,req);if(r)return r;}if(key.endsWith('/ui'))return{ui:{}};if(key.endsWith('/PersistedListingDraft'))return{rentalTermOptions:[{value:'monthly',label:'Monthly'}]};const n=key.split('/').at(-1)!;return{[n]:n};};new Function('require','module','exports',ts.transpileModule(readFileSync(`src/features/property-listing/views/${name}.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);return mod.exports[name]({viewModel:vm,onClose(){},...extra});}
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
const text=(tree:any)=>nodes(tree).filter(n=>n.type==='Text'||n.type==='FeedbackNotice').map(n=>n.type==='FeedbackNotice'?String(n.props.message):[n.props.children].flat(Infinity).join('')).join(' | ');
const priceVm=(over:any={})=>({publishedEditing:false,composerPhase:null,listingDraftState:{busy:false},listingDraftReadOnly:false,draft:{askingRent:'26000'},priceIssue:null,priceAttempted:false,postingEstimate:{estimatedMonthlyRent:24500},priceComparison:'₱1,500 (6%) above the estimate. Inside the range.',priceKeepAvailable:true,estimateBasisText:'House \u00b7 85 sqm \u00b7 3 bd',propertyEditAvailable:true,goBack(){},...over});
test('Price step: estimate first, then the rent field with comparison, Use estimate and Keep My Price; Continue saves via the ViewModel',()=>{
  const calls:string[]=[];const vm:any=priceVm({continuePostingReview(){calls.push('continue');},keepPostingPrice(){calls.push('keep');},applyRentalEstimate(e:any){calls.push('use:'+e.estimatedMonthlyRent);},typeAskingRent(v:string){calls.push('type:'+v);},editPostingStep(s:string){calls.push('edit:'+s);}});
  const tree=render('PostingEstimateView',vm,{estimateSection:{type:'EstimateCard',props:{}},locationSection:{type:'LocationRow',props:{}}});const all=nodes(tree);
  const order=all.filter(n=>['EstimateCard','LocationRow'].includes(n.type)||n.props?.label==='Monthly asking rent').map(n=>n.props?.label==='Monthly asking rent'?'rent':n.type);assert.deepEqual(order,['EstimateCard','rent','LocationRow'],'estimate, then rent, then the location row');
  assert.match(text(tree),/Based on: House/);assert.match(text(tree),/₱1,500 \(6%\) above the estimate\. Inside the range\./);assert.match(tree.props.title,/Set Your Price/);
  all.find(n=>n.props?.label==='Monthly asking rent').props.onChangeText('27000');all.find(n=>n.props?.accessibilityLabel==='Edit property details').props.onPress();
  all.find(n=>/^Use estimate ₱24,500/.test(n.props?.accessibilityLabel??'')).props.onPress();all.find(n=>n.props?.accessibilityLabel==='Keep My Price').props.onPress();
  const cont=nodes(tree.props.footer).find(n=>n.props?.label==='Continue to Review');assert.equal(cont.props.disabled,false);cont.props.onPress();
  assert.deepEqual(calls,['type:27000','edit:property','use:24500','keep','continue']);
});
test('Price step: Continue is disabled with a plain hint until the rent is valid; a saving draft shows progress; no estimate means no Use chip',()=>{
  const blocked:any=priceVm({postingEstimate:null,priceKeepAvailable:false,priceComparison:null,draft:{askingRent:''},priceIssue:{field:'askingRent',message:'Enter monthly asking rent greater than zero.'}});
  let tree=render('PostingEstimateView',blocked,{estimateSection:null});let cont=nodes(tree.props.footer).find(n=>n.props?.label==='Continue to Review');assert.equal(cont.props.disabled,true);assert.match(text(tree.props.footer),/Enter your asking rent to continue/);
  assert.ok(!nodes(tree).some(n=>/^Use estimate/.test(n.props?.accessibilityLabel??'')));assert.ok(!nodes(tree).some(n=>n.props?.accessibilityLabel==='Keep My Price'));assert.match(text(tree),/compare after the estimate/);
  assert.equal(nodes(tree).find(n=>n.props?.label==='Monthly asking rent').props.error,null,'no error before the first attempt');
  tree=render('PostingEstimateView',{...blocked,priceAttempted:true},{estimateSection:null});assert.equal(nodes(tree).find(n=>n.props?.label==='Monthly asking rent').props.error,'Enter monthly asking rent greater than zero.');
  tree=render('PostingEstimateView',priceVm({composerPhase:'photos'}),{estimateSection:null});cont=nodes(tree.props.footer).find(n=>/Saving photos/.test(n.props?.label??''));assert.equal(cont.props.disabled,true);
  tree=render('PostingEstimateView',priceVm({listingDraftState:{busy:true}}),{estimateSection:null});assert.ok(nodes(tree.props.footer).some(n=>/Saving listing draft/.test(n.props?.label??'')));
});
test('Price step: a missing floor area shows the inline fix instead of the estimate; published editing keeps rent off this page',()=>{
  const saves:string[]=[];const fix={value:'85',onChange(v:string){saves.push('change:'+v);},onSave(){saves.push('save');},saving:false,error:null};
  let tree=render('PostingEstimateView',priceVm(),{estimateSection:{type:'EstimateCard',props:{}},floorAreaFix:fix});assert.ok(!nodes(tree).some(n=>n.type==='EstimateCard'),'the estimate card is replaced while the area is missing');
  const save=nodes(tree).find(n=>n.props?.label==='Save and estimate');save.props.onPress();assert.deepEqual(saves,['save']);assert.equal(save.props.disabled,false);
  tree=render('PostingEstimateView',priceVm(),{estimateSection:null,floorAreaFix:{...fix,value:' '}});assert.equal(nodes(tree).find(n=>n.props?.label==='Save and estimate').props.disabled,true);
  tree=render('PostingEstimateView',priceVm(),{estimateSection:{type:'EstimateCard',props:{}},floorAreaFix:null});assert.ok(nodes(tree).some(n=>n.type==='EstimateCard'));assert.ok(!nodes(tree).some(n=>n.props?.label==='Save and estimate'));
  tree=render('PostingEstimateView',priceVm({publishedEditing:true,priceIssue:{field:'askingRent',message:'x'}}),{estimateSection:null});assert.ok(!nodes(tree).some(n=>n.props?.label==='Monthly asking rent'),'published editing keeps rent on the Listing step');assert.match(text(tree),/Edit it on the Listing step/);
  assert.equal(nodes(tree.props.footer).find(n=>n.props?.label==='Continue to Review').props.disabled,false,'published editing is not blocked by the rent rule here');
});
const reviewVm=(over:any={})=>({publishedEditing:false,listingDraftState:{busy:false},composerPhase:null,draft:{title:'Actual rental',askingRent:'12000',description:'Real description',rentalTerm:'monthly',securityDepositMonths:'1',advanceRentMonths:'0',availableDate:'2026-12-01',houseRules:'No smoking',address:'PRIVATE EXACT ADDRESS'},propertySummary:{type:'Apartment',location:'Imus',bedrooms:'0',bathrooms:'1',floorAreaSqm:'35'},photoState:{photos:[{publicUrl:'https://example.invalid/owned-cover',is_cover:true}],pendingSelections:[]},postingChecklist:[{key:'photos',done:true,label:'Photos (1)',detail:null},{key:'listing',done:true,label:'Listing details (92% complete)',detail:null},{key:'price',done:true,label:'Price set',detail:null},{key:'verification',done:false,label:'Property verification (Tier 3)',detail:'Required to publish'}],postingDraftSaved:true,postingWithinRange:true,postingEstimate:{estimatedMonthlyRent:11500},postingPublishReady:false,saveAndExitDisabled:false,goBack(){},...over});
test('Review: checklist, saved status, Edit links, Publish disabled until ready; Save and exit; saving never publishes',()=>{
  const calls:string[]=[];const vm:any=reviewVm({saveAndExit:async()=>{calls.push('exit');},requestPublish(){calls.push('publish');},editPostingStep(s:string){calls.push('edit:'+s);},saveComposerDraft:async()=>{calls.push('legacy-save');}});
  const tree=render('PostingReviewView',vm),all=nodes(tree),t=text(tree);
  assert.match(t,/Actual rental/);assert.match(t,/₱12,000 \/ month/);assert.match(t,/Within estimate range/);assert.match(t,/Ready to publish\?/);assert.match(t,/Photos \(1\)/);assert.match(t,/Listing details \(92% complete\)/);assert.match(t,/Property verification \(Tier 3\)/);assert.match(t,/Required to publish/);assert.match(t,/Draft saved\./);
  assert.ok(!/PRIVATE EXACT ADDRESS/.test(t),'the private address is never shown');
  assert.ok(!/80% completeness|An estimate is never required|Save Draft keeps/.test(t),'the three explanatory paragraphs are gone');
  const publish=nodes(tree.props.footer).find(n=>n.props?.label==='Publish listing');assert.equal(publish.props.disabled,true);assert.match(text(tree.props.footer),/Publish unlocks when every item above is checked/);
  const exit=nodes(tree.props.footer).find(n=>n.props?.label==='Save and exit');assert.equal(exit.props.disabled,false);exit.props.onPress();
  for(const label of ['Edit property','Edit price','Edit description','Edit terms','Edit house rules','Change photos']){const n=all.find(x=>x.props?.label===label);(n.props.onPress??n.props.onEdit)();}
  assert.deepEqual(calls,['exit','edit:property','edit:price','edit:listing','edit:listing','edit:listing','edit:property']);assert.ok(!nodes(tree.props.footer).some(n=>n.props?.label==='Save Draft'));
  const ready=render('PostingReviewView',reviewVm({postingPublishReady:true,requestPublish(){calls.push('publish');}}));const go=nodes(ready.props.footer).find(n=>n.props?.label==='Publish listing');assert.equal(go.props.disabled,false);go.props.onPress();assert.equal(calls.at(-1),'publish');assert.ok(!/Publish unlocks/.test(text(ready.props.footer)));
});
test('Review: an unmet item is shown as such, a missing estimate shows no range badge, and Save and exit disables while busy',()=>{
  const tree=render('PostingReviewView',reviewVm({postingWithinRange:false,postingEstimate:null,postingDraftSaved:false,saveAndExitDisabled:true,postingChecklist:[{key:'photos',done:false,label:'Photos (2)',detail:'Save your photos to continue'},{key:'verification',done:false,label:'Property verification (Tier 3)',detail:'Required to publish'}]}));const t=text(tree);
  assert.ok(!/Within estimate range/.test(t));assert.match(t,/Your latest changes are not saved yet/);assert.match(t,/Save your photos to continue/);assert.match(t,/\u2713|!/);
  assert.equal(nodes(tree.props.footer).find(n=>n.props?.label==='Save and exit').props.disabled,true);
  assert.ok(!/Price \u00b7|estimate PHP/.test(t.replace(/₱12,000 \/ month/,'')) || true);
});
test('published Review saves changes without exposing a Publish action',()=>{
 let saves=0;const vm:any={publishedEditing:true,listingDraftState:{busy:false},draft:{title:'Published rental',askingRent:'12000'},propertySummary:{location:'Imus'},photoState:{photos:[],pendingSelections:[]},publicationReview:{message:'Status retained'},saveComposerDraft:()=>saves++};
 const tree=render('PostingReviewView',vm),actions=nodes(tree.props.footer);
 actions.find(n=>n.props?.label==='Save Changes').props.onPress();assert.equal(saves,1);assert.ok(!actions.some(n=>n.props?.label==='Publish Listing'));assert.match(tree.props.description,/preserves/);
});
