/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdminOperationError, classifyAdminError } from '../src/shared/models/AdminOperationError';
import type { AdminActionInput, AdminActionResult, AdminAuditPage, AdminRestrictionPage, AuditKind } from '../src/features/admin-moderation/models/AdminActions';
import type { AdminActionsService } from '../src/features/admin-moderation/services/adminActionsService';
import { createAdminActionsWorkflow } from '../src/features/admin-moderation/viewModels/adminActionsWorkflow';

const U = '11111111-1111-4111-8111-111111111111', L = '33333333-3333-4333-8333-333333333333', R = '44444444-4444-4444-8444-444444444444';
const row = (userId = U, name = 'Landlord Lee') => ({ userId, name, status: 'suspended' as const, reason: 'Reason on file', endsAt: null, startedAt: null, ended: false, restorable: true });
const adminError = (message: string, code?: string) => new AdminOperationError(classifyAdminError(Object.assign(new Error(message), code ? { code } : {}), { decision: true }));
const deferred = <T,>() => { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

function harness() {
  const calls: AdminActionInput[] = [], audit: { kind: AuditKind; offset: number }[] = [];
  let restrictions: AdminRestrictionPage = { count: 1, rows: [row()] }, applyImpl: (i: AdminActionInput) => Promise<AdminActionResult> = async (i) => ({ id: R, action: i.action, status: 'ok', targetUserId: i.targetUserId, targetListingId: i.targetListingId, reportId: i.reportId, endsAt: i.endsAt });
  let restrictionLoads = 0, auditImpl: (kind: AuditKind, offset: number) => Promise<AdminAuditPage> = async () => ({ count: 0, rows: [] });
  const service: AdminActionsService = {
    fetchRestrictions: async () => { restrictionLoads++; return restrictions; },
    fetchAuditLog: (kind, offset) => { audit.push({ kind, offset }); return auditImpl(kind, offset); },
    applyAction: (input) => { calls.push(input); return applyImpl(input); },
  };
  let id = 0;
  const wf = createAdminActionsWorkflow(service, () => `op-${++id}`, () => Date.parse('2026-11-13T00:00:00Z'));
  return { wf, calls, audit, set: { apply: (f: typeof applyImpl) => { applyImpl = f; }, restrictions: (r: AdminRestrictionPage) => { restrictions = r; }, audit: (f: typeof auditImpl) => { auditImpl = f; } }, loads: () => restrictionLoads };
}
const suspend = { action: 'suspend_account' as const, targetUserId: U, targetListingId: null, reportId: R, targetLabel: 'Reported user' };
const GOOD = 'Harassment confirmed after review';

test('lists load with real state and a failed load shows a plain-language error', async () => {
  const h = harness();
  assert.equal(h.wf.getSnapshot().restrictions.status, 'idle');
  await h.wf.loadRestrictions(); assert.deepEqual([h.wf.getSnapshot().restrictions.status, h.wf.getSnapshot().restrictions.rows.length, h.wf.getSnapshot().restrictions.count], ['success', 1, 1]);
  h.set.audit(async () => { throw adminError('Access unavailable', '42501'); });
  await h.wf.loadAudit('reports', 25); const a = h.wf.getSnapshot().audit;
  assert.deepEqual([a.status, a.kind, a.offset, a.rows.length], ['error', 'reports', 25, 0]); assert.match(a.error ?? '', /Access unavailable/); assert.doesNotMatch(a.error ?? '', /42501|SQL|exception/i);
  await h.wf.loadAudit('all', 0); assert.deepEqual(h.audit.at(-1), { kind: 'all', offset: 0 });
});

test('recent decisions keep the three newest entries', async () => {
  const h = harness(); const entries = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), createdAt: '2026-11-13T00:00:00Z', action: 'suspend_account', entityType: 'user', entityId: U, actor: 'Admin', subject: null, reportReason: null, reason: null, status: null, previousStatus: null, tier: null, kind: null, endsAt: null, reportId: null }));
  h.set.audit(async () => ({ count: 5, rows: entries })); await h.wf.loadRecent();
  assert.deepEqual(h.wf.getSnapshot().recent.rows.map((r) => r.id), ['1', '2', '3']);
});

test('a stale load never overwrites a newer one', async () => {
  const h = harness(); const slow = deferred<AdminAuditPage>(); let calls = 0;
  h.set.audit(() => (++calls === 1 ? slow.promise : Promise.resolve({ count: 1, rows: [] })));
  const first = h.wf.loadAudit('all', 0), second = h.wf.loadAudit('actions', 0); await second; slow.resolve({ count: 99, rows: [] }); await first;
  assert.deepEqual([h.wf.getSnapshot().audit.kind, h.wf.getSnapshot().audit.count], ['actions', 1]);
});

test('confirming sends one trimmed operation, then clears the sheet, refreshes the list and marks audit stale', async () => {
  const h = harness(); await h.wf.loadAudit('all', 0);
  h.wf.openAction(suspend); h.wf.updateDraft({ reason: `  ${GOOD}  `, endsPreset: '30d' });
  assert.equal(await h.wf.confirmAction(), true);
  assert.equal(h.calls.length, 1);
  assert.deepEqual({ ...h.calls[0], operationId: undefined }, { operationId: undefined, action: 'suspend_account', targetUserId: U, targetListingId: null, reportId: R, reason: GOOD, endsAt: '2026-12-13T00:00:00.000Z' });
  const s = h.wf.getSnapshot();
  assert.equal(s.draft, null); assert.equal(s.submit.busy, false); assert.match(s.submit.notice ?? '', /suspended/i); assert.equal(s.submit.attempt, null);
  assert.equal(h.loads(), 1, 'the restrictions list is reloaded after the action');
  assert.equal(s.audit.status, 'idle', 'the audit view reloads on next visit'); assert.equal(s.recent.status, 'idle');
});

test('only a suspension carries an end date', async () => {
  const h = harness();
  h.wf.openAction({ action: 'remove_listing', targetUserId: null, targetListingId: L, reportId: R, targetLabel: 'Listing' }); h.wf.updateDraft({ reason: GOOD, endsPreset: '30d' });
  await h.wf.confirmAction(); assert.equal(h.calls[0]!.endsAt, null);
  h.wf.openAction({ action: 'restore_account', targetUserId: U, targetListingId: null, reportId: null, targetLabel: 'x' }); h.wf.updateDraft({ reason: GOOD, endsPreset: '7d' });
  await h.wf.confirmAction(); assert.equal(h.calls[1]!.endsAt, null); assert.equal(h.calls[1]!.reportId, null);
});

test('an invalid reason never reaches the backend', async () => {
  const h = harness(); h.wf.openAction(suspend); h.wf.updateDraft({ reason: 'too short' });
  assert.equal(await h.wf.confirmAction(), false); assert.equal(h.calls.length, 0);
  assert.match(h.wf.getSnapshot().submit.error ?? '', /10 to 500/); assert.ok(h.wf.getSnapshot().draft, 'the sheet stays open');
});

test('double taps and edits while saving are ignored: exactly one request', async () => {
  const h = harness(); const gate = deferred<AdminActionResult>(); h.set.apply(() => gate.promise);
  h.wf.openAction(suspend); h.wf.updateDraft({ reason: GOOD });
  const a = h.wf.confirmAction(), b = h.wf.confirmAction(), c = h.wf.confirmAction();
  assert.equal(h.wf.getSnapshot().submit.busy, true);
  h.wf.updateDraft({ reason: 'edited while saving, ignored' }); h.wf.cancelAction(); h.wf.openAction({ ...suspend, targetLabel: 'Other' });
  assert.equal(h.wf.getSnapshot().draft?.reason, GOOD); assert.equal(h.wf.getSnapshot().draft?.targetLabel, 'Reported user');
  gate.resolve({ id: R, action: 'suspend_account', status: 'suspended', targetUserId: U, targetListingId: null, reportId: R, endsAt: null });
  assert.deepEqual(await Promise.all([a, b, c]), [true, false, false]); assert.equal(h.calls.length, 1);
});

test('after an unknown outcome the retry replays the SAME operation id and end date', async () => {
  for (const failure of [Object.assign(new TypeError('Network request failed')), new Error('timed out'), Object.assign(new Error('boom'), { code: 'XX000' })]) {
    const h = harness(); let n = 0;
    h.set.apply(async (i) => { if (++n === 1) throw adminError(failure.message, (failure as { code?: string }).code); return { id: R, action: i.action, status: 'ok', targetUserId: i.targetUserId, targetListingId: null, reportId: i.reportId, endsAt: i.endsAt }; });
    h.wf.openAction(suspend); h.wf.updateDraft({ reason: GOOD, endsPreset: '7d' });
    assert.equal(await h.wf.confirmAction(), false);
    assert.ok(h.wf.getSnapshot().draft, 'the sheet stays open'); assert.ok(h.wf.getSnapshot().submit.error); assert.ok(h.wf.getSnapshot().submit.attempt);
    assert.equal(await h.wf.confirmAction(), true);
    assert.equal(h.calls.length, 2); assert.equal(h.calls[1]!.operationId, h.calls[0]!.operationId, 'same operation id'); assert.equal(h.calls[1]!.endsAt, h.calls[0]!.endsAt, 'same end date');
  }
});

test('editing after a failure starts a new attempt with a new operation id', async () => {
  const h = harness(); let n = 0; h.set.apply(async (i) => { if (++n === 1) throw adminError('network down'); return { id: R, action: i.action, status: 'ok', targetUserId: i.targetUserId, targetListingId: null, reportId: i.reportId, endsAt: null }; });
  h.wf.openAction(suspend); h.wf.updateDraft({ reason: GOOD }); await h.wf.confirmAction();
  h.wf.updateDraft({ reason: 'A corrected and longer reason' }); assert.equal(h.wf.getSnapshot().submit.attempt, null);
  await h.wf.confirmAction(); assert.notEqual(h.calls[1]!.operationId, h.calls[0]!.operationId);
});

test('a state conflict closes the sheet, explains why in plain language and refreshes the list', async () => {
  const h = harness(); h.set.apply(async () => { throw adminError('Account is already restricted or suspended', '22023'); });
  h.wf.openAction(suspend); h.wf.updateDraft({ reason: GOOD }); await h.wf.confirmAction();
  const s = h.wf.getSnapshot(); assert.equal(s.draft, null); assert.match(s.submit.error ?? '', /Already restricted/); assert.equal(s.submit.attempt, null); assert.equal(s.submit.busy, false);
  await new Promise((r) => setImmediate(r)); assert.equal(h.loads(), 1, 'the list is reloaded so it shows the current state');
});

test('a fixable refusal (reason or end date) keeps the sheet open', async () => {
  const h = harness(); h.set.apply(async () => { throw adminError('End date must be in the future', '22023'); });
  h.wf.openAction(suspend); h.wf.updateDraft({ reason: GOOD }); await h.wf.confirmAction();
  assert.ok(h.wf.getSnapshot().draft); assert.match(h.wf.getSnapshot().submit.error ?? '', /End date has passed/); assert.equal(h.loads(), 0);
});

test('a denied caller sees a plain message and nothing else changes', async () => {
  const h = harness(); h.set.apply(async () => { throw adminError('Access unavailable', '42501'); });
  h.wf.openAction(suspend); h.wf.updateDraft({ reason: GOOD }); assert.equal(await h.wf.confirmAction(), false);
  assert.match(h.wf.getSnapshot().submit.error ?? '', /Access unavailable/); assert.doesNotMatch(h.wf.getSnapshot().submit.error ?? '', /42501|permission denied/i);
});

test('cancel closes the sheet and clears the error; results arriving after dispose are ignored', async () => {
  const h = harness(); h.wf.openAction(suspend); h.wf.cancelAction(); assert.equal(h.wf.getSnapshot().draft, null);
  const gate = deferred<AdminRestrictionPage>(); const h2 = harness(); h2.set.restrictions({ count: 9, rows: [] });
  const slow: AdminActionsService = { fetchRestrictions: () => gate.promise, fetchAuditLog: async () => ({ count: 0, rows: [] }), applyAction: async () => { throw new Error('unused'); } };
  const wf = createAdminActionsWorkflow(slow, () => 'x'); const pending = wf.loadRestrictions(); wf.dispose(); gate.resolve({ count: 5, rows: [row()] }); await pending;
  assert.equal(wf.getSnapshot().restrictions.status, 'idle');
});

test('suspend and remove need a report; the app never calls the service without one, restore does not need one', async () => {
  const h = harness();
  for (const action of ['suspend_account', 'remove_listing'] as const) {
    h.wf.openAction({ action, targetUserId: action === 'suspend_account' ? U : null, targetListingId: action === 'remove_listing' ? L : null, reportId: null, targetLabel: 'x' }); h.wf.updateDraft({ reason: GOOD });
    assert.equal(await h.wf.confirmAction(), false); assert.match(h.wf.getSnapshot().submit.error ?? '', /upheld report/); assert.equal(h.calls.length, 0, action);
    h.wf.cancelAction();
  }
  h.wf.openAction({ action: 'restore_account', targetUserId: U, targetListingId: null, reportId: null, targetLabel: 'x' }); h.wf.updateDraft({ reason: GOOD });
  assert.equal(await h.wf.confirmAction(), true); assert.equal(h.calls.length, 1);
});

test('Load more appends the next page by offset, de-duplicates shifted rows, and a failed append keeps what is shown', async () => {
  const h = harness();
  const mk = (id: number) => ({ id: String(id), createdAt: '2026-11-13T00:00:00Z', action: 'report_dismissed', entityType: 'report', entityId: null, actor: 'Admin 21ad99f1', subject: null, reportReason: null, reason: null, status: null, previousStatus: null, tier: null, kind: null, endsAt: null, reportId: null });
  const pages: Record<number, { count: number; rows: ReturnType<typeof mk>[] }> = { 0: { count: 6, rows: [mk(6), mk(5), mk(4)] }, 3: { count: 7, rows: [mk(4), mk(3), mk(2)] } };
  h.set.audit(async (_kind, offset) => { const page = pages[offset]; if (!page) throw adminError('Access unavailable', '42501'); return page; });
  await h.wf.loadAudit('all', 0);
  await h.wf.loadMoreAudit();
  let a = h.wf.getSnapshot().audit;
  assert.deepEqual(h.audit.map((c) => c.offset), [0, 3], 'the second request uses the number of rows already shown as its offset');
  assert.deepEqual(a.rows.map((r) => r.id), ['6', '5', '4', '3', '2'], 'row 4 came back again after a new entry shifted the list, and is shown once');
  assert.equal(a.count, 7); assert.equal(a.moreStatus, 'idle');
  await h.wf.loadMoreAudit();
  a = h.wf.getSnapshot().audit;
  assert.equal(a.moreStatus, 'error'); assert.match(a.moreError ?? '', /Access unavailable/); assert.equal(a.rows.length, 5, 'rows already shown stay'); assert.equal(a.status, 'success');
  await h.wf.loadAudit('reports', 0);
  assert.equal(h.wf.getSnapshot().audit.moreStatus, 'idle', 'a new filter clears the append state');
});

test('Load more ignores a stale page after the filter changed, and does nothing when everything is loaded', async () => {
  const h = harness();
  const mk = (id: number) => ({ id: String(id), createdAt: '2026-11-13T00:00:00Z', action: 'report_dismissed', entityType: 'report', entityId: null, actor: 'Admin 21ad99f1', subject: null, reportReason: null, reason: null, status: null, previousStatus: null, tier: null, kind: null, endsAt: null, reportId: null });
  const slow = deferred<AdminAuditPage>();
  h.set.audit(async (kind, offset) => (offset === 1 ? slow.promise : { count: kind === 'all' ? 3 : 1, rows: [mk(kind === 'all' ? 3 : 90)] }));
  await h.wf.loadAudit('all', 0);
  const more = h.wf.loadMoreAudit();
  await h.wf.loadAudit('reports', 0);
  slow.resolve({ count: 3, rows: [mk(2)] }); await more;
  assert.deepEqual(h.wf.getSnapshot().audit.rows.map((r) => r.id), ['90'], 'the late "all" page is dropped');
  const calls = h.audit.length; await h.wf.loadMoreAudit();
  assert.equal(h.audit.length, calls, 'nothing is requested once every row is shown');
});
