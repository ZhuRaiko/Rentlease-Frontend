/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPropertyPhotoWorkflow } from '../src/features/property-listing/viewModels/propertyPhotoWorkflow';
import type { PropertyPhotoService } from '../src/features/property-listing/services/propertyPhotoService';
import type { PropertyPhoto } from '../src/features/property-listing/models/PropertyPhoto';
import type { SelectedDocument } from '../src/shared/models/SelectedDocument';
import { normalizeImagePickerSelections } from '../src/features/property-listing/models/PropertyPhotoSelection';
import { readFileSync } from 'node:fs';
import { propertyMediaItems } from '../src/features/property-listing/models/PropertyMedia';
import { imageGallerySwipe } from '../src/shared/models/documentImagePreview';

const property = '20000000-0000-4000-8000-000000000001';
const files = Array.from({ length: 4 }, (_, i): SelectedDocument => ({ uri: `file:///cache/${i}.jpg`, fileName: `${i}.jpg`, mimeType: 'image/jpeg', size: 30 }));
function queueHarness() {
  let rows: PropertyPhoto[] = [], failAt = -1, picks = 0, active = 0, maxActive = 0, valid = true;
  let hold: Promise<void> | null = null, selections = files, reconcileFails = false;
  const calls: string[] = [], capacities: number[] = [];
  const service = {
    context: async () => ({ ownerId: 'owner', propertyId: property }),
    assertContext: async () => { if (!valid) throw Error('changed'); },
    list: async () => [...rows], hasPending: async () => failAt >= 0,
    reconcile: async () => { if (reconcileFails) throw Error('Unknown'); failAt = -1; },
    upload: async (_: unknown, file: SelectedDocument) => {
      calls.push(file.fileName); active++; maxActive = Math.max(maxActive, active);
      try { if (hold) await hold; if (calls.length === failAt) throw Error('unknown');
        rows.push({ id: file.fileName, property_id: property, publicUrl: 'https://example.test/photo', storage_path: '', sort_order: rows.length, is_cover: !rows.length, alt_text: null, created_at: '2026-10-29' });
      } finally { active--; }
    },
  } as unknown as PropertyPhotoService;
  const flow = createPropertyPhotoWorkflow(service, async () => null, async (remaining: number) => { picks++; capacities.push(remaining); return selections; });
  return { flow, calls, capacities, picks: () => picks, max: () => maxActive, choose: (next: SelectedDocument[]) => { selections = next; }, unresolved: () => { reconcileFails = true; }, fail: (n: number) => { failAt = n; }, hold: (p: Promise<void>) => { hold = p; }, invalidate: () => { valid = false; }, ready: async () => { flow.setProperty(property); await flow.load(); } };
}

test('gallery adapter preserves every returned URI and supported metadata', () => {
  const assets = files.map(f => ({ uri: f.uri, fileName: f.fileName, mimeType: f.mimeType, fileSize: f.size! }));
  assert.deepEqual(normalizeImagePickerSelections(assets, 6), files);
  assert.throws(() => normalizeImagePickerSelections(assets, 3));
  for (const patch of [{ mimeType: 'image/heic' }, { fileSize: 10 * 1024 * 1024 + 1 }, { fileSize: -1 }, { fileSize: NaN }, { uri: '' }, { mimeType: null }]) assert.throws(() => normalizeImagePickerSelections([{ ...assets[0]!, ...patch }], 1));
  assert.equal(normalizeImagePickerSelections([{ uri: 'file:///cache/a.webp', mimeType: 'image/webp' }], 1)[0]?.size, null);
});
test('picker cancellation and invalid batches cause no write or partial selection', async () => {
  const h = queueHarness(); await h.ready(); h.choose([]); await h.flow.addPhotos(); assert.equal(h.calls.length, 0);
  h.choose([files[0]!, { ...files[1]!, mimeType: 'video/mp4' }]); await h.flow.addPhotos();
  assert.equal(h.calls.length, 0); assert.equal(h.flow.getSnapshot().pendingSelections.length, 0); assert.ok(h.flow.getSnapshot().error);
});
test('remaining gallery capacity is authoritative and no eleventh photo can be queued', async () => {
  const h = queueHarness(); await h.ready(); await h.flow.addPhotos(); await h.flow.addPhotos();
  assert.deepEqual(h.capacities, [10, 6]); h.choose([files[0]!, files[1]!, files[2]!]); await h.flow.addPhotos();
  assert.equal(h.calls.length, 8); assert.equal(h.flow.getSnapshot().photos.length, 8);
  h.choose(files.slice(0, 2)); await h.flow.addPhotos(); await h.flow.addPhotos();
  assert.equal(h.calls.length, 10); assert.equal(h.flow.getSnapshot().photos.length, 10);
});
test('unresolved status check cannot resume a queue or blindly retry the attempted item', async () => {
  const h = queueHarness(); await h.ready(); h.fail(2); await h.flow.addPhotos(); h.unresolved(); await h.flow.checkStatus();
  await h.flow.resumeQueue(); await h.flow.addPhotos(); assert.equal(h.calls.length, 2); assert.equal(h.flow.getSnapshot().needsReconcile, true);
});
test('local queue removal and discard are local-only and retain saved photos', async () => {
  const h = queueHarness(); await h.ready(); h.fail(2); await h.flow.addPhotos();
  assert.equal(h.flow.dirty(), true); h.flow.removePending(0); assert.equal(h.flow.getSnapshot().pendingSelections.length, 1);
  h.flow.discardLocalEdits(); assert.equal(h.flow.getSnapshot().pendingSelections.length, 0); assert.equal(h.flow.getSnapshot().photos.length, 1); assert.equal(h.calls.length, 2);
});
test('composer and ordered real preview preserve MVVM, fields, and the inactive 360 boundary', () => {
  const source = readFileSync('src/features/property-listing/views/ListingDetailsView.tsx', 'utf8');
  const media = readFileSync('src/features/property-listing/components/PropertyMediaSection.tsx', 'utf8');
  assert.doesNotMatch(source, /getSupabaseClient|\.rpc\(|\.from\(|\/services\/|exactLatitude|exactLongitude|accessInstructions/);
  for (const field of ['title', 'askingRent', 'description', 'rentalTerm', 'securityDepositMonths', 'advanceRentMonths', 'minimumStayMonths', 'houseRules', 'availableDate']) assert.match(source, new RegExp(`draft\\.${field}`));
  assert.match(media, /Not available in this build yet/); assert.match(media, /horizontal/); assert.match(media, /flow\.setCover/); assert.match(media, /flow\.requestRemove/);
  const preview = readFileSync('src/features/property-listing/views/ListingPreviewView.tsx', 'utf8');
  assert.match(preview, /photoState\.photos\.map/); assert.match(preview, /Local · not saved/);
  const device = readFileSync('src/features/property-listing/services/propertyPhotoDependencies.ts', 'utf8');
  assert.match(device, /allowsMultipleSelection: true/); assert.match(device, /selectionLimit: remainingSlots/); assert.match(device, /allowsEditing: false/);
});
test('gallery selections appear locally and upload sequentially in selection order', async () => {
  const h = queueHarness(); await h.ready(); let release!: () => void;
  h.hold(new Promise<void>(r => { release = r; }));
  const pending = h.flow.addPhotos();
  while (!h.calls.length) await new Promise<void>(r => setImmediate(r));
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 4);
  assert.equal(h.flow.getSnapshot().photos.length, 0);
  await h.flow.addPhotos(); assert.equal(h.picks(), 1);
  release(); await pending;
  assert.deepEqual(h.calls, files.map(f => f.fileName)); assert.equal(h.max(), 1);
  assert.equal(h.flow.getSnapshot().photos.length, 4); assert.equal(h.flow.getSnapshot().photos[0]?.is_cover, true);
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 0);
});
test('photos selected before UUID stay local and survive explicit newly-created-property binding', async () => {
  const h = queueHarness(); await h.flow.addPhotos();
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 4); assert.equal(h.calls.length, 0);
  h.flow.setProperty(property, true); await h.flow.load();
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 4); assert.equal(h.calls.length, 0);
  await h.flow.resumeQueue(); assert.equal(h.calls.length, 4);
});
test('late local gallery result is ignored after disposal before any property exists', async () => {
  let release!: (files: SelectedDocument[]) => void, uploads = 0;
  const flow = createPropertyPhotoWorkflow({ upload: async () => { uploads++; } } as unknown as PropertyPhotoService, async () => null, () => new Promise(r => { release = r; }));
  const pending = flow.addPhotos(); flow.dispose(); release(files); await pending;
  assert.equal(flow.getSnapshot().pendingSelections.length, 0); assert.equal(uploads, 0);
});
test('local gallery opens, switches and closes without changing selections or uploading', async () => {
  const h = queueHarness(); await h.flow.addPhotos();
  const selected = [...h.flow.getSnapshot().pendingSelections];
  h.flow.openMedia(1); assert.equal(h.flow.getSnapshot().activeMediaIndex, 1); assert.equal(h.flow.getSnapshot().mediaViewerOpen, true);
  h.flow.nextMedia(); assert.equal(h.flow.getSnapshot().activeMediaIndex, 2); h.flow.previousMedia(); assert.equal(h.flow.getSnapshot().activeMediaIndex, 1);
  assert.equal(h.flow.back(), true); assert.equal(h.flow.getSnapshot().mediaViewerOpen, false);
  assert.deepEqual(h.flow.getSnapshot().pendingSelections, selected); assert.deepEqual(h.calls, []);
});
test('saved gallery active preview never changes backend cover or photo ordering', async () => {
  const h = queueHarness(); await h.ready(); await h.flow.addPhotos(); const rows = [...h.flow.getSnapshot().photos], writes = h.calls.length;
  h.flow.selectMedia(2); assert.equal(h.flow.getSnapshot().mediaViewerOpen, false);
  h.flow.openMedia(2); const items = propertyMediaItems(rows, [], null, false);
  assert.equal(items[2]?.status, 'Saved'); assert.equal(items[0]?.cover, true); assert.equal(items[2]?.cover, false);
  h.flow.closeMedia(); assert.deepEqual(h.flow.getSnapshot().photos, rows); assert.equal(h.calls.length, writes);
});
test('gallery bounds, selection removal and workspace invalidation do not leave an invalid viewer item', async () => {
  const h = queueHarness(); await h.flow.addPhotos(); h.flow.openMedia(3); h.flow.nextMedia(); assert.equal(h.flow.getSnapshot().activeMediaIndex, 3);
  h.flow.removePending(3); assert.equal(h.flow.getSnapshot().activeMediaIndex, 2);
  h.flow.setProperty(property); assert.equal(h.flow.getSnapshot().mediaViewerOpen, false); assert.equal(h.flow.getSnapshot().activeMediaIndex, 0);
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 0); assert.deepEqual(h.calls, []);
});
test('photo descriptors distinguish selected, uploading, saved and attention without using URIs as keys', () => {
  const selected = propertyMediaItems([], files, files[0]!, true);
  assert.equal(selected[0]?.status, 'Uploading'); assert.equal(selected[1]?.status, 'Selected'); assert.equal(selected.at(-1)?.status, 'Needs attention');
  assert.ok(selected.every(item => !item.key.includes('file:')));
});
test('gallery swipes are horizontal at fitted scale and cannot hijack zoom or pinch pan', () => {
  assert.equal(imageGallerySwipe(1, 1, -100, 10, false), 1); assert.equal(imageGallerySwipe(1, 1, 100, 10, false), -1);
  for (const [start, end, dx, dy, pinched] of [[2, 2, -100, 0, false], [1, 3, -100, 0, false], [1, 1, 30, 0, false], [1, 1, -100, 120, false], [1, 1, -100, 0, true], [1, 1, NaN, 0, false]] as const) assert.equal(imageGallerySwipe(start, end, dx, dy, pinched), null);
});
test('uncertain batch stops, isolates attempted selection, and requires explicit reconciliation and resume', async () => {
  const h = queueHarness(); await h.ready(); h.fail(3); await h.flow.addPhotos();
  assert.equal(h.calls.length, 3); assert.equal(h.flow.getSnapshot().needsReconcile, true);
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 1);
  assert.equal(h.flow.getSnapshot().batch.completed, 2);
  await h.flow.resumeQueue(); assert.equal(h.calls.length, 3);
  await h.flow.checkStatus(); assert.equal(h.calls.length, 3);
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 1);
  await h.flow.resumeQueue(); assert.deepEqual(h.calls, ['0.jpg', '1.jpg', '2.jpg', '3.jpg']);
});
for (const change of ['property', 'dispose', 'account'] as const) test(`batch ${change} invalidation prevents remaining writes and stale UI`, async () => {
  const h = queueHarness(); await h.ready(); let release!: () => void;
  h.hold(new Promise<void>(r => { release = r; })); const pending = h.flow.addPhotos();
  while (!h.calls.length) await new Promise<void>(r => setImmediate(r));
  if (change === 'property') h.flow.setProperty(null); else if (change === 'dispose') h.flow.dispose(); else h.invalidate();
  release(); await pending; assert.equal(h.calls.length, 1);
  assert.equal(h.flow.getSnapshot().pendingSelections.length, 0); assert.equal(h.flow.getSnapshot().photos.length, 0);
});
