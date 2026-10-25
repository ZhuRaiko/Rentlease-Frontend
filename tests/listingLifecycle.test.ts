/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { lifecycleActions, lifecycleBackendError, lifecycleReceiptFromRow, lifecycleRpc, lifecycleStatusLabel, lifecycleTarget, type LifecycleListing, type LifecycleOperation, type LifecycleStatus } from '../src/features/property-listing/models/ListingLifecycle';
import { createListingLifecycleService } from '../src/features/property-listing/services/listingLifecycleService';
import { createListingLifecycleWorkflow } from '../src/features/property-listing/viewModels/listingLifecycleWorkflow';
const propertyId = '10000000-0000-4000-8000-000000000001', listingId = '20000000-0000-4000-8000-000000000001', userId = '30000000-0000-4000-8000-000000000001';
const time = '2026-10-25T01:00:00Z', later = '2026-10-26T01:00:00Z';
function listing(status: LifecycleStatus = 'active'): LifecycleListing {
  return { id: listingId, property_id: propertyId, landlord_id: userId, title: 'A rental home', description: 'A sufficiently descriptive rental home.', asking_rent_monthly: 12000, house_rules: null, rental_term: 'long_term', security_deposit_months: 1, advance_rent_months: 1, minimum_stay_months: null, available_from: null, status, completeness_score: .8, published_at: time, paused_at: status === 'paused' ? time : null, archived_at: status === 'archived' ? time : null, created_at: time, updated_at: time, removed_at: null, removal_reason: null };
}
const context = { userId, propertyId, listingId };
function harness(status: LifecycleStatus = 'active') {
  let owner = userId, row: LifecycleListing | null = listing(status), calls = 0, rpcError: any = null, receipt: any = undefined;
  let afterRpcStatus: LifecycleStatus | null = null;
  let commitOnError = false, failRead = false, failDisk = false, blocked = false, delay: Promise<void> | null = null;
  const journal = new Map<string, string>(), applied: LifecycleListing[] = [], events: string[] = [], names: string[] = [];
  const storage = { getItem: async (k: string) => journal.get(k) ?? null, setItem: async (k: string, v: string) => { if (failDisk) throw Error('disk failure'); events.push('marker'); journal.set(k, v); }, removeItem: async (k: string) => { journal.delete(k); } };
  const client = {
    auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null }, error: null }) },
    from(table: string) {
      assert.equal(table, 'listings'); const filters: Record<string, unknown> = {};
      const q = { select: (_: string) => q, eq: (key: string, value: unknown) => { filters[key] = value; return q; }, maybeSingle: async () => {
        assert.deepEqual(filters, { id: listingId, property_id: propertyId, landlord_id: userId }); events.push('read');
        return { data: row, error: failRead && calls ? { message: 'private backend information' } : null };
      } }; return q;
    },
    async rpc(name: string, args: unknown) {
      calls++; names.push(name); events.push('rpc'); assert.deepEqual(args, { p_listing_id: listingId });
      assert.ok([...journal.keys()].some(key => key.includes(`${userId}:${propertyId}:${listingId}`)));
      if (delay) await delay;
      const operation = (Object.keys(lifecycleRpc) as LifecycleOperation[]).find(op => lifecycleRpc[op] === name)!; assert.ok(operation);
      if (row && (!rpcError || commitOnError)) row = { ...row, status: lifecycleTarget[operation], updated_at: later, paused_at: operation === 'pause' ? later : operation === 'reactivate' ? null : row.paused_at, archived_at: operation === 'archive' ? later : row.archived_at };
      const data = receipt === undefined ? row ? [lifecycleReceiptFromRow(row)] : null : receipt;
      if (afterRpcStatus) row = listing(afterRpcStatus);
      return { data, error: rpcError };
    },
  } as unknown as SupabaseClient<Database>;
  const service = createListingLifecycleService(() => client, storage);
  const flow = createListingLifecycleWorkflow(service, next => applied.push(next), () => !blocked);
  return { service, flow, applied, journal, events, names, calls: () => calls, row: () => row,
    afterRpc: (value: LifecycleStatus) => { afterRpcStatus = value; },
    setRow: (next: LifecycleListing | null) => { row = next; }, user: (next: string) => { owner = next; },
    error: (value: any, commit = false) => { rpcError = value; commitOnError = commit; }, receipt: (value: any) => { receipt = value; },
    readFail: () => { failRead = true; }, diskFail: () => { failDisk = true; }, delay: (value: Promise<void>) => { delay = value; }, block: (value: boolean) => { blocked = value; },
    ready: async () => { flow.setListing(row); await flow.restore(); },
  };
}
for (const [status, expected] of [
  ['active', ['pause', 'archive']], ['paused', ['reactivate', 'archive']], ['draft', []], ['rented', []], ['archived', []], ['removed', []],
] as const) test(`${status} exposes only its permitted landlord lifecycle actions`, () => assert.deepEqual(lifecycleActions(status), expected));

for (const [status, operation] of [['active', 'pause'], ['active', 'archive'], ['paused', 'reactivate'], ['paused', 'archive']] as const) test(`${status} -> ${operation} requires confirmation and scoped reload with exact RPC payload`, async () => {
  const h = harness(status); await h.ready(); assert.equal(h.calls(), 0);
  assert.equal(h.flow.request(operation), true); assert.equal(h.calls(), 0); assert.equal(h.flow.getSnapshot().confirmation, operation);
  assert.equal(await h.flow.confirm(), true); assert.equal(h.calls(), 1); assert.deepEqual(h.names, [lifecycleRpc[operation]]);
  const row = h.flow.getSnapshot().row!; assert.equal(row.id, listingId); assert.equal(row.property_id, propertyId); assert.equal(row.status, lifecycleTarget[operation]); assert.equal(row.published_at, time);
  if (operation === 'reactivate') assert.equal(row.paused_at, null);
  if (operation === 'pause') assert.equal(row.paused_at, later);
  if (operation === 'archive') assert.equal(row.archived_at, later);
  assert.ok(h.events.indexOf('marker') < h.events.indexOf('rpc')); assert.equal(h.events.at(-1), 'read'); assert.equal(h.journal.size, 0);
});
for (const [status, operation] of [['draft', 'pause'], ['active', 'reactivate'], ['archived', 'pause'], ['archived', 'reactivate'], ['archived', 'archive'], ['rented', 'archive'], ['removed', 'reactivate']] as const) test(`${status} cannot request ${operation}`, async () => {
  const h = harness(status); await h.ready(); assert.equal(h.flow.request(operation), false); assert.equal(await h.flow.confirm(), false); assert.equal(h.calls(), 0);
});
test('Cancel and confirm without a request cannot issue an RPC', async () => {
  const h = harness(); await h.ready(); await h.flow.confirm(); h.flow.request('pause'); h.flow.cancel(); await h.flow.confirm(); assert.equal(h.calls(), 0);
});
for (const [operation, change] of [
  ['pause', { listing_id: '40000000-0000-4000-8000-000000000001' }], ['pause', { listing_status: 'active' }], ['pause', { paused_at: null }], ['pause', { paused_at: 'bad' }],
  ['reactivate', { listing_status: 'paused' }], ['reactivate', { paused_at: time }], ['reactivate', { completeness_score: .79 }],
  ['archive', { listing_status: 'paused' }], ['archive', { archived_at: null }], ['archive', { archived_at: 'bad' }],
  ['pause', { published_at: later }], ['pause', { updated_at: 'bad' }], ['pause', { completeness_score: NaN }],
] as const) test(`invalid ${operation} receipt ${Object.keys(change)[0]} remains uncertain`, async () => {
  const h = harness(operation === 'reactivate' ? 'paused' : 'active'); await h.ready();
  const valid = { ...lifecycleReceiptFromRow(listing()), listing_status: lifecycleTarget[operation], paused_at: operation === 'pause' ? later : null, archived_at: operation === 'archive' ? later : null, updated_at: later };
  h.receipt([{ ...valid, ...change }]); h.flow.request(operation); assert.equal(await h.flow.confirm(), false);
  assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().row?.status, operation === 'reactivate' ? 'paused' : 'active'); assert.equal(h.journal.size, 1);
});
test('a valid receipt alone cannot confirm success when authoritative reload fails', async () => {
  const h = harness(); await h.ready(); h.readFail(); h.flow.request('pause'); await h.flow.confirm();
  assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().row?.status, 'active'); assert.doesNotMatch(h.flow.getSnapshot().error ?? '', /private backend/);
});
test('a reload that disagrees with the receipt remains uncertain until reconciliation', async () => {
  const h = harness(); await h.ready(); h.afterRpc('rented');
  h.flow.request('pause'); await h.flow.confirm(); assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().row?.status, 'active');
  await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().row?.status, 'rented'); assert.equal(h.calls(), 1);
});
test('rapid confirmations and concurrent service operations issue one RPC', async () => {
  const h = harness(); await h.ready(); let release!: () => void; h.delay(new Promise<void>(resolve => { release = resolve; }));
  h.flow.request('pause'); const first = h.flow.confirm(); const second = h.flow.confirm();
  await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(h.calls(), 1);
  await assert.rejects(h.service.mutate(context, 'archive', 'active')); release(); assert.equal(await first, true); assert.equal(await second, false); assert.equal(h.calls(), 1);
});
test('durable journal failure prevents mutation', async () => {
  const h = harness(); await h.ready(); h.diskFail(); h.flow.request('pause'); await h.flow.confirm(); assert.equal(h.calls(), 0); assert.equal(h.flow.getSnapshot().uncertain, true);
});
for (const operation of ['pause', 'reactivate', 'archive'] as const) test(`uncertain ${operation} blocks replay and explicitly reconciles already-applied transition`, async () => {
  const h = harness(operation === 'reactivate' ? 'paused' : 'active'); await h.ready(); h.error({ code: 'network', message: 'timeout' }, true);
  h.flow.request(operation); await h.flow.confirm(); assert.equal(h.flow.getSnapshot().uncertain, true);
  assert.equal(h.flow.request(operation), false); await h.flow.confirm(); assert.equal(h.calls(), 1);
  await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().row?.status, lifecycleTarget[operation]); assert.equal(h.flow.getSnapshot().uncertain, false); assert.equal(h.calls(), 1); assert.equal(h.journal.size, 0);
});
test('unchanged original state is reconciled explicitly without automatically retrying', async () => {
  const h = harness(); await h.ready(); h.error({ code: 'network', message: 'timeout' }); h.flow.request('pause'); await h.flow.confirm();
  await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().row?.status, 'active'); assert.equal(h.flow.getSnapshot().uncertain, false); assert.equal(h.calls(), 1); assert.match(h.flow.getSnapshot().notice ?? '', /No action was retried/);
});
for (const status of ['rented', 'archived', 'removed'] as const) test(`reconciliation accepts authoritative ${status} as read-only`, async () => {
  const h = harness(); await h.ready(); h.error({ code: 'network', message: 'timeout' }); h.flow.request('pause'); await h.flow.confirm(); h.setRow(listing(status));
  await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().row?.status, status); assert.deepEqual(lifecycleActions(status), []); assert.equal(h.calls(), 1);
});
test('pending marker survives reopen and requires explicit reconciliation', async () => {
  const h = harness(); await h.ready(); h.error({ code: 'network', message: 'timeout' }, true); h.flow.request('pause'); await h.flow.confirm();
  const reopened = createListingLifecycleWorkflow(h.service, () => {}); reopened.setListing(listing()); await reopened.restore();
  assert.equal(reopened.getSnapshot().uncertain, true); assert.equal(reopened.request('archive'), false); await reopened.reconcile(); assert.equal(reopened.getSnapshot().row?.status, 'paused'); assert.equal(h.calls(), 1);
});
for (const change of ['account', 'listing', 'property', 'dispose'] as const) test(`${change} invalidates late lifecycle responses`, async () => {
  const h = harness(); await h.ready(); let release!: () => void; h.delay(new Promise<void>(resolve => { release = resolve; }));
  h.flow.request('pause'); const result = h.flow.confirm(); await new Promise<void>(resolve => setImmediate(resolve));
  if (change === 'account') h.user('40000000-0000-4000-8000-000000000001');
  if (change === 'listing') h.flow.setListing({ ...listing(), id: '40000000-0000-4000-8000-000000000001' });
  if (change === 'property') h.flow.setListing({ ...listing(), property_id: '40000000-0000-4000-8000-000000000001' });
  if (change === 'dispose') h.flow.dispose();
  release(); assert.equal(await result, false); assert.equal(h.applied.length, 1); assert.notEqual(h.flow.getSnapshot().row?.status, 'paused');
});
test('cross-workflow busy or uncertain state blocks request and confirmation', async () => {
  const h = harness(); await h.ready(); h.block(true); assert.equal(h.flow.request('pause'), false);
  h.block(false); h.flow.request('pause'); h.block(true); await h.flow.confirm(); assert.equal(h.calls(), 0); h.block(false); assert.equal(await h.flow.confirm(), true);
});
for (const key of [`rentlease:publish-pending:${userId}:${listingId}`, `rentlease:listing-draft-save:${userId}:${propertyId}`]) test(`unreconciled other workflow journal blocks lifecycle: ${key.split(':')[1]}`, async () => {
  const h = harness(); await h.ready(); h.journal.set(key, 'pending'); h.flow.request('pause'); await h.flow.confirm(); assert.equal(h.calls(), 0); assert.equal(h.flow.getSnapshot().uncertain, true);
});
for (const [message, expected] of [
  ['Only an active listing can be paused', /only be paused while it is published/], ['Only a paused listing can be reactivated', /Only a paused listing/],
  ['Only an active or paused listing can be archived', /Only a published or paused listing/], ['Listing status is controlled by an active tenancy', /cannot be changed manually/],
  ['Approved Tier 3 verification for this property is required before reactivating', /needs approved Tier 3/], ['Listing must reach at least 80%% completeness before publishing', /no longer meets/],
  ['This property already has a live listing', /another live listing/], ['Owned listing required secret-owner-uuid', /Check your account/],
] as const) test(`safe lifecycle denial: ${message.split(' ').slice(0, 4).join(' ')}`, async () => {
  assert.match(lifecycleBackendError({ message }).message, expected);
  const h = harness(); await h.ready(); h.error({ code: '42501', message }); h.flow.request('pause'); await h.flow.confirm();
  assert.match(h.flow.getSnapshot().error ?? '', expected); assert.doesNotMatch(h.flow.getSnapshot().error ?? '', /secret-owner/); assert.equal(h.flow.getSnapshot().uncertain, false); assert.equal(h.journal.size, 0);
});
test('fresh backend status changes block writes until checked again', async () => {
  const h = harness(); await h.ready(); h.setRow(listing('rented')); h.flow.request('pause'); await h.flow.confirm(); assert.equal(h.calls(), 0); assert.match(h.flow.getSnapshot().error ?? '', /status changed/);
});
test('backend statuses have explicit real UI labels without unavailable', () => {
  assert.deepEqual(lifecycleStatusLabel, { draft: 'Draft', active: 'Published', paused: 'Paused', rented: 'Rented', archived: 'Archived', removed: 'Removed' });
});
test('lifecycle presentation has no backend client and service exposes no generic status/rented writes', () => {
  const view = readFileSync('src/features/property-listing/views/PublishedListingStatusView.tsx', 'utf8'); assert.doesNotMatch(view, /getSupabaseClient|\.rpc\(|\.from\(|Mark unavailable|from ['"][^'"]*\/services\//);
  assert.deepEqual(Object.values(lifecycleRpc), ['pause_listing', 'reactivate_listing', 'archive_listing']);
  const service = readFileSync('src/features/property-listing/services/listingLifecycleService.ts', 'utf8'); assert.doesNotMatch(service, /\.(insert|update|upsert)\(|mark_rented|mark_unavailable|set_listing_status|geocod|MapTiler|XGBoost|Overpass/);
});
