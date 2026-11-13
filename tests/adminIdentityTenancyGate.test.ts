/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { mapAdminVerification, type AdminVerificationRow, type AdminVerificationSubmissionDetail } from '../src/features/admin-moderation/models/AdminVerification';
import { createAdminVerificationService } from '../src/features/admin-moderation/services/adminVerificationService';
import { createAdminVerificationQueue } from '../src/features/admin-moderation/viewModels/adminVerificationQueue';

const snapshot = { property_type: 'apartment' as const, city: 'imus' as const, barangay: 'Fixture', floor_number: 2, address_line_1: 'Fixture', address_line_2: null, postal_code: null, exact_lat: 14.4, exact_lng: 120.9, public_lat: 14.4, public_lng: 120.9 };
const context = (extra: Record<string, unknown> = {}) => ({ submission_version: 's-version', property_version: 'p-version', current_revision_id: 'r', current: snapshot, proposed: { ...snapshot, floor_number: 3 }, correction_id: 'c', correction_version: 'c-version', same_asset_required: true, requires_repair: false, ...extra });
const row = (): AdminVerificationRow => ({ submission_id: 's', user_id: 'u', display_name: 'Applicant', tier: 'tier_3_property', property_id: 'p', status: 'under_review', submitted_note: null, submitted_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', trust_score: 10, tier1_verified_at: '2026-10-01T00:00:00Z', tier2_verified_at: null, tier3_verified_at: null, document_count: 1, document_id: 'd', document_type: 'land_title', file_name: 'a.jpg', mime_type: 'image/jpeg', storage_path: 'u/s/a.jpg', document_created_at: '2026-11-01T00:00:00Z' });
function service(review: unknown) {
  const query: any = { select: () => query, eq: () => query, order: () => query, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  const client = { rpc: async (name: string) => name === 'get_admin_verification_queue' ? { data: [row()], error: null } : { data: review, error: null }, from: () => query } as unknown as SupabaseClient<Database>;
  return createAdminVerificationService(() => client);
}

test('service normalizes open_tenancy to a boolean and leaves every other context key untouched', async () => {
  const open = (await service(context({ open_tenancy: true })).fetchVerificationSubmissionDetails('s')).identity!;
  assert.equal(open.open_tenancy, true); assert.equal(open.submission_version, 's-version'); assert.equal(open.correction_version, 'c-version'); assert.equal(open.same_asset_required, true);
  assert.equal((await service(context({ open_tenancy: false })).fetchVerificationSubmissionDetails('s')).identity!.open_tenancy, false);
  assert.equal((await service(context()).fetchVerificationSubmissionDetails('s')).identity!.open_tenancy, false, 'older backend without the key is treated as no open tenancy');
  assert.equal((await service(context({ open_tenancy: 'yes' })).fetchVerificationSubmissionDetails('s')).identity!.open_tenancy, false, 'only a real boolean true counts');
});

test('existing context validation is unchanged: an incomplete or repair-flagged context is still unavailable', async () => {
  await assert.rejects(service(context({ requires_repair: true, open_tenancy: false })).fetchVerificationSubmissionDetails('s'), (error: { message: string }) => /Could not load this verification submission/.test(error.message));
  await assert.rejects(service({ ...context(), submission_version: undefined, open_tenancy: false }).fetchVerificationSubmissionDetails('s'), (error: { message: string }) => /Could not load this verification submission/.test(error.message));
});

const sentStatus = (calls: unknown[]) => (calls[0] as { status: string } | undefined)?.status;
function queue(openTenancy: boolean | undefined, calls: unknown[] = []) {
  const item = mapAdminVerification(row());
  const detail: AdminVerificationSubmissionDetail = { item, documents: [], identity: { ...context(), ...(openTenancy === undefined ? {} : { open_tenancy: openTenancy }) } as never };
  return createAdminVerificationQueue({ fetchVerificationQueue: async () => [item], fetchVerificationSubmissionDetails: async () => detail, createVerificationDocumentViewUrl: async () => 'x', reviewSubmission: async (input: unknown) => { calls.push(input); } } as never);
}

test('open tenancy blocks Approve with the reason while Reject stays available', async () => {
  const calls: unknown[] = [], q = queue(true, calls); await q.select('s');
  assert.deepEqual(q.reviewActions(), ['approved', 'rejected']);
  assert.match(q.approveBlockedReason() ?? '', /open tenancy.*identity cannot change until the tenancy ends.*can still reject/);
  q.requestReview('approved'); assert.equal(q.getSnapshot().reviewDialog, null, 'Approve cannot open its confirmation');
  assert.equal(await q.confirmReview(), false); assert.deepEqual(calls, [], 'no review RPC is sent');
  q.requestReview('rejected'); assert.equal(q.getSnapshot().reviewDialog, 'rejected'); q.setRejectionReason('Tenancy is open'); await q.confirmReview();
  assert.equal(sentStatus(calls), 'rejected');
});

test('without an open tenancy, or when the backend does not report it, Approve works as before', async () => {
  for (const flag of [false, undefined]) {
    const calls: unknown[] = [], q = queue(flag, calls); await q.select('s');
    assert.equal(q.approveBlockedReason(), null);
    q.requestReview('approved'); assert.equal(q.getSnapshot().reviewDialog, 'approved'); q.setSameAssetConfirmed(true);
    await q.confirmReview(); assert.equal(sentStatus(calls), 'approved');
  }
});

test('View keeps Approve visible but disabled with the reason, and Reject untouched', () => {
  const view = readFileSync('src/features/admin-moderation/views/VerificationModerationView.tsx', 'utf8').replace(/\r\n/g, '\n');
  assert.match(view, /<AppButton disabled=\{!!viewModel\.approveBlockedReason\} label="Approve"/);
  assert.match(view, /Approval is blocked\\n\$\{viewModel\.approveBlockedReason\}/);
  assert.match(view, /<AppButton label="Reject" onPress=\{\(\) => viewModel\.requestReview\('rejected'\)\} variant="danger" \/>/, 'Reject is not gated');
  assert.match(readFileSync('src/features/admin-moderation/viewModels/useAdminModerationViewModel.ts', 'utf8'), /approveBlockedReason: verificationQueue\.approveBlockedReason\(\)/);
});

test('open_tenancy comes only from the server context; the View and queue never query tenancies', () => {
  for (const file of ['src/features/admin-moderation/views/VerificationModerationView.tsx', 'src/features/admin-moderation/viewModels/adminVerificationQueue.ts']) assert.doesNotMatch(readFileSync(file, 'utf8'), /tenancies|\.from\(|getSupabaseClient/, file);
});
