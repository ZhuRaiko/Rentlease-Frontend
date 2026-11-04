/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {createMessagingService,parseConversation} from '../src/features/messaging-viewing/services/messagingService';
import {inquiryDiagnostic,type InquiryDiagnostic} from '../src/shared/services/supabase/inquiryDiagnostics';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../src/shared/services/supabase/database.types';
import {MessagingError} from '../src/features/messaging-viewing/models/PersistentMessaging';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function loadDetail(){
 const file=resolve('src/features/search-discovery/views/LiveSearchViews.tsx'),actual=createRequire(file),mod={exports:{} as any};
 const jsx=(type:any,props:any)=>typeof type==='function'?type(props):({type,props});
 const req=(key:string):any=>{
  if(key==='react')return{useState:()=>[null,()=>{}]};
  if(key==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'Fragment'};
  if(key==='react-native')return new Proxy({StyleSheet:{create:(s:any)=>s},useWindowDimensions:()=>({width:411})},{get:(o:any,k:string)=>o[k]??k});
  if(key.endsWith('/DiscoveryControls'))return{DiscoveryHeader:'Header',DiscoveryButton:'Button'};
  if(key.endsWith('/SearchListingCard'))return{SearchListingCard:'Card'};
  if(key.endsWith('/FullscreenDocumentImage'))return{FullscreenDocumentImage:'Gallery'};
  if(key.endsWith('/InterfaceIcon'))return{InterfaceIcon:'Icon'};
  return actual(key);
 };
 new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);
 return mod.exports.LivePropertyDetailView;
}
function visit(tree:any,fn:(node:any,parent:string)=>void,parent=''){
 if(tree===null||tree===undefined||typeof tree==='boolean')return;
 if(Array.isArray(tree)){tree.forEach(n=>visit(n,fn,parent));return;}
 fn(tree,parent);if(typeof tree==='object')visit(tree.props?.children,fn,tree.type==='Fragment'?parent:tree.type);
}
test('shared listing details render only Text children for Contact Owner, self, and inquiry errors',()=>{
 const render=loadDetail();
 for(const own of [false,true])for(const error of [null,'Please retry']){
  const detail={photos:[],rent:5000,title:'Rental',barangay:'Public area',city:'imus',bedrooms:1,bathrooms:1,floorArea:null,propertyType:'room',furnishing:'unfurnished',description:'Description',amenities:[],rentalTerm:'monthly',depositMonths:1,advanceMonths:1,minimumStay:null};
  const tree=render({viewModel:{manualState:{detail,detailBusy:false,inquiryError:error,placesPhase:'error',placesError:'Unavailable',placesRows:[]},isOwnListing:own,listingOwnerLabel:'Property Owner',manual:{}}});
  const text:string[]=[];visit(tree,(node,parent)=>{if(typeof node==='string'||typeof node==='number'){assert.equal(parent,'Text',`Invalid native text child ${JSON.stringify(node)} under ${parent}`);text.push(String(node));}});
  assert.ok(text.includes('Property Owner'));assert.ok(text.includes('Listed by'));
 }
});
test('inbox ignores unconsented profile names for both participants',()=>{
 const raw={id:id(10),listing_id:id(20),tenant_id:id(1),landlord_id:id(2),listing_title:'Rental',participant_name:'Private legal name',status:'open',activity_at:'2026-11-04T01:00:00Z',latest_body:null,latest_type:null};
 assert.equal(parseConversation(raw,id(1)).participantName,'Property Owner');
 assert.equal(parseConversation(raw,id(2)).participantName,'Renter');
});
test('send failures record only operation, safe code and HTTP status',async()=>{
 const events:InquiryDiagnostic[]=[];
 const client={auth:{getUser:async()=>({data:{user:{id:id(1)}},error:null})},rpc:()=>({abortSignal:async()=>({data:null,status:503,error:{code:'PGRST000',message:'private content',details:'private details',token:'secret'}})})} as unknown as SupabaseClient<Database>;
 const service=createMessagingService(()=>client,event=>events.push(event));
 await assert.rejects(service.send(id(1),id(10),id(30),'Private test text'),e=>e instanceof MessagingError&&e.uncertain);
 assert.deepEqual(events,[{operation:'send_property_message',code:'PGRST000',status:503}]);
 assert.deepEqual(inquiryDiagnostic('start_property_inquiry',{code:'private text',message:'sensitive'},0),{operation:'start_property_inquiry',code:'unknown',status:null});
});
test('a rejected transport leaves delivery uncertain with no raw exception exposure',async()=>{
 const events:InquiryDiagnostic[]=[];
 const client={auth:{getUser:async()=>({data:{user:{id:id(1)}},error:null})},rpc:()=>({abortSignal:async()=>{throw new Error('private transport details');}})} as unknown as SupabaseClient<Database>;
 await assert.rejects(createMessagingService(()=>client,e=>events.push(e)).send(id(1),id(10),id(30),'Question'),e=>e instanceof MessagingError&&e.uncertain&&!e.message.includes('private'));
 assert.deepEqual(events,[{operation:'send_property_message',code:'unknown',status:null}]);
});
test('account change during a confirmed send never returns the previous account receipt',async()=>{
 let reads=0;
 const client={auth:{getUser:async()=>({data:{user:{id:++reads===1?id(1):id(2)}},error:null})},rpc:()=>({abortSignal:async()=>({data:{},error:null,status:200})})} as unknown as SupabaseClient<Database>;
 await assert.rejects(createMessagingService(()=>client).send(id(1),id(10),id(30),'Question'),e=>e instanceof MessagingError&&e.identity);
});
