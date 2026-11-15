/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { createGpsProximityService } from '../src/features/search-discovery/services/gpsProximityService';
import { createGpsProximityWorkflow } from '../src/features/search-discovery/viewModels/gpsProximityWorkflow';
import { createManualSearchWorkflow } from '../src/features/search-discovery/viewModels/manualSearchWorkflow';
import { ManualSearchError } from '../src/features/search-discovery/models/ManualSearch';
import { GpsError } from '../src/features/search-discovery/models/GpsProximity';
import { searchDiagnostic, traceSearchDiagnostic } from '../src/features/search-discovery/services/searchDiagnostics';
import { createManualSearchService } from '../src/features/search-discovery/services/manualSearchService';
const point = { latitude:14.4,longitude:120.9 };
function gps(error: { code:string; message:string } | null) {
  const calls: string[]=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'tenant'}},error:null})},rpc:()=>({abortSignal:async()=>{calls.push('rpc');return{data:[],error};}})} as unknown as SupabaseClient<Database>;
  return {service:createGpsProximityService(()=>client),calls};
}
test('only 42501 with the intentional RPC message means eligibility',async()=>{
  const h=gps({code:'42501',message:'Tenant verification required'});await assert.rejects(()=>h.service.search('tenant',point),(e:unknown)=>e instanceof GpsError&&e.kind==='eligibility');
});
for(const message of ['permission denied for table tenancies','permission denied for schema extensions','permission denied for function st_dwithin','', 'permission denied: Tenant verification required'])test(`unrelated 42501 is a safe access failure (${message||'missing message'})`,async()=>{
  const h=gps({code:'42501',message});await assert.rejects(()=>h.service.search('tenant',point),(e:unknown)=>{assert.ok(e instanceof GpsError);assert.equal(e.kind,'backend_permission');assert.doesNotMatch(e.message,/Tenant|Tier 1|tenancies|extensions|st_dwithin/);return true;});
});
test('28000 remains session error and successful [] remains a successful GPS page',async()=>{
  await assert.rejects(()=>gps({code:'28000',message:'Authentication required'}).service.search('tenant',point),(e:unknown)=>e instanceof GpsError&&e.kind==='identity');assert.deepEqual(await gps(null).service.search('tenant',point),[]);
});
test('GPS retry reuses acquired coordinates and cannot duplicate in-flight requests',async()=>{
  let positions=0,requests=0,release!:()=>void;
  const f=createGpsProximityWorkflow({user:async()=>'tenant',locate:async()=>{positions++;return{kind:'granted',coordinates:point};},search:async()=>{requests++;if(requests===1)throw Error('network failure');await new Promise<void>(r=>{release=r;});return[];},settings:async()=>{}});
  await f.start();assert.equal(f.getSnapshot().phase,'error');const retry=f.retry();await new Promise(r=>setImmediate(r));assert.equal(f.getSnapshot().phase,'searching');await f.retry();assert.equal(requests,2);assert.equal(positions,1);release();await retry;assert.equal(f.getSnapshot().phase,'success');assert.deepEqual(f.getSnapshot().rows,[]);
});
test('GPS retry without a position reacquires one rather than silently doing nothing',async()=>{
  let positions=0,requests=0;const f=createGpsProximityWorkflow({user:async()=>'tenant',locate:async()=>++positions===1?{kind:'denied'}:{kind:'granted',coordinates:point},search:async()=>{requests++;return[];},settings:async()=>{}});await f.start();assert.equal(requests,0);await f.retry();assert.equal(positions,2);assert.equal(requests,1);assert.equal(f.getSnapshot().phase,'success');
});
function locations(read:()=>Promise<{locations:any[];received:number}>) {
  return createManualSearchWorkflow({user:async()=>'tenant',locations:read,search:async()=>[],detail:async()=>{throw Error('not requested');},catalogue:async()=>[]});
}
test('Available Locations distinguishes not requested, loading and successful empty result',async()=>{
  let release!:(v:{locations:[];received:number})=>void;const f=locations(async()=>new Promise(r=>{release=r;}));assert.equal(f.getSnapshot().locationsStatus,'idle');const pending=f.locations();await new Promise(r=>setImmediate(r));assert.equal(f.getSnapshot().locationsStatus,'loading');release({locations:[],received:0});await pending;assert.equal(f.getSnapshot().locationsStatus,'success');assert.equal(f.getSnapshot().locationsError,null);assert.deepEqual(f.getSnapshot().locations,[]);
});
test('Available Locations failure retries with a new request and suppresses rapid duplicate attempts',async()=>{
  let calls=0,release!:(v:{locations:[];received:number})=>void;const f=locations(async()=>{calls++;if(calls===1)throw new ManualSearchError('Could not load available locations. Please retry.');return new Promise(r=>{release=r;});});await f.locations();assert.equal(f.getSnapshot().locationsStatus,'error');assert.ok(f.getSnapshot().locationsError);const retry=f.locations();await new Promise(r=>setImmediate(r));await f.locations();assert.equal(calls,2);assert.equal(f.getSnapshot().locationsStatus,'loading');release({locations:[],received:0});await retry;assert.equal(f.getSnapshot().locationsStatus,'success');assert.equal(f.getSnapshot().locationsError,null);
});
test('nonempty Available Locations remain backend-derived',async()=>{const location={key:'real',city:'imus',barangay:'Actual area',label:'Actual area, Imus',query:'Actual area'};const f=locations(async()=>({locations:[location],received:1}));await f.locations();assert.equal(f.getSnapshot().locationsStatus,'success');assert.deepEqual(f.getSnapshot().locations,[location]);});
function presentation(path:string,name:string){const full=resolve(path),actual=createRequire(full),mod={exports:{}as any};const req=(key:string):any=>{
 if(key==='react')return {useState:(v:any)=>[v,()=>{}]};
  if(key==='react/jsx-runtime')return{jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};
  if(key.endsWith('/KeyboardAwareScrollView'))return{KeyboardAwareScrollView:'ScrollView'};
  if(key==='react-native')return{View:'View',Text:'Text',Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:(v:any)=>v},FlatList:'FlatList',ActivityIndicator:'ActivityIndicator'};
  if(/\.png$/.test(key))return 1;
  if(key.endsWith('/DiscoveryControls'))return{DiscoveryButton:'DiscoveryButton',DiscoveryHeader:'DiscoveryHeader',DiscoverySearchBar:'DiscoverySearchBar'};
  if(key.endsWith('/SearchListingCard'))return{SearchListingCard:'SearchListingCard'};
  if(key.endsWith('/InterfaceIcon'))return{InterfaceIcon:'InterfaceIcon'};
  if(key.endsWith('/DiscoveryIcon'))return{DiscoveryIcon:'DiscoveryIcon'};
  if(key.endsWith('/HeartIcon'))return{HeartIcon:'HeartIcon'};
  if(key.endsWith('/SaveListingButton'))return{SaveListingButton:'SaveListingButton',SavedListingsFeedback:'SavedListingsFeedback'};
  if(key.endsWith('/PublicIdentityBadge'))return{PublicAvatar:'PublicAvatar',PublicIdentityBadge:'PublicIdentityBadge'};
  return actual(key);
};const code=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(req,mod,mod.exports);return mod.exports[name];}
function nodes(tree:any):any[]{if(!tree||typeof tree!=='object')return[];return[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
test('successful empty Available Locations has explanatory copy, no retry or fixtures',()=>{
  const render=presentation('src/features/search-discovery/views/SearchLocationView.tsx','SearchLocationView');const tree=render({viewModel:{screen:'searchLocation',query:'',suggestions:[],manualState:{locationsStatus:'success',locationsBusy:false,locationsError:null},manual:{}}});const text=JSON.stringify(tree);assert.match(text,/No available rental locations yet/);assert.match(text,/active rentals are available now/);assert.doesNotMatch(text,/Retry locations|Imus|Tagaytay|Alapan|POPULAR LOCATIONS/);
});
test('Available Locations retry binds a real request and is disabled while loading',()=>{
  const render=presentation('src/features/search-discovery/views/SearchLocationView.tsx','SearchLocationView');let requests=0;const tree=render({viewModel:{screen:'searchLocation',query:'area',suggestions:[],manualState:{locationsStatus:'error',locationsBusy:false,locationsError:'Please retry'},manual:{locations:()=>{requests++;}}}});nodes(tree).find(n=>n.props?.label==='Retry locations').props.onPress();assert.equal(requests,1);
});
// For You renders the ranked recommendations (recommendationState.recommended) in a FlatList. These helpers read the list the view builds.
const rankedRow=(id:string,reasons:string[])=>({candidate:{listing:{listingId:id}},reasons});
const idleState={phase:'idle',recommended:[],scanned:0,limited:false,error:null};
function forYou(overrides:Record<string,unknown>,calls:string[]=[]){
  const render=presentation('src/features/search-discovery/views/TenantDiscoveryView.tsx','TenantDiscoveryView');
  const spy=(name:string)=>()=>{calls.push(name);};
  const viewModel={screen:'home',homeTab:'forYou',discoverState:{phase:'success',rows:[]},hasRecommendationPreferences:true,
    navigate:(screen:string)=>calls.push('navigate:'+screen),openHome:spy('openHome'),openForYou:spy('openForYou'),openProperty:(id:string)=>calls.push('openProperty:'+id),
    openMatchingPreferences:spy('openMatchingPreferences'),openRecommendedResults:spy('openRecommendedResults'),requestCurrentLocation:spy('requestCurrentLocation'),openSavedListings:spy('openSavedListings'),
    recommendations:{load:spy('recommendations.load')},...overrides};
  const tree=render({viewModel,onClose(){},onOpenNotifications(){}});
  const list=nodes(tree).find(n=>n.type==='FlatList');
  return {tree,list,header:nodes(list.props.ListHeaderComponent),empty:list.props.ListEmptyComponent?nodes(list.props.ListEmptyComponent):[],textOf:(parts:any[])=>JSON.stringify(parts)};
}
test('For You lists ranked recommendations in order with their reasons, and has no GPS or fabricated content',()=>{
  const calls:string[]=[];
  const recommended=[rankedRow('listing-b',['Within budget','Pet friendly']),rankedRow('listing-a',[])];
  const {tree,list,header,textOf}=forYou({recommendationState:{phase:'success',recommended,scanned:2,limited:false,error:null}},calls);
  // Ranked results: the list data is the ranking order, unchanged (the view does not re-sort or filter it).
  assert.deepEqual(list.props.data.map((row:any)=>row.listingId),['listing-b','listing-a']);
  assert.equal(list.props.keyExtractor(list.props.data[0]),'listing-b');
  // Each row renders a listing card plus the reasons the ranking gave, or the fallback line when it gave none.
  const first=nodes(list.props.renderItem({item:list.props.data[0]}));const second=nodes(list.props.renderItem({item:list.props.data[1]}));
  assert.ok(first.some(n=>n.type==='SearchListingCard'&&n.props.listing.listingId==='listing-b'));
  assert.ok(first.some(n=>n.props?.children==='Within budget | Pet friendly'));
  assert.ok(second.some(n=>n.props?.children==='Selected property preferences'));
  first.find(n=>n.type==='SearchListingCard').props.onPress();assert.deepEqual(calls,['openProperty:listing-b']);
  // The For You header: personalized title, section title, edit-preferences action, ranked-results action and the coverage line.
  const text=textOf(header);assert.match(text,/Rentals for you\./);assert.match(text,/Recommended rentals/);assert.match(text,/Ranking covers 2 loaded listings\./);assert.match(text,/Edit preferences/);
  calls.length=0;header.find(n=>n.props?.label==='View ranked rentals').props.onPress();header.find(n=>n.props?.children==='Edit preferences'&&n.type==='Text');assert.deepEqual(calls,['openRecommendedResults']);
  calls.length=0;header.find(n=>n.props?.accessibilityRole==='button'&&nodes(n).some(c=>c.props?.children==='Edit preferences')).props.onPress();assert.deepEqual(calls,['openMatchingPreferences']);
  // No community placeholder, no fabricated scores or reviews, and nothing read from or sent to GPS.
  assert.doesNotMatch(JSON.stringify(tree)+text,/No community posts yet|RentLease community|Recommendations are not available yet|matchScore|reviewCount|previewDiscovery|gpsState|latitude|longitude/);
  assert.ok(!header.some(n=>n.props?.accessibilityLabel==='Nearby rentals'),'For You must not offer the GPS action');
});
test('For You uses GPS only on the Discover tab and only when the user taps Explore nearby rentals',()=>{
  const calls:string[]=[];
  const forYouView=forYou({recommendationState:idleState},calls);
  assert.deepEqual(calls,[],'rendering For You must not use location');
  const tabs=nodes(forYouView.tree).filter(n=>n.props?.accessibilityRole==='tab');
  assert.deepEqual(tabs.map(n=>n.props.accessibilityState.selected),[false,true]);
  // Search CTA: from For You the Discover tab is the way back to search.
  tabs[0].props.onPress();assert.deepEqual(calls,['openHome']);
  // On Discover the search bar opens the location search, and GPS runs only after the explicit nearby action.
  calls.length=0;
  const discover=forYou({homeTab:'discover',discoverState:{phase:'success',rows:[],hasMore:false}},calls);
  assert.deepEqual(calls,[],'rendering Discover must not use location');
  discover.header.find(n=>n.type==='DiscoverySearchBar').props.onFocus();assert.deepEqual(calls,['navigate:searchLocation']);
  calls.length=0;discover.header.find(n=>n.props?.accessibilityLabel==='Nearby rentals').props.onPress();assert.deepEqual(calls,['requestCurrentLocation']);
});
test('diagnostics retain only code-owned stage, safe code and classification',()=>{
  const event=searchDiagnostic('gps_rpc',{code:'42501',message:'permission denied email secret@example.test latitude 14.4 token PRIVATE',details:'PRIVATE',hint:'PRIVATE'});
  assert.deepEqual(event,{stage:'gps_rpc',code:'42501',classification:'backend_permission'});
  assert.deepEqual(searchDiagnostic('available_locations',{code:'secret@example.test',message:'PRIVATE'}),{stage:'available_locations',code:'unknown',classification:'unknown'});
});
test('diagnostics are silent in production and contain no raw error in development',()=>{
  const before=Object.getOwnPropertyDescriptor(globalThis,'__DEV__'),original=console.info,events:unknown[][]=[];console.info=(...args:unknown[])=>{events.push(args);};
  try {Object.defineProperty(globalThis,'__DEV__',{value:false,configurable:true});traceSearchDiagnostic(searchDiagnostic('gps_rpc',{code:'42501',message:'PRIVATE'}));assert.deepEqual(events,[]);Object.defineProperty(globalThis,'__DEV__',{value:true,configurable:true});traceSearchDiagnostic(searchDiagnostic('gps_rpc',{code:'42501',message:'PRIVATE'}));assert.equal(events.length,1);assert.doesNotMatch(JSON.stringify(events),/PRIVATE|latitude|longitude|token|email/);}finally{console.info=original;if(before)Object.defineProperty(globalThis,'__DEV__',before);else Reflect.deleteProperty(globalThis,'__DEV__');}
});
test('a real query permission error must not be disguised as empty locations',async()=>{
  const query:any=new Proxy({}, {get(_t,key){if(key==='then')return(resolve:any)=>resolve({data:[],error:{code:'42501',message:'permission denied for table tenancies'}});return()=>query;}});
  const client={auth:{getUser:async()=>({data:{user:{id:'tenant'}},error:null})},from:()=>query}as unknown as SupabaseClient<Database>;
  await assert.rejects(()=>createManualSearchService(()=>client).locations('tenant','',0),/Could not load available locations/);
});
test('location retry control exposes disabled loading state',()=>{
  const render=presentation('src/features/search-discovery/views/SearchLocationView.tsx','SearchLocationView');const tree=render({viewModel:{screen:'searchLocation',query:'area',suggestions:[],manualState:{locationsStatus:'error',locationsBusy:true,locationsError:'Please retry'},manual:{}}});const button=nodes(tree).find(n=>n.props?.label==='Loading…');assert.equal(button.props.disabled,true);
});

test('For You empty states fill the screen as a scrollable list and tell the user what to do next',()=>{
  // Layout: one FlatList that takes the remaining height (flex 1) and scrolls its own content; the content is a padded,
  // width-capped column. It is not height-pinned or absolutely positioned, so long content scrolls instead of clipping.
  const noPreferences=forYou({hasRecommendationPreferences:false,recommendationState:idleState});
  assert.equal(noPreferences.list.props.style.flex,1);
  const content=noPreferences.list.props.contentContainerStyle;assert.equal(content.maxWidth,600);assert.equal(content.width,'100%');assert.ok(content.padding>0);assert.equal(content.height,undefined);assert.equal(content.position,undefined);
  assert.equal(nodes(noPreferences.tree).some(n=>n.type==='ScrollView'),false);
  // Pull to refresh reloads the recommendations (not Discover) while For You is open.
  const calls:string[]=[];forYou({recommendationState:idleState},calls).list.props.onRefresh();assert.deepEqual(calls,['recommendations.load']);
  // No saved preferences: the header invites setting them and the list body is empty, with no "no matches" claim.
  const prefsText=noPreferences.textOf(noPreferences.header);assert.match(prefsText,/Set matching preferences/);assert.match(prefsText,/Save matching preferences to find rentals based on what matters to you\./);
  assert.equal(noPreferences.list.props.ListEmptyComponent,null);assert.doesNotMatch(prefsText,/No matching rentals yet|View ranked rentals/);
  const setCalls:string[]=[];const setter=forYou({hasRecommendationPreferences:false,recommendationState:idleState},setCalls);
  setter.header.find(n=>n.props?.accessibilityRole==='button'&&nodes(n).some(c=>c.props?.children==='Set matching preferences')).props.onPress();assert.deepEqual(setCalls,['openMatchingPreferences']);
  // Preferences saved and a finished search with no results: the empty component explains and says how to change it.
  const empty=forYou({recommendationState:{...idleState,phase:'success'}});
  const emptyText=empty.textOf(empty.empty);assert.match(emptyText,/No matching rentals yet/);assert.match(emptyText,/Try changing your preferences or filters\./);
  // While the ranking loads it says so and does not claim an empty result.
  const loading=forYou({recommendationState:{...idleState,phase:'loading'}});
  assert.match(loading.textOf(loading.header),/Finding matching rentals\.\.\./);assert.equal(loading.list.props.ListEmptyComponent,null);
  // The screen keeps the For You title and tab.
  assert.ok(nodes(empty.tree).some(n=>n.props?.children==='For You'));
});

test('Available Locations does not call an unknown error a verified network failure',()=>{
 assert.equal(searchDiagnostic('available_locations',{code:'',message:'unspecified'}).classification,'unknown');assert.equal(searchDiagnostic('available_locations',{code:'42703',message:'private SQL'}).classification,'query');assert.equal(searchDiagnostic('available_locations',{message:'TypeError: Network request failed'}).classification,'network');assert.equal(searchDiagnostic('available_locations',{message:'TypeError: Failed to fetch'}).classification,'network');
});
test('intentional Available Locations cancellation is silent, not a network diagnostic',async()=>{
 const controller=new AbortController(),events:unknown[]=[];const query:any=new Proxy({}, {get(_t,key){if(key==='then')return(resolve:any)=>{controller.abort();resolve({data:null,error:{code:'',message:'AbortError: private'}});};return()=>query;}});const client={auth:{getUser:async()=>({data:{user:{id:'tenant'}},error:null})},from:()=>query}as unknown as SupabaseClient<Database>;
 await assert.rejects(()=>createManualSearchService(()=>client,e=>events.push(e)).locations('tenant','',0,controller.signal),(e:any)=>e.name==='AbortError');assert.deepEqual(events,[]);
});
test('Available Locations reports a non-canceled thrown fetch failure safely',async()=>{
 const events:any[]=[];const query:any=new Proxy({}, {get(_t,key){if(key==='then')return(_resolve:any,reject:any)=>reject(new TypeError('Network request failed private'));return()=>query;}});const client={auth:{getUser:async()=>({data:{user:{id:'tenant'}},error:null})},from:()=>query}as unknown as SupabaseClient<Database>;
 await assert.rejects(()=>createManualSearchService(()=>client,e=>events.push(e)).locations('tenant','',0),/Could not load available locations/);assert.equal(events.length,1);assert.equal(events[0].classification,'network');assert.doesNotMatch(JSON.stringify(events),/private/);
});

test('Available Locations failure does not prevent independent manual listing search',async()=>{
 let searches=0;const flow=createManualSearchWorkflow({user:async()=>'tenant',locations:async()=>{throw Error('failed');},search:async()=>{searches++;return[];},detail:async()=>{throw Error('not requested');},catalogue:async()=>[]});await flow.locations();assert.equal(flow.getSnapshot().locationsStatus,'error');await flow.search('');assert.equal(searches,1);assert.equal(flow.getSnapshot().phase,'success');assert.equal(flow.getSnapshot().error,null);assert.equal(flow.getSnapshot().locationsStatus,'error');
});
