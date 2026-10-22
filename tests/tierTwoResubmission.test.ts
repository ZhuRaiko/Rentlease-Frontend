import { tierTwoSubmissionPresentation } from '../src/features/user-verification/models/TierTwoVerification';
import { readFileSync } from 'node:fs';
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTierTwoVerificationWorkflow } from '../src/features/user-verification/viewModels/tierTwoVerificationWorkflow';
import type { TierTwoSubmission } from '../src/features/user-verification/models/TierTwoVerification';

const old: TierTwoSubmission = { id: 'old', status: 'rejected', rejection_reason: 'Unreadable ID', review_note: null, submitted_at: '2026-10-01T00:00:00Z', reviewed_at: '2026-10-02T00:00:00Z', hasDocument: true };
const pending = (): TierTwoSubmission => ({ ...old, id: 'returned-id', status: 'pending', rejection_reason: null, reviewed_at: null, hasDocument: false });
const file = { uri: 'file:///cache/correction.jpg', fileName: 'correction.jpg', mimeType: 'image/jpeg', size: 100 };
function fixture(initial: TierTwoSubmission | null = old) {
  let latest = initial, identity = 'owner', failure = '', pause: (() => void) | undefined;
  let hold = false, holdRpc = false;
  let releaseRpc: (() => void) | undefined;
  let detailOverride: ((row: TierTwoSubmission | null) => TierTwoSubmission | null) | null = null;
  let historyFails = false;
  const calls: string[] = [];
  const history = initial?.status === 'rejected' ? initial : old;
  const workflow = createTierTwoVerificationWorkflow({
    service: {
      getCurrentUserId: async () => identity,
      fetchLatest: async () => { calls.push('latest'); if (failure === 'latest') throw Error(); return latest; },
      fetchSubmission: async (_user, id) => { calls.push(`detail:${id}`); return detailOverride ? detailOverride(latest) : latest; },
      fetchPreviousRejection: async () => { if (historyFails) throw Error(); return history; },
      beginSubmission: async () => {
        calls.push('rpc');
        if (failure === 'unique') throw { code: '23505' };
        latest = latest?.status === 'pending' ? latest : pending();
        if (failure === 'uncertain') throw Error('lost response');
        if (holdRpc) await new Promise<void>(resolve => { releaseRpc = resolve; });
        return latest;
      },
      insertDocument: async (_user, id) => { calls.push(`metadata:${id}`); if (failure === 'metadata') throw Error(); latest = { ...latest!, hasDocument: true }; },
    },
    selectDocument: async () => file,
    uploadDocument: async input => {
      calls.push(`upload:${input.submissionId}`);
      if (hold) await new Promise<void>(resolve => { pause = resolve; });
      if (failure === 'upload') throw Error();
      return { storagePath: `owner/${input.submissionId}/unique.jpg`, fileName: file.fileName, mimeType: file.mimeType, size: file.size };
    },
  });
  return { workflow, calls, holdBegin: () => { holdRpc = true; }, releaseBegin: () => releaseRpc?.(),
    setFailure: (value: string) => { failure = value; }, setIdentity: (value: string) => { identity = value; },
    failHistory: () => { historyFails = true; }, overrideDetail: (fn: typeof detailOverride) => { detailOverride = fn; },
    setLatest: (value: TierTwoSubmission) => { latest = value; }, hold: () => { hold = true; }, release: () => pause?.(),
    select: async () => { workflow.startRecovery(); workflow.chooseId('Passport'); await workflow.pickDocument(); },
  };
}

test('opening rejection and selecting a correction perform no write; review confirmation is required', async () => {
  const h = fixture(); await h.workflow.refresh(); assert.equal(h.workflow.canStartRecovery(), true);
  await h.select(); await h.workflow.submit(); assert.ok(!h.calls.includes('rpc'));
  h.workflow.navigate('tier2Review'); await h.workflow.submit();
  assert.equal(h.calls.filter(call => call === 'rpc').length, 1);
  assert.ok(h.calls.includes('upload:returned-id')); assert.ok(h.calls.includes('metadata:returned-id'));
  assert.equal(h.workflow.getSnapshot().submission?.hasDocument, true);
  assert.equal(h.workflow.getSnapshot().previousRejection?.rejection_reason, 'Unreadable ID');
  assert.equal(old.status, 'rejected');
});

test('incomplete pending resumes its existing ID; registered pending and terminal/in-review states cannot restart', async () => {
  const h = fixture(pending()); await h.workflow.refresh(); await h.select(); h.workflow.navigate('tier2Review'); await h.workflow.submit();
  assert.ok(h.calls.includes('upload:returned-id')); assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  for (const status of ['pending', 'approved', 'under_review', 'cancelled', 'revoked'] as const) {
    const blocked = fixture({ ...old, status }); await blocked.workflow.refresh(); await blocked.select(); blocked.workflow.navigate('tier2Review'); await blocked.workflow.submit();
    assert.equal(blocked.workflow.canStartRecovery(), false); assert.ok(!blocked.calls.includes('rpc'), status);
  }
});

for (const failure of ['unique', 'uncertain', 'upload', 'metadata']) test(`${failure} requires read reconciliation and explicit recovery rather than a blind retry`, async () => {
  const h = fixture(); await h.workflow.refresh(); await h.select(); h.workflow.navigate('tier2Review'); h.setFailure(failure);
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().requiresRefresh, true);
  await h.workflow.submit(); h.workflow.startRecovery(); assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  h.setFailure(''); await h.workflow.refresh(); assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  assert.ok(h.workflow.getSnapshot().submission);
});

test('rapid confirmation and identity changes cannot register an old account document', async () => {
  const h = fixture(); await h.workflow.refresh(); await h.select(); h.workflow.navigate('tier2Review'); h.hold();
  const first = h.workflow.submit(); await new Promise(resolve => setImmediate(resolve));
  await h.workflow.submit(); await h.workflow.pickDocument(); h.setIdentity('different'); h.release(); await first;
  assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  assert.ok(!h.calls.some(c => c.startsWith('metadata:')));
  assert.equal(h.workflow.getSnapshot().submission, null);
  assert.equal(h.workflow.getSnapshot().selectedDocument, null);
});


test('a fresh load of rejection has no write and historical reason remains separate after explicit recovery', async () => {
  const h = fixture(); await h.workflow.refresh();
  assert.deepEqual(h.calls, ['latest']); assert.equal(h.workflow.getSnapshot().screen, 'overview');
  h.workflow.navigate('tier2Status'); assert.deepEqual(h.calls, ['latest']);
  assert.equal(h.workflow.getSnapshot().submission?.rejection_reason, old.rejection_reason);
  await h.select(); h.workflow.navigate('tier2Review'); await h.workflow.submit();
  assert.equal(h.workflow.getSnapshot().previousRejection?.id, 'old');
  assert.equal(h.workflow.getSnapshot().submission?.id, 'returned-id');
});

test('an attachment registered before upload blocks this upload without another RPC', async () => {
  const h = fixture(); await h.workflow.refresh(); await h.select(); h.workflow.navigate('tier2Review');
  h.overrideDetail(row => row ? { ...row, hasDocument: true } : null);
  await h.workflow.submit(); assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  assert.ok(!h.calls.some(c => c.startsWith('upload:') || c.startsWith('metadata:')));
  assert.equal(h.workflow.getSnapshot().submission?.hasDocument, true);
});

test('another attachment or review starting during upload prevents this metadata write', async () => {
  for (const status of ['pending', 'under_review'] as const) {
    const h = fixture(); await h.workflow.refresh(); await h.select(); h.workflow.navigate('tier2Review'); h.hold();
    const attempt = h.workflow.submit(); await new Promise(resolve => setImmediate(resolve));
    h.setLatest({ ...pending(), status, hasDocument: status === 'pending' }); h.release(); await attempt;
    assert.ok(!h.calls.some(c => c.startsWith('metadata:')));
    assert.match(h.workflow.getSnapshot().error ?? '', /not registered.*or deleted/);
    assert.equal(h.workflow.getSnapshot().submission?.status, status);
  }
});

test('uncertain RPC is reconciled to its pending ID and resumed only after another explicit confirmation', async () => {
  const h = fixture(); await h.workflow.refresh(); await h.select(); h.workflow.navigate('tier2Review'); h.setFailure('uncertain');
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().requiresRefresh, true);
  h.setFailure(''); await h.workflow.refresh();
  assert.equal(h.workflow.getSnapshot().submission?.id, 'returned-id');
  assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  await h.select(); await h.workflow.submit(); assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  h.workflow.navigate('tier2Review'); await h.workflow.submit();
  assert.equal(h.calls.filter(c => c === 'rpc').length, 2);
  assert.equal(h.workflow.getSnapshot().submission?.id, 'returned-id');
});

test('history read failures do not fake history or block the current authoritative application', async () => {
  const h = fixture(pending()); h.failHistory(); await h.workflow.refresh();
  assert.equal(h.workflow.getSnapshot().submission?.id, 'returned-id');
  assert.equal(h.workflow.getSnapshot().previousRejection, null);
  assert.ok(h.workflow.getSnapshot().historyError); assert.equal(h.workflow.canStartRecovery(), true);
});

test('late RPC completion after disposal cannot upload or repopulate the disposed flow', async () => {
  const h = fixture(); await h.workflow.refresh(); await h.select(); h.workflow.navigate('tier2Review');
  h.holdBegin();
  const attempt = h.workflow.submit(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.filter(c => c === 'rpc').length, 1);
  h.workflow.dispose(); const snapshot = h.workflow.getSnapshot(); h.releaseBegin();
  await attempt; assert.equal(h.workflow.getSnapshot(), snapshot);
  assert.ok(!h.calls.some(c => c.startsWith('upload:') || c.startsWith('metadata:')));
});


test('incomplete or unconfirmed application presentation never claims a completed pending submission', () => {
  assert.deepEqual(tierTwoSubmissionPresentation(pending()), { label: 'Incomplete Upload', tone: 'warning' });
  assert.equal(tierTwoSubmissionPresentation({ ...pending(), hasDocument: true }).label, 'Pending');
  assert.equal(tierTwoSubmissionPresentation(pending(), true).label, 'Status Unconfirmed');
  assert.equal(tierTwoSubmissionPresentation(old).label, 'Rejected');
});

test('recovery UI only selects locally; the single submit binding remains on review with existing preview and Back', () => {
  const view = readFileSync('src/features/user-verification/views/TierTwoVerificationView.tsx', 'utf8');
  assert.equal((view.match(/viewModel.submit\(\)/g) ?? []).length, 1);
  const review = view.slice(view.indexOf("viewModel.screen === 'tier2Review'"), view.lastIndexOf('  return ('));
  assert.match(review, /viewModel.submit\(\)/); assert.match(review, /DocumentPreviewPicker/); assert.match(review, /onBack=\{viewModel.goBack\}/);
  const status = readFileSync('src/features/user-verification/views/VerificationStatusView.tsx', 'utf8');
  assert.match(status, /onPress=\{viewModel.startRecovery\}/); assert.doesNotMatch(status, /viewModel.submit\(\)|getSupabaseClient|\.rpc\(/);
  assert.match(status, /formatVerificationDate\(viewModel.previousRejection.reviewed_at/);
});
