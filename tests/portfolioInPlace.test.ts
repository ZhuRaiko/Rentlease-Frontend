/// <reference types="node" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAccountCache} from '../src/shared/utils/accountCache';
import {createLandlordPortfolioWorkflow,patchListing} from '../src/features/property-listing/viewModels/landlordPortfolioWorkflow';

const OWNER = '10000000-0000-4000-8000-00000000000a';
const listing = (id: string, property: string, status: string, extra: Record<string, unknown> = {}) => ({ id, property_id: property, status, title: `Listing ${id}`, asking_rent_monthly: 9000, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', ...extra });
const item = (property: string, rows: any[]) => ({ propertyId: property, property: { id: property }, listings: rows, currentListing: rows[0] ?? null }) as any;
const tick = () => new Promise(r => setImmediate(r));
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(res => { resolve = res; }); return { promise, resolve }; };
const service = (load: () => Promise<any[]>) => ({ user: async () => OWNER, load, assertUser: async () => {} }) as any;
const start = (items: any[], load?: () => Promise<any[]>) => { const store = createAccountCache<any[]>(); return createLandlordPortfolioWorkflow(service(load ?? (async () => items)), { store, owner: OWNER }); };
const ids = (flow: ReturnType<typeof start>) => flow.getSnapshot().items.map(i => `${i.propertyId}:${i.currentListing?.status ?? '-'}`);

/** One row per action: the listing as the backend confirms it. */
const actions: { name: string; before: string; after: string; row: (id: string, p: string) => any }[] = [
  { name: 'archive', before: 'active', after: 'archived', row: (id, p) => listing(id, p, 'archived') },
  { name: 'pause', before: 'active', after: 'paused', row: (id, p) => listing(id, p, 'paused') },
  { name: 'relist', before: 'paused', after: 'active', row: (id, p) => listing(id, p, 'active') },
  { name: 'publish', before: 'draft', after: 'active', row: (id, p) => listing(id, p, 'active', { published_at: '2026-11-18T00:00:00Z' }) },
  { name: 'draft save', before: 'draft', after: 'draft', row: (id, p) => listing(id, p, 'draft', { title: 'Saved title', asking_rent_monthly: 12500 }) },
];
for (const action of actions) {
  test(`${action.name}: the item changes in place at once, the list stays on screen, and the list is read again in the background`, async () => {
    const before = [item('p1', [listing('l1', 'p1', action.before)]), item('p2', [listing('l2', 'p2', 'active')])];
    const gate = deferred<any[]>(); let reads = 0;
    const flow = start(before, () => { reads++; return reads === 1 ? Promise.resolve(before) : gate.promise; });
    await flow.load(); assert.equal(flow.getSnapshot().loaded, true);
    flow.applyListing(action.row('l1', 'p1'));
    const during = flow.getSnapshot();
    assert.equal(during.loaded, true, 'the list never goes away'); assert.equal(during.items.length, 2); assert.equal(during.error, null);
    assert.equal(during.items[0]!.currentListing!.status, action.after, 'the affected item is updated immediately');
    assert.equal(during.items[1]!.currentListing!.status, 'active', 'other items are untouched');
    assert.equal(during.stale, true, 'a background re-read is due');
    if (action.name === 'draft save') { assert.equal(during.items[0]!.currentListing!.title, 'Saved title'); assert.equal(during.items[0]!.currentListing!.asking_rent_monthly, 12500); }
    const reload = flow.load(); await tick();
    assert.equal(flow.getSnapshot().items.length, 2, 'still visible while it re-reads'); assert.equal(flow.getSnapshot().stale, false);
    gate.resolve([item('p1', [action.row('l1', 'p1')]), item('p2', [listing('l2', 'p2', 'active')])]); await reload;
    assert.equal(ids(flow)[0], `p1:${action.after}`); assert.equal(reads, 2);
  });
  test(`${action.name}: a failed re-read keeps the list with the change and shows a quiet retry, not an empty screen`, async () => {
    const before = [item('p1', [listing('l1', 'p1', action.before)])]; let reads = 0;
    const flow = start(before, async () => { reads++; if (reads === 1) return before; throw new Error('offline'); });
    await flow.load(); flow.applyListing(action.row('l1', 'p1')); await flow.load();
    const s = flow.getSnapshot();
    assert.equal(s.items.length, 1); assert.equal(s.items[0]!.currentListing!.status, action.after); assert.equal(s.loaded, true); assert.equal(s.error, null); assert.ok(s.refreshError); assert.equal(s.busy, false);
    assert.equal(s.stale, false, 'no loop of retries on a failure; the user taps Retry');
  });
}
test('a change with no new row (a photo, a verification, a property edit) keeps the list and only marks a re-read as due', async () => {
  const before = [item('p1', [listing('l1', 'p1', 'active')])], flow = start(before);
  await flow.load(); flow.changed();
  const s = flow.getSnapshot(); assert.equal(s.loaded, true); assert.equal(s.items.length, 1); assert.equal(s.stale, true); assert.equal(s.busy, false);
});
test('an older read that was still running cannot bring back the old status over the user\'s own change', async () => {
  const before = [item('p1', [listing('l1', 'p1', 'active')])], slow = deferred<any[]>(); let reads = 0;
  const flow = start(before, () => { reads++; return reads === 1 ? Promise.resolve(before) : slow.promise; });
  await flow.load(); const older = flow.load(); await tick();
  flow.applyListing(listing('l1', 'p1', 'archived')); slow.resolve(before); await older;
  assert.equal(ids(flow)[0], 'p1:archived');
});
test('the cache is emptied by the change, so a reopened screen never shows the old status', async () => {
  const store = createAccountCache<any[]>(), before = [item('p1', [listing('l1', 'p1', 'active')])];
  const flow = createLandlordPortfolioWorkflow(service(async () => before), { store, owner: OWNER });
  await flow.load(); assert.equal(store.peek(OWNER)?.length, 1);
  flow.applyListing(listing('l1', 'p1', 'paused')); assert.equal(store.peek(OWNER), null);
});
test('a listing for a property that is not in the list yet (a new draft) is left to the background re-read', async () => {
  const flow = start([item('p1', [listing('l1', 'p1', 'active')])]); await flow.load();
  flow.applyListing(listing('l9', 'p9', 'draft')); const s = flow.getSnapshot();
  assert.equal(s.items.length, 1); assert.equal(s.stale, true);
});
test('patching keeps the item shape and picks the current listing by the same rule as the list', () => {
  const base = item('p1', [listing('l1', 'p1', 'draft'), listing('l0', 'p1', 'archived')]);
  const published = patchListing(base, listing('l1', 'p1', 'active'));
  assert.equal(published.currentListing!.id, 'l1'); assert.equal(published.currentListing!.status, 'active'); assert.equal(published.listings.length, 2); assert.equal(published.propertyId, 'p1');
  const added = patchListing(item('p1', [listing('l0', 'p1', 'archived')]), listing('l5', 'p1', 'draft'));
  assert.equal(added.listings.length, 2); assert.equal(added.currentListing!.id, 'l5');
});
