/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { getTierTwoDocumentType, tierTwoStatusLabels, type TierTwoSubmission } from '../src/features/user-verification/models/TierTwoVerification';
import { createTierTwoVerificationService } from '../src/features/user-verification/services/tierTwoVerificationService';
import { createTierTwoVerificationWorkflow } from '../src/features/user-verification/viewModels/tierTwoVerificationWorkflow';
import { localImagePreviewReducer } from '../src/shared/models/documentImagePreview';

const userId = '11111111-1111-4111-8111-111111111111';
const submissionId = '22222222-2222-4222-8222-222222222222';
const selectedDocument = { uri: 'file:///cache/id.pdf', fileName: 'ID.pdf', mimeType: 'application/pdf', size: 12 };
const uploaded = { storagePath: `${userId}/${submissionId}/unique.pdf`, fileName: 'ID.pdf', mimeType: 'application/pdf', size: 12 };
function row(status: TierTwoSubmission['status'] = 'pending'): TierTwoSubmission {
  return { id: submissionId, status, rejection_reason: null, review_note: null, submitted_at: '2026-10-19T00:00:00Z', reviewed_at: null, hasDocument: true };
}

for (const [label, expected] of [
  ['Driver’s License', 'drivers_license'], ['UMID', 'umid'], ['Passport', 'passport'], ['National ID / PhilSys ID', 'philsys_id'],
] as const) test(`${label} maps to ${expected}`, () => assert.equal(getTierTwoDocumentType(label), expected));
for (const label of ['SSS ID', 'Student ID', 'Student’s ID', 'Land Title']) {
  test(`${label} has no Tier 2 mapping`, () => assert.equal(getTierTwoDocumentType(label), null));
}

// A boundary fake records actual service query operations without loading native clients.
function serviceHarness() {
  const calls: Array<[string, ...unknown[]]> = [];
  let data: unknown = null;
  let error: unknown = null;
  let authenticated: string | null = userId;
  const query = {
    select: (value: unknown) => { calls.push(['select', value]); return query; },
    eq: (key: unknown, value: unknown) => { calls.push(['eq', key, value]); return query; },
    order: (key: unknown, value: unknown) => { calls.push(['order', key, value]); return query; },
    limit: (value: unknown) => { calls.push(['limit', value]); return query; },
    insert: (value: unknown) => { calls.push(['insert', value]); return query; },
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: authenticated } : null }, error: null }) },
    from: (table: string) => { calls.push(['from', table]); return query; },
  } as unknown as SupabaseClient<Database>;
  return { service: createTierTwoVerificationService(() => client), calls,
    respond: (value: unknown, failure: unknown = null) => { data = value; error = failure; },
    setUser: (value: string | null) => { authenticated = value; } };
}

test('service creates Tier 2 with only authenticated user_id and tier; omits property/review/status fields', async () => {
  const h = serviceHarness(); h.respond(row());
  const identity = await h.service.getCurrentUserId();
  await h.service.createSubmission(identity);
  assert.deepEqual(h.calls.find(([name]) => name === 'insert'), ['insert', { user_id: userId, tier: 'tier_2_identity' }]);
});
test('latest lookup filters identity/tier, orders deterministically and handles historical rows with limit one', async () => {
  const h = serviceHarness(); h.respond({ ...row(), verification_documents: [{ id: 'doc' }] });
  assert.equal((await h.service.fetchLatest(userId))?.hasDocument, true);
  assert.ok(h.calls.some((c) => c[0] === 'eq' && c[1] === 'user_id' && c[2] === userId));
  assert.ok(h.calls.some((c) => c[0] === 'eq' && c[1] === 'tier' && c[2] === 'tier_2_identity'));
  assert.deepEqual(h.calls.filter(([name]) => name === 'order'), [['order', 'submitted_at', { ascending: false }], ['order', 'id', { ascending: false }]]);
  assert.ok(h.calls.some((c) => c[0] === 'limit' && c[1] === 1));
});
test('metadata insert uses created submission/path and no file_size or privileged columns', async () => {
  const h = serviceHarness();
  await h.service.insertDocument(userId, submissionId, 'passport', uploaded);
  assert.deepEqual(h.calls.find(([name]) => name === 'insert'), ['insert', {
    submission_id: submissionId, document_type: 'passport', storage_path: uploaded.storagePath, file_name: 'ID.pdf', mime_type: 'application/pdf',
  }]);
});
test('service rejects missing/changed authenticated identity before querying', async () => {
  const h = serviceHarness(); h.setUser(null);
  await assert.rejects(h.service.getCurrentUserId());
  h.setUser('another-user');
  await assert.rejects(h.service.createSubmission(userId));
  assert.equal(h.calls.length, 0);
});
test('query errors are not treated as no submission', async () => {
  const h = serviceHarness(); h.respond(null, { message: 'denied' });
  await assert.rejects(h.service.fetchLatest(userId));
});

function workflowHarness() {
  const calls: string[] = [];
  let latest: TierTwoSubmission | null = null;
  let failure: string | null = null;
  let pick: typeof selectedDocument | null = selectedDocument;
  let releaseUpload: (() => void) | null = null;
  let waitUpload = false;
  const workflow = createTierTwoVerificationWorkflow({
    service: {
      getCurrentUserId: async () => { if (failure === 'auth') throw Error(); return userId; },
      fetchLatest: async (id) => { assert.equal(id, userId); calls.push('fetch'); if (failure === 'fetch') throw Error(); return latest; },
      createSubmission: async (id) => { assert.equal(id, userId); calls.push('create'); if (failure === 'create') throw Error(); latest = { ...row(), hasDocument: false }; return failure === 'missing-id' ? { ...latest, id: '' } : latest; },
      insertDocument: async (id, submission, type, document) => {
        calls.push('metadata'); assert.equal(id, userId); assert.equal(submission, submissionId); assert.equal(type, 'passport'); assert.deepEqual(document, uploaded);
        if (failure === 'metadata') throw Error(); latest = row(); if (failure === 'refresh') failure = 'fetch';
      },
    },
    selectDocument: async () => { if (failure === 'picker') throw Error(); return pick; },
    uploadDocument: async (input) => {
      calls.push('upload'); assert.deepEqual(input, { userId, submissionId, selectedDocument });
      if (failure === 'upload') throw Error();
      if (waitUpload) await new Promise<void>((resolve) => { releaseUpload = resolve; });
      return uploaded;
    },
  });
  const ready = async () => { await workflow.refresh(); workflow.chooseId('Passport'); await workflow.pickDocument(); };
  return { workflow, calls, ready, setLatest: (value: TierTwoSubmission | null) => { latest = value; },
    setPickedDocument: (value: typeof selectedDocument) => { pick = value; },
    fail: (value: string | null) => { failure = value; }, cancelPicker: () => { pick = null; },
    pauseUpload: () => { waitUpload = true; }, release: () => releaseUpload?.() };
}
test('Tier 2 fullscreen preview interactions preserve selected ID/file/step and do not submit or upload', async () => {
  const h = workflowHarness(); h.setPickedDocument({ ...selectedDocument, uri: 'file:///cache/id.jpeg', fileName: 'ID.jpeg', mimeType: 'image/jpeg' }); await h.ready();
  h.workflow.navigate('tier2Review'); const before = h.workflow.getSnapshot(); const calls = [...h.calls];
  const preview = localImagePreviewReducer(null, { type: 'open', document: before.selectedDocument! });
  assert.equal(preview, before.selectedDocument); assert.equal(localImagePreviewReducer(preview, { type: 'close' }), null);
  assert.equal(h.workflow.getSnapshot(), before); assert.deepEqual(h.calls, calls);
  assert.equal(before.selectedIdLabel, 'Passport'); assert.equal(before.screen, 'tier2Review');
});
test('submit orders authenticated preflight/create/upload/metadata/refresh and uses created ID', async () => {
  const h = workflowHarness(); await h.ready(); h.calls.length = 0;
  await h.workflow.submit();
  assert.deepEqual(h.calls, ['fetch', 'create', 'upload', 'metadata', 'fetch']);
  assert.equal(h.workflow.getSnapshot().submission?.status, 'pending');
  assert.equal(h.workflow.getSnapshot().error, null);
  assert.equal(h.workflow.canSubmit(), false);
});
for (const status of ['pending', 'under_review', 'approved', 'rejected', 'cancelled', 'revoked'] as const) {
  test(`${status} remains exact and blocks a new submission, including preflight race`, async () => {
    const h = workflowHarness(); await h.ready(); h.setLatest({ ...row(status), rejection_reason: status === 'rejected' ? 'Unreadable' : null });
    await h.workflow.submit();
    assert.equal(h.workflow.getSnapshot().submission?.status, status);
    assert.equal(h.workflow.getSnapshot().submission?.rejection_reason, status === 'rejected' ? 'Unreadable' : null);
    assert.equal(h.workflow.canSubmit(), false);
    assert.ok(!h.calls.includes('create'));
    assert.ok(tierTwoStatusLabels[status]);
  });
}
test('double-submit, refresh and selection are blocked while submit owns the workflow', async () => {
  const h = workflowHarness(); await h.ready(); h.pauseUpload();
  const first = h.workflow.submit();
  await new Promise((resolve) => setImmediate(resolve));
  await h.workflow.submit(); await h.workflow.refresh(); h.workflow.chooseId('UMID');
  assert.equal(h.workflow.getSnapshot().isSubmitting, true);
  assert.equal(h.calls.filter((c) => c === 'create').length, 1);
  h.release(); await first;
});
test('picker cancellation retains selection without error', async () => {
  const h = workflowHarness(); await h.ready(); h.cancelPicker(); await h.workflow.pickDocument();
  assert.deepEqual(h.workflow.getSnapshot().selectedDocument, selectedDocument);
  assert.equal(h.workflow.getSnapshot().error, null);
});
for (const failure of ['auth', 'fetch', 'create', 'upload', 'metadata', 'refresh', 'missing-id']) {
  test(`${failure} failure surfaces error without reporting submission success`, async () => {
    const h = workflowHarness(); await h.ready(); h.fail(failure);
    await h.workflow.submit();
    assert.ok(h.workflow.getSnapshot().error);
    assert.equal(h.workflow.getSnapshot().isSubmitting, false);
    if (['upload', 'metadata'].includes(failure)) {
      assert.equal(h.workflow.getSnapshot().submission?.hasDocument, false);
      assert.equal(h.workflow.canSubmit(), false);
    }
    if (['auth', 'fetch'].includes(failure)) assert.ok(!h.calls.includes('create'));
    if (failure === 'upload') assert.ok(!h.calls.includes('metadata'));
  });
}
test('initial query failure blocks editing/submission until successful refresh', async () => {
  const h = workflowHarness(); h.fail('fetch'); await h.workflow.refresh();
  assert.ok(h.workflow.getSnapshot().error); assert.equal(h.workflow.canSubmit(), false);
  h.fail(null); await h.ready(); assert.equal(h.workflow.canSubmit(), true);
});
test('reopen detects an existing submission without document metadata and blocks another create', async () => {
  const h = workflowHarness(); h.setLatest({ ...row(), hasDocument: false }); await h.workflow.refresh();
  assert.equal(h.workflow.getSnapshot().submission?.hasDocument, false);
  assert.equal(h.workflow.canSubmit(), false);
});
test('disposal prevents later workflow steps and state updates', async () => {
  const h = workflowHarness(); await h.ready(); h.pauseUpload(); const attempt = h.workflow.submit();
  await new Promise((resolve) => setImmediate(resolve)); h.workflow.dispose(); const snapshot = h.workflow.getSnapshot();
  h.release(); await attempt;
  assert.equal(h.workflow.getSnapshot(), snapshot); assert.ok(!h.calls.includes('metadata'));
});
test('development effect cleanup/setup can reload without accepting an obsolete mount result', async () => {
  let firstResolve!: (value: TierTwoSubmission | null) => void;
  let reads = 0;
  const workflow = createTierTwoVerificationWorkflow({
    service: {
      getCurrentUserId: async () => userId,
      fetchLatest: async () => ++reads === 1 ? new Promise((resolve) => { firstResolve = resolve; }) : null,
      createSubmission: async () => row(), insertDocument: async () => {},
    },
    selectDocument: async () => null, uploadDocument: async () => uploaded,
  });
  const first = workflow.refresh(); await new Promise((resolve) => setImmediate(resolve));
  workflow.dispose(); workflow.activate(); await workflow.refresh();
  firstResolve(row()); await first;
  assert.equal(workflow.getSnapshot().submission, null);
  assert.equal(workflow.getSnapshot().loaded, true);
  assert.equal(workflow.getSnapshot().isLoading, false);
});
test('picker failure is recoverable without creation', async () => {
  const h = workflowHarness(); await h.ready(); h.fail('picker'); await h.workflow.pickDocument();
  assert.ok(h.workflow.getSnapshot().error); assert.ok(!h.calls.includes('create'));
});
