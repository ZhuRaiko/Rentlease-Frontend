/// <reference types="node" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {approximateSearchOrigin,nearbyMarkerSources,nearbyInitialCamera,radiusPolygon} from '../src/features/search-discovery/models/NearbyMap';
import {createGpsProximityWorkflow} from '../src/features/search-discovery/viewModels/gpsProximityWorkflow';
import type {NearbyListing} from '../src/features/search-discovery/models/GpsProximity';
const origin={latitude:14.431234,longitude:120.945678};
const row:NearbyListing={listingId:'00000000-0000-0000-0000-000000000001',propertyId:'00000000-0000-0000-0000-000000000100',title:'Real rental',askingRentMonthly:'18500.50',propertyType:'studio',city:'imus',barangay:'Alapan',distanceMeters:850,publicLocation:{latitude:14.432,longitude:120.946},availableFrom:null,thumbnailUrl:'https://example.test/cover.jpg'};
async function workflow(){let requests=0;const f=createGpsProximityWorkflow({user:async()=>'user',locate:async()=>({kind:'granted',coordinates:origin}),search:async()=>{requests++;return [row];},settings:async()=>{}});await f.start();return {f,requests:()=>requests};}
test('map/list and marker selection share loaded rows without another RPC; resets clear map context',async()=>{
  const {f,requests}=await workflow(),rows=f.getSnapshot().rows;
  f.selectListing(row.listingId);f.setCamera({center:[120.95,14.44],zoom:14,bearing:15,pitch:20});f.setPresentation('list');f.setPresentation('map');
  assert.equal(requests(),1);assert.equal(f.getSnapshot().rows,rows);assert.equal(f.getSnapshot().selectedListingId,row.listingId);assert.equal(f.getCamera()?.bearing,15);
  f.selectListing('invalid');assert.equal(f.getSnapshot().selectedListingId,row.listingId);f.reset();assert.equal(f.getCamera(),null);assert.equal(f.getSnapshot().approximateOrigin,null);assert.equal(f.getSnapshot().selectedListingId,null);
});
test('map context exposes only rounded user origin and server public points',async()=>{
  const {f}=await workflow();assert.deepEqual(f.getSnapshot().approximateOrigin,{latitude:14.431,longitude:120.946});assert.notEqual(f.getSnapshot().approximateOrigin?.latitude,origin.latitude);assert.deepEqual(f.getSnapshot().rows[0]?.publicLocation,row.publicLocation);
  const source=readFileSync('src/features/search-discovery/components/NearbyPropertyMap.tsx','utf8');assert.doesNotMatch(source,/private_location|exact_lat|exact_lng|UserLocation|expo-location/);
});
test('radius replacement clears framing/selection and ignores old camera callbacks',async()=>{
  const {f}=await workflow(),oldOrigin=f.getSnapshot().approximateOrigin;f.selectListing(row.listingId);f.setCamera({center:[120.9,14.4],zoom:12});await f.setRadius(20);
  f.setCamera({center:[120.9,14.4],zoom:12},3,oldOrigin);assert.equal(f.getCamera(),null);assert.equal(f.getSnapshot().selectedListingId,null);
  f.setCamera({center:[NaN,14],zoom:12});assert.equal(f.getCamera(),null);
});
test('radius overlay is a closed public presentation circle and wider radius frames farther out',()=>{
  const p=approximateSearchOrigin(origin),circle=radiusPolygon(p,3);assert.equal(circle.type,'Polygon');assert.equal(circle.coordinates[0]?.length,65);
  const first=circle.coordinates[0]![0]!,last=circle.coordinates[0]![64]!;assert.ok(Math.abs(first[0]!-last[0]!)<1e-9);assert.ok(first[1]!>p.latitude);assert.ok(nearbyInitialCamera(p,20).zoom<nearbyInitialCamera(p,3).zoom);
});
function renderSource(path:string,name:string){
 const full=resolve(path),actual=createRequire(full),mod={exports:{} as any};
 let cursor=0;const slots:any[]=[];
 const req=(key:string):any=>{
  if(key==='react')return {memo:(component:any)=>component,useState:(v:any)=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],(next:any)=>slots[i]=typeof next==='function'?next(slots[i]):next];},useRef:(v:any)=>{const i=cursor++;return slots[i]??(slots[i]={current:v});},useMemo:(fn:any)=>fn(),useEffect:()=>{}};
  if(key==='react/jsx-runtime')return {jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};
  if(key.endsWith('.png'))return 1;
  if(key==='react-native')return {useWindowDimensions:()=>({width:400,height:800,fontScale:1}),View:'View',Text:'Text',Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:(v:any)=>v}};
  if(key==='@maplibre/maplibre-react-native')return {Map:'Map',Camera:'Camera',GeoJSONSource:'GeoJSONSource',Layer:'Layer',Images:'Images',Marker:'Marker',ViewAnnotation:'ViewAnnotation'};
  if(key.endsWith('/DiscoveryControls'))return {DiscoveryButton:'DiscoveryButton',DiscoveryChip:'DiscoveryChip',DiscoveryHeader:'DiscoveryHeader'};
  for(const n of ['NearbyPropertyMap','NearbyPropertyPreview','NearbyRadiusSlider'])if(key.endsWith('/'+n))return {[n]:n};
  return actual(key);
 };
 new Function('require','module','exports',ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);return (props:any)=>{cursor=0;return mod.exports[name](props);};
}
const nodes=(tree:any):any[]=>tree&&typeof tree==='object'?[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]:[];
test('native symbols preserve public point IDs, selection, clusters and the frozen camera',async()=>{
 const {f}=await workflow();f.selectListing(row.listingId);f.setCamera({center:[120.95,14.44],zoom:14});let selected='',remembered:any;
 const render=renderSource('src/features/search-discovery/components/NearbyPropertyMap.tsx','NearbyPropertyMap'),props={state:f.getSnapshot(),initialCamera:f.getCamera(),styleUrl:'https://example.test/style.json',onSelect:(id:string)=>selected=id,onCamera:(c:any)=>remembered=c};
 const all=nodes(render(props)),map=all.find(n=>n.type==='Map'),selectedSource=all.find(n=>n.type==='GeoJSONSource'&&n.props.id==='nearby-selected-rental');
 assert.deepEqual(selectedSource.props.data.features[0].geometry.coordinates,[120.946,14.432]);assert.equal(selectedSource.props.data.features[0].id,row.listingId);
 map.props.onDidFinishLoadingStyle();selectedSource.props.onPress({stopPropagation(){},nativeEvent:{features:selectedSource.props.data.features}});assert.equal(selected,row.listingId);
 const selectedLayer=all.find(n=>n.props?.id==='nearby-selected-price');assert.equal(selectedLayer.props.layout['icon-image'],'nearby-selected');
 const source=all.find(n=>n.type==='GeoJSONSource'&&n.props.id==='nearby-rentals');assert.equal(source.props.cluster,true);assert.equal(source.props.clusterRadius,60);assert.equal(all.find(n=>n.props?.id==='nearby-rental-prices').props.layout['text-allow-overlap'],true);
 let eased:any;source.props.ref.current={getClusterExpansionZoom:async()=>16};all.find(n=>n.type==='Camera').props.ref.current={easeTo:(v:any)=>eased=v};
 source.props.onPress({stopPropagation(){},nativeEvent:{features:[{type:'Feature',geometry:{type:'Point',coordinates:[120.94,14.43]},properties:{cluster_id:1,point_count:2}}]}});await new Promise(r=>setImmediate(r));assert.equal(eased.zoom,16.1);
 const framed=all.find(n=>n.type==='Camera').props.initialViewState;assert.equal(framed.zoom,14);assert.equal(map.props.attribution,true);
 let release!:(zoom:number)=>void;eased=null;source.props.ref.current={getClusterExpansionZoom:()=>new Promise<number>(r=>release=r)};
 source.props.onPress({stopPropagation(){},nativeEvent:{features:[{geometry:{type:'Point',coordinates:[120.94,14.43]},properties:{cluster_id:1}}]}});map.props.onRegionWillChange({nativeEvent:{userInteraction:true}});release(17);await new Promise(r=>setImmediate(r));assert.equal(eased,null,'a late cluster response cannot undo a user pan');
 map.props.onRegionDidChange({nativeEvent:{center:[121,14],zoom:11,bearing:3,pitch:10}});assert.equal(remembered.pitch,10);assert.deepEqual(remembered.padding,framed.padding);
 const resized=render({...props,insets:{top:180,bottom:350,left:16,right:16}});assert.equal(nodes(resized).find(n=>n.type==='Camera').props.initialViewState,framed);
 assert.match(JSON.stringify(render({...props,styleUrl:null})),/Map configuration is unavailable/);
 const code=readFileSync('src/features/search-discovery/components/NearbyPropertyMap.tsx','utf8');assert.doesNotMatch(code,/\.project\(|ViewAnnotation|setPoints|onRegionIsChanging/);
});
test('preview uses real photo/fields and View Details action; missing photo stays neutral',()=>{
 let opened=0;const render=renderSource('src/features/search-discovery/components/NearbyPropertyPreview.tsx','NearbyPropertyPreview'),tree=render({listing:row,onDetails:()=>opened++});
 assert.match(JSON.stringify(tree),/cover.jpg/);assert.match(JSON.stringify(tree),/18500.50/);assert.match(JSON.stringify(tree),/850/);nodes(tree).find(n=>n.props?.label==='View Details').props.onPress();assert.equal(opened,1);
 assert.match(JSON.stringify(render({listing:{...row,thumbnailUrl:null}})),/No photo/);
});
test('Map/List controls reuse workflow and selected preview opens the exact listing ID',async()=>{
 const {f}=await workflow();f.selectListing(row.listingId);let opened='';const render=renderSource('src/features/search-discovery/views/NearbyMapResultsView.tsx','NearbyMapResultsView');
 const tree=render({viewModel:{gpsState:f.getSnapshot(),gps:f,nearbyMapStyle:'style',openProperty:(id:string)=>opened=id}}),all=nodes(tree);
 all.find(n=>n.type==='NearbyPropertyPreview').props.onDetails();assert.equal(opened,row.listingId);all.find(n=>n.props?.accessibilityLabel==='List').props.onPress();assert.equal(f.getSnapshot().presentation,'list');
});

test('every real point stays in native source data; selection splits only the selected feature',()=>{
 const rows=[row,{...row,listingId:'second',publicLocation:{latitude:14.433,longitude:120.947}},{...row,listingId:'third',publicLocation:{latitude:14.434,longitude:120.948}}];
 const data=nearbyMarkerSources(rows,'second');assert.equal(data.ordinary.features.length,2);assert.equal(data.selected.features.length,1);
 assert.deepEqual([...data.ordinary.features,...data.selected.features].map(f=>f.id).sort(),rows.map(r=>r.listingId).sort());assert.equal(data.selected.features[0]?.properties.listingId,'second');
});
test('1000 camera settlements emit zero UI notifications and make zero extra search/photo requests',async()=>{
 const {f,requests}=await workflow();let notifications=0;f.subscribe(()=>notifications++);const snapshot=f.getSnapshot();
 const started=performance.now();for(let i=0;i<1000;i++)f.setCamera({center:[120.9,14.4],zoom:12+i/10000});const elapsed=performance.now()-started;
 assert.equal(notifications,0);assert.equal(requests(),1);assert.equal(f.getSnapshot(),snapshot);assert.equal(f.getCamera()?.zoom,12.0999);console.info(`Camera persistence: 1000 updates, 0 UI notifications, ${elapsed.toFixed(2)} ms (unit harness, not Android FPS)`);
 f.dispose();f.setCamera({center:[120.9,14.4],zoom:15});assert.equal(f.getCamera(),null);
});
test('immersive flow hides bottom navbar only for nearby Map and retains safe-area inset',()=>{
 const source=readFileSync('src/features/search-discovery/views/SearchDiscoveryFlowView.tsx','utf8');assert.match(source,/screen==='nearbyResults'&&viewModel.gpsState.presentation==='map'/);assert.match(source,/!immersiveMap\?<RentLeaseBottomNavigation/);assert.match(source,/includeBottomInset=\{immersiveMap\}/);
});
test('preview close clears selection without resetting results or making a search',async()=>{
 const {f,requests}=await workflow();f.selectListing(row.listingId);const rows=f.getSnapshot().rows;const render=renderSource('src/features/search-discovery/components/NearbyPropertyPreview.tsx','NearbyPropertyPreview'),tree=render({listing:row,onDetails(){},onClose:f.clearSelection});nodes(tree).find(n=>n.props?.accessibilityLabel==='Close rental preview').props.onPress();assert.equal(f.getSnapshot().selectedListingId,null);assert.equal(f.getSnapshot().rows,rows);assert.equal(requests(),1);
});
