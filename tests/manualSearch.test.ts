/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createManualSearchService, searchAvailabilityDate } from '../src/features/search-discovery/services/manualSearchService';
import { createManualSearchWorkflow } from '../src/features/search-discovery/viewModels/manualSearchWorkflow';
import { defaultSearchFilters, parseSearchListing, locationQuery, ManualSearchError } from '../src/features/search-discovery/models/ManualSearch';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
const propertyId = '00000000-0000-0000-0000-000000000100';
const raw = (id = 1) => ({ id: `00000000-0000-0000-0000-${String(id).padStart(12,'0')}`, property_id: propertyId, title: 'Actual rental', description: 'Actual description', asking_rent_monthly: 18500, available_from: null, published_at: '2026-10-01T00:00:00Z', house_rules: null, rental_term: 'long_term', minimum_stay_months: null, security_deposit_months: 1, advance_rent_months: 1, status: 'active', properties: { id: propertyId, landlord_id: '00000000-0000-0000-0000-000000000200', city: 'imus', barangay: 'Alapan', property_type: 'apartment', bedrooms: 1, bathrooms: 1, floor_area_sqm: 42, furnishing_status: 'furnished', is_active: true } });
function backend() {
  const calls: { table: string; method: string; args: unknown[] }[] = []; let owner = 'tenant', error: unknown = null;
  const data: Record<string,unknown[]> = {listings:[raw()]};
  const client = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) }, from(table: string) {
    const b: any = new Proxy({}, { get(_t, key) { if (key === 'then') return (resolve: any) => resolve({ data: data[table]??[], error }); return (...args: unknown[]) => { calls.push({ table, method: String(key), args }); return b; }; } }); return b;
  }, storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } }) }) } } as unknown as SupabaseClient<Database>;
  return { service: createManualSearchService(() => client), calls, data, error: (v: unknown) => { error = v; }, user: (v: string) => { owner = v; } };
}
test('real search applies active availability, price, physical filters, deterministic sort and backend range', async () => {
  const b = backend(); const result = await b.service.search('tenant', { query: 'IMUS', filters: { ...defaultSearchFilters(), minRent: 10000, maxRent: 20000, types: ['apartment'], minBeds: 1, minBaths: 1, minFloorArea: 30, furnishing: 'furnished', amenityIds: [7] }, sort: 'Price: Low to High', offset: 20 });
  assert.equal(result[0]?.listingId, raw().id); const methods = (name: string) => b.calls.filter(c => c.method === name).map(c => c.args);
  assert.ok(methods('eq').some(a => a[0] === 'status' && a[1] === 'active')); assert.ok(methods('eq').some(a => a[0] === 'properties.is_active' && a[1] === true)); assert.ok(methods('or').some(a => String(a[0]).includes('available_from.is.null'))); assert.deepEqual(methods('range')[0], [20, 39]); assert.ok(methods('gte').some(a => a[0] === 'asking_rent_monthly')); assert.ok(methods('order').some(a => a[0] === 'asking_rent_monthly')); assert.ok(methods('in').some(a => a[0] === 'properties.property_amenities.amenity_id'));
});
for (const sort of ['Price: Low to High', 'Price: High to Low', 'Recently Listed'] as const) test(`backend supports ${sort} without recommendation ordering`, async () => { const b = backend(); await b.service.search('tenant', { query: '', filters: defaultSearchFilters(), sort, offset: 0 }); const order = b.calls.find(c => c.method === 'order'); assert.equal(order?.args[0], sort === 'Recently Listed' ? 'published_at' : 'asking_rent_monthly'); });
test('city labels normalize; barangay input remains safe case-insensitive filter text', () => {
  assert.equal(locationQuery('DAS MARIÑAS').city, undefined); assert.equal(locationQuery('Dasmariñas, Cavite').city, 'dasmarinas'); assert.equal(locationQuery('IMUS').city, 'imus'); assert.match(locationQuery('Alapan').pattern, /Alapan/i); assert.doesNotMatch(locationQuery('x),status.eq.draft,%_').pattern, /[(),%_]/);
});
test('response model rejects inactive/mismatched records and never supplies fake metrics', () => {
  const r = parseSearchListing(raw()); assert.equal(r.floorArea, 42); assert.equal(r.thumbnailUrl, null); assert.ok(!('rating' in r)); assert.ok(!('matchScore' in r)); assert.throws(() => parseSearchListing({ ...raw(), status: 'draft' })); assert.throws(() => parseSearchListing({ ...raw(), properties: { ...raw().properties, id: 'wrong' } }));
});
test('search failures expose safe errors; changed identity never queries', async () => { const b = backend(); b.error({ message: 'sensitive raw sql' }); await assert.rejects(() => b.service.search('tenant', { query: '', filters: defaultSearchFilters(), sort: 'Recently Listed', offset: 0 }), /Could not/); b.user('other'); b.calls.length = 0; await assert.rejects(() => b.service.search('tenant', { query: '', filters: defaultSearchFilters(), sort: 'Recently Listed', offset: 0 })); assert.equal(b.calls.length, 0); });
function workflow() {
  let search = async (_input: any) => [parseSearchListing(raw())]; const calls: any[] = [];
  const f = createManualSearchWorkflow({ user: async () => 'tenant', search: async (_owner: string, input: any) => { calls.push(input); return search(input); }, locations: async () => ({ locations: [], received: 0 }), detail: async (_owner: string, id: string) => ({ ...parseSearchListing(raw()), listingId: id, photos: [], amenities: [] }), catalogue: async () => [] });
  return { f, calls, search: (fn: typeof search) => { search = fn; } };
}
test('manual search is backend-only and supports empty database without fixtures', async () => { const h = workflow(); h.search(async () => []); await h.f.search('Alapan'); assert.deepEqual(h.f.getSnapshot().rows, []); assert.equal(h.f.getSnapshot().phase, 'success'); assert.equal(h.calls[0].query, 'Alapan'); });
test('query/filter/sort resets pages; load more deduplicates and preserves server order', async () => {
  const h = workflow(); h.search(async () => Array.from({ length: 20 }, (_, i) => parseSearchListing(raw(i+1)))); await h.f.search('Imus'); await h.f.loadMore(); assert.equal(h.calls.at(-1).offset, 20); assert.equal(h.f.getSnapshot().rows.length, 20); await h.f.search('Tagaytay'); assert.equal(h.calls.at(-1).offset, 0); await h.f.applyFilters({ ...defaultSearchFilters(), minBeds: 2 }); assert.equal(h.calls.at(-1).offset, 0); await h.f.sort('Price: High to Low'); assert.equal(h.calls.at(-1).offset, 0);
});
test('old query completion cannot overwrite a new search', async () => { const h = workflow(); let release!: (v: any) => void; h.search(async input => input.query === 'old' ? new Promise(r => { release = r; }) : [parseSearchListing(raw(2))]); const old = h.f.search('old'); await new Promise(r => setImmediate(r)); await h.f.search('new'); release([parseSearchListing(raw(1))]); await old; assert.equal(h.f.getSnapshot().rows[0]?.listingId, raw(2).id); });
for (const op of ['reset','dispose'] as const) test(`${op} invalidates pending results`, async () => { const h = workflow(); let release!: (v: any) => void; h.search(async () => new Promise(r => { release = r; })); const pending = h.f.search('old'); await new Promise(r => setImmediate(r)); h.f[op](); release([parseSearchListing(raw())]); await pending; assert.deepEqual(h.f.getSnapshot().rows, []); });
test('real detail identity is retained without fixture fallback', async () => { const h = workflow(); await h.f.openDetail(raw().id); assert.equal(h.f.getSnapshot().detail?.listingId, raw().id); assert.deepEqual(h.f.getSnapshot().detail?.amenities, []); });
test('production detail integration excludes private coordinates, GPS RPCs, ranking and writes', () => { const s = readFileSync('src/features/search-discovery/services/manualSearchService.ts','utf8'); assert.doesNotMatch(s, /property_private_locations|exact_lat|exact_lng|search_nearby_listings|\.insert\(|\.update\(|\.delete\(|matchScore|rating/); });
test('available locations come from eligible paged backend records and have no fabricated counts', async () => { const b=backend();const result=await b.service.locations('tenant','',0);assert.equal(result.received,1);assert.deepEqual(result.locations.map(l=>l.label),['Imus, Cavite','Alapan, Imus']);assert.ok(!('count' in result.locations[0]!));assert.ok(b.calls.some(c=>c.method==='range'&&c.args[1]===19)); });
test('zero available locations and listings stay empty', async () => { const b=backend();b.data.listings=[];assert.deepEqual((await b.service.locations('tenant','',0)).locations,[]);assert.deepEqual(await b.service.search('tenant',{query:'',filters:defaultSearchFilters(),sort:'Recently Listed',offset:0}),[]); });
test('case-insensitive barangay query uses escaped backend ilike and no manual GPS call', async () => { const b=backend();await b.service.search('tenant',{query:'aLaPaN',filters:defaultSearchFilters(),sort:'Recently Listed',offset:0});assert.ok(b.calls.some(c=>c.method==='ilike'&&c.args[0]==='properties.barangay'&&c.args[1]==='%aLaPaN%')); });
test('real namespaced property photo becomes thumbnail and detail photo; missing photos stay neutral', async () => {const b=backend();const photoId='00000000-0000-0000-0000-000000000300';b.data.property_photos=[{id:photoId,property_id:propertyId,storage_path:`${raw().properties.landlord_id}/${propertyId}/${photoId}.jpg`,alt_text:'Actual room',sort_order:0,is_cover:true,created_at:'2026-10-30'}];b.data.property_amenities=[{amenity:{name:'Wi-Fi'}}];const result=await b.service.search('tenant',{query:'',filters:defaultSearchFilters(),sort:'Recently Listed',offset:0});assert.match(result[0]?.thumbnailUrl??'',new RegExp(photoId));const detail=await b.service.detail('tenant',raw().id);assert.equal(detail.photos[0]?.alt,'Actual room');assert.deepEqual(detail.amenities,['Wi-Fi']);assert.equal(detail.description,'Actual description'); });
test('untrusted stored photo URL never becomes a thumbnail', async()=>{const b=backend();b.data.property_photos=[{id:'wrong',property_id:propertyId,storage_path:'https://untrusted.test/file.jpg',alt_text:null}];const rows=await b.service.search('tenant',{query:'',filters:defaultSearchFilters(),sort:'Recently Listed',offset:0});assert.equal(rows[0]?.thumbnailUrl,null);});

test('nearby thumbnails batch parents/photos, retain first cover and support missing-cover fallback',async()=>{
  const b=backend(),other='00000000-0000-0000-0000-000000000101',owner=raw().properties.landlord_id;
  b.data.properties=[{id:propertyId,landlord_id:owner},{id:other,landlord_id:owner}];
  b.data.property_photos=[propertyId,propertyId,other].map((p,i)=>{const id=`00000000-0000-0000-0000-00000000030${i}`;return {id,property_id:p,storage_path:`${owner}/${p}/${id}.jpg`,alt_text:null,is_cover:i===0,sort_order:i};});
  const result=await b.service.nearbyThumbnails('tenant',[{propertyId},{propertyId:other},{propertyId}]);
  assert.match(result[propertyId]??'',/300.jpg$/);assert.match(result[other]??'',/302.jpg$/);
  assert.equal(b.calls.filter(c=>c.table==='property_photos'&&c.method==='select').length,1);
  assert.deepEqual(b.calls.find(c=>c.table==='properties'&&c.method==='in')?.args,['id',[propertyId,other]]);
  b.user('changed');b.calls.length=0;await assert.rejects(()=>b.service.nearbyThumbnails('tenant',[{propertyId}]));assert.equal(b.calls.length,0);
});

test('malformed detail IDs are rejected before querying backend',async()=>{
  const b=backend();for(const id of ['', '../private','-'.repeat(36),'00000000-0000-0000-0000-00000000000z'])await assert.rejects(()=>b.service.detail('tenant',id));assert.equal(b.calls.length,0);
});
test('missing real detail is unavailable, not a fixture substitution',async()=>{const b=backend();b.data.listings=[];await assert.rejects(()=>b.service.detail('tenant',raw().id),/no longer available/);});
test('catalogue uses actual active controlled amenity IDs',async()=>{const b=backend();b.data.amenities=[{id:16,name:'Water supply'}];assert.deepEqual(await b.service.catalogue(),[{id:16,name:'Water supply'}]);assert.ok(b.calls.some(c=>c.table==='amenities'&&c.method==='eq'&&c.args[0]==='is_active'));});
test('Philippine availability day crosses UTC boundary correctly',()=>{assert.equal(searchAvailabilityDate(new Date('2026-10-29T16:01:00Z')),'2026-10-30');assert.equal(searchAvailabilityDate(new Date('2026-10-29T15:59:00Z')),'2026-10-29');});
test('invalid filter input is rejected before backend query',async()=>{const b=backend();await assert.rejects(()=>b.service.search('tenant',{query:'',filters:{...defaultSearchFilters(),minRent:20000,maxRent:1000},sort:'Recently Listed',offset:0}),/Minimum rent/);assert.equal(b.calls.length,0);});
test('page failures preserve earlier results and explicitly retry the failed offset',async()=>{const h=workflow();let fail=true;h.search(async input=>{if(!input.offset)return Array.from({length:20},(_,i)=>parseSearchListing(raw(i+1)));if(fail)throw Error('network');return [parseSearchListing(raw(21))];});await h.f.search('');await h.f.loadMore();assert.equal(h.f.getSnapshot().rows.length,20);assert.ok(h.f.getSnapshot().error);fail=false;await h.f.retry();assert.equal(h.calls.at(-1).offset,20);assert.equal(h.f.getSnapshot().rows.length,21);});
test('identity denial clears search, detail and suggestions instead of retaining another account data',async()=>{const h=workflow();await h.f.openDetail(raw().id);await h.f.search('');h.search(async()=>{throw new ManualSearchError('Account changed',true);});await h.f.search('other');assert.equal(h.f.getSnapshot().detail,null);assert.deepEqual(h.f.getSnapshot().rows,[]);assert.deepEqual(h.f.getSnapshot().locations,[]);});
test('live routing cannot choose prototype detail, fixture feed or recommendation sort',()=>{const flow=readFileSync('src/features/search-discovery/views/SearchDiscoveryFlowView.tsx','utf8');assert.doesNotMatch(flow,/PropertyDiscoveryDetailView|PropertySupplementaryView/);assert.match(flow,/LiveSearchResultsView/);assert.match(flow,/LivePropertyDetailView/);const vm=readFileSync('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts','utf8');assert.doesNotMatch(vm,/previewDiscoveryProperties|locationSuggestions|matchesFilters/);const live=readFileSync('src/features/search-discovery/views/LiveSearchViews.tsx','utf8');assert.doesNotMatch(live,/nearbyPlaces|matchScore|rating/);assert.match(live,/Recommended/);assert.match(live,/Best Match/);const home=readFileSync('src/features/search-discovery/views/TenantDiscoveryView.tsx','utf8');assert.doesNotMatch(home,/previewDiscoveryFeed|previewDiscoveryProperties|DiscoveryFeedPost/);});
test('punctuation-only location input does not silently search everywhere',()=>{assert.throws(()=>locationQuery('(),%_'),/city or barangay/);});
test('stale real-detail completion is discarded after cancellation',async()=>{let release!:(row:any)=>void;const f=createManualSearchWorkflow({user:async()=>'tenant',search:async()=>[],locations:async()=>({locations:[],received:0}),catalogue:async()=>[],detail:async()=>new Promise(r=>{release=r;})});const pending=f.openDetail(raw().id);await new Promise(r=>setImmediate(r));f.cancelDetail();release({...parseSearchListing(raw()),photos:[],amenities:[]});await pending;assert.equal(f.getSnapshot().detail,null);assert.equal(f.getSnapshot().selectedId,null);});
test('available-location pagination deduplicates names while raw offset advances',async()=>{const calls:number[]=[];const location={key:'imus',city:'imus',barangay:'',label:'Imus, Cavite',query:'Imus'};const f=createManualSearchWorkflow({user:async()=>'tenant',search:async()=>[],detail:async()=>{throw Error();},catalogue:async()=>[],locations:async(_owner,_text,offset)=>{calls.push(offset);return {locations:[location],received:offset?1:20};}});await f.locations('');await f.locations('',true);assert.deepEqual(calls,[0,20]);assert.equal(f.getSnapshot().locations.length,1);assert.equal(f.getSnapshot().locationsMore,false);});
test('location query races cannot repopulate an old set of suggestions',async()=>{let release!:(rows:any)=>void;const f=createManualSearchWorkflow({user:async()=>'tenant',search:async()=>[],detail:async()=>{throw Error();},catalogue:async()=>[],locations:async(_owner,text)=>text==='old'?new Promise(r=>{release=r;}):({locations:[],received:0})});const pending=f.locations('old');await new Promise(r=>setImmediate(r));await f.locations('new');release({locations:[{key:'old'}],received:1});await pending;assert.deepEqual(f.getSnapshot().locations,[]);});
function renderSource(path:string,name:string,state?:{value:any}) {
  const full=resolve(path),actual=createRequire(full),mod={exports:{} as any};
  const requireMock=(key:string):any=>{
    if(key.endsWith('/InlineRentalEstimate'))return {InlineRentalEstimate:'InlineRentalEstimate'};
    if(key==='react')return {useState:(v:any)=>[state?state.value:v,(next:any)=>{if(state)state.value=next;}],useEffect:()=>{}};
    if(key==='react/jsx-runtime')return {jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};
    if(key.endsWith('/KeyboardAwareScrollView'))return{KeyboardAwareScrollView:'ScrollView'};
  if(key==='react-native')return {useWindowDimensions:()=>({width:360,height:800}),View:'View',Text:'Text',Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',FlatList:'FlatList',StyleSheet:{create:(v:any)=>v}};
    if(key.endsWith('/FullscreenDocumentImage'))return {FullscreenDocumentImage:'FullscreenDocumentImage'};
    if(key.endsWith('/DiscoveryControls'))return {DiscoveryHeader:'DiscoveryHeader',DiscoveryButton:'DiscoveryButton',DiscoveryChip:'DiscoveryChip',DiscoverySearchBar:'DiscoverySearchBar'};
    if(key.endsWith('/SearchListingCard'))return {SearchListingCard:'SearchListingCard'};
    if(key.endsWith('/PublicIdentityBadge'))return{PublicAvatar:'Avatar',PublicIdentityBadge:'Identity'};if(key.endsWith('/usePublicIdentitiesViewModel'))return{usePublicIdentitiesViewModel:()=>({})};return actual(key);
  };
  const output=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',output)(requireMock,mod,mod.exports);return mod.exports[name];
}
test('real card renders backend image and fields without invented metrics; no-image state is neutral',()=>{const render=renderSource('src/features/search-discovery/components/SearchListingCard.tsx','SearchListingCard');const item=parseSearchListing(raw());const empty=JSON.stringify(render({listing:item,onPress(){}}));assert.match(empty,/No property photo/);assert.match(empty,/Actual rental/);assert.match(empty,/42 sqm/);assert.doesNotMatch(empty,/matchScore|reviewCount|rating|nearbyPlaces/);const actual=JSON.stringify(render({listing:{...item,thumbnailUrl:'https://example.test/actual.jpg'},onPress(){}}));assert.match(actual,/actual.jpg/);assert.doesNotMatch(actual,/No property photo/);});
test('real detail View renders loaded record, photos and property amenities without prototype sections',()=>{const render=renderSource('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView');const tree=JSON.stringify(render({viewModel:{manualState:{detail:{...parseSearchListing(raw()),photos:[{id:'photo',url:'https://example.test/room.jpg',alt:'Room'}],amenities:['Wi-Fi']}},manual:{},goBack(){}}}));assert.match(tree,/Actual description/);assert.match(tree,/room.jpg/);assert.match(tree,/Wi-Fi/);assert.doesNotMatch(tree,/matchScore|reviewCount|rating|DiscoveryPropertyImage|nearbyPlaces/);});

test('detail gallery opens real full-screen photo, advances and closes independently of tenancy',()=>{
  const state={value:null as number|null},render=renderSource('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView',state);
  const props={viewModel:{manualState:{detail:{...parseSearchListing(raw()),photos:[{id:'a',url:'https://example.test/a.jpg',alt:'Room'},{id:'b',url:'https://example.test/b.jpg',alt:'Kitchen'}],amenities:[]}},manual:{},goBack(){}}};
  const nodes=(tree:any):any[]=>tree&&typeof tree==='object'?[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]:[];
  const find=(type:string)=>nodes(render(props)).find(n=>n.type===type);
  nodes(render(props)).find(n=>n.props?.label==='View photo 1 of 2').props.onPress();assert.equal(find('FullscreenDocumentImage').props.uri,'https://example.test/a.jpg');
  find('FullscreenDocumentImage').props.onNext();assert.equal(find('FullscreenDocumentImage').props.uri,'https://example.test/b.jpg');
  find('FullscreenDocumentImage').props.onClose();assert.equal(find('FullscreenDocumentImage').props.visible,false);
});


test('detail safely projects only public point; ordinary search does not fetch locations or Overpass',async()=>{
 const b=backend();const r=raw();b.data.listings=[{...r,properties:{...r.properties,public_location:{type:'Point',coordinates:[120.94,14.43]}}}];
 const detail=await b.service.detail('tenant',r.id);assert.deepEqual(detail.publicLocation,{latitude:14.43,longitude:120.94});
 const select=b.calls.find(c=>c.table==='listings'&&c.method==='select');assert.match(String(select?.args[0]),/public_location/);assert.doesNotMatch(String(select?.args[0]),/private/);
 b.calls.length=0;await b.service.search('tenant',{query:'',filters:defaultSearchFilters(),sort:'Recently Listed',offset:0});assert.doesNotMatch(String(b.calls.find(c=>c.table==='listings'&&c.method==='select')?.args[0]),/public_location/);
});
test('automatic real detail presents separate named OSM categories and approximate straight-line distances',()=>{
 const render=renderSource('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView');
 const props={viewModel:{manualState:{detail:{...parseSearchListing(raw()),photos:[],amenities:['Wi-Fi'],publicLocation:{latitude:14.43,longitude:120.94}},placesPhase:'success',placesRows:[{osmType:'node',osmId:1,name:'Mapped school',category:'school',distanceMeters:150}]},manual:{},goBack(){}}};
 const tree=render(props),serialized=JSON.stringify(tree);assert.match(serialized,/Mapped school/);assert.match(serialized,/Approx\./);assert.match(serialized,/150 m/);assert.match(serialized,/straight-line/);assert.match(serialized,/No named places mapped/);assert.match(serialized,/OpenStreetMap contributors/);assert.match(serialized,/Wi-Fi/);
 const nodes=(t:any):any[]=>t&&typeof t==='object'?[t,...[t.props?.children].flat(Infinity).flatMap(nodes)]:[];assert.equal(nodes(tree).some(n=>n.props?.accessibilityState?.expanded!==undefined),false);
});

test('Discover projection excludes unpublished rows and orders published_at descending then id',async()=>{const b=backend();await b.service.search('tenant',{query:'',filters:defaultSearchFilters(),sort:'Recently Listed',offset:0,publishedOnly:true});assert.ok(b.calls.some(c=>c.method==='not'&&c.args[0]==='published_at'&&c.args[1]==='is'&&c.args[2]===null));const orders=b.calls.filter(c=>c.method==='order');assert.equal(orders[0]?.args[0],'published_at');assert.equal((orders[0]?.args[1] as any).ascending,false);assert.equal(orders[1]?.args[0],'id');assert.ok(b.calls.some(c=>c.method==='eq'&&c.args[0]==='status'&&c.args[1]==='active'));});

test('Contact Owner is server-confirmed, rejects self inquiries and suppresses stale completion',async()=>{
 let release!:(id:string)=>void,calls=0,owner='tenant';const detail={...parseSearchListing(raw()),photos:[],amenities:[]};const f=createManualSearchWorkflow({user:async()=>owner,search:async()=>[],locations:async()=>({locations:[],received:0}),catalogue:async()=>[],detail:async()=>detail,inquire:async()=>{calls++;return new Promise(r=>release=r);}});
 await f.openDetail(raw().id);const pending=f.startInquiry();await new Promise(r=>setImmediate(r));assert.equal(f.getSnapshot().inquiryBusy,true);assert.equal(await f.startInquiry(),null);assert.equal(calls,1);f.cancelDetail();release('00000000-0000-4000-8000-000000000001');assert.equal(await pending,null);
 owner=detail.ownerId;await f.openDetail(raw().id);assert.equal(await f.startInquiry(),null);assert.equal(calls,1);assert.match(f.getSnapshot().inquiryError??'',/your listing/);
});

test('real listing details bind inline estimator to listing and account without leaving details',()=>{const render=renderSource('src/features/search-discovery/views/LiveSearchViews.tsx','LivePropertyDetailView');const detail={...parseSearchListing(raw()),photos:[],amenities:[]};const props={accountId:'tenant',viewModel:{manualState:{detail},manual:{},goBack(){}}};const flatten=(n:any):any[]=>n&&typeof n==='object'?[n,...[n.props?.children].flat(Infinity).flatMap(flatten)]:[];const all=flatten(render(props));const inline=all.find(n=>n.type==='InlineRentalEstimate');assert.ok(inline);assert.deepEqual(inline.props.target,{listingId:detail.listingId});assert.equal(inline.props.accountId,'tenant');assert.equal(all.filter(n=>n.type==='FullscreenDocumentImage').length,1);assert.ok(!all.some(n=>n.type==='DiscoveryButton'&&n.props.label==='Estimate rental price'));});

test('real recommendation sorts dispatch local ranking and never pass unsupported sort names to server search',()=>{const render=renderSource('src/features/search-discovery/views/LiveSearchViews.tsx','LiveSearchFiltersView'),calls:string[]=[];const flatten=(n:any):any[]=>n&&typeof n==='object'?[n,...[n.props?.children].flat(Infinity).flatMap(flatten)]:[];const vm={screen:'sort',liveFilterDraft:defaultSearchFilters(),manualState:{sort:'Recently Listed'},hasRecommendationPreferences:true,chooseSort:(v:string)=>calls.push(v),chooseLiveSort:()=>assert.fail('Ranked sort must not invoke the price/recent server sort'),goBack(){}};const all=flatten(render({viewModel:vm}));for(const label of ['Recommended','Best Match'])all.find(n=>n.type==='DiscoveryChip'&&n.props.label===label).props.onPress();assert.deepEqual(calls,['Recommended','Best Match']);const disabled=flatten(render({viewModel:{...vm,hasRecommendationPreferences:false}}));assert.ok(disabled.filter(n=>['Recommended','Best Match'].includes(n.props?.label)).every(n=>n.props.disabled));});
