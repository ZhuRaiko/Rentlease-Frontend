/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapPredictionInput} from '../src/shared/models/RentalPrediction';
import {createPredictionHandler} from '../supabase/functions/rental-price-estimate/handler';
const base={property_type:'house',city:'imus',furnishing_status:'unfurnished',floor_area_sqm:50,bedrooms:2,bathrooms:1};
const A='00000000-0000-4000-8000-000000000001',P='00000000-0000-4000-8000-000000000002',L='00000000-0000-4000-8000-000000000003';
test('all stored supported subtype pairs use the fitted group API without reclassifying marketplace types',()=>{
 for(const [parent,subtypes] of [['house',['house','townhouse','beach_house','villa']],['apartment',['apartment','room','condominium','studio','loft','penthouse','condotel']],['condominium',['apartment','room','condominium','studio','loft','penthouse','condotel']]] as const)
 for(const subtype of subtypes){const input=mapPredictionInput({...base,property_type:parent,property_subtype:subtype});assert.equal(input.property_type,parent==='house'?'house':'apartment_condominium');assert.equal(input.property_subtype,subtype);}
 for(const parent of ['room','studio','boarding_house','bedspace','dormitory','other','apartment_condominium'])assert.throws(()=>mapPredictionInput({...base,property_type:parent,property_subtype:'room'}));
 for(const property_subtype of ['studio','unknown','',23,true])assert.throws(()=>mapPredictionInput({...base,property_subtype}));
 assert.throws(()=>mapPredictionInput({...base,property_type:'apartment',property_subtype:'villa'}));
});
test('legacy null/missing subtype retains original request fallback; missing and zero measurements remain distinct',()=>{
 for(const property_type of ['house','apartment','condominium'])for(const subtype of [null,undefined]){const input=mapPredictionInput({...base,property_type,property_subtype:subtype});assert.equal(input.property_type,property_type);assert.equal(input.property_subtype,property_type);}
 for(const value of [null,undefined,'','  ']){const input=mapPredictionInput({...base,lot_area_sqm:value,parking_spaces:value});assert.equal(input.lot_area_sqm,null);assert.equal(input.parking_spaces,null);}
 for(const value of [0,2]){const input=mapPredictionInput({...base,lot_area_sqm:value,parking_spaces:value});assert.equal(input.lot_area_sqm,value);assert.equal(input.parking_spaces,value);}
 for(const value of [-1,NaN,Infinity,'2',false])for(const field of ['lot_area_sqm','parking_spaces'])assert.throws(()=>mapPredictionInput({...base,[field]:value}));
 assert.throws(()=>mapPredictionInput({...base,parking_spaces:1.5}));
});
function harness(error?:{code:string;message:string},status=400){let reads=0,actor=A;const calls:{url:string;body:any;authorization:string|null}[]=[];
 const http:typeof fetch=async(url,init={})=>{const path=String(url),headers=new Headers(init.headers);calls.push({url:path,body:init.body?JSON.parse(String(init.body)):null,authorization:headers.get('Authorization')});
 if(path.endsWith('/auth/v1/user'))return Response.json({id:actor});
 if(path.includes('/rpc/'))return Response.json(true);
 if(path.includes('/properties?')){reads++;if(error&&path.includes('property_subtype'))return Response.json(error,{status});return Response.json([{...base,id:P,landlord_id:A,is_active:true,...(!error?{property_subtype:'villa',lot_area_sqm:0,parking_spaces:0}:{})}]);}
 if(path.includes('/listings?'))return Response.json([{id:L,property_id:P,landlord_id:A,status:'active',published_at:'2026-01-01',available_from:null,asking_rent_monthly:9000}]);
 if(path.includes('/property_amenities?'))return Response.json([]);
 return Response.json({estimated_rent_monthly:10000,currency:'PHP',model_version:'fixture',range_min:7000,range_max:13000});};
 const handler=createPredictionHandler({supabaseUrl:'https://db.example',anonKey:'synthetic-public',mlUrl:'https://rentlease-ml.onrender.com',mlSecret:'synthetic-only'},http);
 return{calls,reads:()=>reads,actor:(v:string)=>actor=v,run:(target:unknown={propertyId:P},signal?:AbortSignal)=>handler(new Request('https://edge.example',{method:'POST',headers:{Authorization:'Bearer synthetic-user'},body:JSON.stringify(target),...(signal?{signal}:{})}))};}
test('proxy reads optional stored attributes with caller JWT and keeps range, asking rent and privacy intact',async()=>{
 const h=harness(),r=await h.run({listingId:L});assert.equal(r.status,200);const body=await r.json();assert.equal(body.askingRent,9000);assert.deepEqual(body.illustrativeRange,{minimum:7000,maximum:13000});
 const input=h.calls.find(c=>c.url.endsWith('/predict'))!.body;assert.equal(input.property_subtype,'villa');assert.equal(input.lot_area_sqm,0);assert.equal(input.parking_spaces,0);assert.equal(input.latitude,null);assert.equal(input.longitude,null);assert.equal('asking_rent_monthly' in input,false);
 assert.ok(h.calls.filter(c=>c.url.startsWith('https://db.example')).every(c=>c.authorization==='Bearer synthetic-user'));
 assert.ok(h.calls.every(c=>!c.url.includes('location')&&!c.url.includes('private')));
});
test('only exact missing Phase 2A columns trigger one legacy projection retry',async()=>{
 for(const column of ['property_subtype','lot_area_sqm','parking_spaces']){const h=harness({code:'42703',message:`column properties.${column} does not exist`});assert.equal((await h.run()).status,200);assert.equal(h.reads(),2);const input=h.calls.find(c=>c.url.endsWith('/predict'))!.body;assert.equal(input.property_subtype,'house');assert.equal(input.lot_area_sqm,null);assert.equal(input.parking_spaces,null);}
});
test('unrelated database, permission, malformed error and schema-cache failures never become legacy fallback',async()=>{
 for(const [code,message,status] of [['42703','column properties.bedrooms does not exist',400],['42501','permission denied',403],['PGRST204','missing column',400],['42703','column properties.property_subtype does not exist',500],['42703','private diagnostic',400],['42P01','relation properties does not exist',404]] as const){const h=harness({code,message},status),r=await h.run();assert.notEqual(r.status,200);assert.equal(h.reads(),1);assert.ok(!h.calls.some(c=>c.url.endsWith('/predict')));assert.ok(!(await r.text()).includes('diagnostic'));}
});
test('foreign direct property remains denied after legacy retry and cancellation never reaches model',async()=>{
 const h=harness({code:'42703',message:'column properties.property_subtype does not exist'});h.actor('00000000-0000-4000-8000-000000000099');assert.equal((await h.run()).status,404);assert.ok(!h.calls.some(c=>c.url.endsWith('/predict')));
 const c=new AbortController();c.abort();const h2=harness();assert.equal((await h2.run({propertyId:P},c.signal)).status,504);assert.ok(!h2.calls.some(c=>c.url.endsWith('/predict')));
});

import {derivePublicPropertyPoint} from '../src/features/property-listing/models/PropertyLocationPrivacy';
import {reviewPublicGridPoint} from '../src/features/property-listing/models/PropertyLocationInferenceReview';
test('Phase 2C preparation identifies grid shape only, never consent, authorization or transmissible coordinates',()=>{
 const point=derivePublicPropertyPoint({latitude:14.42,longitude:120.94});
 assert.deepEqual(reviewPublicGridPoint(point),{status:'grid_shape_only',transmissionAllowed:false});
 for(const value of [null,{},[120.94,14.42],{latitude:14.42,longitude:120.94},{...point,exact_location:'private'},{latitude:NaN,longitude:0},{latitude:90,longitude:0}])assert.deepEqual(reviewPublicGridPoint(value),{status:'unverified',transmissionAllowed:false});
 const r=mapPredictionInput({...base,public_location:point,exact_location:point,latitude:point.latitude,longitude:point.longitude});assert.equal(r.latitude,null);assert.equal(r.longitude,null);
});

import {parseModelPrediction,parsePredictionReceipt} from '../src/shared/models/RentalPrediction';
test('shared range dependency rejects misleading bounds without hiding a valid primary result',()=>{
 const base={estimated_rent_monthly:10000,currency:'PHP',model_version:'fixture'};
 for(const [range_min,range_max] of [[null,null],[7000,undefined],['7000',13000],[NaN,13000],[7000,Infinity],[-1,13000],[13000,7000],[8000,12000]]){const result=parseModelPrediction({...base,range_min,range_max});assert.equal(result.estimatedMonthlyRent,10000);assert.equal(result.illustrativeRange,null);}
 assert.deepEqual(parseModelPrediction({...base,range_min:7000,range_max:13000}).illustrativeRange,{minimum:7000,maximum:13000});
 const receipt={estimatedMonthlyRent:10000,currency:'PHP',modelVersion:'fixture',target:{propertyId:P},askingRent:9000,predictedAt:'2026-11-09T00:00:00Z'};
 assert.equal(parsePredictionReceipt(receipt,{propertyId:P}).illustrativeRange,null);
 assert.equal(parsePredictionReceipt({...receipt,illustrativeRange:{minimum:1,maximum:2}},{propertyId:P}).illustrativeRange,null);
 assert.equal(parsePredictionReceipt(receipt,{propertyId:P}).askingRent,9000);
});
