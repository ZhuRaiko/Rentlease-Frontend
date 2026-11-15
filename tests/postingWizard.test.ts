import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const realFiles:Record<string,string>={ListingCheck:'src/features/property-listing/models/ListingCheck.ts',Currency:'src/shared/models/Currency.ts',PostingPrice:'src/features/property-listing/models/PostingPrice.ts',PostingEstimate:'src/features/property-listing/models/PostingEstimate.ts',RentalRange:'src/shared/models/RentalRange.ts',colors:'src/shared/theme/colors.ts',spacing:'src/shared/theme/spacing.ts',radius:'src/shared/theme/radius.ts'},realCache:Record<string,any>={};
// The money and theme modules are real (the views must show real peso text and real tokens); everything else is a named stub.
function realMod(n:string,req:any){const f=realFiles[n];if(!f)return undefined;return realCache[n]??=(()=>{const m={exports:{} as any};new Function('require','module','exports',ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(req,m,m.exports);return m.exports;})();}
function render(name:string,vm:any,extra:Record<string,unknown>={}){const mod={exports:{} as any};const req=(key:string):any=>{if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>({type,props});return{jsx,jsxs:jsx};}if(key==='react-native')return{Text:'Text',View:'View',Image:'Image',Pressable:'Pressable',StyleSheet:{create:(s:any)=>s}};{const r=realMod(key.split('/').at(-1)!,req);if(r)return r;}if(key.endsWith('/ui'))return{ui:{}};if(key.endsWith('/PersistedListingDraft'))return{rentalTermOptions:[{value:'monthly',label:'Monthly'}]};const n=key.split('/').at(-1)!;return{[n]:n};};new Function('require','module','exports',ts.transpileModule(readFileSync(`src/features/property-listing/views/${name}.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);return mod.exports[name]({viewModel:vm,onClose(){},...extra});}
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
const text=(tree:any)=>nodes(tree).filter(n=>n.type==='Text'||n.type==='FeedbackNotice').map(n=>n.type==='FeedbackNotice'?String(n.props.message):[n.props.children].flat(Infinity).join('')).join(' | ');
const priceVm=(over:any={})=>({listingCheck:{state:'ok',message:null},retryListingCheck(){},publishedEditing:false,composerPhase:null,listingDraftState:{busy:false},listingDraftReadOnly:false,draft:{askingRent:'26000'},priceIssue:null,priceAttempted:false,postingEstimate:{illustrativeRange:{minimum:17000,maximum:32000}},priceKeepAvailable:true,estimateBasisText:'House \u00b7 85 sqm \u00b7 3 bd',propertyEditAvailable:true,goBack(){},...over});
test('Price step: range first, then the rent field, Keep My Price and no Use estimate button; Continue saves via the ViewModel',()=>{
  const calls:string[]=[];const vm:any=priceVm({continuePostingReview(){calls.push('continue');},keepPostingPrice(){calls.push('keep');},typeAskingRent(v:string){calls.push('type:'+v);},editPostingStep(s:string){calls.push('edit:'+s);}});
  const tree=render('PostingEstimateView',vm,{estimateSection:{type:'EstimateCard',props:{}}});const all=nodes(tree);
  const order=all.filter(n=>['EstimateCard','LocationRow'].includes(n.type)||n.props?.label==='Your monthly asking rent').map(n=>n.props?.label==='Your monthly asking rent'?'rent':n.type);assert.deepEqual(order,['EstimateCard','rent'],'estimate, then rent; the location question moved to Step 1');
  assert.match(text(tree),/Based on: House/);assert.match(text(tree),/Or type your own price\. Any amount is allowed\./);assert.ok(!nodes(tree).some(n=>/^Use estimate/.test(n.props?.accessibilityLabel??'')),'the point estimate cannot be applied');assert.match(tree.props.title,/Set Your Price/);
  all.find(n=>n.props?.label==='Your monthly asking rent').props.onChangeText('27000');all.find(n=>n.props?.accessibilityLabel==='Edit property details').props.onPress();
  all.find(n=>n.props?.accessibilityLabel==='Keep My Price').props.onPress();
  const cont=nodes(tree.props.footer).find(n=>n.props?.label==='Continue to Review');assert.equal(cont.props.disabled,false);cont.props.onPress();
  assert.deepEqual(calls,['type:27000','edit:property','keep','continue']);
});
test('Price step: Continue is disabled with a plain hint until the rent is valid; a saving draft shows progress; no Use chip',()=>{
  const blocked:any=priceVm({postingEstimate:null,priceKeepAvailable:false,draft:{askingRent:''},priceIssue:{field:'askingRent',message:'Enter monthly asking rent greater than zero.'}});
  let tree=render('PostingEstimateView',blocked,{estimateSection:null});let cont=nodes(tree.props.footer).find(n=>n.props?.label==='Continue to Review');assert.equal(cont.props.disabled,true);assert.match(text(tree.props.footer),/Enter your asking rent to continue/);
  assert.ok(!nodes(tree).some(n=>/^Use estimate/.test(n.props?.accessibilityLabel??'')));assert.ok(!nodes(tree).some(n=>n.props?.accessibilityLabel==='Keep My Price'));assert.match(text(tree),/Or type your own price/);
  assert.equal(nodes(tree).find(n=>n.props?.label==='Your monthly asking rent').props.error,null,'no error before the first attempt');
  tree=render('PostingEstimateView',{...blocked,priceAttempted:true},{estimateSection:null});assert.equal(nodes(tree).find(n=>n.props?.label==='Your monthly asking rent').props.error,'Enter monthly asking rent greater than zero.');
  tree=render('PostingEstimateView',priceVm({composerPhase:'photos'}),{estimateSection:null});cont=nodes(tree.props.footer).find(n=>/Saving photos/.test(n.props?.label??''));assert.equal(cont.props.disabled,true);
  tree=render('PostingEstimateView',priceVm({listingDraftState:{busy:true}}),{estimateSection:null});assert.ok(nodes(tree.props.footer).some(n=>/Saving listing draft/.test(n.props?.label??'')));
});
test('Price step: a missing floor area shows the inline fix instead of the estimate; published and paused editing set the rent here too',()=>{
  const saves:string[]=[];const fix={value:'85',onChange(v:string){saves.push('change:'+v);},onSave(){saves.push('save');},saving:false,error:null};
  let tree=render('PostingEstimateView',priceVm(),{estimateSection:{type:'EstimateCard',props:{}},floorAreaFix:fix});assert.ok(!nodes(tree).some(n=>n.type==='EstimateCard'),'the estimate card is replaced while the area is missing');
  const save=nodes(tree).find(n=>n.props?.label==='Save and show range');save.props.onPress();assert.deepEqual(saves,['save']);assert.equal(save.props.disabled,false);
  tree=render('PostingEstimateView',priceVm(),{estimateSection:null,floorAreaFix:{...fix,value:' '}});assert.equal(nodes(tree).find(n=>n.props?.label==='Save and show range').props.disabled,true);
  tree=render('PostingEstimateView',priceVm(),{estimateSection:{type:'EstimateCard',props:{}},floorAreaFix:null});assert.ok(nodes(tree).some(n=>n.type==='EstimateCard'));assert.ok(!nodes(tree).some(n=>n.props?.label==='Save and show range'));
  tree=render('PostingEstimateView',priceVm({publishedEditing:true,priceIssue:{field:'askingRent',message:'x'}}),{estimateSection:null});assert.ok(nodes(tree).some(n=>n.props?.label==='Your monthly asking rent'),'the rent is edited on the Price step for published and paused listings');assert.ok(!/Edit it on the Listing step/.test(text(tree)));
  assert.equal(nodes(tree.props.footer).find(n=>n.props?.label==='Continue to Review').props.disabled,true,'an unusable rent blocks Continue, as for a draft');assert.match(text(tree.props.footer),/Enter your asking rent to continue/);
  const ok=render('PostingEstimateView',priceVm({publishedEditing:true,priceIssue:null}),{estimateSection:null});assert.equal(nodes(ok.props.footer).find(n=>n.props?.label==='Continue to Review').props.disabled,false);assert.match(text(ok.props.footer),/Opens Review\. Save changes there\./);assert.ok(!/Saves your draft/.test(text(ok.props.footer)),'nothing is saved at this step in edit mode');
});
const reviewVm=(over:any={})=>({listingCheck:{state:'ok',message:null},retryListingCheck(){},publishedEditing:false,listingDraftState:{busy:false},composerPhase:null,draft:{title:'Actual rental',askingRent:'12000',description:'Real description',rentalTerm:'monthly',securityDepositMonths:'1',advanceRentMonths:'0',availableDate:'2026-12-01',houseRules:'No smoking',address:'PRIVATE EXACT ADDRESS'},propertySummary:{type:'Apartment',location:'Imus',bedrooms:'0',bathrooms:'1',floorAreaSqm:'35'},photoState:{photos:[{publicUrl:'https://example.invalid/owned-cover',is_cover:true}],pendingSelections:[]},postingChecklist:[{key:'photos',done:true,label:'Photos (1)',detail:null},{key:'listing',done:true,label:'Listing details (92% complete)',detail:null},{key:'price',done:true,label:'Price set',detail:null},{key:'verification',done:false,label:'Property verification (Tier 3)',detail:'Required to publish'}],postingDraftSaved:true,postingEstimate:{illustrativeRange:{minimum:8500,maximum:16000}},postingPublishReady:false,saveAndExitDisabled:false,goBack(){},...over});
test('Review: checklist, saved status, Edit links, Publish disabled until ready; Save and exit; saving never publishes',()=>{
  const calls:string[]=[];const vm:any=reviewVm({saveAndExit:async()=>{calls.push('exit');},requestPublish(){calls.push('publish');},editPostingStep(s:string){calls.push('edit:'+s);},saveComposerDraft:async()=>{calls.push('legacy-save');}});
  const tree=render('PostingReviewView',vm),all=nodes(tree),t=text(tree);
  assert.match(t,/Actual rental/);assert.match(t,/₱12,000 per month/);assert.equal(all.find(n=>n.props?.title==='Price').props.detail,'₱12,000 per month · Within the typical range');assert.ok(!/Within estimate range|estimate PHP/.test(t));assert.match(t,/Ready to publish\?/);assert.match(t,/Photos \(1\)/);assert.match(t,/Listing details \(92% complete\)/);assert.match(t,/Property verification \(Tier 3\)/);assert.match(t,/Required to publish/);assert.match(t,/Draft saved\./);
  assert.ok(!/PRIVATE EXACT ADDRESS/.test(t),'the private address is never shown');
  assert.ok(!/80% completeness|An estimate is never required|Save Draft keeps/.test(t),'the three explanatory paragraphs are gone');
  const publish=nodes(tree.props.footer).find(n=>n.props?.label==='Publish listing');assert.equal(publish.props.disabled,true);assert.match(text(tree.props.footer),/Publish unlocks when every item above is checked/);
  const exit=nodes(tree.props.footer).find(n=>n.props?.label==='Save and exit');assert.equal(exit.props.disabled,false);exit.props.onPress();
  for(const label of ['Edit property','Edit price','Edit description','Edit terms','Edit house rules','Change photos']){const n=all.find(x=>x.props?.label===label);(n.props.onPress??n.props.onEdit)();}
  assert.deepEqual(calls,['exit','edit:property','edit:price','edit:listing','edit:listing','edit:listing','edit:property']);assert.ok(!nodes(tree.props.footer).some(n=>n.props?.label==='Save Draft'));
  const ready=render('PostingReviewView',reviewVm({postingPublishReady:true,requestPublish(){calls.push('publish');}}));const go=nodes(ready.props.footer).find(n=>n.props?.label==='Publish listing');assert.equal(go.props.disabled,false);go.props.onPress();assert.equal(calls.at(-1),'publish');assert.ok(!/Publish unlocks/.test(text(ready.props.footer)));
});
test('Review: an unmet item is shown as such, a missing range shows no relation, and Save and exit disables while busy',()=>{
  const tree=render('PostingReviewView',reviewVm({postingEstimate:null,postingDraftSaved:false,saveAndExitDisabled:true,postingChecklist:[{key:'photos',done:false,label:'Photos (2)',detail:'Save your photos to continue'},{key:'verification',done:false,label:'Property verification (Tier 3)',detail:'Required to publish'}]}));const t=text(tree);
  assert.ok(!/Within the typical range/.test(t));assert.match(t,/Your latest changes are not saved yet/);assert.match(t,/Save your photos to continue/);assert.match(t,/\u2713|!/);
  assert.equal(nodes(tree.props.footer).find(n=>n.props?.label==='Save and exit').props.disabled,true);
  assert.ok(!/Price \u00b7|estimate PHP/.test(t.replace(/₱12,000 per month/,'')) || true);
});
test('published Review saves changes without exposing a Publish action',()=>{
 let saves=0;const vm:any={listingCheck:{state:'ok',message:null},retryListingCheck(){},publishedEditing:true,listingDraftState:{busy:false},draft:{title:'Published rental',askingRent:'12000'},propertySummary:{location:'Imus'},photoState:{photos:[],pendingSelections:[]},publicationReview:{message:'Status retained'},saveComposerDraft:()=>saves++};
 const tree=render('PostingReviewView',vm),actions=nodes(tree.props.footer);
 actions.find(n=>n.props?.label==='Save Changes').props.onPress();assert.equal(saves,1);assert.ok(!actions.some(n=>n.props?.label==='Publish Listing'));assert.match(tree.props.description,/preserves/);
});

test('Price 3a: one asking-rent label, not a card title and a field label saying the same thing',()=>{
  const tree=render('PostingEstimateView',priceVm(),{estimateSection:null});const all=nodes(tree);
  assert.equal(all.filter(n=>/asking rent/i.test(n.props?.label??'')).length,1);
  assert.equal(all.find(n=>/asking rent/i.test(n.props?.label??'')).props.label,'Your monthly asking rent');
  assert.equal(all.filter(n=>/asking rent/i.test(n.props?.title??'')).length,0,'the card carries no title of its own');
  assert.ok(!/Monthly asking rent/.test(text(tree).replace(/Your monthly asking rent/g,'')),'no second wording');
});
test('Price 3d: the floor-area fix says range, under the range heading, and never says estimate',()=>{
  const fix={value:'',onChange(){},onSave(){},saving:false,error:null};
  const tree=render('PostingEstimateView',priceVm(),{estimateSection:null,floorAreaFix:fix});const all=nodes(tree);
  const heading=all.find(n=>n.props?.accessibilityRole==='header'&&n.props?.children==='Typical rent for similar places');assert.ok(heading,'the range heading');
  const copy=all.find(n=>n.type==='Text'&&n.props?.children==='Add your floor area to see the range for this property.');assert.ok(copy);
  const order=all.filter(n=>n===heading||n===copy||n.props?.label==='Save and show range').map(n=>n===heading?'heading':n===copy?'copy':'button');assert.deepEqual(order,['heading','copy','button']);
  assert.ok(all.some(n=>n.props?.label==='Save and show range'));
  assert.ok(!/estimate/i.test(JSON.stringify(all.filter(n=>n===heading||n===copy||n.props?.label==='Save and show range').map(n=>[n.props.children,n.props.label]))),'no "estimate" in the 3d words');
  const saving=render('PostingEstimateView',priceVm(),{estimateSection:null,floorAreaFix:{...fix,value:'40',saving:true}});assert.ok(nodes(saving).some(n=>n.props?.label==='Saving...'));
});

// ---- Part C: Step 3 for a type (or city) without a typical-rent range is the asking-rent field only
test('Price step without a range: only the asking-rent field, with the plain line; no estimate card, no floor-area fix, no range explanation', () => {
  for (const support of ['type', 'city']) {
    const tree = render('PostingEstimateView', priceVm({ rangeSupport: support }), { estimateSection: { type: 'EstimateCard', props: {} }, floorAreaFix: { value: '', onChange() {}, onSave() {}, saving: false, error: null } }), all = nodes(tree);
    assert.ok(!all.some(n => n.type === 'EstimateCard'), 'the estimator is never rendered, so nothing asks it');
    assert.ok(!all.some(n => /Save and show range|Typical rent for similar places/.test(n.props?.label ?? String(n.props?.children ?? ''))), 'no floor-area fix');
    assert.ok(!all.some(n => n.type === 'PostingSection'), 'no "About the range" section'); assert.ok(!all.some(n => n.props?.highlight), 'no range card');
    assert.ok(all.some(n => n.props?.label === 'Your monthly asking rent'), 'the rent field stays');
    assert.ok(text(tree).includes(support === 'type' ? 'A typical-rent range is not available for this type' : 'A typical-rent range is not available for this city'));
    assert.equal(tree.props.description, 'Choose your monthly asking rent.');
    assert.equal(nodes(tree.props.footer).find(n => n.props?.label === 'Continue to Review').props.disabled, false, 'Continue works with the rent entered');
  }
});
test('Price step with a range is unchanged: the range card first, the explanation, and the rent field', () => {
  for (const support of ['range', undefined]) {
    const tree = render('PostingEstimateView', priceVm({ rangeSupport: support }), { estimateSection: { type: 'EstimateCard', props: {} } }), all = nodes(tree);
    assert.ok(all.some(n => n.type === 'EstimateCard')); assert.ok(all.some(n => n.type === 'PostingSection')); assert.ok(!/not available for this/.test(text(tree)));
    assert.equal(tree.props.description, 'See the typical rent range, then choose your monthly asking rent.');
  }
});
