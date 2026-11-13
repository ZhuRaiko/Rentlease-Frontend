/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { ReportRecord } from '../src/shared/models/Reporting';
import type { IdentityReviewContext, PropertyIdentitySnapshot } from '../src/shared/models/PropertyIdentity';
import {
  filterReports, formatAdminAge, formatAdminDuration, reportDecisionOptions, reviewDecisionConfirmation, reviewDecisionOptions, summarizeAdminWork, summarizeIdentityChanges,
} from '../src/features/admin-moderation/models/AdminQueuePresentation';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const report = (status: ReportRecord['status'], kind: ReportRecord['kind'] = 'listing'): ReportRecord => ({ id: status + kind, kind, reason: 'spam', details: '', status, submittedAt: '2026-11-13T10:00:00Z', resolvedAt: null, publicSummary: null, label: 'x', revision: 'r' });
const snapshot: PropertyIdentitySnapshot = { property_type: 'house', city: 'Imus' as never, barangay: 'Old', floor_number: null, address_line_1: 'A', address_line_2: null, postal_code: null, exact_lat: 1, exact_lng: 2, public_lat: 1, public_lng: 2 };

test('age and duration use real elapsed time and never invent a value', () => {
  assert.equal(formatAdminAge('2026-11-13T11:59:30Z', NOW), 'Just now');
  assert.equal(formatAdminAge('2026-11-13T11:15:00Z', NOW), '45 min ago');
  assert.equal(formatAdminAge('2026-11-13T03:00:00Z', NOW), '9 h ago');
  assert.equal(formatAdminAge('2026-11-11T12:00:00Z', NOW), '2 d ago');
  assert.equal(formatAdminAge('garbage', NOW), 'Date unavailable');
  assert.equal(formatAdminAge(null, NOW), 'Date unavailable');
  assert.equal(formatAdminDuration('2026-11-13T03:00:00Z', NOW), '9 hours');
  assert.equal(formatAdminDuration('2026-11-13T11:00:00Z', NOW), '1 hour');
});

test('report queue filters split open and closed work and keep the type filters open-only', () => {
  const rows = [report('submitted', 'listing'), report('under_review', 'user'), report('dismissed', 'user'), report('upheld', 'listing')];
  assert.deepEqual(filterReports(rows, 'open').map(r => r.status), ['submitted', 'under_review']);
  assert.deepEqual(filterReports(rows, 'listing').map(r => r.status), ['submitted']);
  assert.deepEqual(filterReports(rows, 'user').map(r => r.status), ['under_review']);
  assert.deepEqual(filterReports(rows, 'closed').map(r => r.status), ['dismissed', 'upheld']);
});

test('report decisions only offer the existing moderate inputs and keep the existing transitions', () => {
  const pending = reportDecisionOptions('submitted'), review = reportDecisionOptions('under_review');
  assert.deepEqual(pending.map(o => o.status), ['under_review', 'upheld', 'dismissed']);
  assert.deepEqual(pending.map(o => !!o.disabledReason), [false, true, false], 'a pending report cannot be upheld before review');
  assert.deepEqual(review.map(o => !!o.disabledReason), [true, false, false]);
  assert.deepEqual(reportDecisionOptions('dismissed'), []);
  assert.deepEqual(reportDecisionOptions('upheld'), []);
});

test('identity changes list only differing fields as before/after and collapse the rest', () => {
  const identity = { current: snapshot, proposed: { ...snapshot, barangay: 'New', floor_number: 2 } } as IdentityReviewContext;
  const { changed, unchanged } = summarizeIdentityChanges(identity);
  assert.deepEqual(changed.map(c => [c.label, c.from, c.to]), [['Barangay', 'Old', 'New'], ['Rental floor', 'Not specified', '2']]);
  assert.equal(changed.length + unchanged.length, 7);
  assert.ok(unchanged.some(f => f.label === 'City' && f.value === 'Imus'));
});

test('dashboard total needs every real count; oldest comes from the oldest available source', () => {
  const partial = summarizeAdminWork({ verification: { count: 1, oldest: '2026-11-13T03:00:00Z' }, reports: { count: null, oldest: null }, reviews: { count: 0, oldest: null } });
  assert.equal(partial.total, null);
  const full = summarizeAdminWork({ verification: { count: 1, oldest: '2026-11-13T03:00:00Z' }, reports: { count: 2, oldest: '2026-11-11T12:00:00Z' }, reviews: { count: 0, oldest: null } });
  assert.equal(full.total, 3);
  assert.equal(full.oldest?.label, 'Reports');
  assert.equal(summarizeAdminWork({ verification: { count: 0, oldest: null }, reports: { count: 0, oldest: null }, reviews: { count: 0, oldest: null } }).total, 0);
});

test('Admin screens contain no preview tiles or sample data and the Views never reach backend clients', () => {
  const dir = 'src/features/admin-moderation/';
  for (const file of ['views/AdminDashboardView.tsx', 'views/AdminQueueView.tsx', 'views/AdminActionsView.tsx', 'views/AdminAuditView.tsx', 'views/AdminAuditEntryView.tsx', 'components/AdminAuditRow.tsx', 'models/AuditPresentation.ts', 'views/RestrictionDetailView.tsx', 'views/ReportModerationView.tsx', 'views/ReviewModerationView.tsx', 'views/VerificationModerationView.tsx', 'components/AdminCards.tsx', 'components/AdminActionSheet.tsx', 'components/AdminAuditTimeline.tsx', 'models/AdminModeration.ts', 'models/AdminActions.ts']) {
    const text = readFileSync(dir + file, 'utf8');
    assert.doesNotMatch(text, /\(Preview\)|Admin Preview|LOCAL PREVIEW|previewModerationReports|previewAuditEntries|previewActiveRestrictions/, file);
    if (file.startsWith('views/')) assert.doesNotMatch(text, /getSupabaseClient|supabase\/client|\.rpc\(|\.from\(/, file);
  }
  assert.equal(existsSync(dir + 'views/AdminNotConnectedView.tsx'), false, 'the not-connected placeholders are gone: Actions and Audit are real');
  assert.doesNotMatch(readFileSync(dir + 'components/AdminCards.tsx', 'utf8') + readFileSync(dir + 'views/AdminDashboardView.tsx', 'utf8'), /Not connected yet|not connected yet/);
});

test('the Approve sheet gates only Tier 3 corrections on the same-property confirmation', () => {
  const view = readFileSync('src/features/admin-moderation/views/VerificationModerationView.tsx', 'utf8');
  assert.match(view, /needsSameAsset = review\.reviewDialog === 'approved' && !!identity\?\.same_asset_required/);
  assert.match(view, /\(needsSameAsset && !review\.sameAssetConfirmed\)/);
  assert.match(view, /I confirm the evidence describes the same physical property\./);
  const queue = readFileSync('src/features/admin-moderation/viewModels/adminVerificationQueue.ts', 'utf8');
  assert.match(queue, /sameAssetConfirmed:state\.sameAssetConfirmed/, 'the confirmation still feeds the approve call');
});

test('review decisions keep the previous panel transitions and the required private note', () => {
  assert.deepEqual(reviewDecisionOptions('pending').map(o => o.status), ['approved', 'rejected']);
  assert.deepEqual(reviewDecisionOptions('hidden').map(o => o.status), ['approved', 'rejected']);
  assert.deepEqual(reviewDecisionOptions('approved').map(o => o.status), ['hidden']);
  assert.deepEqual(reviewDecisionOptions('rejected').map(o => o.status), ['approved']);
  assert.equal(reviewDecisionConfirmation('hidden'), 'Set review to hidden?');
  const vm = readFileSync('src/features/admin-moderation/viewModels/useAdminModerationViewModel.ts', 'utf8');
  assert.match(vm, /reviews\.workflow\.submit\(\{ action: 'moderate', reviewId, revision, status, note \}\)/, 'same moderate_rental_review inputs');
  assert.match(vm, /!!reviewNote\.trim\(\)/, 'the private note stays required');
  assert.match(vm, /Review in progress/, 'Back is still blocked while a decision is saving');
});

test('the Reviews tab opens a structured screen and the old panel is gone; hardware Back goes through the ViewModel', () => {
  const flow = readFileSync('src/features/admin-moderation/views/AdminModerationFlowView.tsx', 'utf8');
  assert.match(flow, /<ReviewModerationView/);
  assert.doesNotMatch(flow, /ReviewModerationPanel/);
  assert.match(flow, /registerBackAction\?\.\(\(\) => viewModel\.backFromWorkspace\(onClose\)\)/);
  assert.match(flow, /return \(\) => registerBackAction\?\.\(null\)/);
  assert.doesNotMatch(readFileSync('src/shared/components/RentalReviews.tsx', 'utf8'), /ReviewModerationPanel/);
  const view = readFileSync('src/features/admin-moderation/views/ReviewModerationView.tsx', 'utf8');
  assert.doesNotMatch(view, /getSupabaseClient|\.rpc\(|\.from\(/);
  assert.match(view, /label=\{viewModel\.reviewsSaving \? 'Saving decision\.\.\.' : 'Save decision'\}/);
});
