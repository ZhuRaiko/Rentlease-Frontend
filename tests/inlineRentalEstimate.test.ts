/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInlineRentalEstimate} from '../src/shared/viewModels/inlineRentalEstimate';
import {PredictionError} from '../src/shared/models/RentalPrediction';
const target={listingId:'00000000-0000-4000-8000-000000000001'};
const receipt={target,estimatedMonthlyRent:20000,currency:'PHP' as const,modelVersion:'test',askingRent:21000,predictedAt:'2026-11-08T00:00:00Z'};
const deferred=()=>{let resolve!:(v:typeof receipt)=>void;const promise=new Promise<typeof receipt>(r=>resolve=r);return {promise,resolve};};
test('opening details never predicts; first action uses current listing',async()=>{
 let calls=0;const w=createInlineRentalEstimate({predict:async(actor,t)=>{calls++;assert.equal(actor,'A');assert.deepEqual(t,target);return receipt;}},'A',target);
 assert.equal(calls,0);assert.equal(calls,0);await w.predict();assert.equal(calls,1);assert.deepEqual(w.getSnapshot().result,receipt);
});
test('owned unpublished property passes property ID without fabricated listing or reentered data',async()=>{
 const propertyTarget={propertyId:target.listingId};const w=createInlineRentalEstimate({predict:async(_,t)=>{assert.deepEqual(t,propertyTarget);return {...receipt,target:propertyTarget};}},'A',propertyTarget);await w.predict();assert.deepEqual(w.getSnapshot().result?.target,propertyTarget);
});
test('loading prevents duplicate requests; disposal cancels and late result cannot return',async()=>{
 const d=deferred();let calls=0,signal:AbortSignal|undefined;const w=createInlineRentalEstimate({predict:async(_,__,s)=>{calls++;signal=s;return d.promise;}},'A',target);const pending=w.predict();assert.equal(w.getSnapshot().busy,true);await w.predict();assert.equal(calls,1);w.dispose();assert.equal(signal?.aborted,true);d.resolve(receipt);await pending;assert.equal(w.getSnapshot().result,null);
});
test('Back/unmount or property/account replacement cancels old workflow and clears result',async()=>{
 const d=deferred();let signal:AbortSignal|undefined;const old=createInlineRentalEstimate({predict:async(_,__,s)=>{signal=s;return d.promise;}},'A',target);const pending=old.predict();old.dispose();const next=createInlineRentalEstimate({predict:async()=>receipt},'B',{propertyId:target.listingId});assert.equal(signal?.aborted,true);d.resolve(receipt);await pending;assert.equal(old.getSnapshot().result,null);assert.equal(next.getSnapshot().result,null);
});
test('unsupported/incomplete and malformed-response failures remain inline and allow retry',async()=>{
 for(const code of ['input','invalid_result','eligibility','access']){let calls=0;const w=createInlineRentalEstimate({predict:async()=>{if(++calls===1)throw new PredictionError('Safe failure',code);return receipt;}},'A',target);await w.predict();assert.equal(w.getSnapshot().error,'Safe failure');assert.equal(w.getSnapshot().busy,false);assert.equal(w.getSnapshot().result,null);await w.predict();assert.equal(w.getSnapshot().error,null);assert.equal(w.getSnapshot().result,receipt);}
});
test('missing account cannot reach prediction; unexpected error details stay private',async()=>{
 let calls=0;const client={predict:async()=>{calls++;throw new Error('private-token');}};const w=createInlineRentalEstimate(client,undefined,target);await w.predict();assert.equal(calls,0);const other=createInlineRentalEstimate(client,'A',target);await other.predict();assert.ok(!other.getSnapshot().error?.includes('private-token'));
});

import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
function renderInline(vm:any,info?:{open:boolean},onReview?:()=>void,extra:Record<string,unknown>={}){const path=resolve('src/shared/components/InlineRentalEstimate.tsx'),actual=createRequire(path),mod={exports:{} as any};const jsx=(type:any,props:any)=>({type,props});const req=(key:string):any=>key==='react'?{useState:()=>[info?.open??false,(v:boolean)=>{if(info)info.open=v;}]}:key==='react/jsx-runtime'?{jsx,jsxs:jsx}:key==='react-native'?{ActivityIndicator:'Loading',Modal:'Modal',ScrollView:'ScrollView',StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}},useWindowDimensions:()=>({height:640,width:320,fontScale:1.5}),Text:'Text',View:'View',Pressable:'Pressable'}:key.endsWith('/AppButton')?{AppButton:'Button'}:key.endsWith('/useInlineRentalEstimate')?{useInlineRentalEstimate:()=>vm}:actual(key);new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);return mod.exports.InlineRentalEstimate({accountId:'A',target,onReview,...extra});}
const nodes=(v:any):any[]=>v&&typeof v==='object'&&!(v.type==='Modal'&&v.props.visible===false)?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
test('inline presentation exposes one immediate estimate action and no accordion',()=>{
 let calls=0;const workflow={predict(){calls++;}};
 const initial=nodes(renderInline({workflow}));const buttons=initial.filter(n=>n.type==='Button');assert.equal(buttons.length,1);assert.equal(buttons[0].props.label,'Estimate rental price');assert.equal(calls,0);buttons[0].props.onPress();assert.equal(calls,1);assert.ok(!JSON.stringify(initial).includes('Show estimate options'));
 const tree=nodes(renderInline({expanded:true,workflow,result:{...receipt,illustrativeRange:{minimum:14000,maximum:26000}}}));
 const text=tree.filter(n=>n.type==='Text').map(n=>[n.props.children].flat().join('')).join(' ');
 assert.match(text,/Estimated monthly rent/);assert.match(text,/Illustrative rental range/);assert.match(text,/Landlord asking rent/);assert.equal(tree.filter(n=>n.type==='Text'&&n.props.children==='per month').length,1);
 const legacy=JSON.stringify(renderInline({expanded:true,workflow,result:receipt}));assert.ok(!legacy.includes('Illustrative rental range'));
});
test('inline loading disables its single action and inline errors offer retry',()=>{
 let retried=0;const workflow={predict(){retried++;}};
 const loading=nodes(renderInline({expanded:true,busy:true,workflow}));assert.ok(loading.some(n=>n.type==='Loading'));const action=loading.find(n=>n.type==='Button');assert.equal(action.props.label,'Estimating\u2026');assert.equal(action.props.disabled,true);assert.equal(loading.filter(n=>n.type==='Button').length,1);
 const failed=nodes(renderInline({expanded:true,busy:false,error:'Safe failure',workflow}));assert.ok(failed.some(n=>n.props?.accessibilityRole==='alert'));failed.find(n=>n.type==='Button'&&n.props.label==='Retry estimate').props.onPress();assert.equal(retried,1);
});


test('validation codes are retained and not retryable, while transient failures can retry',async()=>{
 for(const code of ['input','model_input','eligibility','access','auth','configuration','upstream','timeout','unavailable']){
 const w=createInlineRentalEstimate({predict:async()=>{throw new PredictionError('Safe failure',code);}},'A',target);await w.predict();assert.equal(w.getSnapshot().errorCode,code);assert.equal(w.getSnapshot().retryable,['upstream','timeout','unavailable'].includes(code));
 }
});
test('invalid saved data shows review guidance without a Retry button or default technical paragraph',()=>{
 const tree=nodes(renderInline({error:'Review saved property details.',retryable:false,workflow:{predict(){}}}));
 assert.ok(!tree.some(n=>n.type==='Button'));const text=tree.filter(n=>n.type==='Text').map(n=>n.props.children).join(' ');assert.match(text,/Review saved/);assert.ok(!text.includes('imputed'));assert.ok(tree.some(n=>n.props?.accessibilityLabel==='About rental price estimation'));
});


test('information opens only on demand with a 44dp target and Android Back dismisses modal',()=>{
 const info={open:false},vm={workflow:{predict(){}}};let tree=nodes(renderInline(vm,info));const icon=tree.find(n=>n.props?.accessibilityLabel==='About rental price estimation');assert.ok(icon.props.style.minHeight>=44&&icon.props.style.minWidth>=44);icon.props.onPress();assert.equal(info.open,true);
 tree=nodes(renderInline(vm,info));const modal=tree.find(n=>n.type==='Modal');assert.ok(modal);const text=JSON.stringify(tree);assert.ok(text.includes('not a confidence interval'));assert.ok(text.includes('Precise coordinates'));modal.props.onRequestClose();assert.equal(info.open,false);
});

import {rentalEstimateEligibility} from '../src/shared/models/RentalEstimateEligibility';
const saved={property_type:'house',city:'imus',furnishing_status:'unfurnished',floor_area_sqm:60,bedrooms:2,bathrooms:1};
test('saved supported types, unusual valid dimensions and missing optional inputs remain eligible',()=>{
 for(const property_type of ['house','apartment','condominium'])assert.equal(rentalEstimateEligibility({...saved,property_type}).eligible,true);
 assert.equal(rentalEstimateEligibility({...saved,floor_area_sqm:5000,bedrooms:40,bathrooms:0}).eligible,true);
 assert.equal(rentalEstimateEligibility({...saved,bedrooms:null,bathrooms:null}).eligible,true);
});
test('stored category overrides title and missing/invalid floor area has specific eligibility reason',()=>{
 for(const property_type of ['boarding_house','room','studio','bedspace','dormitory','other'])assert.match(rentalEstimateEligibility({...saved,property_type,title:'Modern house apartment'}).reason??'',/type is not currently supported/);
 assert.match(rentalEstimateEligibility({...saved,floor_area_sqm:null}).reason??'',/has not been provided/);
 for(const floor_area_sqm of [0,-2,NaN,Infinity,'60'])assert.match(rentalEstimateEligibility({...saved,floor_area_sqm}).reason??'',/measurements need review/);
 assert.equal(rentalEstimateEligibility({...saved,bedrooms:-1}).eligible,false);assert.equal(rentalEstimateEligibility({...saved,is_active:false}).eligible,false);
});
test('known eligibility failure prevents even direct workflow prediction, without fabricating server error',async()=>{
 let calls=0;const eligibility=rentalEstimateEligibility({...saved,property_type:'boarding_house'});const w=createInlineRentalEstimate({predict:async()=>{calls++;return receipt;}},'A',target,eligibility);await w.predict();assert.equal(calls,0);assert.equal(w.getSnapshot().errorCode,null);
});
test('ineligible tenant sees explanation only; owner gets only allowed review action',()=>{
 const eligibility=rentalEstimateEligibility({...saved,floor_area_sqm:null}),vm={eligibility,workflow:{predict(){assert.fail('ineligible');}}};
 assert.ok(!nodes(renderInline(vm)).some(n=>n.type==='Button'));
 let reviewed=0;const owner=nodes(renderInline(vm,undefined,()=>reviewed++));const actions=owner.filter(n=>n.type==='Button');assert.equal(actions.length,1);assert.equal(actions[0].props.label,'Review property details');actions[0].props.onPress();assert.equal(reviewed,1);
});
test('eligible saved property with unexpected server input rejection remains a server failure, not local unsupported status',async()=>{
 const eligibility=rentalEstimateEligibility(saved);const w=createInlineRentalEstimate({predict:async()=>{throw new PredictionError('Server validation failed.','input');}},'A',target,eligibility);await w.predict();assert.equal(eligibility.eligible,true);assert.equal(w.getSnapshot().errorCode,'input');assert.equal(w.getSnapshot().error,'Server validation failed.');
});

test('information dialog is content-sized with bounded width and a small accessible close action',()=>{
 const tree=nodes(renderInline({workflow:{predict(){}}},{open:true}));const close=tree.find(n=>n.props?.accessibilityLabel==='Close estimate information');assert.equal(close.props.style.width,44);assert.equal(close.props.style.height,44);
 const panel=tree.find(n=>n.props?.accessibilityViewIsModal);const style=Object.assign({},...panel.props.style);assert.equal(style.maxWidth,340);assert.equal(style.height,undefined);assert.equal(style.flex,undefined);assert.equal(style.padding,18);assert.equal(style.maxHeight,544);
 const scroll=tree.find(n=>n.type==='ScrollView');assert.equal(scroll.props.style.flexGrow,0);assert.equal(scroll.props.scrollEnabled,false);assert.ok(!tree.some(n=>n.props?.label==='Close information'));
});


test('price guidance matches compact hierarchy and only explicit Use estimate applies real prediction',()=>{
 let applied:any=null,calls=0;const workflow={predict(){calls++;}};
 const first=nodes(renderInline({workflow},undefined,undefined,{variant:'guidance',onUseEstimate:(r:any)=>applied=r}));
 const get=first.find(n=>n.props.accessibilityLabel==='Get estimated rent');assert.ok(get);assert.equal(calls,0);get.props.onPress();assert.equal(calls,1);assert.equal(applied,null);
 const tree=nodes(renderInline({workflow,result:{...receipt,illustrativeRange:{minimum:14000,maximum:26000}}},undefined,undefined,{variant:'guidance',onUseEstimate:(r:any)=>applied=r}));
 const text=tree.filter(n=>n.type==='Text').map(n=>[n.props.children].flat().join('')).join(' ');
 assert.match(text,/Rental price guidance/);assert.match(text,/XGBoost estimated rent/);assert.match(text,/20,000/);assert.match(text,/14,000/);assert.match(text,/26,000/);assert.match(text,/not a statistical confidence interval/);assert.doesNotMatch(text,/Example|18,000|Landlord asking rent|Model:/);
 assert.ok(!tree.some(n=>n.type==='Modal'));assert.equal(applied,null);const use=tree.find(n=>n.props.accessibilityLabel==='Use estimate');assert.ok(use);use.props.onPress();assert.equal((applied as any).estimatedMonthlyRent,20000);
});
test('guidance loading, retry and unsupported states stay local and never offer invalid adoption',()=>{
 const workflow={predict(){}};
 const busy=nodes(renderInline({workflow,busy:true},undefined,undefined,{variant:'guidance'}));assert.ok(busy.some(n=>n.type==='Loading'));assert.equal(busy.find(n=>n.props.accessibilityLabel==='Get estimated rent').props.disabled,true);
 const error=nodes(renderInline({workflow,error:'Temporary failure',retryable:true},undefined,undefined,{variant:'guidance'}));assert.ok(error.some(n=>n.props.accessibilityLabel==='Retry estimate'));assert.ok(!error.some(n=>n.props.accessibilityLabel==='Use estimate'));
 const unsupported=nodes(renderInline({workflow,eligibility:{eligible:false,reason:'Unsupported saved category'}},undefined,undefined,{variant:'guidance'}));assert.ok(!unsupported.some(n=>n.props.accessibilityLabel==='Get estimated rent'));
});

test('posting estimator exposes real results, explicit adoption and transient retry without requiring prediction',()=>{let applied:any=null,predicts=0;const workflow={predict:async()=>{predicts++;}};const initial=nodes(renderInline({workflow},undefined,undefined,{variant:'posting',onUseEstimate:(r:any)=>applied=r}));initial.find(n=>n.props?.accessibilityLabel==='Estimate Rental Price')!.props.onPress();assert.equal(predicts,1);assert.equal(applied,null);const ready=nodes(renderInline({workflow,result:receipt},undefined,undefined,{variant:'posting',onUseEstimate:(r:any)=>applied=r}));ready.find(n=>n.props?.accessibilityLabel==='Use Estimated Price')!.props.onPress();assert.equal(applied,receipt);const failed=nodes(renderInline({workflow,error:'Temporary failure',retryable:true},undefined,undefined,{variant:'posting'}));assert.ok(failed.some(n=>n.props?.accessibilityLabel==='Retry estimate'));const unsupported=nodes(renderInline({workflow,eligibility:{eligible:false,reason:'Unsupported saved category'}},undefined,undefined,{variant:'posting'}));assert.match(JSON.stringify(unsupported),/Unsupported saved category/);assert.ok(!unsupported.some(n=>n.props?.accessibilityLabel==='Use Estimated Price'));});


test('spotlight follows reference with two truthful metrics and one protected action',()=>{
 let calls=0;const workflow={predict(){calls++;}};
 const initial=nodes(renderInline({workflow},undefined,undefined,{variant:'spotlight',askingRent:9999}));
 const text=initial.filter(n=>n.type==='Text').map(n=>[n.props.children].flat().join('')).join(' ');
 assert.match(text,/Is this rent fairly priced/);assert.match(text,/9,999/);assert.match(text,/Not requested/);
 const actions=initial.filter(n=>n.type==='Pressable');assert.equal(actions.length,1);actions[0].props.onPress();assert.equal(calls,1);
 const result=nodes(renderInline({workflow,result:receipt},undefined,undefined,{variant:'spotlight',askingRent:9999}));assert.ok(result.some(n=>n.props?.children==="Model's point estimate"));assert.doesNotMatch(JSON.stringify(result),/Not requested/);
 const denied=nodes(renderInline({workflow,eligibility:{eligible:false,reason:'Unsupported property'}},undefined,undefined,{variant:'spotlight'}));assert.equal(denied.filter(n=>n.type==='Pressable').length,0);assert.match(JSON.stringify(denied),/Unsupported property/);
});


test('range-first spotlight consumes supplied bounds before secondary metrics with a calculated accessible marker',()=>{
 const result={...receipt,estimatedMonthlyRent:11747.67,illustrativeRange:{minimum:8223.37,maximum:15271.97}};
 const tree=nodes(renderInline({workflow:{predict(){}},result},undefined,undefined,{variant:'spotlight',askingRent:1}));
 const texts=tree.filter(n=>n.type==='Text').map(n=>[n.props.children].flat().join(''));
 assert.ok(texts.indexOf('Illustrative rental range')<texts.indexOf("Landlord's asking rent"));
 assert.ok(texts.includes('\u20b18,223.37'));assert.ok(texts.includes('\u20b115,271.97'));assert.ok(texts.includes('\u20b11.00'));
 const interval=tree.find(n=>n.props?.accessibilityLabel?.startsWith('Illustrative rental range from'));
 assert.ok(interval);assert.match(interval.props.accessibilityLabel,/not a confidence interval/);
 const marker=tree.find(n=>n.props?.testID==='rental-range-marker');
 assert.equal(marker.props.style[1].left,`${(11747.67-8223.37)/(15271.97-8223.37)*100}%`);
 const bounds=tree.find(n=>n.props?.testID==='rental-range-bounds');assert.equal(bounds.props.style[1].flexDirection,'column');
});
test('range-first states never fabricate bounds and keep loading and retry guards',()=>{
 for(const state of [{},{busy:true},{error:'Network unavailable',retryable:true},{eligibility:{eligible:false,reason:'Unsupported'}}]){
  let calls=0;const tree=nodes(renderInline({...state,workflow:{predict(){calls++;}}},undefined,undefined,{variant:'spotlight'}));
  assert.ok(!tree.some(n=>n.props?.testID==='rental-range-bounds'));
  const action=tree.find(n=>n.type==='Pressable');if('busy' in state)assert.equal(action.props.disabled,true);
  if('eligibility' in state)assert.equal(action,undefined);
  if('error' in state){action.props.onPress();assert.equal(calls,1);}
 }
});
test('range bounds retain cents for small and large real contract values; absent range stays absent',()=>{
 for(const amount of [.1,1234567890.12]){
  const range={minimum:amount*.7,maximum:amount*1.3};
  const tree=nodes(renderInline({workflow:{predict(){}},result:{...receipt,estimatedMonthlyRent:amount,illustrativeRange:range}},undefined,undefined,{variant:'spotlight'}));
  const text=JSON.stringify(tree);const php=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2});
  assert.ok(text.includes(php.format(range.minimum)));assert.ok(text.includes(php.format(range.maximum)));
 }
 const tree=nodes(renderInline({workflow:{predict(){}},result:receipt},undefined,undefined,{variant:'spotlight'}));assert.ok(!tree.some(n=>n.props?.testID==='rental-range-bounds'));
});
