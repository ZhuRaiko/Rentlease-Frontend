/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTierThreeVerificationWorkflow } from '../src/features/user-verification/viewModels/tierThreeVerificationWorkflow';
import { tierThreeDocumentOptions, isTierThreeDocumentType, canEnterTierThree, type TierThreeSubmission } from '../src/features/user-verification/models/TierThreeVerification';
import { localImagePreviewReducer } from '../src/shared/models/documentImagePreview';

const property = { id: 'property-one', landlord_id: 'owner', property_type: 'apartment' as const, barangay: 'Test barangay', city: 'imus' as const };
const selectedDocument = { uri: 'file:///cache/test.jpeg', fileName: 'test.jpeg', mimeType: 'image/jpeg', size: 12 };
const submitted = (status: TierThreeSubmission['status'] = 'pending'): TierThreeSubmission => ({ id: 'submission-one', property_id: property.id, status, rejection_reason: null, review_note: null, submitted_at: '2026-10-21T00:00:00Z', reviewed_at: null, hasDocument: false });
function fixture() {
  let user = 'owner'; let properties = [property]; let latest: TierThreeSubmission | null = null;
  let fail = ''; let cancel = false; let paused = false; let release: (() => void) | undefined; let finalRefreshFailure = false;
  const calls: unknown[][] = [];
  const step = (name: string, ...args: unknown[]) => { calls.push([name, ...args]); if (fail === name) throw Error('private raw backend error'); };
  const workflow = createTierThreeVerificationWorkflow({
    service: {
      getEligibleUserId: async () => { step('auth'); return user; },
      fetchOwnedProperties: async () => { step('properties'); return properties; },
      fetchLatest: async (_user, id) => { step('fetch', id); return latest; },
      createSubmission: async (_user, id) => { step('create', id); if (paused) await new Promise<void>(r => { release = r; }); latest = submitted(); return latest; },
      insertDocument: async (_user, id, type, uploaded) => { step('metadata', id, type, uploaded.storagePath); latest = { ...submitted(), hasDocument: true }; if (finalRefreshFailure) fail = 'fetch'; },
    },
    selectDocument: async () => { step('picker'); return cancel ? null : selectedDocument; },
    uploadDocument: async input => { step('upload', input); return { storagePath: 'owner/submission-one/uuid.jpeg', fileName: 'test.jpeg', mimeType: 'image/jpeg', size: 12 }; },
  });
  const ready = async () => { await workflow.refresh(); await workflow.selectProperty(property.id); workflow.chooseDocumentType('land_title'); await workflow.pickDocument(); workflow.navigate('review'); };
  return { workflow, calls, ready, fail: (v: string) => { fail = v; }, setLatest: (v: TierThreeSubmission | null) => { latest = v; }, noProperties: () => { properties = []; }, switchUser: () => { user = 'other'; }, cancel: () => { cancel = true; }, pause: () => { paused = true; }, release: () => release?.(), failFinalRefresh: () => { finalRefreshFailure = true; } };
}
test('Tier 3 entry requires Tier 1 and landlord, not Tier 2', () => {
  assert.equal(canEnterTierThree(true, true), true); assert.equal(canEnterTierThree(false, true), false); assert.equal(canEnterTierThree(true, false), false);
});

test('separate type step and confirmation cancellation retain property/type/file without writes', async () => {
  const h = fixture(); await h.workflow.refresh(); await h.workflow.selectProperty(property.id);
  assert.equal(h.workflow.getSnapshot().screen, 'documentType');
  h.workflow.chooseDocumentType('land_title'); await h.workflow.pickDocument();
  assert.equal(h.workflow.getSnapshot().screen, 'document');
  await h.workflow.submit(); assert.ok(!h.calls.some(c => c[0] === 'create'));
  h.workflow.navigate('review'); h.workflow.goBack();
  assert.equal(h.workflow.getSnapshot().screen, 'document');
  assert.equal(h.workflow.getSnapshot().propertyId, property.id);
  assert.equal(h.workflow.getSnapshot().documentType, 'land_title');
  assert.equal(h.workflow.getSnapshot().selectedDocument, selectedDocument);
  assert.ok(!h.calls.some(c => ['create', 'upload', 'metadata'].includes(String(c[0]))));
  h.workflow.goBack(); assert.equal(h.workflow.getSnapshot().screen, 'documentType');
  h.workflow.chooseDocumentType('land_title');
  assert.equal(h.workflow.getSnapshot().selectedDocument, selectedDocument);
  h.workflow.goBack(); h.workflow.goBack();
  const reads = h.calls.filter(c => c[0] === 'fetch').length;
  await h.workflow.selectProperty(property.id);
  assert.equal(h.calls.filter(c => c[0] === 'fetch').length, reads + 1);
  assert.equal(h.workflow.getSnapshot().selectedDocument, selectedDocument);
});
test('only four generated ownership/authorization document types qualify', () => {
  assert.deepEqual(tierThreeDocumentOptions.map(o => o.value), ['land_title', 'tax_declaration', 'hoa_document', 'authorization_to_lease']);
  for (const type of ['other', 'passport', 'drivers_license', 'umid', 'philsys_id']) assert.equal(isTierThreeDocumentType(type), false);
});
test('owned property is required; arbitrary IDs and empty property list cannot submit', async () => {
  const h = fixture(); await h.workflow.refresh(); await h.workflow.selectProperty('foreign'); assert.equal(h.workflow.getSnapshot().propertyId, null);
  assert.equal(h.workflow.canSubmit(), false); h.noProperties(); await h.workflow.refresh(); assert.deepEqual(h.workflow.getSnapshot().properties, []);
  await h.workflow.selectProperty(property.id); assert.equal(h.workflow.canSubmit(), false); assert.ok(!h.calls.some(c => c[0] === 'create'));
});
test('property/type/file/review steps enforce prerequisites and cancellation retains selection', async () => {
  const h = fixture(); await h.workflow.refresh(); h.workflow.navigate('review'); assert.equal(h.workflow.getSnapshot().screen, 'intro');
  await h.workflow.selectProperty(property.id); h.workflow.chooseDocumentType('other'); await h.workflow.pickDocument(); assert.equal(h.workflow.canSubmit(), false);
  h.workflow.chooseDocumentType('land_title'); await h.workflow.pickDocument(); h.cancel(); await h.workflow.pickDocument(); assert.equal(h.workflow.getSnapshot().selectedDocument, selectedDocument);
  h.workflow.navigate('review'); assert.equal(h.workflow.canSubmit(), true); h.workflow.chooseDocumentType('tax_declaration'); assert.equal(h.workflow.getSnapshot().selectedDocument, null);
});
test('submit orders preflight, real creation, shared private upload, metadata, backend refresh', async () => {
  const h = fixture(); await h.ready(); h.calls.length = 0; await h.workflow.submit();
  assert.deepEqual(h.calls.map(c => c[0]), ['auth', 'properties', 'fetch', 'create', 'auth', 'upload', 'metadata', 'fetch']);
  assert.deepEqual(h.calls.find(c => c[0] === 'upload')?.[1], { userId: 'owner', submissionId: 'submission-one', selectedDocument });
  assert.deepEqual(h.calls.find(c => c[0] === 'metadata'), ['metadata', 'submission-one', 'land_title', 'owner/submission-one/uuid.jpeg']);
  assert.equal(h.workflow.getSnapshot().submission?.hasDocument, true); assert.equal(h.workflow.getSnapshot().screen, 'status'); assert.equal(h.workflow.getSnapshot().selectedDocument, null);
});
for (const status of ['pending', 'under_review', 'approved', 'rejected', 'cancelled', 'revoked'] as const) test(`existing ${status} for selected property is authoritative and blocks new submission`, async () => {
  const h = fixture(); h.setLatest({ ...submitted(status), rejection_reason: status === 'rejected' ? 'Unreadable' : null }); await h.workflow.refresh(); await h.workflow.selectProperty(property.id);
  assert.equal(h.workflow.getSnapshot().screen, 'status'); assert.equal(h.workflow.getSnapshot().submission?.status, status);
  await h.workflow.submit(); assert.ok(!h.calls.some(c => c[0] === 'create'));
});
test('preflight detects a submission created elsewhere and prevents another create', async () => {
  const h = fixture(); await h.ready(); h.setLatest(submitted()); await h.workflow.submit(); assert.ok(!h.calls.some(c => c[0] === 'create')); assert.equal(h.workflow.getSnapshot().screen, 'status');
});
for (const stage of ['auth', 'properties', 'fetch', 'create', 'upload', 'metadata']) test(`${stage} failure remains truthful and requires refresh without unsafe retry`, async () => {
  const h = fixture(); await h.ready(); h.fail(stage); await h.workflow.submit(); const state = h.workflow.getSnapshot();
  assert.ok(state.error); assert.equal(state.requiresRefresh, true); assert.equal(state.isSubmitting, false); assert.ok(!state.error?.includes('raw backend'));
  const count = h.calls.length; await h.workflow.submit(); assert.equal(h.calls.length, count);
  if (stage === 'upload' || stage === 'metadata') assert.equal(state.submission?.hasDocument, false);
});
test('loading/selection failures do not mean empty eligible state', async () => {
  const h = fixture(); h.fail('properties'); await h.workflow.refresh(); assert.equal(h.workflow.getSnapshot().loaded, false); assert.ok(h.workflow.getSnapshot().error);
  h.fail(''); await h.workflow.refresh(); h.fail('fetch'); await h.workflow.selectProperty(property.id); assert.equal(h.workflow.getSnapshot().requiresRefresh, true); assert.equal(h.workflow.canSubmit(), false);
});
test('duplicate submit, navigation, picker, refresh and property changes are blocked during submit', async () => {
  const h = fixture(); await h.ready(); h.pause(); const first = h.workflow.submit();
  await new Promise(r => setTimeout(r, 0)); await h.workflow.submit(); h.workflow.goBack(); await h.workflow.selectProperty('foreign'); await h.workflow.refresh(); await h.workflow.pickDocument();
  assert.equal(h.calls.filter(c => c[0] === 'create').length, 1); assert.equal(h.workflow.getSnapshot().screen, 'review'); h.release(); await first;
});
test('account/ownership changes detected before creation do not upload or create', async () => {
  const h = fixture(); await h.ready(); h.switchUser(); await h.workflow.submit(); assert.ok(!h.calls.some(c => c[0] === 'create'));
  const other = fixture(); await other.ready(); other.noProperties(); await other.workflow.submit(); assert.ok(!other.calls.some(c => c[0] === 'create'));
});
test('dispose prevents later upload and drops selected file; reactivation can refresh', async () => {
  const h = fixture(); await h.ready(); h.pause(); const first = h.workflow.submit(); await new Promise(r => setTimeout(r, 0)); h.workflow.dispose(); h.release(); await first;
  assert.ok(!h.calls.some(c => c[0] === 'upload')); assert.equal(h.workflow.getSnapshot().selectedDocument, null); h.workflow.activate(); await h.workflow.refresh(); assert.equal(h.workflow.getSnapshot().isSubmitting, false);
});
test('overview -> Tier 3 -> overview -> Tier 3 retains subscribers and clears local selections', async () => {
  const h = fixture(); let updates = 0; const unsubscribe = h.workflow.subscribe(() => { updates++; });
  await h.workflow.setEnabled(false); const initial = updates;
  await h.workflow.setEnabled(true); assert.ok(updates > initial); await h.workflow.selectProperty(property.id);
  h.workflow.chooseDocumentType('land_title'); await h.workflow.pickDocument();
  await h.workflow.setEnabled(false); assert.equal(h.workflow.getSnapshot().selectedDocument, null); assert.equal(h.workflow.getSnapshot().propertyId, null);
  const beforeReopen = updates; await h.workflow.setEnabled(true); assert.ok(updates > beforeReopen);
  assert.equal(h.workflow.getSnapshot().loaded, true); assert.equal(h.workflow.getSnapshot().screen, 'intro'); unsubscribe();
});
test('metadata success followed by final refresh failure does not claim confirmed submission success', async () => {
  const h = fixture(); await h.ready(); h.failFinalRefresh(); await h.workflow.submit();
  assert.match(h.workflow.getSnapshot().error ?? '', /latest backend status could not be confirmed/);
  assert.equal(h.workflow.getSnapshot().requiresRefresh, true); assert.equal(h.workflow.canSubmit(), false);
  assert.equal(h.calls.filter(c => c[0] === 'metadata').length, 1);
});
test('picker errors recover without creating a submission', async () => {
  const h = fixture(); await h.workflow.refresh(); await h.workflow.selectProperty(property.id); h.workflow.chooseDocumentType('hoa_document');
  h.fail('picker'); await h.workflow.pickDocument(); assert.equal(h.workflow.getSnapshot().isSelectingDocument, false); assert.ok(h.workflow.getSnapshot().error);
  assert.ok(!h.calls.some(c => c[0] === 'create')); h.fail(''); await h.workflow.pickDocument(); assert.equal(h.workflow.getSnapshot().selectedDocument, selectedDocument);
});
test('Tier 3 preview open/close preserves document/property/type/review step and invokes no backend work', async () => {
  const h = fixture(); await h.ready(); const before = h.workflow.getSnapshot(); const calls = h.calls.length;
  const preview = localImagePreviewReducer(null, { type: 'open', document: before.selectedDocument! });
  assert.equal(preview, before.selectedDocument); assert.equal(localImagePreviewReducer(preview, { type: 'close' }), null);
  assert.equal(h.workflow.getSnapshot(), before); assert.equal(h.calls.length, calls);
  assert.equal(before.propertyId, property.id); assert.equal(before.documentType, 'land_title'); assert.equal(before.screen, 'review');
});
test('disabling Tier 3 during an operation ignores late work without clearing subscribers', async () => {
  const h = fixture(); await h.ready(); h.pause(); const request = h.workflow.submit(); await new Promise(r => setTimeout(r, 0));
  await h.workflow.setEnabled(false); const snapshot = h.workflow.getSnapshot(); h.release(); await request;
  assert.equal(h.workflow.getSnapshot(), snapshot); assert.ok(!h.calls.some(c => c[0] === 'upload'));
});
