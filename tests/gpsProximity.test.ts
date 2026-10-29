/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGpsProximityWorkflow } from '../src/features/search-discovery/viewModels/gpsProximityWorkflow';
import { createGpsProximityService } from '../src/features/search-discovery/services/gpsProximityService';
import { createDeviceLocationAdapter } from '../src/shared/services/location/deviceLocationAdapter';
import { mapSearchNearbyListingsRpcResponse, toSearchNearbyListingsRpcParams } from '@rentlease/gps-local/rpc';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { readFileSync } from 'node:fs';

const coordinates = { latitude: 14.43, longitude: 120.94 };
const raw = (id = 1) => ({ listing_id: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`, property_id: '00000000-0000-0000-0000-000000000100', title: 'Real rental', asking_rent_monthly: '18500.50', property_type: 'studio', city: 'dasmarinas', barangay: 'Burol Main', available_from: null, public_latitude: 14.44, public_longitude: 120.95, distance_meters: '850.25' });
const mapped = (ids: number[]) => mapSearchNearbyListingsRpcResponse(ids.map(raw));
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };
function harness(search = async (_owner: string, _options: { offset?: number }) => mapped([1])) {
  let locations = 0, user = 'tenant'; const calls: { radiusKm?: number; offset?: number }[] = [];
  const flow = createGpsProximityWorkflow({ user: async () => user, locate: async () => { locations++; return { kind: 'granted' as const, coordinates }; }, search: async (owner, options) => { calls.push(options); return search(owner, options); }, settings: async () => {} });
  return { flow, calls, locations: () => locations, setUser: (value: string) => { user = value; } };
}
test('GPS construction and snapshots do not request permission or retain coordinates', () => {
  const h = harness(); assert.equal(h.locations(), 0); assert.deepEqual(h.calls, []); assert.equal(h.flow.getSnapshot().radiusKm, 3); assert.doesNotMatch(JSON.stringify(h.flow.getSnapshot()), /latitude|longitude/);
});
test('explicit start obtains one position and uses default page and radius', async () => {
  const h = harness(); await h.flow.start(); assert.equal(h.locations(), 1); assert.equal(h.calls.length, 1); assert.equal(h.calls[0]?.radiusKm, 3); assert.equal(h.calls[0]?.offset, 0); assert.equal(h.flow.getSnapshot().phase, 'success');
});
for (const radius of [1, 3, 5] as const) test(`radius ${radius} requests authoritative page zero without acquiring another position`, async () => {
  const h = harness(); await h.flow.start(); await h.flow.setRadius(radius); assert.equal(h.calls.at(-1)?.radiusKm, radius); assert.equal(h.calls.at(-1)?.offset, 0); assert.equal(h.locations(), 1);
});
test('invalid radius produces safe validation failure and no RPC', async () => {
  const h = harness(); await h.flow.start(); await assert.rejects(() => h.flow.setRadius(2)); assert.equal(h.calls.length, 1);
});
test('rapid explicit starts acquire just one position', async () => {
  const wait = deferred<ReturnType<typeof mapped>>(); const h = harness(async () => wait.promise); const first = h.flow.start(); await Promise.resolve(); await h.flow.start(); wait.resolve(mapped([1])); await first; assert.equal(h.locations(), 1); assert.equal(h.calls.length, 1);
});
test('pagination uses raw page count, deduplicates overlaps and retries failed page', async () => {
  let fail = true;
  const h = harness(async (_owner, options) => { if (options.offset === 0) return mapped(Array.from({ length: 20 }, (_, i) => i + 1)); if (fail) throw Error('raw private backend text'); return mapped([20, 21]); });
  await h.flow.start(); assert.equal(h.flow.getSnapshot().hasMore, true); await h.flow.loadMore(); assert.equal(h.flow.getSnapshot().rows.length, 20); assert.ok(h.flow.getSnapshot().error); fail = false; await h.flow.retry(); assert.equal(h.calls.at(-1)?.offset, 20); assert.equal(h.flow.getSnapshot().rows.length, 21); assert.equal(h.flow.getSnapshot().hasMore, false);
});
test('radius and new location reset pagination', async () => {
  const h = harness(async () => mapped(Array.from({ length: 20 }, (_, i) => i + 1))); await h.flow.start(); await h.flow.loadMore(); await h.flow.setRadius(5); assert.equal(h.calls.at(-1)?.offset, 0); await h.flow.start(); assert.equal(h.locations(), 2); assert.equal(h.calls.at(-1)?.offset, 0);
});
test('stale radius response cannot replace newer radius results', async () => {
  const wait = deferred<ReturnType<typeof mapped>>(); let count = 0; const h = harness(async () => ++count === 2 ? wait.promise : mapped([count])); await h.flow.start(); const old = h.flow.setRadius(1); await Promise.resolve(); await Promise.resolve(); await h.flow.setRadius(5); wait.resolve(mapped([2])); await old; assert.equal(h.flow.getSnapshot().radiusKm, 5); assert.equal(h.flow.getSnapshot().rows[0]?.listingId, raw(3).listing_id);
});
for (const action of ['reset', 'dispose'] as const) test(`${action} clears position and invalidates pending responses`, async () => {
  const wait = deferred<ReturnType<typeof mapped>>(); const h = harness(async () => wait.promise); const pending = h.flow.start(); await new Promise(r => setImmediate(r)); h.flow[action](); wait.resolve(mapped([1])); await pending; assert.deepEqual(h.flow.getSnapshot().rows, []); assert.equal(h.flow.getSnapshot().phase, 'idle');
});
test('account change rejects stale data and clears previous results', async () => {
  const wait = deferred<ReturnType<typeof mapped>>(); const h = harness(async () => wait.promise); const pending = h.flow.start(); await new Promise(r => setImmediate(r)); h.setUser('another'); wait.resolve(mapped([1])); await pending; assert.deepEqual(h.flow.getSnapshot().rows, []); assert.match(h.flow.getSnapshot().error?.message ?? '', /account|Sign in/i);
});
test('empty authoritative response is successful, never replaced by fixtures', async () => {
  const h = harness(async () => []); await h.flow.start(); assert.equal(h.flow.getSnapshot().phase, 'success'); assert.deepEqual(h.flow.getSnapshot().rows, []); assert.equal(h.flow.getSnapshot().hasMore, false);
});
for (const kind of ['denied', 'blocked', 'services_disabled', 'position_failed'] as const) test(`${kind} never calls RPC and permits a fresh attempt`, async () => {
  let calls = 0; const f = createGpsProximityWorkflow({ user: async () => 'tenant', locate: async () => ({ kind }), search: async () => { calls++; return []; }, settings: async () => {} }); await f.start(); assert.equal(calls, 0); assert.equal(f.getSnapshot().error?.kind, kind); f.reset(); assert.equal(f.getSnapshot().phase, 'idle');
});
function device(granted = true, canAskAgain = true, enabled = true) {
  const events: string[] = [];
  const adapter = createDeviceLocationAdapter({ permission: async () => { events.push('permission'); return { granted, canAskAgain }; }, enabled: async () => { events.push('services'); return enabled; }, position: async () => { events.push('position'); return coordinates; } });
  return { adapter, events };
}
test('device adapter is inert until explicit call; granted takes one position', async () => { const d = device(); assert.deepEqual(d.events, []); const result = await d.adapter(); assert.equal(result.kind, 'granted'); assert.deepEqual(d.events, ['permission', 'services', 'position']); });
for (const blocked of [false, true]) test(`device denial blocked=${blocked} skips position`, async () => { const d = device(false, !blocked); assert.equal((await d.adapter()).kind, blocked ? 'blocked' : 'denied'); assert.deepEqual(d.events, ['permission']); });
test('disabled location services never acquire a position', async () => { const d = device(true, true, false); assert.equal((await d.adapter()).kind, 'services_disabled'); assert.ok(!d.events.includes('position')); });
test('device cancellation after permission prevents position acquisition', async () => {
  const controller = new AbortController(); const d = createDeviceLocationAdapter({ permission: async () => { controller.abort(); return { granted: true, canAskAgain: true }; }, enabled: async () => true, position: async () => { throw Error('should not run'); } }); assert.equal((await d(controller.signal)).kind, 'cancelled');
});
test('invalid device coordinate is a safe failure', async () => { const d = createDeviceLocationAdapter({ permission: async () => ({ granted: true, canAskAgain: true }), enabled: async () => true, position: async () => ({ latitude: NaN, longitude: 120 }) }); assert.deepEqual(await d(), { kind: 'position_failed' }); });
test('one-shot location timeout is safe and discards a late position', async () => {
  const pending = deferred<typeof coordinates>();
  const d = createDeviceLocationAdapter({ permission: async () => ({ granted: true, canAskAgain: true }), enabled: async () => true, position: () => pending.promise }, 1);
  assert.deepEqual(await d(), { kind: 'position_failed' }); pending.resolve(coordinates);
});
test('a late settings failure cannot populate a reset search', async () => {
  const pending = deferred<void>();
  const f = createGpsProximityWorkflow({ user: async () => 'tenant', locate: async () => ({ kind: 'denied' }), search: async () => [], settings: async () => { await pending.promise; throw Error('settings failure'); } });
  const opening = f.openSettings(); f.reset(); pending.resolve(); await opening; assert.equal(f.getSnapshot().phase, 'idle');
});
function transport(data: unknown, error: unknown = null) {
  let owner = 'tenant'; const calls: unknown[][] = [];
  const client = { auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null }, error: null }) }, rpc: (name: string, params: unknown) => { calls.push([name, params]); return { abortSignal: async () => ({ data, error }) }; } } as unknown as SupabaseClient<Database>;
  return { service: createGpsProximityService(() => client), calls, user: (value: string) => { owner = value; } };
}
test('production adapter exact payload, server order and decimal distance preserved', async () => {
  const t = transport([raw(2), raw(1)]); const rows = await t.service.search('tenant', { ...coordinates, radiusKm: 3, limit: 20, offset: 0 }); assert.deepEqual(t.calls, [['search_nearby_listings', toSearchNearbyListingsRpcParams(coordinates)]]); assert.deepEqual(rows.map(r => r.listingId), [raw(2).listing_id, raw(1).listing_id]); assert.equal(rows[0]?.distanceMeters, '850.25'); assert.equal(rows[0]?.askingRentMonthly, '18500.50');
});
test('malformed response rejects whole page', async () => { const t = transport([raw(), { ...raw(2), distance_meters: -1 }]); await assert.rejects(() => t.service.search('tenant', coordinates), /response|results/i); });
for (const code of ['42501', '28000', 'XX000']) test(`RPC ${code} is safe and actionable`, async () => { const t = transport(null, { code, message: 'secret coordinate payload' }); await assert.rejects(() => t.service.search('tenant', coordinates), e => { assert.doesNotMatch(String(e), /secret|payload/); return /42501/.test(code) ? /Tenant.*Tier 1/.test(String(e)) : true; }); });
test('signed out or changed account does not issue RPC', async () => { const t = transport([]); t.user(''); await assert.rejects(() => t.service.search('tenant', coordinates)); t.user('another'); await assert.rejects(() => t.service.search('tenant', coordinates)); assert.deepEqual(t.calls, []); });
test('production source excludes local simulation, persistence and coordinate logging', () => {
  for (const path of ['services/gpsProximityService.ts', 'viewModels/gpsProximityWorkflow.ts']) { const source = readFileSync(`src/features/search-discovery/${path}`, 'utf8'); assert.doesNotMatch(source, /gps-local\/local|haversine|AsyncStorage|console\.|analytics/); }
});
