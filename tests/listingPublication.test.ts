/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { confirmedListingFields, isPublishedListing, publicationBackendError, publicationEligibility, publicationStatusLabel, type PublicationListing } from '../src/features/property-listing/models/ListingPublication';
import { createListingPublicationService } from '../src/features/property-listing/services/listingPublicationService';
import { createListingPublicationWorkflow } from '../src/features/property-listing/viewModels/listingPublicationWorkflow';
import { createListingDraftWorkflow } from '../src/features/property-listing/viewModels/listingDraftWorkflow';
const propertyId = '10000000-0000-4000-8000-000000000001', listingId = '20000000-0000-4000-8000-000000000001', userId = '30000000-0000-4000-8000-000000000001';
function draft(): PublicationListing { return { id: listingId, property_id: propertyId, landlord_id: userId, title: 'A rental home', description: 'A sufficiently descriptive rental home.', asking_rent_monthly: 12000, house_rules: null, rental_term: 'long_term', security_deposit_months: 1, advance_rent_months: 1, minimum_stay_months: null, available_from: null, status: 'draft', completeness_score: 0.3, published_at: null, created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z', paused_at: null, archived_at: null, removed_at: null, removal_reason: null }; }
const fields = () => confirmedListingFields(draft());
function harness() {
  let owner = userId, row: PublicationListing | null = draft(), rpcError: { code: string; message: string } | null = null, receipt: unknown = undefined;
  let calls = 0, commitOnError = false, wait: Promise<void> | null = null, readFailure = false, diskFailure = false;
  const journal = new Map<string, string>(), filters: Record<string, unknown>[] = [], applied: PublicationListing[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null }, error: null }) },
    from(table: string) {
      const eqs: Record<string, unknown> = {};
      const q = { select: (_: string) => q, eq: (k: string, v: unknown) => { eqs[k] = v; return q; }, order: (_: string, __: unknown) => q, limit: (n: number) => { assert.equal(n, 1); return q; },
        maybeSingle: async () => {
          if (table === 'properties') return { data: owner === userId ? { id: propertyId, landlord_id: userId, is_active: true } : null, error: null };
          assert.equal(table, 'listings'); filters.push(eqs); return { data: row, error: readFailure && calls ? { message: 'private read error' } : null };
        } }; return q;
    },
    async rpc(name: string, args: unknown) {
      assert.equal(name, 'publish_listing'); assert.deepEqual(args, { p_listing_id: listingId }); calls++; if (wait) await wait;
      if ((!rpcError || commitOnError) && row) row = { ...row, status: 'active', completeness_score: 0.8, published_at: '2026-10-25T01:00:00Z' };
      return { data: receipt !== undefined ? receipt : row ? [{ listing_id: row.id, listing_status: row.status, completeness_score: row.completeness_score, published_at: row.published_at, updated_at: row.updated_at }] : null, error: rpcError };
    },
  } as unknown as SupabaseClient<Database>;
  const storage = { getItem: async (k: string) => journal.get(k) ?? null, setItem: async (k: string, v: string) => { if (diskFailure) throw Error('disk unavailable'); journal.set(k, v); }, removeItem: async (k: string) => { journal.delete(k); } };
  const service = createListingPublicationService(() => client, storage);
  const flow = createListingPublicationWorkflow(service, r => applied.push(r));
  return { service, flow, journal, filters, applied, row: () => row, calls: () => calls, setRow: (v: PublicationListing | null) => { row = v; }, error: (v: typeof rpcError, commit = false) => { rpcError = v; commitOnError = commit; }, receipt: (v: unknown) => { receipt = v; }, user: (v: string) => { owner = v; }, delay: (v: Promise<void>) => { wait = v; }, readFail: (v: boolean) => { readFailure = v; }, diskFail: () => { diskFailure = true; }, ready: async () => { flow.setProperty(propertyId); await flow.restore(); } };
}
const context = { propertyId, listingId, userId };

test('publication requires real property/listing IDs and a confirmed backend draft', () => {
  assert.ok(publicationEligibility(null, draft(), fields(), false)); assert.ok(publicationEligibility(propertyId, null, fields(), false));
  assert.ok(publicationEligibility(propertyId, { ...draft(), id: 'preview-id' }, fields(), false));
  assert.ok(publicationEligibility(propertyId, { ...draft(), status: 'active' }, fields(), false));
  assert.equal(publicationEligibility(propertyId, draft(), fields(), false), null);
});
test('dirty local listing fields and uncertain saves block RPC without losing edits', async () => {
  const h = harness(); await h.ready(); const edited = { ...fields(), title: 'Unsaved title' };
  assert.equal(await h.flow.publish(draft(), edited, false), false); assert.match(h.flow.getSnapshot().error ?? '', /Save your listing changes/); assert.equal(edited.title, 'Unsaved title');
  await h.flow.publish(draft(), fields(), true); assert.equal(h.calls(), 0);
});
test('server cached score and preview-only physical fields are not a client publication gate', async () => {
  const h = harness(); await h.ready(); assert.equal(draft().completeness_score, 0.3);
  const form = { ...fields(), landArea: '', photoCount: 0, pinConfirmed: false };
  assert.equal(await h.flow.publish(draft(), form, false), true); assert.equal(h.calls(), 1);
});
test('publication RPC contains only listing UUID and active receipt maps to Published', async () => {
  const h = harness(); await h.ready(); assert.equal(await h.flow.publish(draft(), fields(), false), true);
  const s = h.flow.getSnapshot(); assert.equal(s.publishedListingId, listingId); assert.equal(s.status, 'active'); assert.equal(s.completenessScore, 0.8); assert.ok(s.publishedAt); assert.equal(publicationStatusLabel(s.status), 'Published');
});
for (const [label, change] of [
  ['different UUID', { listing_id: '40000000-0000-4000-8000-000000000001' }],
  ['preview published status', { listing_status: 'published' }], ['draft status', { listing_status: 'draft' }],
  ['low completeness', { completeness_score: 0.79 }], ['missing timestamp', { published_at: null }], ['bad timestamp', { published_at: 'not a date' }],
] as const) test(`invalid publication receipt (${label}) cannot report success`, async () => {
  const h = harness(); await h.ready(); h.receipt([{ listing_id: listingId, listing_status: 'active', completeness_score: 0.8, published_at: '2026-10-25T01:00:00Z', updated_at: draft().updated_at, ...change }]);
  assert.equal(await h.flow.publish(draft(), fields(), false), false); assert.equal(h.flow.getSnapshot().publishedListingId, null); assert.equal(h.flow.getSnapshot().uncertain, true);
});
for (const [message, code, expected] of [
  ['Approved Tier 3 verification for this property is required before publishing', '42501', /This property must have approved Tier 3/],
  ['Listing must reach at least 80% completeness before publishing', 'P0001', /does not yet meet the publication requirements/],
  ['This property already has a live listing', '23505', /already has a live listing/],
  ['Owned listing required private-owner-id', '42501', /Check your account eligibility and ownership/],
] as const) test(`backend denial is normalized safely: ${code} ${message.split(' ')[0]}`, async () => {
  const h = harness(); await h.ready(); h.error({ code, message }); await h.flow.publish(draft(), fields(), false);
  assert.match(h.flow.getSnapshot().error ?? '', expected); assert.doesNotMatch(h.flow.getSnapshot().error ?? '', /private-owner-id/); assert.equal(h.flow.getSnapshot().status, 'draft'); assert.equal(h.flow.getSnapshot().uncertain, false);
});
test('completeness error supports the trigger percent-escaped message too', () => {
  assert.match(publicationBackendError({ code: 'P0001', message: 'Listing must reach at least 80%% completeness before publishing' }).message, /does not yet meet/);
});
test('rapid publish taps and cross-workflow requests do not issue concurrent RPCs', async () => {
  const h = harness(); await h.ready(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
  const pending = h.flow.publish(draft(), fields(), false); await h.flow.publish(draft(), fields(), false); release(); await pending; assert.equal(h.calls(), 1);
  const s = harness(); let end!: () => void; s.delay(new Promise<void>(r => { end = r; }));
  const first = s.service.publish(context, fields()); await assert.rejects(s.service.publish(context, fields())); end(); await first; assert.equal(s.calls(), 1);
});
test('uncertain committed publication blocks blind retry and reconciles by owner/listing ID', async () => {
  const h = harness(); await h.ready(); h.error({ code: '', message: 'unknown response' }, true); await h.flow.publish(draft(), fields(), false);
  assert.equal(h.flow.getSnapshot().uncertain, true); await h.flow.publish(draft(), fields(), false); assert.equal(h.calls(), 1);
  await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().publishedListingId, listingId); assert.equal(h.flow.getSnapshot().status, 'active');
  assert.ok(h.filters.some(f => f.id === listingId && f.landlord_id === userId));
});
test('explicit reconciliation of still-draft state clears uncertainty without publishing automatically', async () => {
  const h = harness(); await h.ready(); h.error({ code: '', message: 'timeout' }); await h.flow.publish(draft(), fields(), false);
  await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().status, 'draft'); assert.equal(h.flow.getSnapshot().uncertain, false); assert.match(h.flow.getSnapshot().error ?? '', /still a draft/); assert.equal(h.calls(), 1);
});
test('unexpected reconciliation status stays blocked without inventing a lifecycle transition', async () => {
  const h = harness(); await h.ready(); h.error({ code: '', message: 'timeout' }); await h.flow.publish(draft(), fields(), false);
  h.setRow({ ...draft(), status: 'paused' }); await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().publishedListingId, null); assert.equal(h.calls(), 1);
});
test('late account and disposed responses cannot populate publication state', async () => {
  for (const change of ['account', 'dispose', 'property']) {
    const h = harness(); await h.ready(); const initialApplied = h.applied.length; let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
    const pending = h.flow.publish(draft(), fields(), false); while (!h.calls()) await new Promise<void>(r => setImmediate(r));
    if (change === 'account') h.user('another'); else if (change === 'dispose') h.flow.dispose(); else h.flow.setProperty(null);
    release(); await pending; assert.equal(h.flow.getSnapshot().publishedListingId, null); assert.equal(h.applied.length, initialApplied);
  }
});
test('pending publication survives reopen and requires an explicit check', async () => {
  const h = harness(); h.error({ code: '', message: 'timeout' }, true); await assert.rejects(h.service.publish(context, fields()));
  const reopened = createListingPublicationWorkflow(h.service, () => {}); reopened.setProperty(propertyId); await reopened.restore(); assert.equal(reopened.getSnapshot().uncertain, true);
  await reopened.publish(draft(), fields(), false); assert.equal(h.calls(), 1); await reopened.reconcile(); assert.equal(reopened.getSnapshot().status, 'active');
});
test('known active publication restores without mistaking it for a missing draft', async () => {
  const h = harness(); await h.service.publish(context, fields());
  const reopened = createListingPublicationWorkflow(h.service, () => {}); reopened.setProperty(propertyId); await reopened.restore(); assert.equal(reopened.getSnapshot().publishedListingId, listingId); assert.equal(h.calls(), 1);
  h.journal.clear(); const noReceipt = await h.service.restore(propertyId); assert.equal(noReceipt?.row.status, 'active');
});
test('adopting publication blocks draft loads and replacement draft saves', async () => {
  let reads = 0, saves = 0;
  const fake: any = { read: async () => { reads++; return null; }, save: async () => { saves++; return draft(); } };
  const flow = createListingDraftWorkflow(fake, () => {}); flow.setProperty(propertyId); flow.adoptBackendListing({ ...draft(), status: 'active', published_at: '2026-10-25T01:00:00Z', completeness_score: 0.8 });
  await flow.load(); await flow.save(fields()); assert.equal(flow.getSnapshot().listingId, listingId); assert.equal(flow.getSnapshot().lastConfirmed?.status, 'active'); assert.equal(reads, 0); assert.equal(saves, 0);
});
test('authoritative reload failure after receipt cannot produce fake Published success', async () => {
  const h = harness(); await h.ready(); h.readFail(true); await h.flow.publish(draft(), fields(), false); assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().publishedListingId, null);
  h.readFail(false); await h.flow.reconcile(); assert.ok(isPublishedListing(h.flow.getSnapshot().lastConfirmed!));
});
test('pending marker must be durable before RPC execution', async () => {
  const h = harness(); h.diskFail(); await assert.rejects(h.service.publish(context, fields())); assert.equal(h.calls(), 0);
});
test('fresh backend draft changes block publication instead of publishing a stale form', async () => {
  const h = harness(); await h.ready(); h.setRow({ ...draft(), title: 'Changed on another device' }); await h.flow.publish(draft(), fields(), false); assert.equal(h.calls(), 0); assert.match(h.flow.getSnapshot().error ?? '', /backend draft may have changed/);
});


test('publication presentation keeps backend access in services and adds no lifecycle RPCs', () => {
  for (const view of ['ListingPreviewView', 'PublishedListingStatusView', 'PropertyDashboardView', 'PropertyListingFlowView']) {
    const source = readFileSync(`src/features/property-listing/views/${view}.tsx`, 'utf8');
    assert.doesNotMatch(source, /getSupabaseClient|\.rpc\(|\.from\(|from ['"][^'"]*\/services\//);
  }
  const service = readFileSync('src/features/property-listing/services/listingPublicationService.ts', 'utf8');
  assert.deepEqual([...service.matchAll(/\.rpc\('([^']+)'/g)].map(match => match[1]), ['publish_listing']);
  assert.doesNotMatch(service, /\.(insert|update|upsert)\(/);
  assert.deepEqual([...service.matchAll(/(\w+)\.delete\(/g)].map(match => match[1]), ['publishing']); // Only the in-memory request Set is cleared.
});
