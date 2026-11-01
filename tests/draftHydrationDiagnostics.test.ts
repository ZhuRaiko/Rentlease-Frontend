/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureHydration,type HydrationDiagnostic} from '../src/features/property-listing/services/draftHydrationDiagnostics';
test('hydration timing reports measured stages without private request data',async()=>{
 let time=100;const events:HydrationDiagnostic[]=[];
 const result=await measureHydration('listing',async()=>{time=275;return{title:'private title'};},7,e=>events.push(e),()=>time);
 assert.equal(result.title,'private title');assert.deepEqual(events,[{stage:'listing',durationMs:175,request:7,result:'success',code:'none'}]);assert.doesNotMatch(JSON.stringify(events),/private/);
});
test('hydration timing classifies failures without swallowing them or leaking backend messages',async()=>{
 const events:HydrationDiagnostic[]=[];const error={code:'42501',message:'private address'};
 await assert.rejects(async()=>measureHydration('property',async()=>{throw error;},2,e=>events.push(e)),e=>e===error);assert.equal(events[0]?.result,'error');assert.equal(events[0]?.code,'42501');assert.doesNotMatch(JSON.stringify(events),/private/);
 await measureHydration('listing',async()=>({error}),2,e=>events.push(e));assert.equal(events[1]?.result,'error');assert.equal(events[1]?.code,'42501');await measureHydration('amenities',async()=>[{error:null},{error}],2,e=>events.push(e));assert.equal(events[2]?.result,'error');assert.equal(events[2]?.code,'42501');
});
