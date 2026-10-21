/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import type { AdminVerificationSubmissionDetail } from '../src/features/admin-moderation/models/AdminVerification';
import { createAdminVerificationService } from '../src/features/admin-moderation/services/adminVerificationService';
import { createAdminVerificationQueue } from '../src/features/admin-moderation/viewModels/adminVerificationQueue';

function fixture(status: 'pending' | 'under_review' = 'pending') {
  let detail: AdminVerificationSubmissionDetail = { item: { submissionId: 's', userId: 'u', displayName: 'Applicant', tier: 'tier_2_identity', status, submittedAt: '', updatedAt: '', submittedNote: null, propertyId: null, trustScore: .4, tier1VerifiedAt: '', tier2VerifiedAt: null, tier3VerifiedAt: null, documentCount: 1, documentType: 'passport', fileName: 'a.jpg', mimeType: 'image/jpeg' }, documents: [{ id: 'd', submission_id: 's', storage_path: 'u/s/a.jpg', file_name: 'a.jpg', mime_type: 'image/jpeg', document_type: 'passport', created_at: '' }] };
  const calls: unknown[] = []; let active = true; let fail = false; let failRefresh = false; let release: (() => void) | undefined; let paused = false; let retainStatus = false;
  const queue = createAdminVerificationQueue({
    fetchVerificationQueue: async () => { calls.push('refresh'); if (failRefresh) throw Error('offline'); return active ? [detail.item] : []; },
    fetchVerificationSubmissionDetails: async () => detail,
    createVerificationDocumentViewUrl: async () => 'https://example.invalid/image',
    reviewSubmission: async (input) => {
      calls.push(input); if (paused) await new Promise<void>(r => { release = r; });
      if (fail) throw Error('raw SQL secret');
      if (input.status === 'under_review') { if (!retainStatus) detail = { ...detail, item: { ...detail.item, status: 'under_review' } }; }
      else active = false;
    },
  });
  return { queue, calls, select: () => queue.select('s'), fail: () => { fail = true; }, failRefresh: () => { failRefresh = true; }, pause: () => { paused = true; }, release: () => release?.(), retainStatus: () => { retainStatus = true; }, change: (next: Partial<typeof detail.item>) => { detail = { ...detail, item: { ...detail.item, ...next } }; } };
}
test('pending permits only Start review and first tap never calls RPC', async () => {
  const h = fixture(); await h.select();
  assert.deepEqual(h.queue.reviewActions(), ['under_review']);
  h.queue.requestReview('approved'); assert.equal(h.queue.getSnapshot().reviewDialog, null);
  h.queue.requestReview('under_review'); assert.equal(h.queue.getSnapshot().reviewDialog, 'under_review');
  assert.deepEqual(h.calls, []); h.queue.cancelReview(); assert.equal(h.queue.getSnapshot().reviewDialog, null);
});
test('Start review uses backend refresh to show Under review and enable decisions', async () => {
  const h = fixture(); await h.select(); h.queue.requestReview('under_review'); await h.queue.confirmReview();
  assert.deepEqual(h.calls, [{ submissionId: 's', status: 'under_review' }, 'refresh']);
  assert.equal(h.queue.getSnapshot().detail?.item.status, 'under_review');
  assert.deepEqual(h.queue.reviewActions(), ['approved', 'rejected']);
});
for (const status of ['approved', 'rejected'] as const) test(`${status} requires confirmation, refreshes queue and handles disappearance`, async () => {
  const h = fixture('under_review'); await h.select(); await h.queue.openPrivateDocument('d');
  h.queue.requestReview(status); assert.equal(h.queue.getSnapshot().documentPreview, null);
  assert.equal(h.calls.length, 0);
  if (status === 'rejected') {
    h.queue.setRejectionReason('   '); await h.queue.confirmReview(); assert.equal(h.calls.length, 0);
    h.queue.setRejectionReason('  Unreadable document  ');
  }
  assert.equal(await h.queue.confirmReview(), true);
  assert.deepEqual(h.calls, [{ submissionId: 's', status, ...(status === 'rejected' ? { rejectionReason: 'Unreadable document' } : {}) }, 'refresh']);
  assert.equal(h.queue.getSnapshot().detail, null); assert.deepEqual(h.queue.getSnapshot().queue, []);
  assert.equal(h.queue.getSnapshot().detailError, null); assert.match(h.queue.getSnapshot().reviewNotice ?? '', new RegExp(status));
});
test('duplicate confirms are excluded and review blocks selection, refresh and preview', async () => {
  const h = fixture('under_review'); await h.select(); h.pause(); h.queue.requestReview('approved');
  const first = h.queue.confirmReview(); await h.queue.confirmReview(); await h.queue.select('other'); await h.queue.refresh(); await h.queue.openPrivateDocument('d');
  assert.equal(h.calls.length, 1); assert.equal(h.queue.getSnapshot().reviewBusy, true); assert.equal(h.queue.getSnapshot().documentPreview, null);
  h.release(); await first; assert.equal(h.queue.getSnapshot().reviewBusy, false);
});
test('RPC failure preserves authoritative detail, exposes safe error and requires refresh before retry', async () => {
  const h = fixture('under_review'); await h.select(); h.fail(); h.queue.requestReview('approved'); await h.queue.confirmReview();
  assert.equal(h.queue.getSnapshot().detail?.item.status, 'under_review'); assert.deepEqual(h.queue.reviewActions(), []);
  assert.ok(h.queue.getSnapshot().reviewError); assert.ok(!JSON.stringify(h.queue.getSnapshot()).includes('raw SQL'));
  await h.queue.confirmReview(); assert.equal(h.calls.length, 1);
  await h.queue.refresh(); await h.select(); assert.deepEqual(h.queue.reviewActions(), ['approved', 'rejected']);
});
test('successful write followed by refresh failure does not offer stale decisions or duplicate write', async () => {
  const h = fixture('under_review'); await h.select(); h.failRefresh(); h.queue.requestReview('approved');
  assert.equal(await h.queue.confirmReview(), true); assert.equal(h.queue.getSnapshot().status, 'error');
  assert.equal(h.queue.getSnapshot().detail, null); assert.deepEqual(h.queue.reviewActions(), []);
  assert.match(h.queue.getSnapshot().reviewError ?? '', /refresh/i);
});
test('dispose ignores late review completion and clears sensitive drafts', async () => {
  const h = fixture('under_review'); await h.select(); h.pause(); h.queue.requestReview('rejected'); h.queue.setRejectionReason('reason');
  const request = h.queue.confirmReview(); h.queue.dispose(); const snapshot = h.queue.getSnapshot(); h.release(); await request;
  assert.equal(h.queue.getSnapshot(), snapshot); assert.equal(snapshot.rejectionReason, '');
});
test('Under review permits reopening private image without a review write', async () => {
  const h = fixture('under_review'); await h.select(); await h.queue.openPrivateDocument('d');
  assert.ok(h.queue.getSnapshot().documentPreview?.signedUrl); assert.deepEqual(h.calls, []);
});
test('Start review never changes status optimistically or overrides a refreshed backend status', async () => {
  const h = fixture(); await h.select(); h.retainStatus(); h.pause(); h.queue.requestReview('under_review');
  const request = h.queue.confirmReview(); assert.equal(h.queue.getSnapshot().detail?.item.status, 'pending');
  h.release(); await request; assert.equal(h.queue.getSnapshot().detail?.item.status, 'pending');
  assert.deepEqual(h.queue.reviewActions(), ['under_review']);
});
test('Tier 3 uses existing review lifecycle; terminal details remain blocked and changing selection cancels intent', async () => {
  const h = fixture('under_review'); await h.select(); h.queue.requestReview('rejected'); h.queue.setRejectionReason('draft');
  await h.select(); assert.equal(h.queue.getSnapshot().reviewDialog, null); assert.equal(h.queue.getSnapshot().rejectionReason, '');
  h.change({ tier: 'tier_3_property' }); await h.select(); assert.deepEqual(h.queue.reviewActions(), ['approved', 'rejected']);
  for (const status of ['approved', 'rejected', 'cancelled', 'revoked'] as const) {
    h.change({ tier: 'tier_2_identity', status }); await h.select(); h.queue.requestReview('approved');
    assert.deepEqual(h.queue.reviewActions(), []); assert.equal(h.queue.getSnapshot().reviewDialog, null);
  }
  await h.queue.confirmReview(); assert.deepEqual(h.calls, []);
});
test('Tier 3 Start review and approval reuse RPC orchestration with property-specific success feedback', async () => {
  const h = fixture(); h.change({ tier: 'tier_3_property', propertyId: 'property-test' }); await h.select();
  h.queue.requestReview('under_review'); await h.queue.confirmReview(); assert.equal(h.queue.getSnapshot().detail?.item.status, 'under_review');
  h.queue.requestReview('approved'); await h.queue.confirmReview();
  assert.match(h.queue.getSnapshot().reviewNotice ?? '', /Tier 3 property verification approved/);
  assert.equal(h.queue.getSnapshot().detail, null);
});
test('service blocks blank rejection before issuing any RPC', async () => {
  let called = false;
  const service = createAdminVerificationService(() => ({ rpc: async () => { called = true; return { data: null, error: null }; } } as unknown as SupabaseClient<Database>));
  await assert.rejects(service.reviewSubmission({ submissionId: 's', status: 'rejected', rejectionReason: '  ' }));
  assert.equal(called, false);
});
test('service uses exact generated RPC arguments with optional default-null fields omitted', async () => {
  const calls: unknown[] = [];
  const service = createAdminVerificationService(() => ({ rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { data: { id: 's' }, error: null }; } } as unknown as SupabaseClient<Database>));
  await service.reviewSubmission({ submissionId: 's', status: 'approved' });
  await service.reviewSubmission({ submissionId: 's', status: 'rejected', rejectionReason: ' reason ' });
  assert.deepEqual(calls, [ ['review_verification_submission', { requested_submission_id: 's', requested_status: 'approved' }], ['review_verification_submission', { requested_submission_id: 's', requested_status: 'rejected', requested_rejection_reason: 'reason' }] ]);
});
test('service normalizes denied, invalid transition, missing-document and network errors without raw SQL', async () => {
  for (const message of ['not authenticated', 'not admin', 'invalid transition', 'document required', 'network']) {
    const service = createAdminVerificationService(() => ({ rpc: async () => ({ data: null, error: { message, code: '42501' } }) } as unknown as SupabaseClient<Database>));
    await assert.rejects(service.reviewSubmission({ submissionId: 's', status: 'approved' }), (error: { message: string }) => /refresh/i.test(error.message) && !error.message.includes('42501'));
  }
});
