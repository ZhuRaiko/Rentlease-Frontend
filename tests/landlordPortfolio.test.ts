/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { assemblePortfolio, currentPortfolioListing, filterPortfolio, portfolioStats, portfolioListingLabels, portfolioTierLabels, PortfolioError, type PortfolioProperty, type PortfolioListing, type PortfolioVerification } from '../src/features/property-listing/models/LandlordPortfolio';
import { createLandlordPortfolioService } from '../src/features/property-listing/services/landlordPortfolioService';
import { portfolioDiagnostic, type PortfolioDiagnostic } from '../src/features/property-listing/services/portfolioDiagnostics';
import { createLandlordPortfolioWorkflow } from '../src/features/property-listing/viewModels/landlordPortfolioWorkflow';
const owner = '10000000-0000-4000-8000-000000000001', property = '20000000-0000-4000-8000-000000000001', photo = '30000000-0000-4000-8000-000000000001';
const p: PortfolioProperty = { id: property, landlord_id: owner, property_type: 'apartment', city: 'imus', barangay: 'Buhay na Tubig', bedrooms: 1, bathrooms: 1, floor_area_sqm: 30, floor_number: 3, total_floors: 8, max_occupants: 4, furnishing_status: 'unfurnished', is_active: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' };
const listing = (status: PortfolioListing['status'], id = '40000000-0000-4000-8000-000000000001'): PortfolioListing => ({ id, property_id: property, landlord_id: owner, title: 'Sunny rental', description: 'Description', asking_rent_monthly: 12000, house_rules: null, rental_term: 'long_term', security_deposit_months: 1, advance_rent_months: 1, minimum_stay_months: null, available_from: null, status, completeness_score: 0.8, published_at: '2026-10-28T00:00:00Z', paused_at: null, archived_at: null, removed_at: null, removal_reason: null, created_at: p.created_at, updated_at: p.updated_at });
const verification = (status: PortfolioVerification['status']): PortfolioVerification => ({ id: 'v', user_id: owner, property_id: property, tier: 'tier_3_property', status, submitted_at: p.created_at, updated_at: p.updated_at });
function serviceHarness() {
  let user: string | null = owner, wait: Promise<void> | null = null, fail = false, legacySchema = false;
  const failures = new Map<string,unknown>(), diagnostics: PortfolioDiagnostic[] = [];
  const rows: Record<string, any[]> = { properties: [p], listings: [listing('draft')], verification_submissions: [verification('pending')], property_photos: [{ id: photo, property_id: property, storage_path: `property-media/${owner}/${property}/${photo}.jpg`, alt_text: null, sort_order: 0, is_cover: true, created_at: p.created_at }] };
  const calls: { table: string; columns: string; filters: Record<string, any> }[] = [];
  const client = { auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) },
    from(table: string) { const call = { table, columns: '', filters: {} as Record<string, any> }; calls.push(call); let start = 0, end = Infinity;
      const query = { select: (columns: string) => { call.columns = columns; return query; }, eq: (k: string, v: any) => { call.filters[k] = v; return query; }, in: (k: string, v: any[]) => { call.filters[k] = v; return query; }, order: () => query, range: (a: number, b: number) => { start = a; end = b; return query; }, then: async (resolve: any, reject: any) => { try { if (wait) await wait; return resolve({ data: rows[table]!.filter(row => Object.entries(call.filters).every(([k, v]) => Array.isArray(v) ? v.includes(row[k]) : row[k] === v)).slice(start, end + 1), error: failures.get(table) ?? (legacySchema && call.columns.split(',').includes('edit_version') ? {code:'42703',message:'column listings.edit_version does not exist'} : fail ? { message: 'private database text' } : null) }); } catch(e) { return reject(e); } } }; return query; },
    storage: { from: (bucket: string) => { assert.equal(bucket, 'property-media'); return { getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } }) }; } },
  } as unknown as SupabaseClient<Database>;
  const service = createLandlordPortfolioService(() => client,event=>diagnostics.push(event));
  return { service, calls, rows, failures, diagnostics, legacy: () => { legacySchema = true; for(const row of rows.listings!) delete row.edit_version; }, user: (id: string | null) => { user = id; }, hold: (p: Promise<void>) => { wait = p; }, fail: () => { fail = true; } };
}
test('portfolio reads are owner-scoped, Tier 3 scoped, narrow, and use validated real cover paths', async () => {
  const h = serviceHarness(); const items = await h.service.load(owner);
  assert.equal(items.length, 1); assert.equal(items[0]?.tier3.status, 'pending'); assert.ok(items[0]?.coverPhoto?.publicUrl.endsWith(`${photo}.jpg`));
  assert.equal(h.calls.find(c => c.table === 'properties')?.filters.landlord_id, owner);
  assert.equal(h.calls.find(c => c.table === 'listings')?.filters.landlord_id, owner);
  assert.deepEqual(h.calls.find(c => c.table === 'verification_submissions')?.filters, { user_id: owner, tier: 'tier_3_property' });
  assert.deepEqual(h.calls.find(c => c.table === 'property_photos')?.filters, { property_id: [property], is_cover: true });
  assert.doesNotMatch(h.calls.map(c => c.columns).join(' '), /\*|exact_|public_location|access_instructions|address_line/);
});
test('authentication required and changed accounts reject returned data', async () => {
  const h = serviceHarness(); h.user(null); await assert.rejects(h.service.load(owner), PortfolioError); assert.equal(h.calls.length, 0);
  h.user(owner); let release!: () => void; h.hold(new Promise<void>(r => { release = r; })); const pending = h.service.load(owner);
  while (!h.calls.length) await new Promise<void>(r => setImmediate(r)); h.user('other'); release(); await assert.rejects(pending, PortfolioError);
});
test('properties without listings, photos or verification stay visible and separate', async () => {
  const h = serviceHarness(); h.rows.properties!.push({ ...p, id: '20000000-0000-4000-8000-000000000002' });
  const items = await h.service.load(owner); assert.equal(items.length, 2); assert.equal(items[1]?.currentListing, null); assert.equal(items[1]?.coverPhoto, null); assert.equal(items[1]?.tier3.status, 'not_submitted');
});
test('empty owner portfolio does not query arbitrary photo IDs', async () => {
  const h = serviceHarness(); h.rows.properties = []; assert.deepEqual(await h.service.load(owner), []); assert.ok(!h.calls.some(c => c.table === 'property_photos'));
});
for (const status of ['active', 'paused', 'rented'] as const) test(`${status} outranks draft and historical listings`, () => {
  const live = listing(status), draft = { ...listing('draft', 'draft'), updated_at: '2026-10-29T00:00:00Z' };
  assert.equal(currentPortfolioListing([listing('archived'), draft, live])?.status, status);
});
test('listing history is retained, deterministic recency selects current, and draft outranks history', () => {
  const a = listing('draft', 'a'), b = listing('draft', 'b'), archived = { ...listing('archived', 'c'), updated_at: '2026-10-29T00:00:00Z' };
  assert.equal(currentPortfolioListing([archived, a, b])?.id, 'b');
  const items = assemblePortfolio([p], [a, b, archived, { ...a, property_id: 'other' }], [], new Map()); assert.equal(items[0]?.listings.length, 3);
});
test('latest submitted property verification wins with deterministic ties', () => {
  const old = { ...verification('approved'), updated_at: '2026-10-30T00:00:00Z' }, next = { ...verification('rejected'), id: 'new', submitted_at: '2026-10-29T00:00:00Z' };
  assert.equal(assemblePortfolio([p], [], [old, next], new Map())[0]?.tier3.status, 'rejected');
});
test('real search and statistics use properties and complete listing history', () => {
  const items = assemblePortfolio([p], [listing('active'), listing('draft', 'draft'), listing('rented', 'rented')], [], new Map());
  for (const q of ['Buhay', 'Imus', 'Apartment', 'Sunny']) assert.equal(filterPortfolio(items, q).length, 1);
  assert.equal(filterPortfolio(items, 'UC-06').length, 0); assert.deepEqual(portfolioStats(items), { properties: 1, published: 1, drafts: 1, rented: 1 });
  assert.equal(portfolioListingLabels.active, 'Published'); assert.equal(portfolioTierLabels.approved, 'Ownership verified');
});
test('portfolio workflow ignores disposed or invalidated late responses', async () => {
  for (const dispose of [false, true]) {
    const h = serviceHarness(); let release!: () => void; h.hold(new Promise<void>(r => { release = r; })); const flow = createLandlordPortfolioWorkflow(h.service); const pending = flow.load();
    while (!h.calls.length) await new Promise<void>(r => setImmediate(r)); if (dispose) flow.dispose(); else flow.invalidate(); release(); await pending; assert.equal(flow.getSnapshot().items.length, 0);
  }
});
test('dashboard contains only real property presentation and no mock metrics or clients', () => {
  const source = readFileSync('src/features/property-listing/views/PropertyDashboardView.tsx', 'utf8');
  assert.doesNotMatch(source, /landlordListingPreviews|Figma|UC-06|OVERDUE|AVG RATING|TENANTED|inquiry|\.rpc\(|getSupabaseClient/);
  assert.match(source, /portfolioItems\.map/); assert.match(source, /coverPhoto\.publicUrl/); assert.match(source, /portfolioStatistics/);
  const flow = readFileSync('src/features/property-listing/views/PropertyListingFlowView.tsx', 'utf8'); assert.doesNotMatch(flow, /<FeedbackNotice|Check publication status|Check listing status|draft to reconcile/);
});
test('portfolio pagination retains properties beyond one page and chunks owner-confirmed cover queries', async () => {
  const h = serviceHarness(); h.rows.properties = Array.from({ length: 201 }, (_, i) => ({ ...p, id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }));
  const items = await h.service.load(owner); assert.equal(items.length, 201);
  assert.equal(h.calls.filter(c => c.table === 'properties').length, 2);
  assert.equal(h.calls.filter(c => c.table === 'property_photos').length, 3);
});
test('unsafe cover paths fall back without hiding the property or constructing an unsafe public URL', async () => {
  const h = serviceHarness(); h.rows.property_photos![0].storage_path = 'property-media/another-user/private.jpg';
  const items = await h.service.load(owner); assert.equal(items.length, 1); assert.equal(items[0]?.coverPhoto, null);
});
test('portfolio refresh account invalidation clears previous owner rows and safe error messages hide backend details', async () => {
  const h = serviceHarness(), flow = createLandlordPortfolioWorkflow(h.service); await flow.load(); assert.equal(flow.getSnapshot().items.length, 1);
  h.user('other'); await flow.load(); assert.equal(flow.getSnapshot().items.length, 0); assert.equal(flow.getSnapshot().busy, false);
  h.user(owner); h.fail(); await flow.load(); assert.doesNotMatch(flow.getSnapshot().error ?? '', /private database text/);
});


test('read-only portfolio loads two active listings and a draft without the undeployed edit schema or RPC',async()=>{
 const h=serviceHarness();h.rows.properties=[p,{...p,id:'20000000-0000-4000-8000-000000000002'},{...p,id:'20000000-0000-4000-8000-000000000003'}];
 h.rows.listings=[listing('active'),{...listing('active','40000000-0000-4000-8000-000000000002'),property_id:h.rows.properties[1]!.id},{...listing('draft','40000000-0000-4000-8000-000000000003'),property_id:h.rows.properties[2]!.id}];h.legacy();
 const flow=createLandlordPortfolioWorkflow(h.service);await flow.load();const state=flow.getSnapshot();assert.equal(state.error,null);assert.equal(state.loaded,true);assert.equal(state.items.length,3);assert.deepEqual(flow.stats(),{properties:3,published:2,drafts:1,rented:0});
 assert.deepEqual(state.items.flatMap(i=>i.listings.map(l=>l.id)),h.rows.listings.map(l=>l.id));assert.equal(state.items[0]?.tier3.status,'pending');assert.ok(state.items[0]?.coverPhoto);assert.ok(h.calls.every(c=>!c.columns.split(',').includes('edit_version')));
 // The mock client has no RPC method: loading cannot depend on update_listing_draft.
});


test('portfolio diagnostics identify schema rejection at listings read without leaking raw messages',async()=>{
 const h=serviceHarness();h.failures.set('listings',{code:'42703',message:'column listings.edit_version does not exist; private address'});
 const flow=createLandlordPortfolioWorkflow(h.service);await flow.load();assert.equal(flow.getSnapshot().loaded,false);assert.match(flow.getSnapshot().error??'',/database contract/);assert.equal(h.diagnostics.length,1);
 assert.deepEqual(h.diagnostics[0],{operation:'select.listings',stage:'listings',code:'42703',classification:'schema',message:'Requested listings.edit_version column is unavailable'});assert.doesNotMatch(JSON.stringify(h.diagnostics),/private address/);
});
test('portfolio failures retain prior records and distinguish authorization from network errors',async()=>{
 const h=serviceHarness(),flow=createLandlordPortfolioWorkflow(h.service);await flow.load();h.failures.set('verification_submissions',{code:'42501',message:'permission denied private data'});await flow.load();
 assert.equal(flow.getSnapshot().items.length,1);assert.match(flow.getSnapshot().error??'',/account access/);assert.equal(h.diagnostics.at(-1)?.stage,'verifications');assert.equal(h.diagnostics.at(-1)?.classification,'authorization');
 h.failures.clear();h.failures.set('properties',{message:'Network request failed'});await flow.load();assert.equal(flow.getSnapshot().items.length,1);assert.equal(h.diagnostics.at(-1)?.stage,'properties');assert.equal(h.diagnostics.at(-1)?.classification,'network');
});
test('cover failures remain visible and diagnosed rather than returning an empty portfolio',async()=>{
 const h=serviceHarness();h.failures.set('property_photos',{code:'42501',message:'private row data'});await assert.rejects(h.service.load(owner),PortfolioError);assert.equal(h.diagnostics.at(-1)?.operation,'select.property_photos');assert.equal(h.diagnostics.at(-1)?.classification,'authorization');
});
test('unknown portfolio errors are not falsely labeled network and identity diagnostics contain no credentials',async()=>{
 assert.equal(portfolioDiagnostic('listings',{message:'unknown internal issue'}).classification,'backend');assert.equal(portfolioDiagnostic('hydration',null).classification,'application_state');
 const h=serviceHarness();h.user(null);await assert.rejects(h.service.load(owner));assert.equal(h.diagnostics.at(-1)?.stage,'auth');assert.doesNotMatch(JSON.stringify(h.diagnostics),new RegExp(owner));
});
