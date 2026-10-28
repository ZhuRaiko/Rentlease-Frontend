/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import { fromMapLngLat, toMapLngLat, isExactPropertyPoint, propertyAddressQuery } from '../src/features/property-listing/models/PropertyLocationConfirmation';
import { createPropertyLocationService } from '../src/features/property-listing/services/propertyLocationService';
import { createPropertyLocationWorkflow } from '../src/features/property-listing/viewModels/propertyLocationWorkflow';
import { createPropertyCreationWorkflow } from '../src/features/property-listing/viewModels/propertyCreationWorkflow';
import { emptyDraftProperty, hasConfirmedPropertyLocation } from '../src/features/property-listing/models/DraftProperty';
const candidate = { id: 'fixture', label: 'Example address', longitude: 120.9, latitude: 14.4 };
const feature = () => ({ id: candidate.id, place_name: candidate.label, center: [candidate.longitude, candidate.latitude] });
function geocoder(payload: unknown = { features: [feature()] }) {
  const calls: { url: string; signal: AbortSignal | null | undefined }[] = [];
  const search = createGeocodingService(() => 'fixture-key', (async (url: string, options: RequestInit) => {
    calls.push({ url, signal: options.signal }); return { ok: true, json: async () => payload };
  }) as unknown as typeof fetch);
  return { search, calls };
}
const context = { addressRevision: 2, setupId: 'fixture-setup', query: 'Example street, Imus, Cavite, Philippines' };
function locationHarness(searchAddress: (query: string, signal: AbortSignal) => Promise<typeof candidate[]> = async () => [candidate]) {
  const calls: { query: string; signal: AbortSignal }[] = [];
  const flow = createPropertyLocationWorkflow({ searchAddress: (query, signal) => { calls.push({ query, signal }); return searchAddress(query, signal); }, getMapStyleUrl: () => 'fixture-style' });
  return { flow, calls, open: () => flow.open(context), map: async () => { await flow.open(context); flow.chooseCandidate(candidate.id); flow.mapLoaded(); } };
}

import { geocodeAddress, createGeocodingService, parseGeocodingCandidates } from '../src/shared/services/maps/geocoding/geocodingService';
test('geocoding rejects a blank query before requesting private location data', async () => {
  await assert.rejects(geocodeAddress('  '), /Enter at least 3 characters/);
});


test('geocoder trims the query, scopes to Philippines, and maps lng/lat explicitly', async () => {
  const h = geocoder(); assert.deepEqual(await h.search('  Example street  '), [candidate]);
  const url = new URL(h.calls[0]!.url); assert.ok(url.pathname.endsWith('/Example%20street.json')); assert.equal(url.searchParams.get('country'), 'ph'); assert.equal(url.searchParams.get('limit'), '5');
});
for (const change of [
  { center: undefined }, { center: null }, { center: [] }, { center: [120] }, { center: ['120', 14] }, { center: [NaN, 14] }, { center: [120, Infinity] }, { center: [181, 14] }, { center: [120, 91] }, { id: undefined }, { id: ' ' }, { place_name: undefined }, { place_name: ' ' },
]) test(`geocoder drops malformed candidate ${JSON.stringify(change)}`, () => {
  assert.deepEqual(parseGeocodingCandidates({ features: [{ ...feature(), ...change }, null, 'bad'] }), []);
});
test('empty results remain empty and duplicate IDs cannot become conflicting candidates', async () => {
  assert.deepEqual(await geocoder({ features: [] }).search('Example'), []);
  assert.equal(parseGeocodingCandidates({ features: [feature(), feature()] }).length, 1);
});
for (const payload of [null, {}, { features: {} }, { features: null }]) test(`malformed geocoding envelope is a safe failure: ${JSON.stringify(payload)}`, async () => {
  await assert.rejects(geocoder(payload).search('Example'), /unreadable response/);
});
for (const failure of ['http', 'json', 'network', 'configuration'] as const) test(`${failure} failure does not expose private URLs or addresses`, async () => {
  const h = createGeocodingService(() => { if (failure === 'configuration') throw Error('private-key'); return 'private-key'; }, (async () => {
    if (failure === 'network') throw Error('private-key private-address');
    return { ok: failure !== 'http', json: async () => { throw Error('private-key private-address'); } };
  }) as unknown as typeof fetch);
  await assert.rejects(h('private-address'), error => error instanceof Error && !/private-key|private-address/.test(error.message));
});
test('AbortSignal is forwarded and an aborted request yields a sanitized AbortError', async () => {
  const controller = new AbortController(); let received: AbortSignal | null | undefined;
  const search = createGeocodingService(() => 'fixture-key', (async (_url: string, options: RequestInit) => {
    received = options.signal; controller.abort(); throw Error('private URL');
  }) as unknown as typeof fetch);
  await assert.rejects(search('Example', { signal: controller.signal }), { name: 'AbortError' }); assert.equal(received, controller.signal);
  const h = geocoder(); await assert.rejects(h.search('Example', { signal: controller.signal }), { name: 'AbortError' }); assert.equal(h.calls.length, 0);
});
for (const [limit, expected] of [[99, 10], [-2, 1], [2.7, 2], [NaN, 5]] as const) test(`candidate limit ${limit} is bounded`, async () => {
  const h = geocoder({ features: Array.from({ length: 20 }, (_, i) => ({ ...feature(), id: String(i) })) });
  assert.equal((await h.search('Example', { limit })).length, expected); assert.equal(new URL(h.calls[0]!.url).searchParams.get('limit'), String(expected));
});
test('valid points and geographic boundaries retain explicit longitude-first conversion', () => {
  assert.equal(isExactPropertyPoint(candidate), true); assert.equal(isExactPropertyPoint({ latitude: -90, longitude: 180 }), true);
  assert.deepEqual(toMapLngLat(candidate), [120.9, 14.4]); assert.deepEqual(fromMapLngLat(toMapLngLat(candidate)), { longitude: 120.9, latitude: 14.4 });
});
for (const point of [null, {}, { latitude: NaN, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: '14', longitude: 120 }]) test(`invalid exact point is rejected: ${JSON.stringify(point)}`, () => {
  assert.equal(isExactPropertyPoint(point), false);
});
test('address query uses normal fields and excludes private access instructions', () => {
  const query = propertyAddressQuery({ ...emptyDraftProperty(), city: 'imus', barangay: ' Barangay ', addressLine1: ' Street ', addressLine2: ' Unit ', postalCode: '4103', accessInstructions: 'private-access-code' });
  assert.equal(query, 'Street, Unit, Barangay, Imus, 4103, Cavite, Philippines'); assert.doesNotMatch(query, /private-access/);
});
test('feature service reuses the existing geocoder/style provider with a bounded search', async () => {
  let args: any[] = []; const signal = new AbortController().signal;
  const service = createPropertyLocationService(async (...values) => { args = values; return [candidate]; }, () => 'fixture-style');
  assert.deepEqual(await service.searchAddress('Example', signal), [candidate]); assert.deepEqual(args, ['Example', { signal, limit: 5 }]); assert.equal(service.getMapStyleUrl(), 'fixture-style');
});
test('opening captures revision and requires explicit candidate selection', async () => {
  const h = locationHarness(); await h.open(); const state = h.flow.getSnapshot();
  assert.deepEqual(state.context, context); assert.equal(state.selected, null); assert.equal(state.workingPoint, null); assert.deepEqual(state.candidates, [candidate]);
  h.flow.chooseCandidate('unknown'); assert.equal(h.flow.getSnapshot().stage, 'candidates'); h.flow.chooseCandidate(candidate.id);
  assert.equal(h.flow.getSnapshot().stage, 'map'); assert.deepEqual(h.flow.getSnapshot().workingPoint, { longitude: 120.9, latitude: 14.4 });
});
test('map load and valid explicit confirmation retain the exact point/revision only', async () => {
  const h = locationHarness(); await h.open(); h.flow.chooseCandidate(candidate.id); assert.equal(h.flow.confirmExact(), false);
  h.flow.mapLoaded(); h.flow.movePoint([121.1, 14.6]); assert.equal(h.flow.confirmExact(), true);
  assert.deepEqual(h.flow.getSnapshot().confirmedPoint, { longitude: 121.1, latitude: 14.6 }); assert.equal(h.flow.getSnapshot().confirmedRevision, 2);
  assert.equal('publicLatitude' in h.flow.getSnapshot(), false);
});
test('invalid native points do not replace the valid working pin; map failure blocks confirmation', async () => {
  const h = locationHarness(); await h.map(); const point = h.flow.getSnapshot().workingPoint;
  for (const invalid of [[Infinity, 14], [190, 14], [120, 100], [], ['120', 14]]) h.flow.movePoint(invalid);
  assert.deepEqual(h.flow.getSnapshot().workingPoint, point); h.flow.mapFailed(); assert.equal(h.flow.confirmExact(), false);
});
test('cancel before confirmation creates no exact point; cancelling a later adjustment retains prior confirmation', async () => {
  const h = locationHarness(); await h.map(); h.flow.cancel(); assert.equal(h.flow.getSnapshot().confirmedPoint, null);
  await h.map(); h.flow.confirmExact(); const point = h.flow.getSnapshot().confirmedPoint; await h.map(); h.flow.movePoint([121, 15]); h.flow.cancel(); assert.deepEqual(h.flow.getSnapshot().confirmedPoint, point);
});
test('address revision and different setup invalidate confirmed points and native callbacks immediately', async () => {
  const h = locationHarness(); await h.map(); h.flow.confirmExact(); const oldToken = h.flow.generationToken();
  h.flow.syncContext({ ...context, addressRevision: 3 }); assert.equal(h.flow.getSnapshot().confirmedPoint, null);
  await h.flow.open({ ...context, addressRevision: 3 }); h.flow.chooseCandidate(candidate.id);
  h.flow.movePoint([121, 15], oldToken); h.flow.mapLoaded(oldToken); assert.equal(h.flow.getSnapshot().mapReady, false); assert.equal(h.flow.confirmExact(oldToken), false);
  h.flow.mapLoaded(); h.flow.confirmExact(); h.flow.syncContext({ ...context, addressRevision: 3, setupId: 'another-setup' }); assert.equal(h.flow.getSnapshot().confirmedPoint, null);
});
test('address change aborts search and ignores its late response', async () => {
  let release!: (value: typeof candidate[]) => void;
  const h = locationHarness(() => new Promise(resolve => { release = resolve; })); const pending = h.open();
  h.flow.syncContext({ ...context, addressRevision: 3 }); assert.equal(h.calls[0]!.signal.aborted, true); release([candidate]); await pending;
  assert.deepEqual(h.flow.getSnapshot().candidates, []); assert.equal(h.flow.getSnapshot().context?.addressRevision, 3);
});
test('new and rapid searches abort older requests and only the last result is applied', async () => {
  const releases: ((value: typeof candidate[]) => void)[] = [];
  const h = locationHarness(() => new Promise(resolve => releases.push(resolve)));
  const first = h.open(); const second = h.flow.search(); const third = h.flow.search(); assert.equal(h.calls[0]!.signal.aborted, true); assert.equal(h.calls[1]!.signal.aborted, true);
  releases[2]!([{ ...candidate, id: 'latest' }]); await third; releases[0]!([candidate]); releases[1]!([candidate]); await Promise.all([first, second]);
  assert.equal(h.flow.getSnapshot().candidates[0]?.id, 'latest'); assert.equal(h.flow.getSnapshot().busy, false);
});
for (const action of ['cancel', 'close', 'dispose'] as const) test(`${action} aborts search and rejects late results`, async () => {
  let release!: (value: typeof candidate[]) => void; const h = locationHarness(() => new Promise(resolve => { release = resolve; })); const pending = h.open();
  h.flow[action](); assert.equal(h.calls[0]!.signal.aborted, true); release([candidate]); await pending; assert.deepEqual(h.flow.getSnapshot().candidates, []); assert.equal(h.flow.getSnapshot().confirmedPoint, null);
});
test('empty and failed searches remain recoverable without selecting a pin', async () => {
  const empty = locationHarness(async () => []); await empty.open(); assert.equal(empty.flow.getSnapshot().stage, 'candidates'); assert.equal(empty.flow.getSnapshot().selected, null);
  const failed = locationHarness(async () => { throw Error('private exact address'); }); await failed.open(); assert.doesNotMatch(failed.flow.getSnapshot().error ?? '', /private exact/); assert.equal(failed.flow.getSnapshot().stage, 'candidates');
});
test('missing style configuration is a safe non-persistence error', async () => {
  let searches = 0; const flow = createPropertyLocationWorkflow({ searchAddress: async () => { searches++; return []; }, getMapStyleUrl: () => { throw Error('private-key'); } });
  await flow.open(context); assert.match(flow.getSnapshot().error ?? '', /EXPO_PUBLIC_MAPTILER_API_KEY/); assert.equal(searches, 0); assert.equal(flow.getSnapshot().confirmedPoint, null);
});
test('a standalone location workflow cannot write an unrelated, unconnected creation workflow', async () => {
  let writes = 0; const creation = createPropertyCreationWorkflow({ getEligibleUserId: async () => 'owner', assertIdentity: async () => {}, restore: async () => null, create: async () => { writes++; throw Error('not allowed'); } } as any);
  await creation.initialize(); creation.updateField('propertyType', 'studio'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Example'); creation.updateField('addressLine1', 'Example street'); creation.updateField('accessInstructions', 'Private instructions');
  const before = { ...creation.getSnapshot().draft }; const h = locationHarness(); await h.map(); h.flow.confirmExact();
  assert.deepEqual(creation.getSnapshot().draft, before); assert.equal(hasConfirmedPropertyLocation(creation.getSnapshot().draft), false);
  creation.next(); creation.next(); await creation.submit(); assert.equal(writes, 0); assert.equal(creation.getSnapshot().draft.publicLatitude, null); assert.equal(creation.getSnapshot().draft.exactLatitude, null);
});
test('renderer forwards v11 tap and drag events in longitude-first order with visible attribution', () => {
  const path = resolve('src/features/property-listing/views/PropertyLocationMapView.tsx'); const actualRequire = createRequire(path), module = { exports: {} as any };
  const req = (name: string): any => {
    if (name === '@maplibre/maplibre-react-native') return { Map: 'Map', Camera: 'Camera', ViewAnnotation: 'ViewAnnotation' };
    if (name === 'react-native') return { View: 'View', Text: 'Text', ScrollView: 'ScrollView', StyleSheet: { create: (styles: any) => styles } };
    const component = ['ScreenHeader', 'FeedbackNotice', 'ListingButton'].find(value => name.endsWith('/' + value));
    return component ? { [component]: component } : actualRequire(name);
  };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  const moves: unknown[] = [];
  const tree = module.exports.PropertyLocationMapView({ styleUrl: 'fixture-style', point: { latitude: 15, longitude: 121 }, initialPoint: candidate, error: null, ready: true, onMove: (point: unknown) => moves.push(point), onLoaded: () => {}, onFailed: () => {}, onCancel: () => {}, onConfirm: () => {} });
  const nodes: any[] = []; const visit = (node: any) => { if (!node || typeof node !== 'object') return; nodes.push(node); for (const child of [node.props?.children].flat(Infinity)) visit(child); }; visit(tree);
  const map = nodes.find(node => node.type === 'Map'), pin = nodes.find(node => node.type === 'ViewAnnotation'), camera = nodes.find(node => node.type === 'Camera');
  map.props.onPress({ nativeEvent: { lngLat: [121.2, 14.8] } }); pin.props.onDragEnd({ nativeEvent: { lngLat: [121.3, 14.9] } });
  assert.deepEqual(moves, [[121.2, 14.8], [121.3, 14.9]]); assert.deepEqual(pin.props.lngLat, [121, 15]); assert.deepEqual(camera.props.initialViewState.center, [120.9, 14.4]); assert.equal(map.props.attribution, true); assert.equal(pin.props.draggable, true);
});
test('location boundaries exclude GPS, raw View HTTP, legacy pins, public-point fabrication and logging', () => {
  const setup = readFileSync('src/features/property-listing/views/PropertySetupView.tsx', 'utf8'), map = readFileSync('src/features/property-listing/views/PropertyLocationMapView.tsx', 'utf8');
  assert.doesNotMatch(setup + map, /fetch\(|geocodeAddress\(|getSupabaseClient|\.rpc\(|expo-location|confirmPin\(/);
  const workflow = readFileSync('src/features/property-listing/viewModels/propertyLocationWorkflow.ts', 'utf8'), model = readFileSync('src/features/property-listing/models/PropertyLocationConfirmation.ts', 'utf8'), service = readFileSync('src/features/property-listing/services/propertyLocationService.ts', 'utf8'), vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.doesNotMatch(workflow + model + service, /expo-location|provideConfirmedLocation|console\.|fetch\(/); assert.match(vm, /provideConfirmedLocation\(location, confirmedRevision\)/);
  assert.doesNotMatch(readFileSync('src/shared/services/maps/geocoding/geocodingService.ts', 'utf8'), /console\./);
});
