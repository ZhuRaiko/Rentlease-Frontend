/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { adminErrorMessage, adminErrorText, AdminOperationError, classifyAdminError, type AdminErrorCode } from '../src/shared/models/AdminOperationError';
import { createAdminVerificationService } from '../src/features/admin-moderation/services/adminVerificationService';
import { createAdminVerificationQueue } from '../src/features/admin-moderation/viewModels/adminVerificationQueue';
import { createReportingService } from '../src/shared/services/reportingService';
import { createRentalReviewService } from '../src/shared/services/rentalReviewService';
import { ReportingError } from '../src/shared/models/Reporting';
import { ReviewError, type ReviewOperation } from '../src/shared/models/RentalReview';

const identityMigration = readFileSync('supabase/migrations/20261102081459_property_identity_revision_verification.sql', 'utf8');
const reportingMigration = readFileSync('supabase/migrations/20261110171913_reporting_moderation.sql', 'utf8');
const gateMigration = readFileSync('supabase/migrations/20261112164000_identity_tenancy_gate.sql', 'utf8');
const sources = { identity: identityMigration, reporting: reportingMigration, gate: gateMigration };

// Exact literals raised by the migrations. The drift guard below fails if the SQL text ever changes.
const catalogue: { source: keyof typeof sources; message: string; code: AdminErrorCode; reload: boolean }[] = [
  { source: 'identity', message: 'Identity cannot change while a tenancy is open', code: 'tenancy_open', reload: true },
  { source: 'identity', message: 'Review context changed. Reload before deciding', code: 'review_context_changed', reload: true },
  { source: 'identity', message: 'Correction changed', code: 'correction_changed', reload: true },
  { source: 'identity', message: 'Identity changed', code: 'identity_changed', reload: true },
  { source: 'identity', message: 'Confirm evidence corrects the same physical property', code: 'same_property_confirmation_required', reload: false },
  { source: 'identity', message: 'Qualifying private proof required', code: 'qualifying_proof_required', reload: true },
  { source: 'identity', message: 'Eligible owner and finalized evidence required', code: 'owner_evidence_required', reload: true },
  { source: 'identity', message: 'Invalid review transition', code: 'invalid_review_transition', reload: true },
  { source: 'identity', message: 'Rejection reason required', code: 'rejection_reason_required', reload: false },
  { source: 'identity', message: 'Admin required', code: 'admin_required', reload: true },
  { source: 'gate', message: 'Identity cannot change while a tenancy is open', code: 'tenancy_open', reload: true },
  { source: 'gate', message: 'Resolve the pending identity review first.', code: 'pending_identity_review', reload: true },
  { source: 'reporting', message: 'Access unavailable', code: 'access_unavailable', reload: true },
  { source: 'reporting', message: 'Report changed', code: 'report_changed', reload: true },
  { source: 'reporting', message: 'Invalid transition', code: 'invalid_report_transition', reload: true },
  { source: 'reporting', message: 'Operation changed', code: 'operation_changed', reload: true },
];
const postgrest = (message: string, code = '22023') => ({ message, code, details: null, hint: null });

test('every mapped literal still exists verbatim in the migration that raises it', () => {
  for (const { source, message } of catalogue) assert.ok(sources[source].includes(`raise exception '${message}'`), `${message} no longer raised by ${source} migration`);
});

test('each migration message maps to a plain-language title, message and next step', () => {
  for (const { message, code, reload } of catalogue) {
    const info = classifyAdminError(postgrest(message));
    assert.equal(info.code, code, message); assert.equal(info.reload, reload, message);
    for (const part of [info.title, info.message, info.nextStep]) assert.ok(part.trim().length > 8, message);
    assert.equal(info.reference, null);
    assert.ok(!adminErrorText(info).includes(message) || info.title === message, `raw literal should not be echoed: ${message}`);
  }
});

test('message wins over errcode; wrapped provider text still matches; errcode is only a fallback', () => {
  assert.equal(classifyAdminError(postgrest('Admin required', '22023')).code, 'admin_required');
  assert.equal(classifyAdminError(postgrest('Access unavailable', '40001')).code, 'access_unavailable');
  assert.equal(classifyAdminError({ message: 'RPC failed: Review context changed. Reload before deciding (hint)', code: '' }).code, 'review_context_changed');
  assert.equal(classifyAdminError({ message: 'Reason required' }).code, 'rejection_reason_required', 'client pre-check message');
  assert.equal(classifyAdminError(postgrest('something unlisted', '42501')).code, 'permission_denied');
  assert.equal(classifyAdminError(postgrest('something unlisted', '40001')).code, 'conflict');
  assert.equal(classifyAdminError(postgrest('something unlisted', '22023')).code, 'invalid_request');
  assert.equal(classifyAdminError(postgrest('Could not find the function', 'PGRST202')).code, 'backend_update_required');
});

test('network and timeout are recognized and tell a deciding Admin to check whether the decision saved', () => {
  assert.equal(classifyAdminError(new TypeError('Network request failed')).code, 'network');
  assert.equal(classifyAdminError({ message: 'TypeError: Failed to fetch', code: '' }).code, 'network');
  assert.equal(classifyAdminError(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })).code, 'timeout');
  assert.equal(classifyAdminError({ message: 'request timed out', code: '' }).code, 'timeout');
  const deciding = classifyAdminError(new TypeError('Network request failed'), { decision: true });
  assert.match(deciding.nextStep, /whether your decision was saved/i); assert.equal(deciding.reload, true);
  assert.doesNotMatch(classifyAdminError(new TypeError('Network request failed')).nextStep, /decision was saved/i);
  assert.equal(classifyAdminError({ message: 'Failed to fetch', code: '23505' }).code, 'unknown', 'a SQLSTATE means the server answered, so it is not a network error');
});

test('unknown errors give a generic message and a short code and never leak SQL or provider text', () => {
  const raw = postgrest('relation "private.accounts" does not exist; SELECT secret FROM auth.users', '42P01');
  const info = classifyAdminError(raw), text = adminErrorText(info);
  assert.equal(info.code, 'unknown'); assert.equal(info.reference, 'AD-42P01'); assert.match(text, /AD-42P01/);
  for (const leak of ['relation', 'private.accounts', 'SELECT', 'auth.users', 'secret']) assert.ok(!text.includes(leak), leak);
  assert.equal(classifyAdminError(new Error('anything at all')).reference, 'AD-UNKNOWN');
  assert.equal(classifyAdminError(undefined).code, 'unknown'); assert.equal(classifyAdminError('boom').code, 'unknown');
  assert.equal(adminErrorMessage(postgrest('Admin required')), adminErrorText(classifyAdminError(postgrest('Admin required'))));
});

test('wording is en-US', () => {
  const all = catalogue.map(c => adminErrorText(classifyAdminError(postgrest(c.message)))).join(' ');
  assert.doesNotMatch(all, /\b(colour|behaviour|organis|authoris|finalis|cancelled)\w*/i);
});

// ---- Verification review service and queue
const verificationClient = (error: unknown, calls: string[] = []) => ({ rpc: async (name: string) => { calls.push(name); if (error instanceof TypeError) throw error; return { data: null, error }; } } as any);

test('reviewSubmission throws a typed plain-language error instead of one generic message', async () => {
  for (const { message, code } of catalogue.filter(c => c.source === 'identity')) {
    const service = createAdminVerificationService(() => verificationClient(postgrest(message)));
    await assert.rejects(service.reviewSubmission({ submissionId: 's', status: 'approved' } as any), (error: unknown) => {
      assert.ok(error instanceof AdminOperationError, message); assert.equal(error.code, code); assert.ok(error.title && error.nextStep);
      assert.ok(!/could not confirm the review result/i.test(error.message)); return true;
    });
  }
  const offline = createAdminVerificationService(() => verificationClient(new TypeError('Network request failed')));
  await assert.rejects(offline.reviewSubmission({ submissionId: 's', status: 'approved' } as any), (error: any) => error.code === 'network' && /decision was saved/.test(error.nextStep));
  const calls: string[] = [], reason = createAdminVerificationService(() => verificationClient(null, calls));
  await assert.rejects(reason.reviewSubmission({ submissionId: 's', status: 'rejected' } as any), (error: any) => error.code === 'rejection_reason_required');
  assert.deepEqual(calls, [], 'client pre-check never reaches the backend');
});

test('queue loads show a specific reason only when the backend gave one, otherwise the existing fallback', async () => {
  const specific = createAdminVerificationService(() => verificationClient(postgrest('Admin required', '42501')));
  await assert.rejects(specific.fetchVerificationQueue(), (error: any) => /Admin access needed/.test(error.message) && !/relation|SQL/.test(error.message));
  const unknown = createAdminVerificationService(() => verificationClient(postgrest('boom', '42P01')));
  await assert.rejects(unknown.fetchVerificationQueue(), (error: any) => /Could not load the Admin verification queue/.test(error.message));
  const offline = createAdminVerificationService(() => verificationClient(new TypeError('Network request failed')));
  await assert.rejects(offline.fetchVerificationQueue(), (error: any) => /Could not load the Admin verification queue/.test(error.message));
});

function queueFixture(failure: () => unknown) {
  const item = { submissionId: 's', userId: 'u', displayName: 'Applicant', tier: 'tier_2_identity', status: 'pending', submittedAt: '', updatedAt: '', submittedNote: null, propertyId: null, trustScore: 0.4, tier1VerifiedAt: '', tier2VerifiedAt: null, tier3VerifiedAt: null, documentCount: 1, documentType: 'passport', fileName: 'a.jpg', mimeType: 'image/jpeg' };
  const detail = { item, documents: [{ id: 'd', submission_id: 's', storage_path: 'u/s/a.jpg', file_name: 'a.jpg', mime_type: 'image/jpeg', document_type: 'passport', created_at: '' }] };
  return createAdminVerificationQueue({ fetchVerificationQueue: async () => [item as any], fetchVerificationSubmissionDetails: async () => detail as any, createVerificationDocumentViewUrl: async () => 'x', reviewSubmission: async () => { throw failure(); } } as any);
}

test('queue keeps the dialog open for fixable errors and asks for a reload otherwise, always with title, message and next step', async () => {
  const fixable = queueFixture(() => new AdminOperationError(classifyAdminError(postgrest('Rejection reason required'))));
  await fixable.select('s'); fixable.requestReview('under_review'); await fixable.confirmReview();
  let snapshot = fixable.getSnapshot();
  assert.equal(snapshot.reviewDialog, 'under_review'); assert.equal(snapshot.reviewNeedsRefresh, false); assert.equal(snapshot.reviewBusy, false);
  assert.match(snapshot.reviewError ?? '', /^Reason needed\n.*Enter a reason/s);

  const stale = queueFixture(() => new AdminOperationError(classifyAdminError(postgrest('Review context changed. Reload before deciding'))));
  await stale.select('s'); stale.requestReview('under_review'); await stale.confirmReview();
  snapshot = stale.getSnapshot();
  assert.equal(snapshot.reviewDialog, null); assert.equal(snapshot.reviewNeedsRefresh, true);
  assert.match(snapshot.reviewError ?? '', /^Review changed\n.*Reload the queue/s);

  const raw = queueFixture(() => Error('raw SQL secret from provider'));
  await raw.select('s'); raw.requestReview('under_review'); await raw.confirmReview();
  snapshot = raw.getSnapshot();
  assert.equal(snapshot.reviewNeedsRefresh, true); assert.ok(!JSON.stringify(snapshot).includes('raw SQL')); assert.match(snapshot.reviewError ?? '', /AD-UNKNOWN/);
});

// ---- Admin-scoped reports and review moderation; reporter, tenant and landlord messages must not change
const A = '00000000-0000-4000-8000-000000000001', L = '00000000-0000-4000-8000-000000000002';
const signal = () => new AbortController().signal;
const rpcClient = (error: unknown) => () => ({ auth: { getUser: async () => ({ data: { user: { id: A } }, error: null }) }, rpc: () => ({ abortSignal: async () => ({ data: null, error }) }) } as any);
const moderate = { action: 'moderate' as const, operationId: A, reportId: L, revision: A, status: 'under_review' as const, note: 'Investigate', publicSummary: '' };
const submit = { action: 'submit' as const, operationId: A, kind: 'listing' as const, contextId: L, reason: 'other' as const, details: 'Concern' };

test('admin report read and moderation show plain-language reasons; definitive flag is unchanged', async () => {
  const service = createReportingService(rpcClient(postgrest('Access unavailable', '42501')));
  await assert.rejects(service.read(A, { mode: 'admin', kind: 'all', status: 'all' }, 0, signal()), (error: unknown) => error instanceof ReportingError && error.definitive === true && /^Access unavailable\n/.test(error.message));
  await assert.rejects(service.write(A, moderate, signal()), (error: unknown) => error instanceof ReportingError && error.definitive === true && /Access unavailable/.test(error.message));
  const changed = createReportingService(rpcClient(postgrest('Report changed', '40001')));
  await assert.rejects(changed.write(A, moderate, signal()), (error: any) => /Report changed\n.*Reload the report/s.test(error.message));
});

test('reporter paths and uncertain admin outcomes keep their existing non-revealing messages', async () => {
  const service = createReportingService(rpcClient(postgrest('Access unavailable', '42501')));
  await assert.rejects(service.write(A, submit, signal()), (error: any) => error.message === 'This report already exists, changed, or the action is unavailable. Refresh.' && error.definitive === true);
  await assert.rejects(service.read(A, { mode: 'mine' }, 0, signal()), (error: any) => error.message === 'This report already exists, changed, or the action is unavailable. Refresh.');
  const timeout = createReportingService(rpcClient(postgrest('canceling statement due to statement timeout', '57014')));
  await assert.rejects(timeout.write(A, moderate, signal()), (error: any) => error.message === 'Report outcome is not confirmed. Retry the same operation.' && error.definitive === false);
  await assert.rejects(timeout.read(A, { mode: 'admin', kind: 'all', status: 'all' }, 0, signal()), (error: any) => error.message === 'Report outcome is not confirmed. Retry the same operation.');
});

const reviewModerate: ReviewOperation = { action: 'moderate', operationId: A, reviewId: L, revision: A, status: 'approved', note: 'Reviewed' };
const reviewSubmit: ReviewOperation = { action: 'submit', operationId: A, tenancyId: L, kind: 'property', rating: 4, text: 'Tahimik!' };

test('review moderation shows plain-language reasons while tenant and landlord review paths are unchanged', async () => {
  const service = createRentalReviewService(rpcClient(postgrest('Access unavailable', '42501')));
  await assert.rejects(service.read(A, { mode: 'moderation', status: 'pending' }, 0, signal()), (error: unknown) => error instanceof ReviewError && /^Access unavailable\n/.test(error.message));
  await assert.rejects(service.write(A, reviewModerate, signal()), (error: any) => /^Access unavailable\n/.test(error.message) && error.uncertain === false && error.definitive === false);
  // Unchanged non-admin behavior.
  await assert.rejects(service.read(A, { mode: 'tenancy', id: L }, 0, signal()), (error: any) => error.message === 'Reviews could not load. Retry.');
  await assert.rejects(service.read(A, { mode: 'property', id: L }, 0, signal()), (error: any) => error.message === 'Reviews could not load. Retry.');
  await assert.rejects(service.write(A, reviewSubmit, signal()), (error: any) => error.message === 'Review already exists, changed, or this action is unavailable. Refresh.');
  const missing = createRentalReviewService(rpcClient({ code: 'PGRST202', message: 'Could not find the function' }));
  await assert.rejects(missing.read(A, { mode: 'tenancy', id: L }, 0, signal()), /T7A backend/);
  const unknown = createRentalReviewService(rpcClient(postgrest('boom', '57014')));
  await assert.rejects(unknown.write(A, reviewModerate, signal()), (error: any) => error.message === 'Outcome not confirmed. Retry the exact review operation.' && error.uncertain === true);
});
