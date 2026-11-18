/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { MAX_PANORAMA_BYTES, clampPanOffset, maxPanOffset, panProgress, propertyPanoramaObjectPath, propertyPanoramaPath, stripAreaHeight, stripWidth, visibleFraction } from '../src/shared/models/PropertyPanorama';
import { readPublicPropertyPanoramas } from '../src/shared/services/publicPropertyPanoramas';
import { validatePanoramaAsset, type PanoramaAsset } from '../src/features/property-listing/models/PropertyPanoramaSelection';
import { PropertyPanoramaError, createPropertyPanoramaService } from '../src/features/property-listing/services/propertyPanoramaService';
import { createPropertyPanoramaWorkflow, roomTourBusy } from '../src/features/property-listing/viewModels/propertyPanoramaWorkflow';
import { createManualSearchService } from '../src/features/search-discovery/services/manualSearchService';
import { markDragHintSeen, openRoomTour, resetDragHintForTests, retrySide, roomTourSubtitle, selectSide, shouldShowDragHint, showSideSwitch, sideFailed, sideLoaded, switchEnabled } from '../src/features/search-discovery/viewModels/roomTourViewerState';

const owner = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002', property = '20000000-0000-4000-8000-000000000001', otherProperty = '20000000-0000-4000-8000-000000000002';
const file = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asset = (patch: Partial<PanoramaAsset> = {}): PanoramaAsset => ({ uri: 'file:///cache/pano.jpg', mimeType: 'image/jpeg', size: 4_000_000, width: 5000, height: 1000, ...patch });

// ---- geometry ----
test('strip geometry fits by HEIGHT: width follows the image shape, the viewport width does not matter', () => {
  assert.equal(stripAreaHeight(891), 463);
  assert.equal(stripWidth(460, 2400, 500), 2208);
  assert.equal(stripWidth(460, 5000, 1000), 2300);
  assert.equal(maxPanOffset(2300, 411), 1889);
});
test('pan is clamped at both edges and a bad number becomes the left edge', () => {
  assert.equal(clampPanOffset(-40, 1000), 0); assert.equal(clampPanOffset(1400, 1000), 1000); assert.equal(clampPanOffset(250, 1000), 250);
  assert.equal(clampPanOffset(Number.NaN, 1000), 0); assert.equal(clampPanOffset(50, 0), 0);
});
test('progress is 0 at the left edge, 1 at the right edge and 0 when nothing can move', () => {
  assert.equal(panProgress(0, 1000), 0); assert.equal(panProgress(500, 1000), 0.5); assert.equal(panProgress(1000, 1000), 1); assert.equal(panProgress(1500, 1000), 1); assert.equal(panProgress(10, 0), 0);
});
test('very narrow and very wide strips, and zero or invalid sizes, never produce NaN or negative offsets', () => {
  const narrow = stripWidth(460, 3000, 1000), huge = stripWidth(460, 16384, 1000);
  assert.equal(narrow, 1380); assert.ok(huge > narrow && Number.isFinite(huge));
  assert.equal(maxPanOffset(300, 411), 0);   // a strip narrower than the screen cannot move
  for (const bad of [0, -1, Number.NaN, Infinity]) { assert.equal(stripWidth(460, bad, 1000), 0); assert.equal(stripWidth(bad, 3000, 1000), 0); assert.equal(stripAreaHeight(bad), 0); assert.equal(maxPanOffset(bad, 411), 0); }
  assert.equal(visibleFraction(2300, 411), 411 / 2300); assert.equal(visibleFraction(300, 411), 1);
});

// ---- picked photo validation ----
test('selection: 3.0:1 is accepted, 2.9:1 is "not wide enough"', () => {
  assert.deepEqual(validatePanoramaAsset(asset({ width: 3000, height: 1000 })), { ok: true, mime: 'image/jpeg', width: 3000, height: 1000 });
  assert.deepEqual(validatePanoramaAsset(asset({ width: 2900, height: 1000 })), { ok: false, problem: 'aspect' });
});
test('selection: 16,384 px wide is accepted, 16,385 is too wide', () => {
  assert.equal(validatePanoramaAsset(asset({ width: 16384, height: 3000 })).ok, true);
  assert.deepEqual(validatePanoramaAsset(asset({ width: 16385, height: 3000 })), { ok: false, problem: 'width' });
});
test('selection: size limit is exactly 15 MiB and the type must be JPEG, PNG or WebP', () => {
  assert.equal(validatePanoramaAsset(asset({ size: MAX_PANORAMA_BYTES })).ok, true);
  assert.deepEqual(validatePanoramaAsset(asset({ size: MAX_PANORAMA_BYTES + 1 })), { ok: false, problem: 'size' });
  assert.deepEqual(validatePanoramaAsset(asset({ mimeType: 'image/gif' })), { ok: false, problem: 'type' });
  assert.equal(validatePanoramaAsset(asset({ mimeType: 'image/webp' })).ok, true);
});
test('selection: a missing mime type falls back to the file extension only; unknown shape is "unreadable"', () => {
  assert.equal(validatePanoramaAsset(asset({ mimeType: null, uri: 'file:///x/pano.PNG' })).ok, true);
  assert.deepEqual(validatePanoramaAsset(asset({ mimeType: null, uri: 'file:///x/pano.heic' })), { ok: false, problem: 'type' });
  assert.deepEqual(validatePanoramaAsset(asset({ width: 0, height: 0 })), { ok: false, problem: 'unreadable' });
  assert.deepEqual(validatePanoramaAsset(asset({ uri: '  ' })), { ok: false, problem: 'unreadable' });
});

// ---- path model ----
test('path model accepts the exact stored shape, jpeg included', () => {
  const p = propertyPanoramaPath(owner, property, file(1), 'image/jpeg');
  assert.equal(p, `${owner}/${property}/${file(1)}.jpg`);
  assert.equal(propertyPanoramaObjectPath(p, owner, property), p);
  assert.equal(propertyPanoramaObjectPath(`${owner}/${property}/${file(2)}.jpeg`, owner, property), `${owner}/${property}/${file(2)}.jpeg`);
});
test('path model rejects another owner or property, a bad uuid, a bad extension, upper case, a bucket prefix and non-strings', () => {
  const good = `${owner}/${property}/${file(1)}.png`;
  assert.throws(() => propertyPanoramaObjectPath(good, other, property));
  assert.throws(() => propertyPanoramaObjectPath(good, owner, otherProperty));
  assert.throws(() => propertyPanoramaObjectPath(`${owner}/${property}/not-a-uuid.png`, owner, property));
  assert.throws(() => propertyPanoramaObjectPath(`${owner}/${property}/${file(1)}.gif`, owner, property));
  assert.throws(() => propertyPanoramaObjectPath(good.toUpperCase(), owner, property));
  assert.throws(() => propertyPanoramaObjectPath(`property-panoramas/${good}`, owner, property));
  assert.throws(() => propertyPanoramaObjectPath(`${owner}/${property}/x/${file(1)}.png`, owner, property));
  assert.throws(() => propertyPanoramaObjectPath(null, owner, property));
  assert.throws(() => propertyPanoramaPath(owner, 'not-a-uuid', file(1), 'image/png'));
});

// ---- fake Supabase client (owner service) ----
type Fail = { code?: string; message?: string } | null;
function harness(options: { uploadError?: boolean; user?: string | null } = {}) {
  const calls: string[] = [];
  let rpcResult: { data: unknown; error: Fail } = { data: null, error: null };
  let rpcThrows = false, removeThrows = false, rows: Record<string, unknown>[] = [], ownsProperty = true, uploadGate: Promise<void> | null = null, user = options.user === undefined ? owner : options.user;
  const client = {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) },
    from(table: string) {
      const q: Record<string, unknown> = {};
      const chain = () => q;
      if (table === 'properties') { q.select = chain; q.eq = chain; q.maybeSingle = async () => ({ data: ownsProperty ? { id: property, landlord_id: user } : null, error: null }); return q; }
      q.select = chain; q.eq = chain; q.limit = chain; q.abortSignal = chain; q.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
      return q;
    },
    rpc: async (name: string, args: Record<string, unknown>) => { calls.push(`rpc:${name}:${args.p_side}`); if (rpcThrows) throw new Error('network'); return rpcResult; },
    storage: { from: () => ({
      upload: async (path: string, _body: ArrayBuffer, opts: { upsert: boolean; contentType: string }) => { calls.push(`upload:${path}:${opts.upsert}:${opts.contentType}`); if (uploadGate) await uploadGate; return { error: options.uploadError ? { message: 'x' } : null }; },
      remove: async (paths: string[]) => { calls.push(`remove:${paths.join(',')}`); if (removeThrows) throw new Error('cannot delete'); return { error: null }; },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } }),
    }) },
  } as unknown as SupabaseClient<Database>;
  let n = 100;
  const service = createPropertyPanoramaService(() => client, { read: async () => new ArrayBuffer(24), uuid: () => file(n++) });
  return { service, calls, ctx: { ownerId: owner, propertyId: property }, set: { rpc: (v: { data: unknown; error: Fail }) => { rpcResult = v; }, rpcThrows: (v: boolean) => { rpcThrows = v; }, removeThrows: (v: boolean) => { removeThrows = v; }, rows: (v: Record<string, unknown>[]) => { rows = v; }, owns: (v: boolean) => { ownsProperty = v; }, gate: (v: Promise<void> | null) => { uploadGate = v; }, user: (v: string | null) => { user = v; } } };
}
const stored = (n: number, ext = 'jpg') => `${owner}/${property}/${file(n)}.${ext}`;

test('upload: uploads with upsert false and the right content type, then records the side with the picked size', async () => {
  const h = harness(); h.set.rpc({ data: { side: 'front', storage_path: stored(100), replaced_path: null }, error: null });
  const result = await h.service.upload(h.ctx, 'front', asset({ mimeType: 'image/png' }));
  assert.deepEqual(h.calls, [`upload:${stored(100, 'png')}:false:image/png`, 'rpc:set_property_panorama:front']);
  assert.deepEqual(result, { side: 'front', url: `https://example.test/${stored(100, 'png')}`, width: 5000, height: 1000 });
});
test('upload that replaces a side deletes the old file afterwards; a failed delete is ignored', async () => {
  const h = harness(); h.set.rpc({ data: { side: 'front', storage_path: stored(100), replaced_path: stored(7) }, error: null });
  await h.service.upload(h.ctx, 'front', asset());
  assert.equal(h.calls.at(-1), `remove:${stored(7)}`);
  const h2 = harness(); h2.set.rpc({ data: { side: 'back', storage_path: stored(100), replaced_path: stored(7) }, error: null }); h2.set.removeThrows(true);
  assert.equal((await h2.service.upload(h2.ctx, 'back', asset())).side, 'back');
});
test('upload never deletes a replaced path that is not this owner and property', async () => {
  const h = harness(); h.set.rpc({ data: { side: 'front', storage_path: stored(100), replaced_path: `${other}/${property}/${file(9)}.jpg` }, error: null });
  await h.service.upload(h.ctx, 'front', asset());
  assert.ok(!h.calls.some(c => c.startsWith('remove:')));
});
test('upload refused by the backend deletes the just-uploaded file BEFORE the error reaches the caller, and maps the contract messages', async () => {
  const h = harness(); h.set.rpc({ data: null, error: { code: '22023', message: 'Panorama must be at least 3:1 wide' } });
  const error = await h.service.upload(h.ctx, 'front', asset()).catch(e => e);
  assert.ok(error instanceof PropertyPanoramaError && error.kind === 'aspect');
  assert.deepEqual(h.calls, [`upload:${stored(100)}:false:image/jpeg`, 'rpc:set_property_panorama:front', `remove:${stored(100)}`]);
  h.set.rpc({ data: null, error: { code: '22023', message: 'Panorama is too wide' } });
  assert.equal((await h.service.upload(h.ctx, 'front', asset()).catch(e => e)).kind, 'width');
  h.set.rpc({ data: null, error: { code: '42501', message: 'Owned active property required' } });
  assert.equal((await h.service.upload(h.ctx, 'front', asset()).catch(e => e)).kind, 'upload');
});
test('upload with no answer from the server keeps the file only if the row now points at it', async () => {
  const h = harness(); h.set.rpcThrows(true); h.set.rows([{ side: 'front', storage_path: stored(100), width: 5000, height: 1000 }]);
  assert.equal((await h.service.upload(h.ctx, 'front', asset())).side, 'front');
  assert.ok(!h.calls.some(c => c.startsWith('remove:')));
  const h2 = harness(); h2.set.rpcThrows(true);
  assert.equal((await h2.service.upload(h2.ctx, 'front', asset()).catch(e => e)).kind, 'upload');
  assert.ok(h2.calls.includes(`remove:${stored(100)}`));
});
test('a failed upload never removes an existing side and never calls the save RPC', async () => {
  const h = harness({ uploadError: true });
  assert.equal((await h.service.upload(h.ctx, 'front', asset()).catch(e => e)).kind, 'upload');
  assert.deepEqual(h.calls, [`upload:${stored(100)}:false:image/jpeg`]);
});
test('too large, not wide enough and wrong type never reach storage or the database', async () => {
  const h = harness();
  for (const [bad, kind] of [[asset({ size: MAX_PANORAMA_BYTES + 1 }), 'size'], [asset({ width: 2000, height: 1000 }), 'aspect'], [asset({ mimeType: 'image/gif' }), 'type']] as const) assert.equal((await h.service.upload(h.ctx, 'front', bad).catch(e => e)).kind, kind);
  assert.deepEqual(h.calls, []);
});
test('only one change runs at a time per property', async () => {
  const h = harness(); h.set.rpc({ data: { side: 'front', storage_path: stored(100), replaced_path: null }, error: null });
  let release = () => {}; h.set.gate(new Promise<void>(r => { release = r; }));
  const first = h.service.upload(h.ctx, 'front', asset());
  await new Promise(r => setTimeout(r, 0));
  const second = await h.service.upload(h.ctx, 'back', asset()).catch(e => e);
  assert.ok(second instanceof PropertyPanoramaError && /still running/.test(second.message));
  release(); await first;
  assert.equal((await h.service.upload(h.ctx, 'back', asset()).catch(e => e)).side, 'back');   // the lock is released afterwards
});
test('ownership failure: another account or a property that is not the caller\'s never touches storage', async () => {
  const h = harness(); h.set.owns(false);
  assert.equal((await h.service.upload(h.ctx, 'front', asset()).catch(e => e)).kind, 'context');
  const h2 = harness({ user: null }); assert.equal((await h2.service.context(property).catch(e => e)).kind, 'context');
  const h3 = harness(); h3.set.user(other);
  assert.equal((await h3.service.upload(h3.ctx, 'front', asset()).catch(e => e)).kind, 'context');
  assert.deepEqual([...h.calls, ...h3.calls], []);
  assert.equal((await harness().service.context('not-a-uuid').catch(e => e)).kind, 'context');
});
test('remove: records the removal, then deletes the old file best effort; an empty side is fine', async () => {
  const h = harness(); h.set.rpc({ data: { side: 'front', removed_path: stored(5) }, error: null });
  await h.service.remove(h.ctx, 'front');
  assert.deepEqual(h.calls, ['rpc:remove_property_panorama:front', `remove:${stored(5)}`]);
  const h2 = harness(); h2.set.rpc({ data: { side: 'back', removed_path: null }, error: null });
  await h2.service.remove(h2.ctx, 'back'); assert.deepEqual(h2.calls, ['rpc:remove_property_panorama:back']);
  const h3 = harness(); h3.set.rpc({ data: null, error: { code: '42501' } });
  assert.equal((await h3.service.remove(h3.ctx, 'front').catch(e => e)).kind, 'remove');
});
test('reading the room tour confirms every stored path and skips rows it cannot confirm', async () => {
  const h = harness(); h.set.rows([{ side: 'back', storage_path: stored(2), width: 4000, height: 1000 }, { side: 'front', storage_path: stored(1), width: 5000, height: 1000 }, { side: 'front', storage_path: `${other}/${property}/${file(3)}.jpg`, width: 1, height: 1 }, { side: 'left', storage_path: stored(4), width: 1, height: 1 }]);
  const client = { from: () => ({ select() { return this; }, eq() { return this; }, limit() { return this; }, then: (r: (v: unknown) => unknown) => r({ data: [{ side: 'back', storage_path: stored(2), width: 4000, height: 1000 }, { side: 'front', storage_path: stored(1), width: 5000, height: 1000 }, { side: 'front', storage_path: `${other}/${property}/${file(3)}.jpg`, width: 1, height: 1 }, { side: 'left', storage_path: stored(4), width: 1, height: 1 }, { side: 'back', storage_path: `property-panoramas/${stored(2)}`, width: 4000, height: 1000 }], error: null }) }), storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://example.test/${p}` } }) }) } } as unknown as SupabaseClient<Database>;
  const tour = await readPublicPropertyPanoramas(client, { propertyId: property, ownerId: owner });
  assert.deepEqual(tour.map(p => p.side), ['front', 'back']); assert.equal(tour[0]!.url, `https://example.test/${stored(1)}`);
  const failing = { from: () => ({ select() { return this; }, eq() { return this; }, limit() { return this; }, then: (r: (v: unknown) => unknown) => r({ data: null, error: { message: 'raw' } }) }), storage: {} } as unknown as SupabaseClient<Database>;
  await assert.rejects(() => readPublicPropertyPanoramas(failing, { propertyId: property, ownerId: owner }), /Could not load the room tour/);
});

// ---- owner workflow (fake service) ----
function flow(initialRows: { side: 'front' | 'back' }[] = []) {
  const calls: string[] = []; let pickResult: PanoramaAsset | null = asset(), pickThrows = false, uploadError: PropertyPanoramaError | null = null, listError = false, uploadGate: Promise<void> | null = null, removeError = false;
  const service = {
    context: async (id: string) => ({ ownerId: owner, propertyId: id }),
    assertContext: async () => {},
    list: async () => { if (listError) throw new PropertyPanoramaError('context', 'Could not load the room tour. Check your connection.'); return initialRows.map(r => ({ side: r.side, url: `https://example.test/${r.side}`, width: 5000, height: 1000 })); },
    upload: async (_c: unknown, side: 'front' | 'back') => { calls.push(`upload:${side}`); if (uploadGate) await uploadGate; if (uploadError) throw uploadError; return { side, url: `https://example.test/new-${side}`, width: 5000, height: 1000 }; },
    remove: async (_c: unknown, side: 'front' | 'back') => { calls.push(`remove:${side}`); if (removeError) throw new PropertyPanoramaError('remove', 'Couldn’t remove it. Check your connection and try again.'); },
  };
  const workflow = createPropertyPanoramaWorkflow(service as never, async () => { calls.push('pick'); if (pickThrows) throw new Error('picker'); return pickResult; });
  return { workflow, calls, set: { pick: (v: PanoramaAsset | null) => { pickResult = v; }, pickThrows: (v: boolean) => { pickThrows = v; }, uploadError: (v: PropertyPanoramaError | null) => { uploadError = v; }, listError: (v: boolean) => { listError = v; }, gate: (v: Promise<void> | null) => { uploadGate = v; }, removeError: (v: boolean) => { removeError = v; } } };
}
const settle = () => new Promise(r => setTimeout(r, 0));
async function loaded(rows: { side: 'front' | 'back' }[] = []) { const f = flow(rows); f.workflow.setProperty(property); await settle(); return f; }

test('workflow loads the saved sides into their tiles; a different property starts over', async () => {
  const f = await loaded([{ side: 'front' }]); const s = f.workflow.getSnapshot();
  assert.equal(s.loaded, true); assert.equal(s.sides.front.status, 'ready'); assert.equal(s.sides.back.status, 'idle');
  f.workflow.setProperty(otherProperty); assert.equal(f.workflow.getSnapshot().loaded, false); assert.equal(f.workflow.getSnapshot().sides.front.status, 'idle');
  f.workflow.setProperty(null); assert.equal(f.workflow.getSnapshot().propertyId, null);
});
test('workflow: an empty tile picks, uploads and becomes ready; picking again is not offered for a saved tile', async () => {
  const f = await loaded();
  await f.workflow.pick('back');
  assert.deepEqual(f.calls, ['pick', 'upload:back']); assert.equal(f.workflow.getSnapshot().sides.back.status, 'ready');
  await f.workflow.pick('back'); assert.deepEqual(f.calls, ['pick', 'upload:back']);
});
test('workflow: closing the picker changes nothing', async () => {
  const f = await loaded([{ side: 'front' }]); f.set.pick(null);
  await f.workflow.pick('back'); assert.equal(f.workflow.getSnapshot().sides.back.status, 'idle');
  await f.workflow.replace('front'); assert.equal(f.workflow.getSnapshot().sides.front.status, 'ready'); assert.ok(f.workflow.getSnapshot().sides.front.panorama);
});
test('workflow: a problem tile shows its reason and tapping it ALWAYS reopens the picker; a failed replace keeps the saved panorama', async () => {
  const f = await loaded([{ side: 'front' }]); f.set.uploadError(new PropertyPanoramaError('aspect', ''));
  await f.workflow.replace('front');
  let front = f.workflow.getSnapshot().sides.front;
  assert.equal(front.status, 'error'); assert.equal(front.problem, 'aspect'); assert.ok(front.panorama, 'the saved panorama is not removed by a failed replace');
  f.set.uploadError(null); f.calls.length = 0;
  await f.workflow.pick('front');
  assert.deepEqual(f.calls, ['pick', 'upload:front']); front = f.workflow.getSnapshot().sides.front;
  assert.equal(front.status, 'ready'); assert.equal(front.problem, null); assert.equal(front.panorama!.url, 'https://example.test/new-front');
});
test('workflow: a picker that throws becomes a problem tile; an unusable property becomes a card message, not a tile problem', async () => {
  const f = await loaded(); f.set.pickThrows(true); await f.workflow.pick('front');
  assert.equal(f.workflow.getSnapshot().sides.front.problem, 'pick');
  const g = await loaded(); g.set.uploadError(new PropertyPanoramaError('context', 'This property is unavailable for a room tour.'));
  await g.workflow.pick('front');
  assert.equal(g.workflow.getSnapshot().sides.front.status, 'idle'); assert.equal(g.workflow.getSnapshot().notice, 'This property is unavailable for a room tour.');
});
test('workflow: one change at a time; the other tile and the menu are disabled while a side uploads', async () => {
  const f = await loaded([{ side: 'front' }]); let release = () => {}; f.set.gate(new Promise<void>(r => { release = r; }));
  const first = f.workflow.pick('back'); await settle();
  assert.equal(roomTourBusy(f.workflow.getSnapshot()), true); assert.equal(f.workflow.getSnapshot().sides.back.status, 'uploading');
  await f.workflow.pick('back'); f.workflow.openMenu('front'); f.workflow.requestRemove('front');
  assert.equal(f.workflow.getSnapshot().menuSide, null); assert.equal(f.workflow.getSnapshot().removeSide, null);
  assert.deepEqual(f.calls, ['pick', 'upload:back']);
  release(); await first; assert.equal(roomTourBusy(f.workflow.getSnapshot()), false);
});
test('workflow: remove needs a confirmation; cancel keeps the side; confirm removes it', async () => {
  const f = await loaded([{ side: 'front' }]);
  f.workflow.openMenu('front'); assert.equal(f.workflow.getSnapshot().menuSide, 'front');
  f.workflow.requestRemove('front'); assert.equal(f.workflow.getSnapshot().removeSide, 'front'); assert.equal(f.workflow.getSnapshot().menuSide, null);
  f.workflow.cancelRemove(); assert.deepEqual(f.calls, []); assert.equal(f.workflow.getSnapshot().sides.front.status, 'ready');
  f.workflow.requestRemove('front'); await f.workflow.confirmRemove();
  assert.deepEqual(f.calls, ['remove:front']); assert.equal(f.workflow.getSnapshot().sides.front.status, 'idle'); assert.equal(f.workflow.getSnapshot().removeSide, null);
});
test('workflow: a failed remove keeps the side and says so on the card; a failed load says so and can be retried', async () => {
  const f = await loaded([{ side: 'back' }]); f.set.removeError(true);
  f.workflow.requestRemove('back'); await f.workflow.confirmRemove();
  assert.equal(f.workflow.getSnapshot().sides.back.status, 'ready'); assert.match(f.workflow.getSnapshot().notice ?? '', /remove it/);
  const g = flow(); g.set.listError(true); g.workflow.setProperty(property); await settle();
  assert.equal(g.workflow.getSnapshot().loaded, false); assert.match(g.workflow.getSnapshot().notice ?? '', /Could not load the room tour/);
  g.set.listError(false); await g.workflow.load(); assert.equal(g.workflow.getSnapshot().loaded, true); assert.equal(g.workflow.getSnapshot().notice, null);
});

// ---- renter: detail() ----
const listingId = '40000000-0000-4000-8000-000000000001';
function searchBackend(options: { tour?: Record<string, unknown>[] | 'fail' } = {}) {
  const started: string[] = []; let inFlight = 0, maxParallel = 0;
  const listing = { id: listingId, property_id: property, title: 'Actual rental', description: 'd', asking_rent_monthly: 18500, available_from: null, published_at: '2026-10-01T00:00:00Z', house_rules: null, rental_term: 'long_term', minimum_stay_months: null, security_deposit_months: 1, advance_rent_months: 1, status: 'active', properties: { id: property, landlord_id: owner, city: 'imus', barangay: 'Anabu', property_type: 'apartment', bedrooms: 1, bathrooms: 1, floor_area_sqm: 30, furnishing_status: 'furnished', is_active: true, public_location: null } };
  const rowsFor = (table: string) => table === 'listings' ? [listing] : table === 'property_panoramas' ? (options.tour === 'fail' ? null : options.tour ?? []) : [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'tenant' } }, error: null }) },
    from(table: string) {
      const q: Record<string, unknown> = new Proxy({}, { get: (_t, key) => key === 'then' ? (resolve: (v: unknown) => unknown) => {
        if (['property_photos', 'property_amenities', 'property_panoramas'].includes(table)) { started.push(table); inFlight++; maxParallel = Math.max(maxParallel, inFlight); }
        return new Promise(r => setTimeout(r, 5)).then(() => { if (['property_photos', 'property_amenities', 'property_panoramas'].includes(table)) inFlight--; return resolve({ data: rowsFor(table), error: table === 'property_panoramas' && options.tour === 'fail' ? { message: 'raw private failure' } : null }); });
      } : () => q });
      return q;
    },
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://example.test/${p}` } }) }) },
  } as unknown as SupabaseClient<Database>;
  return { service: createManualSearchService(() => client), started, parallel: () => maxParallel };
}
const row = (side: string, n: number) => ({ side, storage_path: stored(n), width: 5000, height: 1000 });
test('detail() carries 0, 1 or 2 sides, Front before Back', async () => {
  assert.deepEqual((await searchBackend().service.detail('tenant', listingId)).roomTour, []);
  const one = await searchBackend({ tour: [row('back', 2)] }).service.detail('tenant', listingId);
  assert.deepEqual(one.roomTour!.map(p => p.side), ['back']);
  const two = await searchBackend({ tour: [row('back', 2), row('front', 1)] }).service.detail('tenant', listingId);
  assert.deepEqual(two.roomTour!.map(p => p.side), ['front', 'back']); assert.equal(two.roomTour![0]!.url, `https://example.test/${stored(1)}`);
});
test('detail() still loads when the room tour read fails, and shows no tour', async () => {
  const detail = await searchBackend({ tour: 'fail' }).service.detail('tenant', listingId);
  assert.equal(detail.title, 'Actual rental'); assert.deepEqual(detail.roomTour, []);
});
test('detail() reads photos, amenities and the room tour together: no extra sequential round trip', async () => {
  const b = searchBackend({ tour: [row('front', 1)] }); await b.service.detail('tenant', listingId);
  assert.deepEqual([...b.started].sort(), ['property_amenities', 'property_panoramas', 'property_photos']); assert.equal(b.parallel(), 3);
});

// ---- renter: viewer state ----
const tourOf = (...sides: ('front' | 'back')[]) => sides.map(side => ({ side, url: `https://example.test/${side}`, width: 5000, height: 1000 }));
test('viewer: the switch exists only with two sides; one side shows a label and opens on that side', () => {
  assert.equal(openRoomTour([]), null);
  const one = openRoomTour(tourOf('back'))!; assert.equal(showSideSwitch(one), false); assert.equal(one.selected, 'back');
  const two = openRoomTour(tourOf('back', 'front'))!; assert.equal(showSideSwitch(two), true); assert.equal(two.selected, 'front'); assert.deepEqual(two.sides, ['front', 'back']);
});
test('viewer: subtitle wording follows the sides', () => {
  assert.equal(roomTourSubtitle(tourOf('front', 'back')), 'Front and back side'); assert.equal(roomTourSubtitle(tourOf('front')), 'Front side only'); assert.equal(roomTourSubtitle(tourOf('back')), 'Back side only'); assert.equal(roomTourSubtitle([]), null);
});
test('viewer: the switch is disabled until the side has loaded; a failed side can be left; retry remounts with a new key', () => {
  let s = openRoomTour(tourOf('front', 'back'))!;
  assert.equal(switchEnabled(s), false); assert.equal(selectSide(s, 'back').selected, 'front');
  s = sideLoaded(s, 'front'); assert.equal(switchEnabled(s), true); assert.equal(selectSide(s, 'back').selected, 'back');
  let failing = sideFailed(openRoomTour(tourOf('front', 'back'))!, 'front'); assert.equal(failing.load.front, 'failed'); assert.equal(selectSide(failing, 'back').selected, 'back');
  const before = failing.reloads.front; failing = retrySide(failing, 'front');
  assert.equal(failing.load.front, 'loading'); assert.equal(failing.reloads.front, before + 1);
});
test('viewer: "Drag to look around" is shown once per session', () => {
  resetDragHintForTests(); assert.equal(shouldShowDragHint(), true); markDragHintSeen(); assert.equal(shouldShowDragHint(), false); resetDragHintForTests();
});
