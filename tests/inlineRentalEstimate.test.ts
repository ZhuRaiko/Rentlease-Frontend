/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInlineRentalEstimate} from '../src/shared/viewModels/inlineRentalEstimate';
import {PredictionError} from '../src/shared/models/RentalPrediction';
const target={listingId:'00000000-0000-4000-8000-000000000001'};
const receipt={target,currency:'PHP' as const,modelVersion:'test',askingRent:21000,predictedAt:'2026-11-08T00:00:00Z'};
const range={minimum:14000,maximum:26000};
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
function renderInline(vm:any,info?:{open:boolean},onReview?:()=>void,extra:Record<string,unknown>={}){const path=resolve('src/shared/components/InlineRentalEstimate.tsx'),actual=createRequire(path),mod={exports:{} as any};const jsx=(type:any,props:any)=>({type,props});const req=(key:string):any=>key==='react'?{useState:()=>[info?.open??false,(v:boolean)=>{if(info)info.open=v;}]}:key==='react/jsx-runtime'?{jsx,jsxs:jsx}:key==='react-native'?{ActivityIndicator:'Loading',Modal:'Modal',ScrollView:'ScrollView',StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}},useWindowDimensions:()=>({height:640,width:320,fontScale:1.5}),Text:'Text',View:'View',Pressable:'Pressable'}:key.endsWith('/AppButton')?{AppButton:'Button'}:key.endsWith('/RangeEstimateCard')?{RangeEstimateCard:'RangeCard'}:key.endsWith('/useInlineRentalEstimate')?{useInlineRentalEstimate:()=>vm}:actual(key);new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);return mod.exports.InlineRentalEstimate({accountId:'A',target,onReview,...extra});}
const nodes=(v:any):any[]=>v&&typeof v==='object'&&!(v.type==='Modal'&&v.props.visible===false)?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
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









// ---- Range-only rendering: every variant shows the range card; none has a point value to show.
const textOf=(tree:any[])=>tree.filter(n=>n.type==='Text').map(n=>[n.props.children].flat().join('')).join(' ');
const withRange={...receipt,illustrativeRange:range};
test('details variant: one estimate action, then the range card for the asking rent, never a point value',()=>{
  let calls=0;const workflow={predict(){calls++;}};
  const initial=nodes(renderInline({workflow}));const buttons=initial.filter(n=>n.type==='Button');assert.equal(buttons.length,1);assert.equal(buttons[0].props.label,'Estimate rental price');buttons[0].props.onPress();assert.equal(calls,1);
  assert.ok(!initial.some(n=>n.props?.accessibilityLabel==='About rental price estimation'),'the old info icon is replaced by the card link');
  const tree=nodes(renderInline({workflow,result:withRange}));const card=tree.find(n=>n.type==='RangeCard');assert.deepEqual(card.props.range,range);assert.equal(card.props.rent,21000);assert.equal(card.props.onUseRent,undefined);
  assert.doesNotMatch(textOf(tree),/Estimated monthly rent|20,000|XGBoost|Model:/);
  const none=nodes(renderInline({workflow,result:receipt}));assert.ok(!none.some(n=>n.type==='RangeCard'));assert.match(textOf(none),/No typical range is available/);
  const failed=nodes(renderInline({busy:false,error:'Safe failure',workflow}));assert.ok(failed.some(n=>n.props?.accessibilityRole==='alert'));
  const invalid=nodes(renderInline({error:'Review saved property details.',retryable:false,workflow}));assert.ok(!invalid.some(n=>n.type==='Button'));
});
test('guidance variant: the range card carries the Use action; loading, retry and unsupported states never offer one',()=>{
  let applied:number|null=null,calls=0;const workflow={predict(){calls++;}};
  const first=nodes(renderInline({workflow},undefined,undefined,{variant:'guidance',onUseRent:(r:number)=>applied=r}));
  const get=first.find(n=>n.props.accessibilityLabel==='Get typical rent range');assert.ok(get);assert.equal(calls,0);get.props.onPress();assert.equal(calls,1);assert.equal(applied,null);
  const tree=nodes(renderInline({workflow,result:withRange},undefined,undefined,{variant:'guidance',askingRent:18000,onUseRent:(r:number)=>applied=r}));
  assert.match(textOf(tree),/Rental price guidance/);const card=tree.find(n=>n.type==='RangeCard');assert.deepEqual(card.props.range,range);assert.equal(card.props.rent,18000);
  assert.ok(!tree.some(n=>n.type==='Modal'));assert.equal(applied,null);card.props.onUseRent(15500);assert.equal(applied,15500);
  assert.doesNotMatch(textOf(tree),/XGBoost|estimated rent|20,000/);
  const busy=nodes(renderInline({workflow,busy:true,result:withRange},undefined,undefined,{variant:'guidance',onUseRent(){}}));assert.ok(busy.some(n=>n.type==='Loading'));assert.ok(!busy.some(n=>n.type==='RangeCard'),'no range is offered while a request is running');
  const error=nodes(renderInline({workflow,error:'Temporary failure',retryable:true},undefined,undefined,{variant:'guidance'}));assert.ok(error.some(n=>n.props.accessibilityLabel==='Retry estimate'));assert.ok(!error.some(n=>n.type==='RangeCard'));
  const unsupported=nodes(renderInline({workflow,eligibility:{eligible:false,reason:'Unsupported saved category'}},undefined,undefined,{variant:'guidance'}));assert.ok(!unsupported.some(n=>n.props.accessibilityLabel==='Get typical rent range'));assert.match(JSON.stringify(unsupported),/Unsupported saved category/);
});
test('posting variant: a range card with the owner rent and the Use action; transient retry; no point value',()=>{
  let applied:number|null=null,predicts=0;const workflow={predict:async()=>{predicts++;}};
  const initial=nodes(renderInline({workflow},undefined,undefined,{variant:'posting',onUseRent:(r:number)=>applied=r}));initial.find(n=>n.props?.accessibilityLabel==='Estimate Rental Price')!.props.onPress();assert.equal(predicts,1);assert.equal(applied,null);
  const ready=nodes(renderInline({workflow,result:withRange},undefined,undefined,{variant:'posting',askingRent:13000,onUseRent:(r:number)=>applied=r}));
  const card=ready.find(n=>n.type==='RangeCard');assert.deepEqual(card.props.range,range);assert.equal(card.props.rent,13000);card.props.onUseRent(14500);assert.equal(applied,14500);
  assert.ok(!ready.some(n=>n.props?.accessibilityLabel==='Use Estimated Price'));assert.doesNotMatch(textOf(ready),/model estimate|20,000|XGBoost/i);
  const failed=nodes(renderInline({workflow,error:'Temporary failure',retryable:true},undefined,undefined,{variant:'posting'}));assert.ok(failed.some(n=>n.props?.accessibilityLabel==='Retry estimate'));
  const unsupported=nodes(renderInline({workflow,eligibility:{eligible:false,reason:'Unsupported saved category'}},undefined,undefined,{variant:'posting'}));assert.match(JSON.stringify(unsupported),/Unsupported saved category/);assert.ok(!unsupported.some(n=>n.type==='RangeCard'));
});
test('spotlight (tenant): read-only range card for the listing, one protected action, and no range before a result',()=>{
  let calls=0;const workflow={predict(){calls++;}};
  const initial=nodes(renderInline({workflow},undefined,undefined,{variant:'spotlight',askingRent:9999}));
  assert.match(textOf(initial),/Is this rent fairly priced/);assert.ok(!initial.some(n=>n.type==='RangeCard'));
  const actions=initial.filter(n=>n.type==='Pressable');assert.equal(actions.length,1);actions[0].props.onPress();assert.equal(calls,1);
  const result=nodes(renderInline({workflow,result:withRange},undefined,undefined,{variant:'spotlight',askingRent:9999,onUseRent(){}}));const card=result.find(n=>n.type==='RangeCard');
  assert.deepEqual(card.props.range,range);assert.equal(card.props.rent,9999);assert.equal(card.props.subject,'listing');assert.equal(card.props.onUseRent,undefined);
  assert.doesNotMatch(JSON.stringify(result),/point estimate|Not requested|XGBoost/);
  const noRange=nodes(renderInline({workflow,result:receipt},undefined,undefined,{variant:'spotlight'}));assert.ok(!noRange.some(n=>n.type==='RangeCard'));
  const denied=nodes(renderInline({workflow,eligibility:{eligible:false,reason:'Unsupported property'}},undefined,undefined,{variant:'spotlight'}));assert.equal(denied.filter(n=>n.type==='Pressable').length,0);assert.match(JSON.stringify(denied),/Unsupported property/);
  for(const state of [{busy:true},{error:'Network unavailable',retryable:true}]){let c=0;const tree=nodes(renderInline({...state,workflow:{predict(){c++;}}},undefined,undefined,{variant:'spotlight'}));assert.ok(!tree.some(n=>n.type==='RangeCard'));const action=tree.find(n=>n.type==='Pressable');if('busy' in state)assert.equal(action.props.disabled,true);else{action.props.onPress();assert.equal(c,1);}}
});
