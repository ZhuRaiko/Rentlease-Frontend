/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { readPublicPropertyPhotos } from '../src/shared/services/publicPropertyPhotos';
import { createManualSearchService } from '../src/features/search-discovery/services/manualSearchService';
import { defaultSearchFilters } from '../src/features/search-discovery/models/ManualSearch';
import { createLandlordPortfolioService } from '../src/features/property-listing/services/landlordPortfolioService';
import { type PortfolioProperty, type PortfolioListing, type PortfolioVerification, PortfolioError } from '../src/features/property-listing/models/LandlordPortfolio';
import { readManagementFacts } from '../src/app/managementRead';

const owner = '10000000-0000-4000-8000-000000000001', property = '20000000-0000-4000-8000-000000000001', photo = '30000000-0000-4000-8000-000000000001';
const propertyId = '00000000-0000-0000-0000-000000000100';
const p: PortfolioProperty = { id: property, landlord_id: owner, property_type: 'apartment', city: 'imus', barangay: 'Buhay na Tubig', bedrooms: 1, bathrooms: 1, floor_area_sqm: 30, floor_number: 3, total_floors: 8, max_occupants: 4, furnishing_status: 'unfurnished', is_active: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' };
const listing = (status: PortfolioListing['status'], id = '40000000-0000-4000-8000-000000000001'): PortfolioListing => ({ id, property_id: property, landlord_id: owner, title: 'Sunny rental', description: 'Description', asking_rent_monthly: 12000, house_rules: null, rental_term: 'long_term', security_deposit_months: 1, advance_rent_months: 1, minimum_stay_months: null, available_from: null, status, completeness_score: 0.8, published_at: '2026-10-28T00:00:00Z', paused_at: null, archived_at: null, removed_at: null, removal_reason: null, created_at: p.created_at, updated_at: p.updated_at });
const verification = (status: PortfolioVerification['status']): PortfolioVerification => ({ id: 'v', user_id: owner, property_id: property, tier: 'tier_3_property', status, submitted_at: p.created_at, updated_at: p.updated_at });
const raw = (id = 1) => ({ id: `00000000-0000-0000-0000-${String(id).padStart(12,'0')}`, property_id: propertyId, title: 'Actual rental', description: 'Actual description', asking_rent_monthly: 18500, available_from: null, published_at: '2026-10-01T00:00:00Z', house_rules: null, rental_term: 'long_term', minimum_stay_months: null, security_deposit_months: 1, advance_rent_months: 1, status: 'active', properties: { id: propertyId, landlord_id: '00000000-0000-0000-0000-000000000200', city: 'imus', barangay: 'Alapan', property_type: 'apartment', bedrooms: 1, bathrooms: 1, floor_area_sqm: 42, furnishing_status: 'furnished', is_active: true } });
const never = (label: string) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error(label)), 1500));

// ---- cover-only photo read -------------------------------------------------------------------------------------------------------------
const A = '00000000-0000-0000-0000-0000000000a1', B = '00000000-0000-0000-0000-0000000000b1', OWNER = '00000000-0000-0000-0000-000000000200';
const pid = (n: number) => `30000000-0000-4000-8000-00000000000${n}`;
type PhotoRow = { id: string; property_id: string; storage_path: string; alt_text: string | null; sort_order: number; is_cover: boolean; created_at: string };
const photoRow = (n: number, property: string, sort: number, cover: boolean, created = '2026-01-01', path?: string): PhotoRow => ({ id: pid(n), property_id: property, storage_path: path ?? `${OWNER}/${property}/${pid(n)}.jpg`, alt_text: null, sort_order: sort, is_cover: cover, created_at: created });
function photoClient(rows: PhotoRow[]) {
  const selects: { ids: string[]; cover: boolean }[] = [];
  const client = { from(table: string) { assert.equal(table, 'property_photos'); const q = { ids: [] as string[], cover: false };
    const chain: any = { select: () => chain, in: (_k: string, v: string[]) => { q.ids = v; return chain; }, eq: (k: string, v: unknown) => { if (k === 'is_cover' && v === true) q.cover = true; return chain; }, order: () => chain, limit: () => chain, abortSignal: () => chain,
      then: (resolve: (v: unknown) => unknown) => { selects.push(q); return resolve({ data: rows.filter(r => q.ids.includes(r.property_id) && (!q.cover || r.is_cover)), error: null }); } };
    return chain; }, storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://example.test/${p}` } }) }) } } as unknown as SupabaseClient<Database>;
  return { client, selects };
}
const parents = [{ propertyId: A, ownerId: OWNER }, { propertyId: B, ownerId: OWNER }];
test('cover-only read asks for covers once and returns one image per listing', async () => {
  const h = photoClient([photoRow(1, A, 0, true), photoRow(2, A, 1, false), photoRow(3, B, 0, true), photoRow(4, B, 1, false)]);
  const photos = await readPublicPropertyPhotos(h.client, parents, undefined, 200, true);
  assert.equal(h.selects.length, 1); assert.equal(h.selects[0]!.cover, true);
  assert.deepEqual(photos.map(p => [p.propertyId, p.photo.id]), [[A, pid(1)], [B, pid(3)]]);
});
test('a listing with no cover row falls back to its first photo by sort_order, then created_at, then id', async () => {
  const h = photoClient([photoRow(1, A, 0, true), photoRow(5, B, 1, false, '2026-01-01'), photoRow(4, B, 0, false, '2026-01-03'), photoRow(7, B, 0, false, '2026-01-02'), photoRow(6, B, 0, false, '2026-01-02')]);
  const photos = await readPublicPropertyPhotos(h.client, parents, undefined, 200, true);
  assert.equal(h.selects.length, 2); assert.deepEqual(h.selects[1], { ids: [B], cover: false });
  assert.equal(photos.length, 2); assert.equal(photos.find(p => p.propertyId === A)?.photo.id, pid(1)); assert.equal(photos.find(p => p.propertyId === B)?.photo.id, pid(6));
});
test('an unusable cover path falls back to the next photo instead of losing the image', async () => {
  const h = photoClient([photoRow(1, A, 0, true, '2026-01-01', 'https://untrusted.test/x.jpg'), photoRow(2, A, 1, false)]);
  const photos = await readPublicPropertyPhotos(h.client, [parents[0]!], undefined, 200, true);
  assert.deepEqual(photos.map(p => p.photo.id), [pid(2)]);
});
test('a listing with no photo at all stays without an image; the detail read still returns every photo in one query', async () => {
  const none = photoClient([]); assert.deepEqual(await readPublicPropertyPhotos(none.client, parents, undefined, 200, true), []);
  const full = photoClient([photoRow(1, A, 0, true), photoRow(2, A, 1, false)]);
  const photos = await readPublicPropertyPhotos(full.client, [parents[0]!]);
  assert.equal(full.selects.length, 1); assert.equal(full.selects[0]!.cover, false); assert.deepEqual(photos.map(p => p.photo.id), [pid(1), pid(2)]);
});

// ---- Rental details: photos and amenities together ---------------------------------------------------------------------------------------
function detailClient(reads: { photos: () => Promise<any>; amenities: () => Promise<any> }) {
  const started: string[] = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'tenant' } }, error: null }) },
    from(table: string) { const b: any = new Proxy({}, { get(_t, key) { if (key === 'then') return (resolve: any, reject: any) => { started.push(table); const r = table === 'property_photos' ? reads.photos() : table === 'property_amenities' ? reads.amenities() : Promise.resolve({ data: [raw()], error: null }); return r.then(resolve, reject); }; return () => b; } }); return b; },
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://example.test/${p}` } }) }) } } as unknown as SupabaseClient<Database>;
  return { service: createManualSearchService(() => client), started };
}
const okPhotos = async () => ({ data: [photoRow(1, propertyId, 0, true)], error: null });
const okAmenities = async () => ({ data: [{ amenity: { name: 'Wi-Fi' } }], error: null });
test('rental details start the photo and amenity reads together', async () => {
  let amenitiesStarted!: () => void; const gate = new Promise<void>(r => { amenitiesStarted = r; });
  const h = detailClient({ photos: async () => { await Promise.race([gate, never('photos waited for amenities')]); return okPhotos(); }, amenities: async () => { amenitiesStarted(); return okAmenities(); } });
  const detail = await h.service.detail('tenant', raw().id);
  assert.deepEqual(detail.amenities, ['Wi-Fi']); assert.equal(detail.photos.length, 1);
});
test('rental details: a failing photo read keeps the old photo error', async () => {
  const h = detailClient({ photos: async () => ({ data: null, error: { message: 'raw' } }), amenities: okAmenities });
  await assert.rejects(h.service.detail('tenant', raw().id), { message: 'Could not load rental photos. Please retry.' });
});
test('rental details: a failing amenity read keeps the old amenity error', async () => {
  const h = detailClient({ photos: okPhotos, amenities: async () => ({ data: null, error: { message: 'raw' } }) });
  await assert.rejects(h.service.detail('tenant', raw().id), { message: 'Could not load rental amenities. Please retry.' });
});
test('rental details: when both reads fail the photo error still wins, as it did when they ran one after the other', async () => {
  const h = detailClient({ photos: async () => ({ data: null, error: { message: 'raw' } }), amenities: async () => ({ data: null, error: { message: 'raw' } }) });
  await assert.rejects(h.service.detail('tenant', raw().id), { message: 'Could not load rental photos. Please retry.' });
});
test('search results get their thumbnail from the cover read', async () => {
  const h = detailClient({ photos: okPhotos, amenities: okAmenities });
  const rows = await h.service.search('tenant', { query: '', filters: defaultSearchFilters(), sort: 'Recently Listed', offset: 0 });
  assert.match(rows[0]?.thumbnailUrl ?? '', new RegExp(pid(1)));
});

// ---- My Rentals: identity statuses and covers together -------------------------------------------------------------------------------------
function portfolioClient(reads: { bindings: () => Promise<any>; covers: () => Promise<any> }) {
  const tables: Record<string, unknown[]> = { properties: [p], listings: [listing('draft')], verification_submissions: [verification('pending')] };
  const client = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) }, rpc: () => reads.bindings(),
    from(table: string) { const b: any = new Proxy({}, { get(_t, key) { if (key === 'then') return (resolve: any, reject: any) => (table === 'property_photos' ? reads.covers() : Promise.resolve({ data: tables[table] ?? [], error: null })).then(resolve, reject); return () => b; } }); return b; },
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } }) }) } } as unknown as SupabaseClient<Database>;
  return createLandlordPortfolioService(() => client, () => {});
}
const okBindings = async () => ({ data: [{ property_id: property, verified: false, requires_repair: false, current_submission_id: null }], error: null });
const okCovers = async () => ({ data: [{ id: photo, property_id: property, storage_path: `property-media/${owner}/${property}/${photo}.jpg`, alt_text: null, sort_order: 0, is_cover: true, created_at: p.created_at }], error: null });
test('My Rentals starts the identity-status and cover reads together', async () => {
  let bindingsStarted!: () => void; const gate = new Promise<void>(r => { bindingsStarted = r; });
  const service = portfolioClient({ bindings: async () => { bindingsStarted(); return okBindings(); }, covers: async () => { await Promise.race([gate, never('covers waited for identity statuses')]); return okCovers(); } });
  const items = await service.load(owner);
  assert.equal(items.length, 1); assert.match(JSON.stringify(items[0]), new RegExp(photo));
});
test('My Rentals: a failing cover read still fails the load', async () => {
  await assert.rejects(portfolioClient({ bindings: okBindings, covers: async () => ({ data: null, error: { code: '08006' } }) }).load(owner), PortfolioError);
});
test('My Rentals: a failing identity-status read still fails the load, and wins when both fail', async () => {
  await assert.rejects(portfolioClient({ bindings: async () => ({ data: null, error: { code: '42501' } }), covers: okCovers }).load(owner), PortfolioError);
  await assert.rejects(portfolioClient({ bindings: async () => ({ data: null, error: { code: '42501' } }), covers: async () => ({ data: null, error: { code: '08006' } }) }).load(owner), { message: /Could not access your properties/ });
});

// ---- Tenancy tab: inbox starts with the tenancies ------------------------------------------------------------------------------------------
test('Tenancy tab starts the inbox with the tenancies; activity still waits for the tenancies; one result at the end', async () => {
  const order: string[] = []; let inboxStarted!: () => void; const gate = new Promise<void>(r => { inboxStarted = r; });
  const result = await readManagementFacts({
    tenancies: async () => { order.push('tenancies'); await Promise.race([gate, never('tenancies finished before the inbox started')]); return ['t1']; },
    activity: async t => { order.push(`activity:${t.join()}`); return 'a'; },
    inbox: async () => { order.push('inbox'); inboxStarted(); return ['i1']; },
  });
  assert.deepEqual(order, ['inbox', 'tenancies', 'activity:t1']); assert.deepEqual(result, { tenancies: ['t1'], activity: 'a', inbox: ['i1'] });
});
test('Tenancy tab: a failing inbox leaves null; a failing tenancy read rejects without an unhandled inbox rejection', async () => {
  const quiet = await readManagementFacts({ tenancies: async () => [1], activity: async () => 'a', inbox: async () => { throw new Error('inbox'); } });
  assert.equal(quiet.inbox, null); assert.deepEqual(quiet.tenancies, [1]);
  let activityCalled = false; const unhandled: unknown[] = []; const listener = (e: unknown) => unhandled.push(e); process.on('unhandledRejection', listener);
  await assert.rejects(readManagementFacts({ tenancies: async () => { throw new Error('tenancies'); }, activity: async () => { activityCalled = true; return 'a'; }, inbox: async () => { throw new Error('inbox'); } }), { message: 'tenancies' });
  await new Promise(r => setTimeout(r, 20)); process.off('unhandledRejection', listener);
  assert.equal(activityCalled, false); assert.deepEqual(unhandled, []);
});
