/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { draftPropertyError, emptyDraftProperty, propertySetupPayload, propertyCreationInput, propertyTypeOptions } from '../src/features/property-listing/models/DraftProperty';
import { createPropertyCreationService, type PropertyCreationService } from '../src/features/property-listing/services/propertyCreationService';
import { createPropertyCreationWorkflow } from '../src/features/property-listing/viewModels/propertyCreationWorkflow';
const propertyId = 'a0000000-0000-4000-8000-000000000001';
// Test fixtures only; production coordinates must come from the separate location workflow.
const location = { exactLatitude: 14.4291, exactLongitude: 120.9367, publicLatitude: 14.43, publicLongitude: 120.94 };
const validDraft = () => ({ ...emptyDraftProperty(), propertyType: 'studio' as const, city: 'imus' as const, barangay: 'Example barangay', addressLine1: 'Example street', ...location, bedrooms: '1', bathrooms: '1.5', floorAreaSqm: '32', floorNumber: '2', totalFloors: '3', maxOccupants: '2', addressLine2: 'Unit 2', postalCode: '4103', accessInstructions: 'Side entrance' });
function serviceHarness() {
  let active = true, tierOne = true, landlord = true;
  let userId = 'owner', result: unknown = { property_id: propertyId, status: 'created' }, rpcError: unknown = null;
  let storageFails = false;
  let rpcCalls = 0, payload: unknown = null, wait: Promise<void> | null = null;
  const values = new Map<string, string>();
  const reads: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table: string) {
      reads.push(table);
      const data = table === 'profiles' ? { account_status: active ? 'active' : 'restricted', tier1_verified_at: tierOne ? 'date' : null } : table === 'user_roles' ? [{ role: landlord ? 'landlord' : 'tenant' }] : { id: propertyId, landlord_id: userId, property_type: 'studio', city: 'imus', barangay: 'Example barangay', created_at: '2026-10-23T00:00:00Z' };
      const query = { select: (_: string) => query, eq: (_: string, __: unknown) => query, order: (_: string, __: unknown) => query, limit: (_: number) => query, maybeSingle: async () => ({ data, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: table === 'properties' ? [data] : data, error: null })) };
      return query;
    },
    async rpc(name: string, args: unknown) { assert.equal(name, 'create_property_setup'); rpcCalls++; payload = args; if (wait) await wait; return { data: result, error: rpcError }; },
  } as unknown as SupabaseClient<Database>;
  const journal = { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { if (storageFails) throw Error('local storage unavailable'); values.set(k, v); }, removeItem: async (k: string) => { values.delete(k); } };
  const service = createPropertyCreationService(() => client, journal);
  return { service, journal, values, reads, access: (a: boolean, t: boolean, l: boolean) => { active = a; tierOne = t; landlord = l; }, storageFails: (v: boolean) => { storageFails = v; }, calls: () => rpcCalls, payload: () => payload, setResult: (v: unknown) => { result = v; }, setError: (v: unknown) => { rpcError = v; }, setUser: (v: string) => { userId = v; }, delay: (v: Promise<void>) => { wait = v; } };
}
function workflowHarness() {
  let calls = 0, userId = 'owner', wait: Promise<void> | null = null;
  let error: unknown = null;
  const service = {
    getEligibleUserId: async () => userId,
    assertIdentity: async (id: string) => { if (id !== userId) throw Object.assign(new Error('Changed'), { code: 'property_identity_changed' }); },
    restore: async () => null,
    create: async (_: string, __: unknown) => { calls++; if (wait) await wait; if (error) throw error; return { propertyId, status: 'created' as const }; },
    recentOwned: async () => [], confirmOwned: async () => ({ propertyId, status: 'created' as const }), beginNew: async () => {},
  } satisfies PropertyCreationService;
  const flow = createPropertyCreationWorkflow(service);
  const ready = async () => {
    await flow.initialize();
    const d = validDraft();
    const { exactLatitude, exactLongitude, publicLatitude, publicLongitude, ...fields } = d;
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) flow.updateField(key, fields[key]);
    flow.provideConfirmedLocation({ exactLatitude, exactLongitude, publicLatitude, publicLongitude }, flow.getSnapshot().locationRevision);
    flow.next(); flow.next();
    assert.equal(flow.getSnapshot().step, 'review');
  };
  return { flow, ready, calls: () => calls, delay: (v: Promise<void>) => { wait = v; }, fail: (v: unknown) => { error = v; }, switchAccount: () => { userId = 'another'; } };
}

test('physical property payload sends exact RPC arguments, backend enums, separate points and floor area', async () => {
  const h = serviceHarness(); await h.service.create('owner', validDraft());
  const p = h.payload() as Record<string, unknown>;
  assert.equal(p.p_property_type, 'studio'); assert.equal(p.p_city, 'imus'); assert.equal(p.p_furnishing_status, 'unfurnished');
  assert.equal(p.p_floor_area_sqm, 32); assert.equal(p.p_bathrooms, 1.5); assert.equal(p.p_floor_number, 2);
  assert.equal(p.p_exact_lat, location.exactLatitude); assert.equal(p.p_public_lat, 14.43);
  assert.deepEqual(p.p_amenity_ids, []); assert.equal(p.p_address_line_2, 'Unit 2');
  assert.ok(!('landlord_id' in p) && !('p_landlord_id' in p) && !('landArea' in p));
  assert.ok(!h.reads.includes('property_private_locations'));
});
test('all nine backend property types are explicit; preview labels are rejected before RPC', () => {
  assert.deepEqual(propertyTypeOptions.map(o => o.value), ['apartment', 'boarding_house', 'bedspace', 'room', 'studio', 'condominium', 'house', 'dormitory', 'other']);
  assert.throws(() => propertySetupPayload({ ...validDraft(), propertyType: 'Studio apartment' as never }), /supported property type/);
});
test('missing public location is a real blocker and never copies the exact point', () => {
  const d = { ...validDraft(), publicLatitude: null };
  assert.match(draftPropertyError(d) ?? '', /Confirm the property location/);
  assert.equal(draftPropertyError(d, false), null);
  assert.throws(() => propertyCreationInput(d), /Confirm the property location/);
  assert.equal(d.publicLatitude, null);
});
test('invalid numeric/domain/geocoding inputs are not sent', () => {
  for (const draft of [{ ...validDraft(), bedrooms: '1.2' }, { ...validDraft(), bathrooms: 'NaN' }, { ...validDraft(), floorAreaSqm: '-1' }, { ...validDraft(), exactLatitude: 91 }, { ...validDraft(), amenityIds: [123] }]) assert.ok(draftPropertyError(draft));
});
test('confirmed receipt is restored without a second create and retained for later workflows', async () => {
  const h = serviceHarness(); const first = await h.service.create('owner', validDraft());
  assert.equal(first.propertyId, propertyId); assert.deepEqual(await h.service.create('owner', validDraft()), first);
  assert.equal(h.calls(), 1); assert.equal((await h.service.restore('owner'))?.propertyId, propertyId);
});
test('unexpected RPC responses remain uncertain and block a blind retry after remount', async () => {
  for (const value of [null, [], {}, { status: 'created', property_id: 'sample-id' }, { status: 'published', property_id: propertyId }]) {
    const h = serviceHarness(); h.setResult(value);
    await assert.rejects(h.service.create('owner', validDraft()), { code: 'property_creation_uncertain' });
    await assert.rejects(h.service.create('owner', validDraft()), { code: 'property_creation_uncertain' });
    assert.equal(h.calls(), 1);
  }
});
test('uncertain network result leaves a durable guard; validation rejection allows an explicit corrected attempt', async () => {
  const unknown = serviceHarness(); unknown.setError({ code: '', message: 'private server detail' });
  await assert.rejects(unknown.service.create('owner', validDraft()), { code: 'property_creation_uncertain' });
  await assert.rejects(unknown.service.beginNew('owner')); assert.equal(unknown.calls(), 1);
  const rejected = serviceHarness(); rejected.setError({ code: '22023', message: 'raw private detail' });
  await assert.rejects(rejected.service.create('owner', validDraft()), e => e instanceof Error && !e.message.includes('raw private'));
  assert.equal(rejected.values.size, 0); rejected.setError(null);
  assert.equal((await rejected.service.create('owner', validDraft())).propertyId, propertyId);
});
test('service checks current identity and no Tier 3 prerequisite', async () => {
  const h = serviceHarness(); h.setUser('another');
  await assert.rejects(h.service.create('owner', validDraft())); assert.equal(h.calls(), 0);
  const source = readFileSync('src/features/property-listing/services/propertyCreationService.ts', 'utf8');
  assert.doesNotMatch(source, /tier3_verified_at|is_tier3|\.insert\(/);
  assert.match(source, /eq\('landlord_id', userId\)/);
});
test('workflow requires explicit review confirmation and saves the real property UUID once', async () => {
  const h = workflowHarness(); await h.flow.initialize(); await h.flow.submit(); assert.equal(h.calls(), 0);
  await h.ready(); await h.flow.submit(); assert.equal(h.flow.getSnapshot().propertyId, propertyId);
  await h.flow.submit(); h.flow.back(); await h.flow.submit(); assert.equal(h.calls(), 1);
});
test('rapid submit taps cannot send simultaneous property creation requests', async () => {
  const h = workflowHarness(); await h.ready();
  let release!: () => void; h.delay(new Promise<void>(resolve => { release = resolve; }));
  const pending = h.flow.submit(); await Promise.resolve(); await Promise.resolve();
  await h.flow.submit(); assert.equal(h.calls(), 1); release(); await pending; assert.equal(h.calls(), 1);
});
test('unmount and account switching invalidate delayed creation responses', async () => {
  for (const change of ['dispose', 'account']) {
    const h = workflowHarness(); await h.ready();
    let release!: () => void; h.delay(new Promise<void>(resolve => { release = resolve; }));
    const pending = h.flow.submit(); await Promise.resolve(); await Promise.resolve();
    if (change === 'dispose') h.flow.dispose(); else h.switchAccount();
    release(); await pending; assert.equal(h.flow.getSnapshot().propertyId, null);
    if (change === 'account') assert.equal(h.flow.getSnapshot().draft.addressLine1, '');
  }
});
test('workflow never displays fake success or blindly retries after an uncertain creation', async () => {
  const h = workflowHarness(); await h.ready(); h.fail(Object.assign(new Error('raw server error'), { code: 'property_creation_uncertain' }));
  await h.flow.submit(); assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().propertyId, null);
  assert.doesNotMatch(h.flow.getSnapshot().error ?? '', /raw server/);
  await h.flow.submit(); assert.equal(h.calls(), 1);
});
test('future confirmed location preserves all four inputs and rejects stale address results', async () => {
  const h = workflowHarness(); await h.ready(); h.flow.back();
  const revision = h.flow.getSnapshot().locationRevision;
  h.flow.updateField('addressLine1', 'A corrected street');
  const draft = h.flow.getSnapshot().draft;
  for (const key of Object.keys(location) as (keyof typeof location)[]) assert.equal(draft[key], null);
  h.flow.provideConfirmedLocation(location, revision);
  assert.equal(h.flow.locationReady(), false);
  h.flow.provideConfirmedLocation(location, h.flow.getSnapshot().locationRevision);
  for (const key of Object.keys(location) as (keyof typeof location)[]) assert.equal(h.flow.getSnapshot().draft[key], location[key]);
  assert.equal(h.flow.locationReady(), true); assert.equal(h.calls(), 0);
});
test('property setup views bind the ViewModel only and preserve guarded local navigation', () => {
  const view = readFileSync('src/features/property-listing/views/PropertySetupView.tsx', 'utf8');
  assert.doesNotMatch(view, /getSupabaseClient|supabase|\.rpc\(|geocodeAddress\(/);
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /propertyCreation.dirty\(\)/); assert.match(vm, /propertyCreation.getSnapshot\(\).busy/);
  assert.match(vm, /navigation.requestNavigation/);
});

test('explicit uncertain-outcome reconciliation confirms ownership and never sends a replacement create', async () => {
  const h = serviceHarness(); h.setError({ code: '', message: 'Response lost' });
  await assert.rejects(h.service.create('owner', validDraft()));
  const recent = await h.service.recentOwned('owner'); assert.equal(recent.length, 1);
  await assert.rejects(h.service.confirmOwned('owner', 'b0000000-0000-4000-8000-000000000002'));
  const receipt = await h.service.confirmOwned('owner', recent[0]!.id);
  assert.equal(receipt.propertyId, propertyId); assert.equal(h.calls(), 1);
  assert.equal((await h.service.restore('owner'))?.propertyId, propertyId);
});
test('an in-flight service request cannot be duplicated by another workflow in the same app process', async () => {
  const h = serviceHarness(); let release!: () => void;
  h.delay(new Promise<void>(resolve => { release = resolve; }));
  const pending = h.service.create('owner', validDraft());
  await assert.rejects(h.service.create('owner', validDraft()), { code: 'property_creation_uncertain' });
  release(); await pending; assert.equal(h.calls(), 1);
});

test('property creation persistence stays separate from dedicated location integration', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  const view = readFileSync('src/features/property-listing/views/PropertySetupView.tsx', 'utf8');
  const creation = readFileSync('src/features/property-listing/viewModels/propertyCreationWorkflow.ts', 'utf8');
  assert.doesNotMatch(creation, /geocodeAddress|geocodingService|MapTiler|searchAddress|chooseCandidate/);
  assert.doesNotMatch(view, /fetch\(|geocodeAddress\(/);
  assert.match(vm, /createPropertyLocationWorkflow/);
  assert.match(view, /propertyLocationNotice/);
  assert.doesNotMatch(view, /updateField\(['"](?:exact|public)(?:Latitude|Longitude)/);
});

test('failure to persist the pre-send journal prevents any remote creation', async () => {
  const h = serviceHarness(); h.storageFails(true);
  await assert.rejects(h.service.create('owner', validDraft())); assert.equal(h.calls(), 0);
  h.storageFails(false); assert.equal((await h.service.create('owner', validDraft())).propertyId, propertyId);
});
test('missing location leaves review available with no error and no backend write', async () => {
  const h = workflowHarness(); await h.ready(); h.flow.back();
  h.flow.updateField('barangay', 'Updated barangay'); h.flow.next();
  assert.equal(h.flow.getSnapshot().step, 'review');
  await h.flow.submit();
  assert.equal(h.flow.getSnapshot().error, null); assert.equal(h.calls(), 0);
  assert.equal(h.flow.getSnapshot().propertyId, null);
  assert.equal(h.flow.getSnapshot().draft.addressLine1, 'Example street');
});

test('UX eligibility refuses restricted, non-Tier-1 and non-Landlord accounts without checking Tier 3', async () => {
  for (const [active, tierOne, landlord] of [[false, true, true], [true, false, true], [true, true, false]] as const) {
    const h = serviceHarness(); h.access(active, tierOne, landlord);
    await assert.rejects(h.service.create('owner', validDraft())); assert.equal(h.calls(), 0);
  }
});
