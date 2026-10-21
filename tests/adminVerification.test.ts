/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { mapAdminVerification, documentTypeLabel, verificationStatusLabel, verificationTierLabel, type AdminVerificationRow } from '../src/features/admin-moderation/models/AdminVerification';
import { createAdminVerificationService } from '../src/features/admin-moderation/services/adminVerificationService';
import { createAdminVerificationQueue } from '../src/features/admin-moderation/viewModels/adminVerificationQueue';

const raw = (overrides: Partial<AdminVerificationRow> = {}): AdminVerificationRow => ({
  submission_id: 'test-submission', user_id: 'test-applicant', display_name: 'Test applicant', tier: 'tier_2_identity',
  property_id: null, status: 'pending', submitted_note: null, submitted_at: '2026-10-20T01:00:00Z', updated_at: '2026-10-20T01:00:00Z',
  trust_score: 10, tier1_verified_at: '2026-10-01T01:00:00Z', tier2_verified_at: null, tier3_verified_at: null,
  document_count: 1, document_id: 'doc-1', document_type: 'passport', file_name: 'test.jpeg', mime_type: 'image/jpeg', storage_path: 'owner/submission/file.jpeg', document_created_at: '2026-10-20T01:00:00Z', ...overrides,
});
test('real RPC row maps to an honest pending Tier 2 card with document metadata', () => {
  const item = mapAdminVerification(raw());
  assert.equal(item.submissionId, 'test-submission'); assert.equal(item.displayName, 'Test applicant');
  assert.equal(verificationTierLabel(item.tier), 'Tier 2 Identity');
  assert.equal(verificationStatusLabel(item.status), 'Pending');
  assert.equal(documentTypeLabel(item.documentType), 'Passport');
  assert.equal(item.submittedAt, '2026-10-20T01:00:00Z'); assert.equal(item.fileName, 'test.jpeg');
});
test('under_review remains distinct and displays Under review', () => assert.equal(verificationStatusLabel(mapAdminVerification(raw({ status: 'under_review' })).status), 'Under review'));
test('missing document does not invent a filename or type', () => {
  const item = mapAdminVerification(raw({ document_count: 0, document_id: null, document_type: null, file_name: null, mime_type: null, storage_path: null, document_created_at: null }));
  assert.equal(item.documentCount, 0); assert.equal(item.fileName, null); assert.equal(documentTypeLabel(item.documentType), 'No document attached');
});
test('document labels cover generated types without fake aliases', () => {
  for (const [type, label] of [['drivers_license', 'Driver’s License'], ['umid', 'UMID'], ['philsys_id', 'National ID / PhilSys ID'], ['land_title', 'Land Title'], ['tax_declaration', 'Tax Declaration'], ['hoa_document', 'HOA Document'], ['authorization_to_lease', 'Authorization to Lease'], ['other', 'Other']] as const) assert.equal(documentTypeLabel(type), label);
});
function serviceFixture(failed = false) {
  const calls: unknown[][] = [];
  const query = {
    select: (fields: string) => { calls.push(['select', fields]); return query; },
    eq: (key: string, value: string) => { calls.push(['eq', key, value]); return query; },
    order: () => query,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  const client = {
    rpc: async (name: string) => { calls.push(['rpc', name]); return { data: failed ? null : [raw()], error: failed ? Error('denied') : null }; },
    from: (table: string) => { calls.push(['from', table]); return query; },
  } as unknown as SupabaseClient<Database>;
  return { calls, service: createAdminVerificationService(() => client) };
}
test('one RPC submission with a document produces one queue item; no profile/auth.users query', async () => {
  const h = serviceFixture(); assert.equal((await h.service.fetchVerificationQueue()).length, 1);
  assert.deepEqual(h.calls, [['rpc', 'get_admin_verification_queue']]);
});
test('detail revalidates active RPC membership and fetches only matching document metadata', async () => {
  const h = serviceFixture(); await h.service.fetchVerificationSubmissionDetails('test-submission');
  assert.ok(h.calls.some((c) => c[0] === 'from' && c[1] === 'verification_documents'));
  assert.ok(h.calls.some((c) => c[0] === 'eq' && c[1] === 'submission_id' && c[2] === 'test-submission'));
  assert.ok(!JSON.stringify(h.calls).includes('auth.users')); assert.ok(!JSON.stringify(h.calls).includes('profiles'));
  await assert.rejects(h.service.fetchVerificationSubmissionDetails('absent'));
});
test('backend RPC failure propagates a safe error without sample items', async () => {
  const h = serviceFixture(true); await assert.rejects(h.service.fetchVerificationQueue(), (error: { message: string }) => /Could not load/.test(error.message));
});
function queueFixture() {
  let rows = [mapAdminVerification(raw())]; let fail = false;
  const queue = createAdminVerificationQueue({
    reviewSubmission: async () => { throw Error('Not requested by queue tests'); },
    createVerificationDocumentViewUrl: async () => { throw Error('Not requested by queue tests'); },
    fetchVerificationQueue: async () => { if (fail) throw Error('backend'); return rows; },
    fetchVerificationSubmissionDetails: async (id) => ({ item: rows.find((r) => r.submissionId === id)!, documents: [] }),
  });
  return { queue, setRows: (next: typeof rows) => { rows = next; }, setFail: (next: boolean) => { fail = next; } };
}
test('loading state is immediate and then real data replaces it', async () => {
  const h = queueFixture(); const loading = h.queue.refresh(); assert.equal(h.queue.getSnapshot().status, 'loading');
  await loading; assert.equal(h.queue.getSnapshot().status, 'success'); assert.equal(h.queue.getSnapshot().queue.length, 1);
});
test('empty response is an actual empty successful queue', async () => {
  const h = queueFixture(); h.setRows([]); await h.queue.refresh();
  assert.equal(h.queue.getSnapshot().status, 'success'); assert.deepEqual(h.queue.getSnapshot().queue, []);
});
test('refresh replaces stale queue and clears stale detail; errors never restore fixtures', async () => {
  const h = queueFixture(); await h.queue.refresh(); await h.queue.select('test-submission');
  h.setRows([]); await h.queue.refresh(); assert.equal(h.queue.getSnapshot().detail, null); assert.deepEqual(h.queue.getSnapshot().queue, []);
  h.setFail(true); await h.queue.refresh(); assert.equal(h.queue.getSnapshot().status, 'error'); assert.deepEqual(h.queue.getSnapshot().queue, []);
});
test('a slower obsolete refresh cannot replace the newest result', async () => {
  let resolve!: (items: ReturnType<typeof mapAdminVerification>[]) => void; let n = 0;
  const queue = createAdminVerificationQueue({ reviewSubmission: async () => { throw Error(); }, createVerificationDocumentViewUrl: async () => { throw Error(); }, fetchVerificationQueue: async () => ++n === 1 ? new Promise((r) => { resolve = r; }) : [], fetchVerificationSubmissionDetails: async () => { throw Error(); } });
  const first = queue.refresh(); await queue.refresh(); resolve([mapAdminVerification(raw())]); await first;
  assert.deepEqual(queue.getSnapshot().queue, []);
});
test('disposal suppresses obsolete queue results', async () => {
  const h = queueFixture(); const attempt = h.queue.refresh(); h.queue.dispose(); const snapshot = h.queue.getSnapshot(); await attempt;
  assert.equal(h.queue.getSnapshot(), snapshot);
});
