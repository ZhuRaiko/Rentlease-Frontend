/// <reference types="node" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountCaches,createAccountCache,instrumentMutations,isMutatingRpc} from '../src/shared/utils/accountCache';
import {createLandlordPortfolioWorkflow} from '../src/features/property-listing/viewModels/landlordPortfolioWorkflow';
import {createMessagingWorkflow,type InboxSnapshot} from '../src/features/messaging-viewing/viewModels/messagingWorkflow';
import {beginWorkspaceRefresh,blankWorkspace,failWorkspaceRefresh,seedWorkspace,succeedWorkspace,type WorkspaceData} from '../src/features/tenancy/viewModels/tenancyWorkspaceState';
import {beginManagementRefresh,failManagementRefresh,seedManagement} from '../src/app/managementRead';

const A = '10000000-0000-4000-8000-00000000000a', B = '10000000-0000-4000-8000-00000000000b';
const item = (id: string) => ({ propertyId: id, property: { id }, currentListing: null }) as any;
const deferred = <T,>() => { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const tick = () => new Promise(r => setImmediate(r));

// ---- the cache itself -----------------------------------------------------------------------------------------------------------------------
test('a cached value is for one signed-in user only; another user, or nobody, gets nothing', () => {
  const cache = createAccountCache<string>();
  assert.equal(cache.set(A, 'mine', cache.begin()), true);
  assert.equal(cache.peek(A), 'mine'); assert.equal(cache.peek(B), null); assert.equal(cache.peek(undefined), null); assert.equal(cache.peek(null), null);
});
test('sign-out and account switch empty every cache', () => {
  const one = createAccountCache<string>(), two = createAccountCache<number>();
  one.set(A, 'x', one.begin()); two.set(A, 1, two.begin());
  accountCaches.invalidateAll();
  assert.equal(one.peek(A), null); assert.equal(two.peek(A), null);
});
test('a read that began before the cache was emptied cannot put old data back', () => {
  const cache = createAccountCache<string>(), token = cache.begin();
  accountCaches.invalidateAll();
  assert.equal(cache.set(A, 'stale', token), false); assert.equal(cache.peek(A), null);
  assert.equal(cache.set(A, 'fresh', cache.begin()), true);
});

// ---- every write empties the caches ---------------------------------------------------------------------------------------------------------
test('writes are told from reads by name', () => {
  for (const write of ['write_tenancy_lifecycle', 'write_tenancy_care', 'write_rent_ledger', 'manage_property_media', 'publish_listing', 'update_listing_draft', 'save_listing_draft', 'send_property_message', 'respond_rental_reservation', 'request_rental_reservation', 'respond_tenancy_establishment', 'establish_tenancy', 'set_saved_listing', 'create_property_setup', 'start_property_inquiry', 'delete_unfinished_post', 'write_tenancy_extension']) assert.equal(isMutatingRpc(write), true, write);
  for (const read of ['get_messaging_inbox', 'get_tenancy_care', 'get_rental_reservations', 'get_owned_property_identity_statuses', 'search_nearby_listings', 'list_unfinished_post_cleanup', 'get_pending_tenancy_extensions']) assert.equal(isMutatingRpc(read), false, read);
});
test('a write empties the caches when it is sent and again when it finishes; a read does not', async () => {
  let calls = 0; const builder = () => { const b: any = { then: (ok: any, no: any) => Promise.resolve({ data: 1 }).then(ok, no) }; return b; };
  const client: any = { rpc: (_name: string) => builder() };
  instrumentMutations(client, () => { calls++; });
  await client.rpc('get_messaging_inbox'); assert.equal(calls, 0);
  const pending = client.rpc('write_tenancy_lifecycle'); assert.equal(calls, 1, 'emptied when sent');
  await pending; assert.equal(calls, 2, 'emptied again when it finished');
});
test('a failed write also empties the caches', async () => {
  let calls = 0; const client: any = { rpc: () => ({ then: (ok: any, no: any) => Promise.reject(new Error('x')).then(ok, no) }) };
  instrumentMutations(client, () => { calls++; });
  await assert.rejects(Promise.resolve(client.rpc('manage_property_media')), /x/); assert.equal(calls, 2);
});
test('a read that was in flight during a write cannot refill the cache with the old list', () => {
  const cache = createAccountCache<string>(), token = cache.begin();
  const client: any = { rpc: () => ({ then: (ok: any) => Promise.resolve({}).then(ok) }) };
  instrumentMutations(client);
  client.rpc('publish_listing');
  assert.equal(cache.set(A, 'read before the write', token), false);
});

// ---- My properties --------------------------------------------------------------------------------------------------------------------------
const portfolioService = (load: () => Promise<any[]>, owner = A) => ({ user: async () => owner, load, assertUser: async () => {} }) as any;
test('My properties: a cached list shows at once, before the refresh resolves, then the new result swaps in', async () => {
  const store = createAccountCache<any[]>(); store.set(A, [item('p1'), item('p2')], store.begin());
  const gate = deferred<any[]>(), flow = createLandlordPortfolioWorkflow(portfolioService(() => gate.promise), { store, owner: A });
  assert.equal(flow.getSnapshot().loaded, true); assert.deepEqual(flow.getSnapshot().items.map(i => i.propertyId), ['p1', 'p2']);
  const loading = flow.load(); await tick();
  assert.equal(flow.getSnapshot().busy, true); assert.equal(flow.getSnapshot().items.length, 2, 'the list is still there while it refreshes');
  gate.resolve([item('p1'), item('p3')]); await loading;
  assert.deepEqual(flow.getSnapshot().items.map(i => i.propertyId), ['p1', 'p3']); assert.deepEqual(store.peek(A)?.map(i => i.propertyId), ['p1', 'p3']);
});
test('My properties: with nothing cached the first load is a full loading state', async () => {
  const store = createAccountCache<any[]>(), gate = deferred<any[]>(), flow = createLandlordPortfolioWorkflow(portfolioService(() => gate.promise), { store, owner: A });
  assert.equal(flow.getSnapshot().loaded, false); const loading = flow.load(); await tick();
  assert.equal(flow.getSnapshot().busy, true); assert.equal(flow.getSnapshot().loaded, false); gate.resolve([item('p1')]); await loading;
  assert.equal(flow.getSnapshot().loaded, true);
});
test("My properties: another account never sees this account's list, and sign-out empties it", () => {
  const store = createAccountCache<any[]>(); store.set(A, [item('p1')], store.begin());
  assert.equal(createLandlordPortfolioWorkflow(portfolioService(async () => []), { store, owner: B }).getSnapshot().items.length, 0);
  accountCaches.invalidateAll();
  assert.equal(createLandlordPortfolioWorkflow(portfolioService(async () => []), { store, owner: A }).getSnapshot().loaded, false);
});
test('My properties: a failed refresh keeps the list and shows a quiet retry, not an error screen', async () => {
  const store = createAccountCache<any[]>(); store.set(A, [item('p1')], store.begin());
  const flow = createLandlordPortfolioWorkflow(portfolioService(async () => { throw new Error('offline'); }), { store, owner: A });
  await flow.load();
  const s = flow.getSnapshot(); assert.equal(s.items.length, 1); assert.equal(s.loaded, true); assert.equal(s.error, null); assert.ok(s.refreshError); assert.equal(s.busy, false);
  assert.equal(store.peek(A)?.length, 1, 'the failed read did not touch the cache');
});
test('My properties: with no cache a failed first load keeps the existing error behavior', async () => {
  const flow = createLandlordPortfolioWorkflow(portfolioService(async () => { throw new Error('offline'); }), { store: createAccountCache<any[]>(), owner: A });
  await flow.load(); const s = flow.getSnapshot(); assert.equal(s.loaded, false); assert.ok(s.error); assert.equal(s.refreshError, null);
});
test('My properties: a write (invalidate) empties the cache and the list', async () => {
  const store = createAccountCache<any[]>(), flow = createLandlordPortfolioWorkflow(portfolioService(async () => [item('p1')]), { store, owner: A });
  await flow.load(); assert.equal(store.peek(A)?.length, 1);
  flow.invalidate(); assert.equal(store.peek(A), null); assert.equal(flow.getSnapshot().loaded, false);
});
test('delete: the item leaves the list at once, the list is read again, and the list never goes away', async () => {
  const store = createAccountCache<any[]>(), gate = deferred<any[]>();
  let reads = 0; const flow = createLandlordPortfolioWorkflow(portfolioService(() => { reads++; return reads === 1 ? Promise.resolve([item('p1'), item('p2')]) : gate.promise; }), { store, owner: A });
  await flow.load();
  const removing = flow.remove('p1'); await tick();
  const during = flow.getSnapshot();
  assert.deepEqual(during.items.map(i => i.propertyId), ['p2'], 'gone immediately, before the re-read finishes'); assert.equal(during.loaded, true); assert.equal(during.error, null);
  gate.resolve([item('p2')]); await removing;
  assert.deepEqual(flow.getSnapshot().items.map(i => i.propertyId), ['p2']); assert.equal(reads, 2);
});
test('delete: a failed re-read keeps the list without the deleted item and offers a quiet retry', async () => {
  const store = createAccountCache<any[]>(); let reads = 0;
  const flow = createLandlordPortfolioWorkflow(portfolioService(async () => { reads++; if (reads === 1) return [item('p1'), item('p2')]; throw new Error('offline'); }), { store, owner: A });
  await flow.load(); await flow.remove('p1');
  const s = flow.getSnapshot(); assert.deepEqual(s.items.map(i => i.propertyId), ['p2']); assert.equal(s.loaded, true); assert.equal(s.error, null); assert.ok(s.refreshError);
});
test('delete: an older read that was still running cannot bring the deleted item back', async () => {
  const store = createAccountCache<any[]>(), slow = deferred<any[]>(); let reads = 0;
  const flow = createLandlordPortfolioWorkflow(portfolioService(() => { reads++; return reads === 1 ? Promise.resolve([item('p1'), item('p2')]) : reads === 2 ? slow.promise : Promise.resolve([item('p2')]); }), { store, owner: A });
  await flow.load(); const older = flow.load(); await tick();
  await flow.remove('p1'); slow.resolve([item('p1'), item('p2')]); await older;
  assert.deepEqual(flow.getSnapshot().items.map(i => i.propertyId), ['p2']);
});

// ---- Messages -------------------------------------------------------------------------------------------------------------------------------
const row = (id: string) => ({ id, listingId: id, listingTitle: 't', tenantId: A, landlordId: B, participantName: null, status: 'open', activityAt: '2026-11-18T00:00:00Z', latestBody: null, latestType: null }) as any;
const messagingService = (inbox: () => Promise<any[]>, owner = A) => ({ user: async () => owner, inbox }) as any;
test('Messages: a cached conversation list shows at once, before the refresh resolves, then the new result swaps in', async () => {
  const store = createAccountCache<InboxSnapshot>(); store.set(A, { inbox: [row('c1'), row('c2')], inboxMore: false, inboxOffset: 2 }, store.begin());
  const gate = deferred<any[]>(), flow = createMessagingWorkflow(messagingService(() => gate.promise), () => 'id', { store, owner: A });
  assert.deepEqual(flow.getSnapshot().inbox.map(c => c.id), ['c1', 'c2']);
  const loading = flow.inbox(); await tick();
  assert.equal(flow.getSnapshot().inboxBusy, true); assert.equal(flow.getSnapshot().inbox.length, 2, 'the list stays while it refreshes');
  gate.resolve([row('c3'), row('c1')]); await loading;
  assert.deepEqual(flow.getSnapshot().inbox.map(c => c.id).sort(), ['c1', 'c2', 'c3']); assert.equal(store.peek(A)?.inbox.length, 3);
});
test("Messages: another account never sees this account's list; sign-out empties it; no cache means a full first load", () => {
  const store = createAccountCache<InboxSnapshot>(); store.set(A, { inbox: [row('c1')], inboxMore: false, inboxOffset: 1 }, store.begin());
  assert.equal(createMessagingWorkflow(messagingService(async () => []), () => 'id', { store, owner: B }).getSnapshot().inbox.length, 0);
  accountCaches.invalidateAll();
  const fresh = createMessagingWorkflow(messagingService(async () => []), () => 'id', { store, owner: A }); assert.equal(fresh.getSnapshot().inbox.length, 0);
});
test('Messages: a failed refresh keeps the list and shows a quiet retry; with no list it is the existing error', async () => {
  const store = createAccountCache<InboxSnapshot>(); store.set(A, { inbox: [row('c1')], inboxMore: false, inboxOffset: 1 }, store.begin());
  const kept = createMessagingWorkflow(messagingService(async () => { throw new Error('offline'); }), () => 'id', { store, owner: A });
  await kept.inbox(); assert.equal(kept.getSnapshot().inbox.length, 1); assert.equal(kept.getSnapshot().inboxError, null); assert.ok(kept.getSnapshot().inboxRefreshError);
  const none = createMessagingWorkflow(messagingService(async () => { throw new Error('offline'); }), () => 'id', { store: createAccountCache<InboxSnapshot>(), owner: A });
  await none.inbox(); assert.ok(none.getSnapshot().inboxError); assert.equal(none.getSnapshot().inboxRefreshError, null);
});
test('Messages: sending a message (a write) empties the cache so the old last-message line is never shown', () => {
  const store = createAccountCache<InboxSnapshot>(); store.set(A, { inbox: [row('c1')], inboxMore: false, inboxOffset: 1 }, store.begin());
  const client: any = { rpc: () => ({ then: (ok: any) => Promise.resolve({}).then(ok) }) }; instrumentMutations(client);
  client.rpc('send_property_message'); assert.equal(store.peek(A), null);
});

// ---- Tenancy tab ----------------------------------------------------------------------------------------------------------------------------
const data = (ids: string[]): WorkspaceData => ({ tenancies: ids.map(id => ({ id }) as any), reservations: [], contexts: {}, contextWarning: null, links: null, offset: 0, activity: null });
test('Tenancy tab: a cached result is on screen at once with the counts, and a refresh is pending', () => {
  const s = seedWorkspace(A, data(['t1', 't2']));
  assert.equal(s.loaded, true); assert.equal(s.tenancies.length, 2); assert.equal(s.busy, true); assert.equal(s.error, null);
});
test('Tenancy tab: with nothing cached the first load is empty and loading, so the screen shows placeholders, not "--"', () => {
  const s = seedWorkspace(A, null); assert.equal(s.loaded, false); assert.equal(s.busy, true); assert.equal(s.tenancies.length, 0);
});
test("Tenancy tab: another account's cached result is never used", () => {
  const cache = createAccountCache<WorkspaceData>(); cache.set(A, data(['t1']), cache.begin());
  assert.equal(seedWorkspace(B, cache.peek(B)).loaded, false);
  accountCaches.invalidateAll(); assert.equal(seedWorkspace(A, cache.peek(A)).loaded, false);
});
test('Tenancy tab: a refresh keeps the data on screen and only turns busy on; the new result swaps in', () => {
  const shown = succeedWorkspace(A, data(['t1'])), refreshing = beginWorkspaceRefresh(shown, A, null);
  assert.equal(refreshing.loaded, true); assert.equal(refreshing.busy, true); assert.equal(refreshing.tenancies.length, 1);
  assert.equal(succeedWorkspace(A, data(['t1', 't2'])).tenancies.length, 2);
});
test('Tenancy tab: a failed refresh keeps the data and sets a quiet refreshError; with none it is the existing error', () => {
  const shown = succeedWorkspace(A, data(['t1'])), failed = failWorkspaceRefresh(beginWorkspaceRefresh(shown, A, null), A, 'offline');
  assert.equal(failed.tenancies.length, 1); assert.equal(failed.loaded, true); assert.equal(failed.error, null); assert.equal(failed.refreshError, 'offline'); assert.equal(failed.busy, false);
  const first = failWorkspaceRefresh(blankWorkspace(A, true), A, 'offline'); assert.equal(first.loaded, false); assert.equal(first.error, 'offline'); assert.equal(first.refreshError, null);
});
test('Tenancy tab: a different account never inherits the data on screen', () => {
  const shown = succeedWorkspace(A, data(['t1'])); assert.equal(beginWorkspaceRefresh(shown, B, null).tenancies.length, 0);
});

// ---- My properties facts (Need you, Occupied) -----------------------------------------------------------------------------------------------
const empty = () => ({ care: {} });
test('Manage facts: cached facts are on screen at once; a refresh keeps them; a failed refresh keeps them quietly', () => {
  const seeded = seedManagement(A, { tenancies: [{ id: 't1' }], activity: { care: { x: 1 } } as any, inbox: [] }, empty as any);
  assert.equal(seeded.loaded, true); assert.equal(seeded.tenancies.length, 1);
  const refreshing = beginManagementRefresh(seeded, A, null, empty as any); assert.equal(refreshing.tenancies.length, 1); assert.equal(refreshing.busy, true);
  const failed = failManagementRefresh(refreshing, A, 'x', empty as any); assert.equal(failed.tenancies.length, 1); assert.equal(failed.error, null);
  assert.equal(failManagementRefresh(seedManagement(A, null, empty as any), A, 'x', empty as any).error, 'x');
  assert.equal(beginManagementRefresh(seeded, B, null, empty as any).tenancies.length, 0);
});
