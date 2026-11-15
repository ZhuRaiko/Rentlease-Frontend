/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import type { GpsProximityDependencies } from '../src/features/search-discovery/viewModels/gpsProximityWorkflow';
import type { SearchDiscoveryViewModel } from '../src/features/search-discovery/viewModels/useSearchDiscoveryViewModel';
import { sharedStub } from './support/sharedStubs';

// Real hook, workflow and navigation guard; native/device/backend ports and React scheduler only are replaced.
function mount(dependencies: GpsProximityDependencies) {
  let cursor = 0, accountId = 'tenant', current: SearchDiscoveryViewModel;
  const slots: any[] = [], effects: (() => void)[] = [], cache = new Map<string, any>();
  const manualCalls: any[] = [];
  const manualService = { user: async () => 'tenant', search: async (_owner: string,input: any) => { manualCalls.push(input); return []; }, locations: async () => ({locations:[],received:0}), detail: async () => { throw Error('not selected'); }, catalogue: async () => [] };
  const hooks = {
    useState(initial: any) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, (v: any) => { slots[i].value = typeof v === 'function' ? v(slots[i].value) : v; }]; },
    useRef(value: any) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useMemo(fn: () => any, deps: unknown[]) { const i = cursor++; if (!slots[i] || deps.some((v, n) => !Object.is(v, slots[i].deps[n]))) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn: () => any, deps: unknown[]) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((v, n) => !Object.is(v, previous.deps[n]))) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    useSyncExternalStore(_subscribe: any, snapshot: () => any) { cursor++; return snapshot(); },
  };
  const load = (path: string): any => {
    const absolute = resolve(path); if (cache.has(absolute)) return cache.get(absolute);
    const actual = createRequire(absolute), module = { exports: {} as any };
    const req = (name: string): any => name === 'react' ? hooks : name.endsWith('/usePublicIdentitiesViewModel') ? {usePublicIdentitiesViewModel:()=>({})} : name.endsWith('/recommendationDependencies') ? {recommendationService:{user:async()=>accountId,load:async()=>({candidates:[],limited:false,scanned:0})}} : name.endsWith('/manualSearchDependencies') ? { manualSearchService: manualService } : name.endsWith('/gpsProximityDependencies') ? { gpsProximityDependencies: dependencies } : name.endsWith('/supabase/client') ? { getSupabaseClient: () => { throw Error('The Supabase client must not be reached from the Discovery hook in this test.'); } } : sharedStub(absolute, name) ?? (name.startsWith('.') ? load(resolve(absolute, '..', name.endsWith('.ts') ? name : name + '.ts')) : actual(name));
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(req, module, module.exports); cache.set(absolute, module.exports); return module.exports;
  };
  const hook = load('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts').useSearchDiscoveryViewModel;
  const flush = () => { cursor = 0; current = hook('home', { accountId }); while (effects.length) effects.shift()!(); return current; };
  flush();
  return { vm: () => current, manualCalls, flush, async settle() { for (let i = 0; i < 3; i++) { await new Promise(r => setImmediate(r)); flush(); } }, account(id: string) { accountId = id; flush(); }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function deps() { let calls = 0; return { calls: () => calls, dependency: { user: async () => 'tenant', locate: async () => { calls++; return { kind: 'granted' as const, coordinates: { latitude: 14.4, longitude: 120.9 } }; }, search: async () => [], settings: async () => {} } }; }
test('real Discovery hook explains first; explicit Allow searches; Back clears GPS and manual city backend search remains', async () => {
  const d = deps(), h = mount(d.dependency); assert.equal(d.calls(), 0); h.vm().navigate('searchLocation'); h.flush(); h.vm().requestCurrentLocation(); h.flush(); assert.equal(h.vm().screen, 'locationPermission'); assert.equal(d.calls(), 0);
  h.vm().allowCurrentLocation(); await h.settle(); assert.equal(h.vm().screen, 'nearbyResults'); assert.equal(d.calls(), 1); assert.equal(h.vm().gpsState.phase, 'success'); assert.deepEqual(h.vm().gpsState.rows, []);
  h.vm().backFromWorkspace(() => assert.fail('must not close feature'), () => assert.fail('must not exit app')); h.flush(); assert.equal(h.vm().screen, 'searchLocation'); assert.equal(h.vm().gpsState.phase, 'idle');
  h.vm().chooseSuggestion('Imus, Cavite'); await h.settle(); assert.equal(h.vm().screen, 'resultsList'); assert.deepEqual(h.vm().manualState.rows, []); assert.equal(h.manualCalls.at(-1).query,'Imus, Cavite'); assert.equal(d.calls(), 1); h.unmount();
});
test('Not now returns to manual search with no permission or backend call', () => {
  const d = deps(), h = mount(d.dependency); h.vm().navigate('searchLocation'); h.flush(); h.vm().requestCurrentLocation(); h.flush(); h.vm().declineCurrentLocation(); h.flush(); assert.equal(h.vm().screen, 'searchLocation'); assert.equal(d.calls(), 0); h.unmount();
});

test('nearby detail Back preserves radius, results and location; account switch clears them', async () => {
  const d=deps(), row={listingId:'00000000-0000-0000-0000-000000000001',propertyId:'00000000-0000-0000-0000-000000000100',title:'Real rental',askingRentMonthly:'9000',propertyType:'studio',city:'imus',barangay:'Alapan',availableFrom:null,publicLocation:{latitude:14.4,longitude:120.9},distanceMeters:500};
  const h=mount({...d.dependency,search:async()=>[row]});
  h.vm().navigate('searchLocation');h.flush();h.vm().requestCurrentLocation();h.flush();h.vm().allowCurrentLocation();await h.settle();
  await h.vm().gps.setRadius(20);h.vm().gps.selectListing(row.listingId);h.vm().gps.setCamera({center:[120.91,14.42],zoom:13});h.flush();const before=h.vm().gpsState;
  h.vm().openProperty(row.listingId);await h.settle();assert.equal(h.vm().screen,'propertyDetails');assert.equal(h.vm().manualState.selectedId,row.listingId);
  h.vm().goBack();h.flush();assert.equal(h.vm().screen,'nearbyResults');assert.equal(h.vm().gpsState,before);assert.equal(h.vm().gpsState.selectedListingId,row.listingId);assert.deepEqual(h.vm().gps.getCamera(),{center:[120.91,14.42],zoom:13});assert.equal(d.calls(),1);
  h.account('another');assert.deepEqual(h.vm().gpsState.rows,[]);assert.equal(h.vm().gpsState.radiusKm,3);h.unmount();
});

test('nearby card is pressable and renders the actual thumbnail with neutral fallback',()=>{
  const render=presentation('src/features/search-discovery/components/NearbyListingCard.tsx','NearbyListingCard');let pressed=0;
  const tree=render({listing:{title:'Actual listing',thumbnailUrl:'https://example.test/real.jpg',distanceMeters:100},onPress:()=>pressed++});
  assert.equal(tree.type,'Pressable');tree.props.onPress();assert.equal(pressed,1);assert.match(JSON.stringify(tree),/real.jpg/);assert.match(tree.props.accessibilityLabel,/100 meters away/);
  assert.match(JSON.stringify(render({listing:{title:'No photo',distanceMeters:100},onPress(){}})),/Photo unavailable/);
});
test('actual manual hook searches backend and applies filters/sort without duplicate Back screens', async () => {
  const d=deps(),h=mount(d.dependency);h.vm().navigate('searchLocation');h.flush();h.vm().setQuery('Alapan');h.flush();h.vm().submitSearch();await h.settle();assert.equal(h.manualCalls.at(-1).query,'Alapan');assert.deepEqual(h.vm().manualState.rows,[]);
  h.vm().openLiveFilters();h.flush();h.vm().setLiveFilterDraft({...h.vm().liveFilterDraft,minBeds:2});h.flush();h.vm().applyLiveFilters();await h.settle();assert.equal(h.manualCalls.at(-1).filters.minBeds,2);h.vm().navigate('sort');h.flush();h.vm().chooseLiveSort('Price: Low to High');await h.settle();assert.equal(h.manualCalls.at(-1).sort,'Price: Low to High');h.vm().goBack();h.flush();assert.equal(h.vm().screen,'searchLocation');assert.equal(d.calls(),0);h.unmount();
});
test('new typed location search does not retain a previous suggestion-only city constraint', async () => {
  const d=deps(),h=mount(d.dependency);h.vm().navigate('searchLocation');h.flush();h.vm().chooseSuggestion({key:'imus:alapan',city:'imus',barangay:'Alapan',label:'Alapan, Imus',query:'Alapan'});await h.settle();assert.equal(h.manualCalls.at(-1).filters.city,'imus');h.vm().navigate('searchLocation');h.flush();h.vm().setQuery('Tagaytay');h.flush();h.vm().submitSearch();await h.settle();assert.equal(h.manualCalls.at(-1).filters.city,'');assert.equal(h.manualCalls.at(-1).query,'Tagaytay');h.unmount();
});
for (const change of ['back', 'account', 'unmount'] as const) test(`${change} invalidates the actual hook pending GPS request`, async () => {
  let complete!: (rows: []) => void;
  const d = deps(), h = mount({ ...d.dependency, search: async () => new Promise<[]>(r => { complete = r; }) });
  h.vm().navigate('searchLocation'); h.flush(); h.vm().requestCurrentLocation(); h.flush(); h.vm().allowCurrentLocation(); await h.settle(); const old = h.vm().gps;
  if (change === 'back') { h.vm().goBack(); h.flush(); } else if (change === 'account') h.account('new-tenant'); else h.unmount();
  complete([]); await new Promise(r => setImmediate(r)); assert.equal(old.getSnapshot().phase, 'idle'); assert.deepEqual(old.getSnapshot().rows, []);
  if (change !== 'unmount') h.unmount();
});

function presentation(path: string, name: string) {
  const absolute = resolve(path), actual = createRequire(absolute), mod = { exports: {} as any };
  const req = (key: string): any => {
    if (key === 'react') return {useState:(v:any)=>[v,()=>{}],useEffect:()=>{}};
    if (key === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
    if (key === 'react-native') return { Image:'Image',Pressable:'Pressable',ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', Text: 'Text', View: 'View', StyleSheet: { create: (v: any) => v } };
    if (key.endsWith('/NearbyRadiusSlider')) return { NearbyRadiusSlider:'NearbyRadiusSlider' };
    if (key.endsWith('/NearbyMapResultsView')) return {NearbyMapResultsView:'NearbyMapResultsView'};
    if (key.endsWith('/DiscoveryControls')) return { DiscoveryButton: 'DiscoveryButton', DiscoveryChip: 'DiscoveryChip', DiscoveryHeader: 'DiscoveryHeader' };
    if (key.endsWith('/DiscoveryIcon')) return { DiscoveryIcon: 'DiscoveryIcon' };
    if (key.endsWith('/NearbyListingCard')) return { NearbyListingCard: 'NearbyListingCard' };
    const shared = sharedStub(absolute, key); if (shared) return shared;
    return actual(key);
  };
  const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports); return mod.exports[name];
}
function nodes(tree: any): any[] { if (!tree || typeof tree !== 'object') return []; return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes), ...[tree.props?.ListHeaderComponent, tree.props?.ListFooterComponent].flatMap(nodes)]; }
test('GPS cards render only RPC-supported data, nullable fallbacks and exact decimal strings', () => {
  const render = presentation('src/features/search-discovery/components/NearbyListingCard.tsx', 'NearbyListingCard');
  const tree = render({ listing: { title: 'Real studio', askingRentMonthly: '18500.50', propertyType: 'studio', city: 'dasmarinas', barangay: 'Burol', distanceMeters: '850.25', availableFrom: null } });
  const text = JSON.stringify(tree); assert.match(text, /Real studio/); assert.match(text, /18500.50/); assert.match(text, /850.25/); assert.match(text, /Availability date not provided/); assert.doesNotMatch(text, /matchScore|reviewCount|rating|amenities|imageCrop/);
  assert.match(JSON.stringify(render({ listing: { title: null, askingRentMonthly: null, propertyType: null, city: null, barangay: null, distanceMeters: 0, availableFrom: '2026-10-29' } })), /Rent not provided/);
});
test('GPS results bind radius, retry, settings, more and manual-search actions with no preview ranking', () => {
  const render = presentation('src/features/search-discovery/views/NearbyListingsView.tsx', 'NearbyListingsView'); const calls: unknown[] = [];
  const vm = { gpsState: { phase: 'error', rows: [], radiusKm: 3, error: { kind: 'blocked', message: 'Enable access' }, hasMore: false }, gps: { setRadius: (r: number) => calls.push(r), retry: () => calls.push('retry'), openSettings: () => calls.push('settings'), start: () => calls.push('location') }, navigate: (screen: string) => calls.push(screen) };
  const tree = render({ viewModel: vm }); const all = nodes(tree); all.find(n => n.type === 'NearbyRadiusSlider').props.onComplete(20); all.find(n => n.props?.label === 'Open app settings').props.onPress(); all.find(n => n.props?.label === 'Search by city').props.onPress();
  assert.deepEqual(calls, [20, 'settings', 'searchLocation']); assert.doesNotMatch(JSON.stringify(tree), /Recommended|Best Match|previewDiscoveryProperties|resultsMap/);
});
test('explanation and nearby Views contain no external clients or simulation imports', () => {
  for (const path of ['views/SearchLocationView.tsx', 'views/NearbyListingsView.tsx', 'components/NearbyListingCard.tsx']) { const source = readFileSync(`src/features/search-discovery/${path}`, 'utf8'); assert.doesNotMatch(source, /getSupabaseClient|\.rpc\(|expo-location|gps-local\/local/); }
  const source = readFileSync('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts', 'utf8'); assert.doesNotMatch(source, /Current-location preview is centered|setLocationPermission\('granted'\)/);
});
