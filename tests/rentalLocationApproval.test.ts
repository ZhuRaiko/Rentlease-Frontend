/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRentalCoordinates,rentalLocationPolicy} from '../src/shared/models/RentalCoordinateProjection';
import {derivePublicPropertyPoint} from '../src/features/property-listing/models/PropertyLocationPrivacy';
import {createRentalLocationApprovalService} from '../src/shared/services/rentalLocationApprovalService';
import {createPredictionHandler} from '../supabase/functions/rental-price-estimate/handler';
const P='00000000-0000-4000-8000-000000000001',V='00000000-0000-4000-8000-000000000002',R='00000000-0000-4000-8000-000000000003';
const point=derivePublicPropertyPoint({latitude:14.42,longitude:120.94});
const projection={propertyId:P,editVersion:V,locationRevision:R,approvedRevision:R,policy:rentalLocationPolicy,...point};
test('only exact version-bound approved named public-grid projection is accepted',()=>{
 assert.deepEqual(parseRentalCoordinates(projection,P,V),point);
 for(const value of [null,{}, {...projection,approvedRevision:V},{...projection,editVersion:R},{...projection,propertyId:R},{...projection,policy:'old'},{...projection,latitude:NaN},{...projection,latitude:projection.longitude,longitude:projection.latitude},{...projection,exact_location:point},{...projection,latitude:14.42,longitude:120.94}])assert.equal(parseRentalCoordinates(value,P,V),null);
});
test('owner approval service preserves missing rollout, uses exact revision and reloads uncertain writes',async()=>{
 let actor=P,error:any=null,data:any={revision:R,policy:rentalLocationPolicy,eligible:true,approved:false,point};const calls:any[]=[];
 const client:any={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},rpc:(name:string,args:any)=>{calls.push({name,args});return{abortSignal:async()=>({data,error})};}};
 const service=createRentalLocationApprovalService(()=>client),signal=new AbortController().signal;
 const state=(await service.load(P,P,signal))!;data={...data,approved:true};assert.equal((await service.save(P,P,state,true,signal)).approved,true);
 assert.deepEqual(calls.at(-1).args,{p_property_id:P,p_revision:R,p_policy:rentalLocationPolicy,p_approve:true});
 data={...data,approved:false};assert.equal((await service.save(P,P,state,false,signal)).approved,false);
 error={code:'PGRST202'};assert.equal(await service.load(P,P,signal),null);await assert.rejects(service.save(P,P,state,true,signal));
 error=null;actor=R;await assert.rejects(service.load(P,P,signal));
});
test('proxy forwards only caller-authorized projection; missing/stale projection keeps nulls and denied calls stop',async()=>{
 for(const outcome of ['approved','missing','stale','denied'] as const){let model:any=null,rpc:any=null;
 const http:typeof fetch=async(url,init={})=>{const path=String(url);
 if(path.endsWith('/auth/v1/user'))return Response.json({id:P});
 if(path.endsWith('/is_tier1_verified'))return Response.json(true);
 if(path.includes('/properties?'))return Response.json([{id:P,landlord_id:P,is_active:true,edit_version:V,property_type:'house',city:'imus',furnishing_status:'unfurnished',floor_area_sqm:50}]);
 if(path.includes('/property_amenities?'))return Response.json([]);
 if(path.endsWith('/get_rental_prediction_coordinates')){rpc={headers:new Headers(init.headers),body:JSON.parse(String(init.body))};return outcome==='missing'?Response.json({code:'PGRST202'},{status:404}):outcome==='denied'?Response.json({code:'42501'},{status:403}):Response.json(outcome==='stale'?{...projection,approvedRevision:V}:projection);}
 model=JSON.parse(String(init.body));return Response.json({estimated_rent_monthly:10000,currency:'PHP',model_version:'fixture'});};
 const h=createPredictionHandler({supabaseUrl:'https://db.example',anonKey:'fixture',mlUrl:'https://rentlease-ml.onrender.com',mlSecret:'fixture',approvedCoordinates:true},http);
 const response=await h(new Request('https://edge.example',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({propertyId:P})}));
 assert.equal(response.status,outcome==='denied'?403:200);assert.equal(rpc.headers.get('Authorization'),'Bearer fixture');assert.equal(rpc.body.p_edit_version,V);
 if(outcome==='denied')assert.equal(model,null);else{assert.equal(model.latitude,outcome==='approved'?point.latitude:null);assert.equal(model.longitude,outcome==='approved'?point.longitude:null);assert.equal('exact_location' in model,false);}
 }
});
test('owner control and always-visible ranking disclosure do not change scoring or auto-adopt rent',()=>{
 const ui=readFileSync('src/shared/components/RentalLocationApproval.tsx','utf8');assert.match(ui,/Withdraw location permission/);assert.match(ui,/Public map point to confirm/);assert.match(ui,/Declining does not block estimation or publication/);
 const view=readFileSync('src/features/search-discovery/views/TenantDiscoveryView.tsx','utf8');assert.match(view,/preferences \(80%\).*Tier 2 identity verification \(10%\).*completeness \(10%\)/);assert.match(view,/Listings without confirmed verification remain eligible/);
});

test('approval context cannot offer confirmation without the exact valid public point',()=>{
 const {parseRentalLocationApproval}=require('../src/shared/services/rentalLocationApprovalService');
 for(const point of [undefined,null,{latitude:14.42,longitude:120.94},{latitude:120.94,longitude:14.42}])assert.throws(()=>parseRentalLocationApproval({revision:R,policy:rentalLocationPolicy,eligible:true,approved:false,point}));
 assert.equal(parseRentalLocationApproval({revision:R,policy:rentalLocationPolicy,eligible:false,approved:false,point:null}).point,null);
});
