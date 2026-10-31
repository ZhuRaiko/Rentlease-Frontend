import { propertyCreationDiagnostic } from '../src/features/property-listing/services/propertyCreationDiagnostics';
/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { propertyValidationIssues, propertyFloorConfiguration, propertyFloorIssues, draftPropertyError, emptyDraftProperty, propertySetupPayload, propertyCreationInput, propertyTypeOptions } from '../src/features/property-listing/models/DraftProperty';
import { createPropertyCreationService, type PropertyCreationService } from '../src/features/property-listing/services/propertyCreationService';
import { derivePublicPropertyPoint } from '../src/features/property-listing/models/PropertyLocationPrivacy';
import { createPropertyLocationWorkflow } from '../src/features/property-listing/viewModels/propertyLocationWorkflow';
import { hasConfirmedPropertyLocation } from '../src/features/property-listing/models/DraftProperty';
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
  const diagnostics:unknown[]=[]; const service = createPropertyCreationService(() => client, journal,event=>diagnostics.push(event));
  return { service, journal, values, reads, diagnostics, access: (a: boolean, t: boolean, l: boolean) => { active = a; tierOne = t; landlord = l; }, storageFails: (v: boolean) => { storageFails = v; }, calls: () => rpcCalls, payload: () => payload, setResult: (v: unknown) => { result = v; }, setError: (v: unknown) => { rpcError = v; }, setUser: (v: string) => { userId = v; }, delay: (v: Promise<void>) => { wait = v; } };
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
  for (const draft of [{ ...validDraft(), bedrooms: '1.2' }, { ...validDraft(), bathrooms: 'NaN' }, { ...validDraft(), floorAreaSqm: '-1' }, { ...validDraft(), exactLatitude: 91 }, { ...validDraft(), amenityIds: [-1] }]) assert.ok(draftPropertyError(draft));
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
  // Location errors are rendered from the shared validation metadata.
  assert.match(view, /feedback\('location'\)/);
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


test('normal confirmed map path supplies exact/private and generalized/public values to the unchanged property RPC', async () => {
  const backend = serviceHarness(), creation = createPropertyCreationWorkflow(backend.service); await creation.initialize();
  creation.updateField('propertyType', 'studio'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Synthetic barangay'); creation.updateField('addressLine1', 'Synthetic street'); creation.updateField('addressLine2', 'Unit 2'); creation.updateField('accessInstructions', 'Private fixture entrance'); creation.updateField('bedrooms', '2'); creation.updateField('bathrooms', '1.5'); creation.updateField('floorAreaSqm', '40');
  const exact = { latitude: 14.5, longitude: 121 }, revision = creation.getSnapshot().locationRevision;
  const location = createPropertyLocationWorkflow({ searchAddress: async () => [{ ...exact, id: 'fixture', label: 'Synthetic candidate' }], getMapStyleUrl: () => 'fixture-style' }, (point, confirmedRevision) => {
    assert.equal(confirmedRevision, creation.getSnapshot().locationRevision); creation.provideConfirmedLocation(point, confirmedRevision); return creation.locationReady();
  });
  await location.open({ addressRevision: revision, setupId: 'fixture', query: 'Synthetic address' }); location.chooseCandidate('fixture'); location.mapLoaded(); assert.equal(location.confirmExact(), true);
  const complete = creation.getSnapshot().draft; assert.ok(hasConfirmedPropertyLocation(complete)); assert.equal(draftPropertyError(complete), null);
  const publicPoint = derivePublicPropertyPoint(exact), payload = propertySetupPayload(propertyCreationInput(complete));
  assert.equal(payload.p_exact_lat, exact.latitude); assert.equal(payload.p_exact_lng, exact.longitude); assert.equal(payload.p_public_lat, publicPoint.latitude); assert.equal(payload.p_public_lng, publicPoint.longitude);
  assert.equal(payload.p_bedrooms, 2); assert.equal(payload.p_floor_area_sqm, 40); assert.equal(complete.accessInstructions, 'Private fixture entrance');
  assert.equal(backend.calls(), 0); creation.next(); creation.next(); await creation.submit();
  assert.equal(backend.calls(), 1); assert.deepEqual(backend.payload(), payload); assert.equal(creation.getSnapshot().propertyId, propertyId); assert.equal(creation.getSnapshot().step, 'created');
});

for (const [message, expected] of [['Landlord role required', /Landlord/], ['Tier 1 verification required', /Tier 1/], ['Barangay is required', /barangay/i], ['Address line 1 is required', /address line 1/i], ['Property coordinates are required', /confirm.*location/i], ['Invalid latitude', /confirm.*location/i], ['One or more amenities are invalid or inactive', /amenit/i]] as const) test(`known property rejection is actionable: ${message}`,async()=>{const h=serviceHarness();h.setError({code:'22023',message});const flow=createPropertyCreationWorkflow(h.service);await flow.initialize();const d=validDraft();for(const key of ['propertyType','city','barangay','addressLine1'] as const)flow.updateField(key,d[key]);flow.provideConfirmedLocation(location,flow.getSnapshot().locationRevision);await flow.submit(true);assert.match(flow.getSnapshot().error??'',expected);assert.equal(flow.getSnapshot().uncertain,false);assert.equal(h.calls(),1);assert.equal(h.values.size,0);});
test('real selected amenity IDs reach property RPC and duplicate/invalid IDs are rejected',async()=>{const h=serviceHarness();await h.service.create('owner',{...validDraft(),amenityIds:[4,19]});assert.deepEqual((h.payload() as any).p_amenity_ids,[4,19]);for(const amenityIds of [[-1],[1.5],[NaN],[4,4]])assert.ok(draftPropertyError({...validDraft(),amenityIds}));});

for(const [a,t,l,message] of [[false,true,true,/active account/i],[true,false,true,/Tier 1/],[true,true,false,/Landlord/]] as const)test('preflight account eligibility gives safe error and sends no RPC: '+message,async()=>{const h=serviceHarness();h.access(a,t,l);await assert.rejects(h.service.create('owner',validDraft()),message);assert.equal(h.calls(),0);assert.equal(h.values.size,0);assert.equal((h.diagnostics.at(-1) as any).rpcSent,false);});
test('property diagnostics omit raw backend message, coordinates and user objects',async()=>{const h=serviceHarness();h.setError({code:'42501',message:'PRIVATE ADDRESS token=secret'});await assert.rejects(h.service.create('owner',validDraft()));assert.deepEqual(h.diagnostics.at(-1),{stage:'rpc',code:'42501',classification:'backend_permission',rpcSent:true,operation:'create_property_setup',outcome:'confirmed_failed',message:'insufficient_privilege',details:'absent'});assert.deepEqual(propertyCreationDiagnostic('rpc',{code:'token=secret',message:'private',latitude:14},true,'transport_unknown'),{stage:'rpc',code:'unknown',classification:'transport_unknown',rpcSent:true,operation:'create_property_setup',outcome:'uncertain',message:'backend_message_redacted',details:'absent'});});
test('invalid receipt and local journal error have distinct safe stages',async()=>{const bad=serviceHarness();bad.setResult({});await assert.rejects(bad.service.create('owner',validDraft()));assert.equal((bad.diagnostics.at(-1) as any).stage,'receipt');assert.ok(bad.values.size);const disk=serviceHarness();disk.storageFails(true);await assert.rejects(disk.service.create('owner',validDraft()));assert.equal(disk.calls(),0);assert.equal((disk.diagnostics.at(-1) as any).stage,'journal');});


test('property SQL rejection diagnostics identify safe constraint without exposing failing row details', async () => {
  const h=serviceHarness();
  h.setError({code:'23514',message:'new row violates check constraint "properties_floor_numbers"',details:'Failing row contains PRIVATE ADDRESS token=secret 14.4291'});
  await assert.rejects(h.service.create('owner',validDraft()));
  const event=h.diagnostics.at(-1) as any;
  assert.equal(event.operation,'create_property_setup');
  assert.equal(event.stage,'rpc'); assert.equal(event.rpcSent,true);
  assert.equal(event.outcome,'confirmed_failed');
  assert.equal(event.message,'check_constraint_violation');
  assert.equal(event.constraint,'properties_floor_numbers');
  assert.equal(event.details,'redacted');
  assert.doesNotMatch(JSON.stringify(event),/PRIVATE|secret|14\.4291|Failing row/);
  assert.equal(h.values.size,0);
});

test('unknown property transport keeps durable marker and reports uncertain rather than confirmed failure', async () => {
  const h=serviceHarness(); h.setError({code:'',message:'Network lost PRIVATE ADDRESS'});
  await assert.rejects(h.service.create('owner',validDraft()),{code:'property_creation_uncertain'});
  assert.equal((h.diagnostics.at(-1) as any).outcome,'uncertain');
  assert.ok(h.values.size); assert.equal(h.calls(),1);
  await assert.rejects(h.service.create('owner',validDraft())); assert.equal(h.calls(),1);
});


for(const [floorNumber,totalFloors] of [['2','5'],['5','5'],['0','1'],['',''],['2',''],['','5'],['  ','5']] as const)test(`optional floor mapping preserves ${JSON.stringify([floorNumber,totalFloors])}`,()=>{
  const payload=propertySetupPayload({...validDraft(),floorNumber,totalFloors});
  assert.equal(payload.p_floor_number,floorNumber.trim()?Number(floorNumber):undefined);assert.equal(payload.p_total_floors,totalFloors.trim()?Number(totalFloors):undefined);
});

test('floor relationship errors are immediate and independent of other incomplete property fields',()=>{
  const issues=propertyFloorIssues({...emptyDraftProperty(),floorNumber:'6',totalFloors:'5'});
  assert.match(issues.floorNumber??'',/cannot be higher/);assert.equal(issues.floorNumber,issues.totalFloors);
  assert.equal(propertyFloorIssues({...emptyDraftProperty(),floorNumber:'2',totalFloors:'5'}).floorNumber,null);
});

test('invalid floor pair is blocked before journal and RPC, retains values, and corrected retry creates only once',async()=>{
  const backend=serviceHarness(),flow=createPropertyCreationWorkflow(backend.service);await flow.initialize();
  for(const key of ['propertyType','city','barangay','addressLine1','floorNumber','totalFloors'] as const)flow.updateField(key,({...validDraft(),floorNumber:'6',totalFloors:'5'})[key]);
  flow.provideConfirmedLocation(location,flow.getSnapshot().locationRevision);await flow.submit(true);
  assert.match(flow.getSnapshot().error??'',/cannot be higher/);assert.equal(flow.getSnapshot().draft.floorNumber,'6');assert.equal(flow.getSnapshot().draft.totalFloors,'5');assert.equal(flow.getSnapshot().draft.addressLine1,validDraft().addressLine1);assert.equal(backend.calls(),0);assert.equal(backend.values.size,0);
  await assert.rejects(backend.service.create('owner',{...validDraft(),floorNumber:'6',totalFloors:'5'}),/cannot be higher/);assert.equal(backend.calls(),0);
  flow.updateField('floorNumber','2');await Promise.all([flow.submit(true),flow.submit(true)]);await flow.submit(true);assert.equal(backend.calls(),1);assert.equal((backend.payload() as any).p_floor_number,2);assert.equal((backend.payload() as any).p_total_floors,5);assert.equal(flow.getSnapshot().propertyId,propertyId);
});


for(const [field,value] of [['bathrooms','999.95'],['floorAreaSqm','0.001'],['floorAreaSqm','100000000']] as const)test(`numeric storage rejection is caught before RPC: ${field}=${value}`,async()=>{
  const h=serviceHarness();await assert.rejects(h.service.create('owner',{...validDraft(),[field]:value}));assert.equal(h.calls(),0);assert.equal(h.values.size,0);
});
test('numeric values that remain within backend scale/range keep their original payload mapping',()=>{const p=propertySetupPayload({...validDraft(),bathrooms:'999.94',floorAreaSqm:'0.005'});assert.equal(p.p_bathrooms,999.94);assert.equal(p.p_floor_area_sqm,0.005);});


test('known floor CHECK rejection remains safe and actionable if returned by the backend',async()=>{
  const h=serviceHarness();h.setError({code:'23514',message:'new row violates check constraint "properties_floor_numbers"',details:'PRIVATE ROW'});
  await assert.rejects(h.service.create('owner',validDraft()),/property floor cannot be higher/);assert.equal(h.values.size,0);
});


test('whole house uses building stories and excludes the remembered unit floor from validation and RPC',()=>{
  const house={...validDraft(),propertyType:'house' as const,floorNumber:'8',totalFloors:'2'};
  assert.equal(draftPropertyError(house),null);const payload=propertySetupPayload(house);assert.equal(payload.p_floor_number,undefined);assert.equal(payload.p_total_floors,2);assert.equal(house.floorNumber,'8');
  const optional=propertySetupPayload({...house,totalFloors:''});assert.equal(optional.p_floor_number,undefined);assert.equal(optional.p_total_floors,undefined);
  assert.equal(propertyFloorConfiguration('house').showFloor,false);assert.match(propertyFloorConfiguration('house').totalLabel,/stories/);
  assert.match(draftPropertyError({...house,propertyType:'apartment'})??'',/cannot be higher/);assert.equal(house.floorNumber,'8');
});
for(const type of ['apartment','condominium','room','bedspace','studio','boarding_house','dormitory','other'] as const)test(`contextual floor mapping retains optional backend fields for ${type}`,()=>{
  const config=propertyFloorConfiguration(type);assert.equal(config.showFloor,true);assert.ok(config.floorLabel);const payload=propertySetupPayload({...validDraft(),propertyType:type,floorNumber:'2',totalFloors:'5'});assert.equal(payload.p_floor_number,2);assert.equal(payload.p_total_floors,5);
});
test('one validation metadata set exposes missing required sections separately from inconsistent optional floors',()=>{
  const issues=propertyValidationIssues({...emptyDraftProperty(),floorNumber:'8',totalFloors:'2'});assert.ok(issues.some(i=>i.section==='floors'&&i.kind==='invalid'));assert.ok(issues.some(i=>i.field==='barangay'&&i.kind==='required'));assert.ok(issues.some(i=>i.field==='propertyType'));assert.equal(new Set(issues.filter(i=>i.section==='floors').map(i=>i.message)).size,1);
});
