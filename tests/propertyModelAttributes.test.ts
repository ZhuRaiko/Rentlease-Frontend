/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modelSubtypeOptions,propertyModelAttributes} from '../src/features/property-listing/models/PropertyModelAttributes';
import {emptyDraftProperty,propertyValidationIssues} from '../src/features/property-listing/models/DraftProperty';
import {routineDraft,routineIssues,routineFieldsEqual} from '../src/features/property-listing/models/PropertyRoutineEdit';
import {createPropertyCreationService} from '../src/features/property-listing/services/propertyCreationService';
import {createPropertyRoutineService,parsePropertyEditContext} from '../src/features/property-listing/services/propertyRoutineService';
import {mapPredictionInput} from '../src/shared/models/RentalPrediction';
const owner='90000000-0000-4000-8000-000000000001',id='10000000-0000-4000-8000-000000000001',version='20000000-0000-4000-8000-000000000001',next='20000000-0000-4000-8000-000000000002';
const draft=()=>({...emptyDraftProperty(),propertyType:'house' as const,city:'imus' as const,barangay:'Fixture',addressLine1:'Synthetic street',exactLatitude:14.4,exactLongitude:120.9,publicLatitude:14.4,publicLongitude:120.9,bedrooms:'1',bathrooms:'1',floorAreaSqm:'30'});
const context=()=>({owner_id:owner,property_id:id,edit_version:version,property_type:'house' as const,city:'imus' as const,barangay:'Fixture',floor_number:null,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:null,total_floors:2,furnishing_status:'unfurnished' as const,access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false,model_attributes_version:2,property_subtype:'villa',lot_area_sqm:50,parking_spaces:1});
test('subtype allowlists match canonical fitted groups without recategorizing marketplace types',()=>{
 assert.deepEqual(modelSubtypeOptions('house'),['house','townhouse','beach_house','villa']);
 for(const parent of ['apartment','condominium'])assert.deepEqual(modelSubtypeOptions(parent),['apartment','room','condominium','studio','loft','penthouse','condotel']);
 for(const parent of ['room','studio','boarding_house','bedspace','dormitory','other']){assert.deepEqual(modelSubtypeOptions(parent),[]);assert.throws(()=>propertyModelAttributes(parent,{propertySubtype:'room'}));}
 assert.throws(()=>propertyModelAttributes('house',{propertySubtype:'studio'}));
});
test('blank optional fields remain null, confirmed zero survives, and invalid numeric input is rejected',()=>{
 assert.deepEqual(propertyModelAttributes('house',{}),{p_property_subtype:null,p_lot_area_sqm:null,p_parking_spaces:null});
 assert.deepEqual(propertyModelAttributes('house',{lotAreaSqm:'0',parkingSpaces:'0'}),{p_property_subtype:null,p_lot_area_sqm:0,p_parking_spaces:0});
 for(const v of ['-1','NaN','Infinity','no'])assert.throws(()=>propertyModelAttributes('house',{lotAreaSqm:v}));
 for(const v of ['-1','1.5','2147483648'])assert.throws(()=>propertyModelAttributes('house',{parkingSpaces:v}));
 assert.equal(propertyModelAttributes('house',{lotAreaSqm:'24.125'}).p_lot_area_sqm,24.13);
 assert.equal(propertyValidationIssues({...draft(),parkingSpaces:'1.5'}).find(i=>i.field==='parkingSpaces')?.kind,'invalid');
});
test('old edit contexts hydrate unknowns and new optional fields participate in normalized dirty detection',()=>{
 const old:any=context();delete old.property_subtype;delete old.lot_area_sqm;delete old.parking_spaces;delete old.model_attributes_version;const d=routineDraft(old);
 assert.equal(d.propertySubtype,'');assert.equal(d.lotAreaSqm,'');assert.equal(d.parkingSpaces,'');
 const a=routineDraft(context());assert.equal(routineFieldsEqual(a,{...a,lotAreaSqm:'50.00',parkingSpaces:'01'}),true);assert.equal(routineFieldsEqual(a,{...a,parkingSpaces:''}),false);
 for(const field of ['propertySubtype','lotAreaSqm','parkingSpaces'] as const){const changed={...a,[field]:field==='propertySubtype'?'townhouse':'2'};assert.ok(routineIssues({...context(),open_tenancy:true},changed).some(i=>i.field===field));}
});
function transport(){let row:any=context(),readMissing=false,writeMissing=false,auth=owner;const calls:{name:string;args:any}[]=[],journal=new Map<string,string>();const client:any={auth:{getUser:async()=>({data:{user:{id:auth}},error:null})},from(table:string){const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='profiles'?{account_status:'active',tier1_verified_at:'set'}:{id,landlord_id:owner},error:null})};return q;},rpc:async(name:string,args:any)=>{calls.push({name,args});if(name==='get_owned_property_edit_context_v2')return{data:readMissing?null:row,error:readMissing?{code:'PGRST202'}:null};if(name==='get_owned_property_edit_context'){const {model_attributes_version,property_subtype,lot_area_sqm,parking_spaces,...old}=row;return{data:old,error:null};}if(name==='create_property_setup_v2'||name==='create_property_setup')return{data:writeMissing?null:{property_id:id,status:'created'},error:writeMissing?{code:'PGRST202'}:null};if(name==='update_property_details_v2'){row={...row,property_subtype:args.p_property_subtype,lot_area_sqm:args.p_lot_area_sqm,parking_spaces:args.p_parking_spaces,edit_version:next};return{data:{property_id:id,edit_version:next},error:null};}if(name==='get_property_details_operation')return{data:{property_id:id,edit_version:row.edit_version},error:null};throw Error('Unexpected RPC '+name);}};const storage={getItem:async(k:string)=>journal.get(k)??null,setItem:async(k:string,v:string)=>{journal.set(k,v);},removeItem:async(k:string)=>{journal.delete(k);}};return{calls,journal,client,storage,readMissing(){readMissing=true;},writeMissing(){writeMissing=true;},auth(v:string){auth=v;}};}
test('creation with new values uses atomic v2 and legacy blank creation retains v1',async()=>{
 for(const withAttributes of [false,true]){const h=transport(),service=createPropertyCreationService(()=>h.client,h.storage,()=>{});await service.create(owner,{...draft(),...(withAttributes?{propertySubtype:'villa',lotAreaSqm:'0',parkingSpaces:'0'}:{})});const rpc=h.calls[0]!;assert.equal(rpc.name,withAttributes?'create_property_setup_v2':'create_property_setup');if(withAttributes){assert.equal(rpc.args.p_lot_area_sqm,0);assert.equal(rpc.args.p_parking_spaces,0);}assert.equal(rpc.args.p_exact_lat,14.4);assert.equal(h.journal.size,1);}
});
test('missing create v2 never silently retries legacy or loses explicitly entered new data',async()=>{
 const h=transport();h.writeMissing();const service=createPropertyCreationService(()=>h.client,h.storage,()=>{});await assert.rejects(service.create(owner,{...draft(),parkingSpaces:'0'}),/Phase 2 backend rollout/);assert.deepEqual(h.calls.map(c=>c.name),['create_property_setup_v2']);assert.equal(h.journal.size,0);
});
test('v2 edit saves explicit new values, refreshes authoritative context and clears safe journal',async()=>{
 const h=transport(),service=createPropertyRoutineService(()=>h.client,h.storage,()=>version);const c=await service.load(id),d={...routineDraft(c),lotAreaSqm:'0',parkingSpaces:''};const saved=await service.save(c,d);assert.equal(saved.lot_area_sqm,0);assert.equal(saved.parking_spaces,null);assert.equal(saved.edit_version,next);assert.equal(h.journal.size,0);const write=h.calls.find(c=>c.name==='update_property_details_v2')!;assert.equal(write.args.p_property_subtype,'villa');assert.ok(!('p_property_type' in write.args));assert.ok(!('p_exact_lat' in write.args));
});
test('legacy context fallback does not allow optional values to disappear into old RPC',async()=>{
 const h=transport();h.readMissing();const service=createPropertyRoutineService(()=>h.client,h.storage,()=>version),c=await service.load(id);assert.equal(c.model_attributes_version,undefined);await assert.rejects(service.save(c,{...routineDraft(c),parkingSpaces:'0'}),/Phase 2 backend rollout/);assert.equal(h.journal.size,0);assert.ok(!h.calls.some(c=>c.name.startsWith('update_')));
});
test('malformed v2 numeric contexts are rejected rather than converted into saved values',()=>{
 assert.throws(()=>parsePropertyEditContext({...context(),parking_spaces:'2'},id,owner));assert.throws(()=>parsePropertyEditContext({...context(),property_subtype:'studio'},id,owner));assert.throws(()=>parsePropertyEditContext({...context(),lot_area_sqm:NaN},id,owner));
});
test('Phase 2A attributes remain excluded from inference until separate proxy rollout',()=>{
 const result=mapPredictionInput({...context(),property_subtype:'villa',lot_area_sqm:50,parking_spaces:1,latitude:14.4,longitude:120.9});assert.equal(result.property_subtype,'house');assert.equal(result.lot_area_sqm,null);assert.equal(result.parking_spaces,null);assert.equal(result.latitude,null);assert.equal(result.longitude,null);assert.ok(!('asking_rent_monthly' in result));
});

import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
test('optional form binds blank/zero distinctly, permits explicit clearing and emits only local field edits',()=>{
 const path=resolve('src/features/property-listing/components/PropertyModelAttributeFields.tsx'),actual=createRequire(path),mod={exports:{} as any};const jsx=(type:any,props:any)=>({type,props});const req=(key:string):any=>key==='react/jsx-runtime'?{jsx,jsxs:jsx}:key==='react-native'?{View:'View',Text:'Text'}:key.endsWith('/ListingControls')?{ChoiceChip:'Chip',ListingField:'Field'}:actual(key);new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);
 const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];const changes:any[]=[];
 const all=nodes(mod.exports.PropertyModelAttributeFields({type:'house',draft:{parkingSpaces:'0'},disabled:false,onChange:(...v:any[])=>changes.push(v)}));
 const fields=all.filter(n=>n.type==='Field');assert.equal(fields[0].props.value,'');assert.equal(fields[1].props.value,'0');fields[0].props.onChangeText('25');assert.deepEqual(changes,[['lotAreaSqm','25']]);
 const clear=all.find(n=>n.props?.label==='Not specified');assert.equal(clear.props.selected,true);clear.props.onPress();assert.deepEqual(changes.at(-1),['propertySubtype','']);
 const unknown=nodes(mod.exports.PropertyModelAttributeFields({type:'boarding_house',draft:{propertySubtype:'villa'},disabled:false,onChange:(...v:any[])=>changes.push(v)}));assert.ok(unknown.some(n=>n.props?.label==='Clear unavailable subtype'));
});
