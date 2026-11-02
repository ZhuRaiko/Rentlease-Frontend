/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoDropIndex,movePhotoIds} from '../src/features/property-listing/models/PropertyPhotoGrid';
import {createPropertyPhotoWorkflow} from '../src/features/property-listing/viewModels/propertyPhotoWorkflow';
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
const property='20000000-0000-4000-8000-000000000001';
const photo=(id:string,i:number)=>({id,property_id:property,storage_path:'property-media/'+id,publicUrl:'https://example.test/'+id,alt_text:null,sort_order:i,is_cover:i===0,created_at:'2026-11-02'});
function setup(){
 let rows=ids.map(photo),calls=0,fail=false,removeUnknown=false,delay:Promise<void>|null=null;
 const service:any={context:async()=>({ownerId:'owner',propertyId:property}),assertContext:async()=>{},hasPending:async()=>false,list:async()=>rows,reconcile:async()=>{},reorder:async(_c:any,order:string[])=>{calls++;if(delay)await delay;if(fail)throw Error('network');rows=order.map((id,i)=>({...rows.find(p=>p.id===id)!,sort_order:i,is_cover:i===0}));},updateAlt:async(_c:any,id:string,text:string)=>{rows=rows.map(p=>p.id===id?{...p,alt_text:text as any}:p);},remove:async(_c:any,id:string)=>{rows=rows.filter(p=>p.id!==id);if(removeUnknown)throw Error('cleanup unknown');}};
 const flow=createPropertyPhotoWorkflow(service,async()=>null);
 return {removeUnknown:()=>{removeUnknown=true;},flow,ready:async()=>{flow.setProperty(property);await flow.load();},calls:()=>calls,fail:()=>{fail=true;},delay:(p:Promise<void>)=>{delay=p;}};
}
test('two-column drop positions clamp correctly at edges and odd final row',()=>{
 assert.equal(photoDropIndex(0,0,0,0,100,8,3),0);assert.equal(photoDropIndex(0,110,0,0,100,8,3),1);assert.equal(photoDropIndex(0,0,110,0,100,8,3),2);assert.equal(photoDropIndex(0,110,110,0,100,8,3),2);assert.equal(photoDropIndex(2,-999,-999,0,100,8,3),0);
});
test('autoscroll offset participates in drop target without extra mutations',()=>{assert.equal(photoDropIndex(0,0,0,108,100,8,3),2);});
test('moving keeps exact unique photo set and does not mutate original IDs',()=>{const before=[...ids];assert.deepEqual(movePhotoIds(ids,2,0),[ids[2],ids[0],ids[1]]);assert.deepEqual(ids,before);assert.throws(()=>movePhotoIds(ids,-1,0));});
test('one drag drop persists exact order once, then uses authoritative cover',async()=>{const h=setup();await h.ready();await h.flow.reorder([ids[2]!,ids[0]!,ids[1]!]);assert.equal(h.calls(),1);assert.equal(h.flow.getSnapshot().photos[0]?.id,ids[2]);assert.equal(h.flow.getSnapshot().photos[0]?.is_cover,true);});
test('no-op drop does not issue a photo command',async()=>{const h=setup();await h.ready();await h.flow.reorder(ids);assert.equal(h.calls(),0);});
test('failed order keeps authoritative grid and requires recovery',async()=>{const h=setup();await h.ready();h.fail();await h.flow.reorder([...ids].reverse());assert.deepEqual(h.flow.getSnapshot().photos.map(p=>p.id),ids);assert.equal(h.flow.getSnapshot().needsReconcile,true);assert.equal(h.calls(),1);});
test('rapid drop cannot send a second command while order is pending',async()=>{const h=setup();await h.ready();let release!:()=>void;h.delay(new Promise<void>(r=>{release=r;}));const first=h.flow.reorder([...ids].reverse());await h.flow.reorder(ids);release();await first;assert.equal(h.calls(),1);});
test('photo detail opens/closes, retains edited description and uses existing dirty guard',async()=>{const h=setup();await h.ready();h.flow.openDetail(ids[1]!);assert.equal(h.flow.getSnapshot().detailId,ids[1]);h.flow.setAltDraft(ids[1]!,'Window');h.flow.closeDetail();assert.equal(h.flow.getSnapshot().detailId,null);assert.equal(h.flow.dirty(),true);h.flow.openDetail(ids[1]!);assert.equal(h.flow.getSnapshot().altDrafts[ids[1]!],'Window');});
test('description confirmation reloads authoritative value and returns to grid',async()=>{const h=setup();await h.ready();h.flow.openDetail(ids[1]!);h.flow.setAltDraft(ids[1]!,'Window');await h.flow.saveDetail();assert.equal(h.flow.getSnapshot().detailId,null);assert.equal(h.flow.getSnapshot().photos[1]?.alt_text,'Window');});
test('detail Android Back cancels removal before closing detail',async()=>{const h=setup();await h.ready();h.flow.openDetail(ids[0]!);h.flow.requestRemove(ids[0]!);assert.equal(h.flow.back(),true);assert.equal(h.flow.getSnapshot().removeId,null);assert.equal(h.flow.getSnapshot().detailId,ids[0]);assert.equal(h.flow.back(),true);assert.equal(h.flow.getSnapshot().detailId,null);});
test('confirmed detail removal returns to grid using existing journaled remove',async()=>{const h=setup();await h.ready();h.flow.openDetail(ids[0]!);h.flow.requestRemove(ids[0]!);await h.flow.confirmRemove();assert.equal(h.flow.getSnapshot().detailId,null);assert.equal(h.flow.getSnapshot().photos.length,2);});
test('late order after workspace disposal cannot repopulate grid',async()=>{const h=setup();await h.ready();let release!:()=>void;h.delay(new Promise<void>(r=>{release=r;}));const pending=h.flow.reorder([...ids].reverse());h.flow.setProperty(null);release();await pending;assert.equal(h.flow.getSnapshot().photos.length,0);assert.equal(h.flow.getSnapshot().detailId,null);});

test('reordering never discards an unsaved description for another photo',async()=>{
 const h=setup();await h.ready();h.flow.openDetail(ids[1]!);h.flow.setAltDraft(ids[1]!,'Keep this edit');await h.flow.reorder([...ids].reverse());assert.equal(h.flow.getSnapshot().altDrafts[ids[1]!],'Keep this edit');assert.equal(h.flow.dirty(),true);
});

test('removal recovery closes a missing detail and does not consume a later grid Back',async()=>{
 const h=setup();await h.ready();h.flow.openDetail(ids[0]!);h.flow.requestRemove(ids[0]!);h.removeUnknown();await h.flow.confirmRemove();assert.equal(h.flow.getSnapshot().needsReconcile,true);await h.flow.checkStatus();assert.equal(h.flow.getSnapshot().detailId,null);assert.equal(h.flow.back(),false);
});
