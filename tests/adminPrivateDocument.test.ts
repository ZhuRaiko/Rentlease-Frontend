/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../src/shared/services/supabase/database.types';
import type { AdminVerificationSubmissionDetail } from '../src/features/admin-moderation/models/AdminVerification';
import { isSupportedVerificationImage } from '../src/features/admin-moderation/models/AdminVerification';
import { createAdminVerificationService } from '../src/features/admin-moderation/services/adminVerificationService';
import { createAdminVerificationQueue } from '../src/features/admin-moderation/viewModels/adminVerificationQueue';
import { zoomAt, panImage, initialImageTransform } from '../src/shared/models/documentImagePreview';

const signedUrl = 'https://example.invalid/private/test-image?token=test-only';
test('Admin zoom/pan does not resign URLs, review a submission or mutate authoritative details', async () => {
  const h = fixture(); await h.select(); await h.queue.openPrivateDocument(document.id);
  const before = h.queue.getSnapshot(); const viewport = { width: 400, height: 600 };
  const zoomed = zoomAt(initialImageTransform, 3, { x: 200, y: 300 }, viewport, viewport);
  panImage(zoomed, 50, 20, viewport, viewport);
  assert.equal(h.queue.getSnapshot(), before); assert.equal(h.requests.length, 1); assert.equal(before.detail?.item.status, 'pending');
  h.queue.closePrivateDocument(); assert.equal(h.queue.getSnapshot().documentPreview, null); assert.equal(h.queue.getSnapshot().detail, before.detail);
});
const document: Tables<'verification_documents'> = { id: 'doc-one', submission_id: 'submission-one', document_type: 'passport', storage_path: 'user/submission/file.jpeg', file_name: 'test.jpeg', mime_type: 'image/jpeg', created_at: '2026-10-20T00:00:00Z' };
const detail: AdminVerificationSubmissionDetail = { item: {
  submissionId: 'submission-one', userId: 'test-user', displayName: 'Test applicant', tier: 'tier_2_identity', status: 'pending', submittedAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z', submittedNote: null, propertyId: null, trustScore: 0, tier1VerifiedAt: null, tier2VerifiedAt: null, tier3VerifiedAt: null, documentCount: 1, documentType: 'passport', fileName: 'test.jpeg', mimeType: 'image/jpeg',
}, documents: [document] };
function fixture() {
  const requests: string[] = [];
  let currentDetail = detail; let failed = false; let release: (() => void) | undefined; let paused = false;
  const queue = createAdminVerificationQueue({
    reviewSubmission: async () => { throw Error('Not requested by image tests'); },
    fetchVerificationQueue: async () => [currentDetail.item],
    fetchVerificationSubmissionDetails: async () => currentDetail,
    createVerificationDocumentViewUrl: async (path) => {
      requests.push(path);
      if (paused) await new Promise<void>((resolve) => { release = resolve; });
      if (failed) throw Error(signedUrl);
      return signedUrl;
    },
  });
  return { queue, requests, select: () => queue.select('submission-one'), change: (next: AdminVerificationSubmissionDetail) => { currentDetail = next; }, fail: () => { failed = true; }, pause: () => { paused = true; }, release: () => release?.() };
}
test('only the supported JPEG/JPG/PNG/WebP MIME types enable image preview', () => {
  for (const mime of ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']) assert.equal(isSupportedVerificationImage(mime), true);
  for (const mime of ['application/pdf', 'image/svg+xml', 'image/gif', null]) assert.equal(isSupportedVerificationImage(mime), false);
});
test('service requests correct private path with a 90-second expiry and returns URL only', async () => {
  const calls: unknown[][] = [];
  const service = createAdminVerificationService(() => ({ storage: { from: (bucket: string) => ({ createSignedUrl: async (path: string, seconds: number) => {
    calls.push([bucket, path, seconds]); return { data: { signedUrl }, error: null };
  } }) } } as unknown as SupabaseClient<Database>));
  assert.equal(await service.createVerificationDocumentViewUrl(document.storage_path), signedUrl);
  assert.deepEqual(calls, [['verification-documents', document.storage_path, 90]]);
});
test('signed-link service errors never expose transport URLs or token-bearing causes', async () => {
  for (const response of [{ data: null, error: Error(signedUrl) }, { data: { signedUrl: '' }, error: null }]) {
    const service = createAdminVerificationService(() => ({ storage: { from: () => ({ createSignedUrl: async () => response }) } } as unknown as SupabaseClient<Database>));
    await assert.rejects(service.createVerificationDocumentViewUrl(document.storage_path), (error: unknown) => {
      assert.ok(!JSON.stringify(error).includes('token='));
      assert.ok(!Object.prototype.hasOwnProperty.call(error, 'cause'));
      return true;
    });
  }
});
test('queue/detail loads never generate a URL; only explicit known document action does', async () => {
  const h = fixture(); await h.queue.refresh(); await h.select(); assert.deepEqual(h.requests, []);
  assert.equal(h.queue.canViewPrivateDocument(document.id), true);
  await h.queue.openPrivateDocument(document.id);
  assert.deepEqual(h.requests, [document.storage_path]);
  assert.equal(h.queue.getSnapshot().documentPreview?.signedUrl, signedUrl);
  assert.equal(h.queue.getSnapshot().documentPreview?.isVisible, true);
  assert.equal(h.queue.getSnapshot().detail?.item.status, 'pending');
});
test('missing, arbitrary and other-submission document identities cannot request a URL', async () => {
  const h = fixture(); await h.queue.openPrivateDocument(document.id); await h.select();
  await h.queue.openPrivateDocument('arbitrary/path');
  h.change({ ...detail, documents: [{ ...document, submission_id: 'another-submission' }] }); await h.select();
  assert.equal(h.queue.canViewPrivateDocument(document.id), false); await h.queue.openPrivateDocument(document.id);
  h.change({ ...detail, documents: [] }); await h.select(); await h.queue.openPrivateDocument(document.id);
  assert.deepEqual(h.requests, []); assert.equal(h.queue.getSnapshot().documentPreview, null);
});
test('unsupported MIME does not request a signed URL or fake an image preview', async () => {
  const h = fixture(); h.change({ ...detail, documents: [{ ...document, mime_type: 'application/pdf' }] }); await h.select();
  assert.equal(h.queue.canViewPrivateDocument(document.id), false); await h.queue.openPrivateDocument(document.id);
  assert.deepEqual(h.requests, []); assert.equal(h.queue.getSnapshot().documentPreview, null);
});
test('close clears URL; reopen requests a fresh link and preserves metadata', async () => {
  const h = fixture(); await h.select(); await h.queue.openPrivateDocument(document.id);
  h.queue.closePrivateDocument(); assert.equal(h.queue.getSnapshot().documentPreview, null);
  await h.queue.openPrivateDocument(document.id); assert.equal(h.requests.length, 2);
  assert.deepEqual(h.queue.getSnapshot().detail, detail);
});
test('changing selection/refresh/disposal clear active URLs', async () => {
  const h = fixture(); await h.select(); await h.queue.openPrivateDocument(document.id);
  await h.queue.select('another'); assert.equal(h.queue.getSnapshot().documentPreview, null);
  await h.queue.openPrivateDocument(document.id); await h.queue.refresh(); assert.equal(h.queue.getSnapshot().documentPreview, null);
  await h.select(); await h.queue.openPrivateDocument(document.id); h.queue.dispose(); assert.equal(h.queue.getSnapshot().documentPreview, null);
});
test('double-taps during opening are excluded, and closing invalidates a late signed URL', async () => {
  const h = fixture(); await h.select(); h.pause();
  const opening = h.queue.openPrivateDocument(document.id);
  assert.equal(h.queue.getSnapshot().documentPreview?.isOpening, true);
  await h.queue.openPrivateDocument(document.id); assert.equal(h.requests.length, 1);
  h.queue.closePrivateDocument(); h.release(); await opening;
  assert.equal(h.queue.getSnapshot().documentPreview, null);
});
test('switching submission during signing ignores the obsolete response', async () => {
  const h = fixture(); await h.select(); h.pause(); const opening = h.queue.openPrivateDocument(document.id);
  await h.queue.select('another'); h.release(); await opening;
  assert.equal(h.queue.getSnapshot().documentPreview, null);
});
test('signed URL failure exposes safe error without a URL', async () => {
  const h = fixture(); await h.select(); h.fail(); await h.queue.openPrivateDocument(document.id);
  const preview = h.queue.getSnapshot().documentPreview;
  assert.ok(preview?.error); assert.equal(preview?.signedUrl, null); assert.equal(preview?.isOpening, false);
  assert.ok(!JSON.stringify(preview).includes('token='));
});
test('image-load failure clears URL and instructs close/reopen', async () => {
  const h = fixture(); await h.select(); await h.queue.openPrivateDocument(document.id); h.queue.privateDocumentFailed(h.queue.getSnapshot().documentPreview!.requestId);
  assert.equal(h.queue.getSnapshot().documentPreview?.signedUrl, null);
  assert.match(h.queue.getSnapshot().documentPreview?.error ?? '', /close.*reopen/i);
});
test('a stale image error from a closed preview cannot clear a reopened document', async () => {
  const h = fixture(); await h.select(); await h.queue.openPrivateDocument(document.id);
  const oldRequest = h.queue.getSnapshot().documentPreview!.requestId;
  h.queue.closePrivateDocument(); await h.queue.openPrivateDocument(document.id);
  h.queue.privateDocumentFailed(oldRequest);
  assert.equal(h.queue.getSnapshot().documentPreview?.signedUrl, signedUrl);
  assert.equal(h.queue.getSnapshot().documentPreview?.error, null);
});
