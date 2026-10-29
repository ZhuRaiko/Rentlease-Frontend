/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { PUBLIC_LOCATION_GRID_METERS, WEB_MERCATOR_RADIUS_METERS, WEB_MERCATOR_MAX_LATITUDE, derivePublicPropertyPoint, projectWebMercator, unprojectWebMercator } from '../src/features/property-listing/models/PropertyLocationPrivacy';
import { isExactPropertyPoint } from '../src/features/property-listing/models/PropertyLocationConfirmation';
import { createPropertyLocationWorkflow } from '../src/features/property-listing/viewModels/propertyLocationWorkflow';
import { emptyDraftProperty } from '../src/features/property-listing/models/DraftProperty';
import type { PropertyLocationInput } from '../src/features/property-listing/models/DraftProperty';
const exact = { latitude: 14.5, longitude: 121 };
const candidate = { ...exact, id: 'fixture', label: 'Synthetic address' };
const context = { addressRevision: 4, setupId: 'fixture', query: 'Synthetic address, Cavite' };
const close = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
async function map(onConfirmed?: (location: PropertyLocationInput, revision: number) => boolean) {
 const flow = createPropertyLocationWorkflow({ searchAddress: async () => [candidate], getMapStyleUrl: () => 'fixture-style' }, onConfirmed);
 await flow.open(context); flow.chooseCandidate(candidate.id); flow.mapLoaded(); return flow;
}
test('approved grid/radius constants and valid synthetic Philippine public point', () => {
 assert.equal(PUBLIC_LOCATION_GRID_METERS, 300); assert.equal(WEB_MERCATOR_RADIUS_METERS, 6378137); const point = derivePublicPropertyPoint(exact);
 assert.ok(isExactPropertyPoint(point)); assert.notDeepEqual(point, exact);
});
test('deterministic transformation preserves the frozen exact input', () => {
 const input = Object.freeze({ ...exact }); const first = derivePublicPropertyPoint(input);
 for (let i = 0; i < 10; i++) assert.deepEqual(derivePublicPropertyPoint(input), first);
 assert.deepEqual(input, exact);
});
test('same-cell nearby points share their public center; adjacent cells differ', () => {
 const a = unprojectWebMercator({ x: 9000100, y: 1500100 }), b = unprojectWebMercator({ x: 9000110, y: 1500110 }), c = unprojectWebMercator({ x: 9000400, y: 1500100 });
 assert.deepEqual(derivePublicPropertyPoint(a), derivePublicPropertyPoint(b)); assert.notDeepEqual(derivePublicPropertyPoint(a), derivePublicPropertyPoint(c));
});
test('known Web Mercator benchmarks verify the projection independently', () => {
 const zero = projectWebMercator({ latitude: 0, longitude: 0 }); assert.deepEqual(zero, { x: 0, y: 0 });
 close(projectWebMercator({ latitude: 45, longitude: 180 }).x, 20037508.342789244, 1e-6);
 close(projectWebMercator({ latitude: 45, longitude: 180 }).y, 5621521.486192066, 1e-6);
});
for (const point of [exact, { latitude: -33, longitude: -71 }, { latitude: 0, longitude: 0 }, { latitude: 85, longitude: 179 }]) test(`projection roundtrip is stable: ${point.latitude}`, () => {
 const restored = unprojectWebMercator(projectWebMercator(point)); close(restored.latitude, point.latitude); close(restored.longitude, point.longitude);
});
test('negative projected coordinates use floor rather than truncation', () => {
 const publicPoint = projectWebMercator(derivePublicPropertyPoint(unprojectWebMercator({ x: -10, y: -10 })));
 close(publicPoint.x, -150, 1e-6); close(publicPoint.y, -150, 1e-6);
});
test('zero lies in the positive-origin cell; a grid center remains a valid fixed point', () => {
 const point = derivePublicPropertyPoint({ latitude: 0, longitude: 0 }); const projected = projectWebMercator(point);
 close(projected.x, 150, 1e-6); close(projected.y, 150, 1e-6);
 const again = derivePublicPropertyPoint(point); close(again.latitude, point.latitude); close(again.longitude, point.longitude);
});
for (const latitude of [-90, -85.05112878, 85.05112878, 90]) for (const longitude of [-180, 180]) test(`global boundary ${latitude}/${longitude} remains finite and clamped`, () => {
 const point = derivePublicPropertyPoint({ latitude, longitude }); assert.ok(isExactPropertyPoint(point)); assert.ok(Math.abs(point.latitude) <= WEB_MERCATOR_MAX_LATITUDE); assert.ok(Math.abs(point.longitude) <= 180);
});
for (const input of [null, {}, { latitude: NaN, longitude: 1 }, { latitude: 1, longitude: Infinity }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: '14', longitude: 121 }]) test(`invalid input rejects without disclosing it: ${JSON.stringify(input)}`, () => {
 assert.throws(() => derivePublicPropertyPoint(input as any), /valid geographic point/);
});
test('center displacement is bounded by half the projected diagonal, not exactly 300m', () => {
 const a = projectWebMercator(exact), b = projectWebMercator(derivePublicPropertyPoint(exact));
 assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= Math.SQRT2 * 150 + 1e-6);
 close((b.x / 300) - Math.floor(b.x / 300), .5, 1e-7); close((b.y / 300) - Math.floor(b.y / 300), .5, 1e-7);
});
test('explicit exact confirmation hands off unchanged exact and derived public coordinates with captured revision', async () => {
 const calls: { location: PropertyLocationInput; revision: number }[] = [];
 const flow = await map((location, revision) => { calls.push({ location, revision }); return true; });
 assert.equal(calls.length, 0); assert.equal(flow.confirmExact(), true); assert.equal(calls.length, 1);
 const publicPoint = derivePublicPropertyPoint(exact);
 assert.deepEqual(calls[0], { location: { exactLatitude: exact.latitude, exactLongitude: exact.longitude, publicLatitude: publicPoint.latitude, publicLongitude: publicPoint.longitude }, revision: 4 });
 assert.deepEqual(flow.getSnapshot().confirmedPoint, exact); assert.deepEqual(flow.getSnapshot().publicPoint, publicPoint); assert.equal(flow.getSnapshot().confirmedRevision, 4);
 assert.equal(flow.confirmExact(), false); assert.equal(calls.length, 1);
});
test('rejected stale-revision handoff cannot report successful confirmation', async () => {
 let calls = 0; const flow = await map(() => { calls++; return false; }); assert.equal(flow.confirmExact(), false);
 assert.equal(calls, 1); assert.equal(flow.getSnapshot().confirmedPoint, null); assert.equal(flow.getSnapshot().publicPoint, null);
});
for (const action of ['cancel', 'mapFailed', 'dispose'] as const) test(`${action} before confirmation supplies no coordinates`, async () => {
 let calls = 0; const flow = await map(() => { calls++; return true; }); flow[action](); assert.equal(flow.confirmExact(), false); assert.equal(calls, 0);
});
test('stale native callbacks after address revision cannot hand off a location', async () => {
 let calls = 0; const flow = await map(() => { calls++; return true; }); const token = flow.generationToken();
 flow.syncContext({ ...context, addressRevision: 5 }); assert.equal(flow.confirmExact(token), false); assert.equal(calls, 0); assert.equal(flow.getSnapshot().publicPoint, null);
});
test('reentrant context changes during handoff cannot restore an old confirmation', async () => {
 let flow: Awaited<ReturnType<typeof map>>; flow = await map(() => { flow.syncContext({ ...context, addressRevision: 5 }); return true; });
 assert.equal(flow.confirmExact(), false); assert.equal(flow.getSnapshot().confirmedPoint, null); assert.equal(flow.getSnapshot().publicPoint, null);
});
test('invalid derived point fails closed before the handoff callback', async () => {
 const file = resolve('src/features/property-listing/viewModels/propertyLocationWorkflow.ts'), actualRequire = createRequire(file), module = { exports: {} as any };
 const req = (name: string) => name.endsWith('/PropertyLocationPrivacy') ? { derivePublicPropertyPoint: () => ({ latitude: NaN, longitude: 121 }) } : actualRequire(name);
 new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(req, module, module.exports);
 let calls = 0; const flow = module.exports.createPropertyLocationWorkflow({ searchAddress: async () => [candidate], getMapStyleUrl: () => 'fixture-style' }, () => { calls++; return true; });
 await flow.open(context); flow.chooseCandidate(candidate.id); flow.mapLoaded(); assert.equal(flow.confirmExact(), false); assert.equal(calls, 0); assert.equal(flow.getSnapshot().confirmedPoint, null);
});
test('privacy rule is pure, deterministic and outside Views/services/GPS', () => {
 const source = readFileSync('src/features/property-listing/models/PropertyLocationPrivacy.ts', 'utf8');
 assert.doesNotMatch(source, /Math\.random|randomUUID|Date\.now|expo-location|fetch\(|console\.|supabase|from ['"]react/);
});


test('invalid candidates and geocoding failures cannot produce a complete handoff', async () => {
 let calls = 0;
 for (const searchAddress of [async () => [{ ...candidate, latitude: NaN }], async (): Promise<typeof candidate[]> => { throw Error('Private address'); }]) {
  const flow = createPropertyLocationWorkflow({ searchAddress, getMapStyleUrl: () => 'fixture-style' }, () => { calls++; return true; });
  await flow.open(context); flow.chooseCandidate(candidate.id); flow.mapLoaded(); assert.equal(flow.confirmExact(), false); assert.equal(flow.getSnapshot().publicPoint, null);
 }
 assert.equal(calls, 0);
});
test('Property Setup/Review readiness follows accepted four-coordinate state without rendering raw points', () => {
 const file = resolve('src/features/property-listing/views/PropertySetupView.tsx'), actualRequire = createRequire(file), module = { exports: {} as any };
 const req = (name: string): any => {
  if (name === 'react-native') return { View: 'View', Text: 'Text', StyleSheet: { create: (styles: any) => styles } };
  const component = ['PropertyLocationToolView', 'PropertyLocationMapView', 'FeedbackNotice', 'ListingWizardScaffold', 'ListingButton'].find(value => name.endsWith('/' + value));
  if (component) return { [component]: component };
  if (name.endsWith('/ListingControls')) return { ListingField: 'ListingField', ChoiceChip: 'ChoiceChip' };
  return actualRequire(name);
 };
 new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, module, module.exports);
 for (const step of ['address', 'review']) for (const accepted of [false, true]) {
  const publicPoint = derivePublicPropertyPoint(exact), draft = { ...emptyDraftProperty(), propertyType: 'studio', city: 'imus', barangay: 'Fixture barangay', addressLine1: 'Fixture street', ...(accepted ? { exactLatitude: exact.latitude, exactLongitude: exact.longitude, publicLatitude: publicPoint.latitude, publicLongitude: publicPoint.longitude } : {}) };
  const vm = { propertyState: { draft, step, loaded: true, busy: false, uncertain: false, error: null }, propertyCreation: {}, propertyLocation: { generationToken: () => 1 }, locationState: { stage: 'exactConfirmed', confirmedPoint: exact } };
  const tree = module.exports.PropertySetupView({ viewModel: vm, onClose: () => {} }); const texts: string[] = [], nodes: any[] = [];
  const visit = (node: any) => { if (typeof node === 'string') texts.push(node); if (!node || typeof node !== 'object') return; nodes.push(node); for (const child of [node.props?.children].flat(Infinity)) visit(child); }; visit(tree);
  const copy = texts.join(''); assert.match(copy, accepted ? /Approximate discovery location ready/ : /Waiting for location confirmation/); assert.match(copy, accepted ? /Confirmed on map/ : /Not confirmed yet/);
  assert.doesNotMatch(copy, /14\.5|121|awaiting.*privacy/i); assert.ok(!copy.includes(String(publicPoint.latitude))); assert.ok(!copy.includes(String(publicPoint.longitude)));
  if (step === 'review') assert.equal(nodes.find(node => node.props?.label === 'Confirm and save property').props.disabled, !accepted);
 }
});
