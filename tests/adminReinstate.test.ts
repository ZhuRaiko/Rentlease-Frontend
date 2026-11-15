/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import {
  actionConfirmLabel, actionEffectText, actionNotice, AdminActionsFormatError, auditEntrySubject, auditEntryTitle, parseActionResult, parseAuditPage, parseRemovedListings,
  reinstateBlockedReason, REINSTATE_BLOCKED_REASON, removedListingMeta, removedListingReason, removedListingsHeading, validateActionReason,
  type AdminActionInput, type AdminAuditEntry,
} from '../src/features/admin-moderation/models/AdminActions';
import { auditActorDisplay, auditOutcome, presentAuditEntry } from '../src/features/admin-moderation/models/AuditPresentation';
import { createAdminActionsWorkflow } from '../src/features/admin-moderation/viewModels/adminActionsWorkflow';
import { isRemovedPropertyMessage, publicationBackendError, REMOVED_PROPERTY_OWNER_MESSAGE } from '../src/features/property-listing/models/ListingPublication';
import { classifyAdminError } from '../src/shared/models/AdminOperationError';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const removedRow = (over: any = {}) => ({ listingId: U(1), title: 'Garden Flat', ownerName: 'Maria Santos', removedAt: '2026-11-10T04:00:00Z', reason: 'Fake photos', reinstatable: true, ...over });
const entry = (over: Partial<AdminAuditEntry> = {}): AdminAuditEntry => ({ id: '1', createdAt: '2026-11-14T04:00:00Z', action: 'remove_listing', entityType: 'listing', entityId: U(2), actor: 'Admin Ana', actorId: U(9), subject: null, reportReason: null, reason: null, status: null, previousStatus: null, tier: null, kind: null, endsAt: null, reportId: null, ...over });

// ---- Removed listings parsing and presentation
test('removed listings parse strictly; a malformed page is an error, never a half list', () => {
  const page = parseRemovedListings({ count: 2, rows: [removedRow(), removedRow({ listingId: U(2), removedAt: null, reason: null, reinstatable: false })] });
  assert.equal(page.count, 2); assert.equal(page.rows[1]!.removedAt, null); assert.equal(page.rows[1]!.reason, null); assert.equal(page.rows[1]!.reinstatable, false);
  assert.deepEqual(parseRemovedListings({ count: 0, rows: [] }), { count: 0, rows: [] });
  for (const bad of [null, { count: 1 }, { count: -1, rows: [] }, { count: 1, rows: [removedRow({ listingId: 'x' })] }, { count: 1, rows: [removedRow({ reinstatable: 'yes' })] }, { count: 1, rows: [removedRow({ title: 5 })] }, { count: 2, rows: [removedRow(), removedRow()] }, { count: 1, rows: [removedRow({ removedAt: 'soon' })] }])
    assert.throws(() => parseRemovedListings(bad), AdminActionsFormatError);
});
test('Reinstate is disabled with one plain line only when the server says the listing is not reinstatable', () => {
  assert.equal(reinstateBlockedReason({ reinstatable: true }), null);
  assert.equal(reinstateBlockedReason({ reinstatable: false }), REINSTATE_BLOCKED_REASON);
  assert.match(REINSTATE_BLOCKED_REASON, /owner is an admin/); assert.match(REINSTATE_BLOCKED_REASON, /already has a live listing/); assert.ok(!REINSTATE_BLOCKED_REASON.includes('\n'));
});
test('row lines: owner and removed date, the reason, and the heading count', () => {
  assert.equal(removedListingMeta(removedRow()), 'Owner: Maria Santos · Removed Nov 10, 2026');
  assert.equal(removedListingMeta(removedRow({ removedAt: null })), 'Owner: Maria Santos · Removal date unavailable');
  assert.equal(removedListingMeta(removedRow({ ownerName: '  ' })), 'Owner: Unknown · Removed Nov 10, 2026');
  assert.equal(removedListingReason(removedRow()), 'Reason: Fake photos');
  assert.equal(removedListingReason(removedRow({ reason: '   ' })), 'No reason recorded');
  assert.equal(removedListingReason(removedRow({ reason: null })), 'No reason recorded');
  assert.deepEqual([0, 1, 2].map(removedListingsHeading), ['0 removed listings', '1 removed listing', '2 removed listings']);
});

// ---- Reinstate dialog wording and validation
test('reason validation: 10 to 500 characters, trimmed, counted by characters', () => {
  assert.notEqual(validateActionReason('a'.repeat(9)), null);
  assert.equal(validateActionReason('a'.repeat(10)), null);
  assert.equal(validateActionReason('a'.repeat(500)), null);
  assert.notEqual(validateActionReason('a'.repeat(501)), null);
  assert.notEqual(validateActionReason(' '.repeat(20)), null, 'spaces do not count');
  assert.notEqual(validateActionReason('   short  '), null);
  assert.equal(validateActionReason('\u{1F600}'.repeat(10)), null, 'characters, not UTF-16 units');
  assert.notEqual(validateActionReason('\u{1F600}'.repeat(5)), null, '5 characters are too few even though they are 10 UTF-16 units');
  assert.equal(validateActionReason('\u{1F600}'.repeat(300)), null, '300 characters fit even though they are 600 UTF-16 units');
});
test('reinstate wording: returns as paused, the owner reactivates, confirm label and notice', () => {
  assert.match(actionEffectText('reinstate_listing', null), /comes back as paused/); assert.match(actionEffectText('reinstate_listing', null), /owner must reactivate/);
  assert.equal(actionConfirmLabel('reinstate_listing'), 'Reinstate listing');
  assert.match(actionNotice('reinstate_listing'), /Listing reinstated as paused/);
  assert.equal(parseActionResult({ id: U(3), action: 'reinstate_listing', status: 'paused', targetUserId: null, targetListingId: U(1), reportId: null, endsAt: null }).action, 'reinstate_listing');
  assert.throws(() => parseActionResult({ id: U(3), action: 'delete_everything', status: 'x' }), AdminActionsFormatError);
});

// ---- Workflow: same operation handling as remove_listing, but no report
function setup(over: any = {}) {
  const calls: AdminActionInput[] = []; let removedLoads = 0, restrictionLoads = 0, fail: any = null, n = 0;
  const service: any = {
    fetchRestrictions: async () => { restrictionLoads++; return { count: 0, rows: [] }; },
    fetchRemovedListings: async () => { removedLoads++; return { count: 1, rows: [removedRow()] }; },
    fetchAuditLog: async () => ({ count: 0, rows: [] }),
    applyAction: async (input: AdminActionInput) => { calls.push(input); if (fail) throw fail; return { id: U(5), action: input.action, status: 'paused', targetUserId: null, targetListingId: input.targetListingId, reportId: null, endsAt: null }; },
    ...over,
  };
  const w = createAdminActionsWorkflow(service, () => U(100 + n++), () => 0);
  return { w, calls, loads: () => ({ removedLoads, restrictionLoads }), failWith: (e: any) => { fail = e; } };
}
const open = (w: any) => w.openAction({ action: 'reinstate_listing', targetUserId: null, targetListingId: U(1), reportId: null, targetLabel: 'Garden Flat' });
test('reinstate needs no report: it sends a null report id, the trimmed reason, and reloads both lists', async () => {
  const { w, calls, loads } = setup();
  open(w); w.updateDraft({ reason: '  Removed in error after review.  ' });
  assert.equal(await w.confirmAction(), true);
  assert.deepEqual(calls.map(c => [c.action, c.reportId, c.targetListingId, c.targetUserId, c.endsAt, c.reason]), [['reinstate_listing', null, U(1), null, null, 'Removed in error after review.']]);
  assert.deepEqual(loads(), { removedLoads: 1, restrictionLoads: 1 });
  assert.equal(w.getSnapshot().draft, null); assert.match(w.getSnapshot().submit.notice!, /reinstated as paused/);
  assert.equal(w.getSnapshot().removed.rows.length, 1);
});
test('a suspend or remove without a report is still refused; reinstate is the only exception', async () => {
  const { w, calls } = setup();
  w.openAction({ action: 'remove_listing', targetUserId: null, targetListingId: U(1), reportId: null, targetLabel: 'x' }); w.updateDraft({ reason: 'long enough reason' });
  assert.equal(await w.confirmAction(), false); assert.deepEqual(calls, []);
  assert.match(w.getSnapshot().submit.error!, /upheld report/);
});
test('reinstate with a short reason is refused before anything is sent', async () => {
  const { w, calls } = setup();
  open(w); w.updateDraft({ reason: 'too short' });
  assert.equal(await w.confirmAction(), false); assert.deepEqual(calls, []); assert.match(w.getSnapshot().submit.error!, /10 to 500/);
});
test('an uncertain failure keeps the sheet and retries with the same operation id; a changed reason starts a new one', async () => {
  const { w, calls, failWith } = setup();
  open(w); w.updateDraft({ reason: 'First reason given here' });
  failWith(Object.assign(new TypeError('Network request failed')));
  assert.equal(await w.confirmAction(), false); assert.ok(w.getSnapshot().draft, 'sheet stays');
  failWith(null); assert.equal(await w.confirmAction(), true);
  assert.equal(calls[0]!.operationId, calls[1]!.operationId, 'identical operation on retry');
  const second = setup(); open(second.w); second.w.updateDraft({ reason: 'First reason given here' }); second.failWith(new TypeError('Network request failed')); await second.w.confirmAction();
  second.w.updateDraft({ reason: 'Changed reason entirely' }); second.failWith(null); await second.w.confirmAction();
  assert.notEqual(second.calls[0]!.operationId, second.calls[1]!.operationId, 'a changed input is a new attempt');
});
test('a refusal (property already has a live listing) closes the sheet with the plain message and reloads', async () => {
  const { w, failWith, loads } = setup();
  open(w); w.updateDraft({ reason: 'Removed in error, please restore' });
  failWith({ code: '22023', message: 'This property already has a live listing' });
  assert.equal(await w.confirmAction(), false);
  const s = w.getSnapshot(); assert.equal(s.draft, null); assert.match(s.submit.error!, /Property already has a live listing/); assert.match(s.submit.error!, /can't be reinstated/);
  await new Promise(r => setTimeout(r, 0)); assert.ok(loads().removedLoads >= 1, 'removed list reloads');
});
test('the removed list loads, and a failing load shows a plain error without rows', async () => {
  const ok = setup(); await ok.w.loadRemoved(); assert.equal(ok.w.getSnapshot().removed.status, 'success'); assert.equal(ok.w.getSnapshot().removed.count, 1);
  const bad = setup({ fetchRemovedListings: async () => { throw new TypeError('Network request failed'); } }); await bad.w.loadRemoved();
  assert.equal(bad.w.getSnapshot().removed.status, 'error'); assert.deepEqual(bad.w.getSnapshot().removed.rows, []); assert.match(bad.w.getSnapshot().removed.error!, /Connection problem/);
});

test('a failed reload clears the removed rows, and a slow older load never overwrites a newer one', async () => {
  let fail = false; const rows = [removedRow()];
  const { w } = setup({ fetchRemovedListings: async () => { if (fail) throw new TypeError('Network request failed'); return { count: 1, rows }; } });
  await w.loadRemoved(); assert.equal(w.getSnapshot().removed.rows.length, 1);
  fail = true; await w.loadRemoved(); assert.deepEqual(w.getSnapshot().removed.rows, [], 'no stale rows beside an error');
  let release!: () => void; let call = 0;
  const race = setup({ fetchRemovedListings: () => { call++; if (call === 1) return new Promise(r => { release = () => r({ count: 1, rows: [removedRow({ title: 'OLD' })] }); }); return Promise.resolve({ count: 1, rows: [removedRow({ title: 'NEW' })] }); } });
  const first = race.w.loadRemoved(); await race.w.loadRemoved(); release(); await first;
  assert.equal(race.w.getSnapshot().removed.rows[0]!.title, 'NEW');
});

// ---- Audit presentation
test('Audit: reinstate_listing reads "Listing reinstated" with a success outcome', () => {
  assert.equal(auditEntryTitle({ action: 'reinstate_listing', tier: null }), 'Listing reinstated');
  assert.deepEqual(auditOutcome({ action: 'reinstate_listing' }), { label: 'Reinstated', tone: 'success', icon: '✓' });
  const p = presentAuditEntry(entry({ action: 'reinstate_listing', subject: 'Garden Flat', reason: 'Removed in error' }));
  assert.equal(p.headline, 'Listing reinstated'); assert.equal(p.subject, 'Garden Flat'); assert.ok(p.detailRows.some(r => r.label === 'Action' && r.value === 'Reinstate listing'));
});
test('Audit: the subject name shows on verification and report entries, with the old fallbacks when it is missing', () => {
  assert.equal(auditEntrySubject({ entityType: 'verification_submission', subject: 'Maria Santos', reportReason: null, kind: null }), 'Maria Santos');
  assert.equal(auditEntrySubject({ entityType: 'verification_submission', subject: null, reportReason: null, kind: null }), null);
  assert.equal(auditEntrySubject({ entityType: 'report', subject: 'Garden Flat', reportReason: null, kind: 'listing' }), 'Listing report · Garden Flat');
  assert.equal(auditEntrySubject({ entityType: 'report', subject: '  ', reportReason: null, kind: 'user' }), 'User report');
  assert.equal(auditEntrySubject({ entityType: 'report', subject: null, reportReason: null, kind: null }), null);
  assert.match(auditEntrySubject({ entityType: 'report', subject: 'Garden Flat', reportReason: 'spam', kind: 'listing' })!, /^Listing report · .+ · Garden Flat$/);
});
test('Audit: "You" only when the actor id is the signed-in admin; the id is never guessed', () => {
  assert.equal(auditActorDisplay(entry(), U(9)), 'You');
  assert.equal(auditActorDisplay(entry(), U(8)), 'Admin Ana');
  assert.equal(auditActorDisplay(entry(), null), 'Admin Ana');
  assert.equal(auditActorDisplay(entry(), undefined), 'Admin Ana');
  assert.equal(auditActorDisplay(entry({ actorId: null }), U(9)), 'Admin Ana', 'no id, no match');
  assert.equal(auditActorDisplay({ actor: 'Admin Ana' }, U(9)), 'Admin Ana', 'a missing actorId field never matches');
  assert.equal(auditActorDisplay(entry({ actor: 'Admin 21ad99f1' }), U(1)), 'Administrator', 'server fallback stays Administrator');
  const mine = presentAuditEntry(entry({ actor: 'Admin 21ad99f1' }), U(9));
  assert.equal(mine.actor, 'You'); assert.equal(mine.actorReference, null);
  assert.equal(presentAuditEntry(entry({ actor: 'Admin 21ad99f1' }), U(1)).actorReference, '21ad99f1');
  assert.equal(presentAuditEntry(entry()).actor, 'Admin Ana');
});
test('Audit page: actorId is read when it is a uuid and otherwise left empty', () => {
  const row = (actorId: unknown) => ({ id: 1, createdAt: '2026-11-14T04:00:00Z', action: 'remove_listing', entityType: 'listing', entityId: U(2), actor: 'Admin Ana', actorId, subject: null, reportReason: null, reason: null, status: null, previousStatus: null, tier: null, kind: null, endsAt: null, reportId: null });
  assert.equal(parseAuditPage({ count: 1, rows: [row(U(9))] }).rows[0]!.actorId, U(9));
  assert.equal(parseAuditPage({ count: 1, rows: [row('not-an-id')] }).rows[0]!.actorId, null);
  assert.equal(parseAuditPage({ count: 1, rows: [row(undefined)] }).rows[0]!.actorId, null);
});

// ---- Error mapping
test('Admin errors: the three reinstate refusals are plain; Access unavailable keeps its mapping', () => {
  const map = (message: string) => classifyAdminError({ message }, { decision: true });
  assert.deepEqual([map('Listing is not removed').code, map('This property already has a live listing').code, map('A report is not used for this action').code], ['action_listing_not_removed', 'action_property_has_live_listing', 'action_report_not_used']);
  assert.equal(map('Listing is not removed').reload, true); assert.equal(map('A report is not used for this action').reload, false);
  assert.match(map('This property already has a live listing').message, /can't be reinstated/);
  assert.equal(map('Access unavailable').code, 'access_unavailable'); assert.equal(map('Access unavailable').title, 'Access unavailable');
  assert.equal(map('A report is required for this action').code, 'action_report_required', 'the older report rule is not shadowed');
  assert.equal(map('Listing cannot be removed from its current status').code, 'action_listing_not_removable');
});
test('Owner errors: a property with a removed listing says so plainly, without revealing who or why', () => {
  assert.equal(REMOVED_PROPERTY_OWNER_MESSAGE, "This property can't be listed again because an admin removed an earlier listing.");
  assert.equal(isRemovedPropertyMessage('Property has a removed listing'), true);
  assert.equal(isRemovedPropertyMessage('PROPERTY HAS A REMOVED LISTING (22023)'), true);
  assert.equal(isRemovedPropertyMessage('Only a draft listing can be published'), false);
  assert.equal(isRemovedPropertyMessage(undefined), false); assert.equal(isRemovedPropertyMessage(null), false);
  assert.equal(publicationBackendError({ code: '22023', message: 'Property has a removed listing' }).message, REMOVED_PROPERTY_OWNER_MESSAGE);
  assert.notEqual(publicationBackendError({ code: '22023', message: 'Something else' }).message, REMOVED_PROPERTY_OWNER_MESSAGE);
  const service = readFileSync('src/features/property-listing/services/listingDraftService.ts', 'utf8');
  assert.match(service, /isRemovedPropertyMessage\(error\.message\)\) \{ await journal\.removeItem\(k\); knownRejection = true; throw new ListingDraftError\(REMOVED_PROPERTY_OWNER_MESSAGE/);
});

// ---- View: rows, disabled reason, and the sheet
function harness() {
  const native: any = { StyleSheet: { create: (s: any) => s, flatten: (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 411, height: 900, fontScale: 1 }) };
  for (const n of ['ActivityIndicator', 'Alert', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View']) native[n] = n;
  const cache = new Map<string, any>();
  const load = (abs: string): any => {
    if (cache.has(abs)) return cache.get(abs);
    const actual = createRequire(abs), mod = { exports: {} as any }; cache.set(abs, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState: (v: any) => [v, () => {}] };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name.endsWith('/AdminScaffold')) return { AdminScaffold: 'Scaffold' };
      if (name.endsWith('/AdminActionSheet')) return { AdminActionSheet: 'Sheet' };
      if (name.endsWith('/AdminCards')) return { AdminCard: 'Card', AdminEmptyState: 'Empty', AdminHeading: 'Heading', AdminQueueCard: 'QueueCard' };
      if (name.endsWith('/AppButton')) return { AppButton: 'Button' };
      if (name.endsWith('/FeedbackNotice')) return { FeedbackNotice: 'Notice' };
      if (name.startsWith('.') && existsSync(resolve(dirname(abs), name) + '.tsx')) return load(resolve(dirname(abs), name) + '.tsx');
      return actual(name);
    };
    new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, mod, mod.exports);
    cache.set(abs, mod.exports); return mod.exports;
  };
  return load;
}
const flat = (n: any): any[] => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n, ...flat(n.props?.children)] : typeof n === 'string' ? [n] : [];
const nodes = (t: any) => flat(t).filter(n => typeof n === 'object');
const text = (t: any) => flat(t).filter(n => typeof n === 'string').join('|');
test('Actions tab: each removed listing shows title, owner, date, reason and Reinstate; a blocked one is disabled with its reason', () => {
  const opened: string[] = [];
  const vm: any = {
    restrictions: { status: 'success', rows: [], count: 0, error: null }, removedListings: { status: 'success', count: 2, error: null, rows: [removedRow(), removedRow({ listingId: U(2), title: 'Blocked Flat', reinstatable: false })] },
    actionSubmit: { busy: false, error: null, notice: null }, actionDraft: null, refreshRestrictions: () => Promise.resolve(), openReinstate: (row: any) => opened.push(row.listingId),
    cancelAction() {}, updateActionDraft() {}, confirmAction: async () => true, openRestriction() {},
  };
  const tree = harness()(resolve('src/features/admin-moderation/views/AdminActionsView.tsx')).AdminActionsView({ viewModel: vm });
  const t = text(tree);
  for (const s of ['Garden Flat', 'Owner: Maria Santos · Removed Nov 10, 2026', 'Reason: Fake photos', 'Blocked Flat', REINSTATE_BLOCKED_REASON]) assert.ok(t.includes(s), s);
  assert.ok(nodes(tree).some(n => n.type === 'Heading' && n.props.title === '2 removed listings'), 'heading shows the count');
  const buttons = nodes(tree).filter(n => n.type === 'Button' && n.props.label === 'Reinstate');
  assert.deepEqual(buttons.map(b => b.props.disabled), [false, true]);
  assert.equal(t.split(REINSTATE_BLOCKED_REASON).length - 1, 1, 'the reason shows once, on the blocked row only');
  buttons[0]!.props.onPress(); assert.deepEqual(opened, [U(1)]);
  assert.ok(nodes(tree).some(n => n.type === 'Sheet'), 'the shared confirmation sheet is on this tab');
  const busy = harness()(resolve('src/features/admin-moderation/views/AdminActionsView.tsx')).AdminActionsView({ viewModel: { ...vm, actionSubmit: { busy: true, error: null, notice: null } } });
  assert.ok(nodes(busy).filter(n => n.type === 'Button' && n.props.label === 'Reinstate').every(b => b.props.disabled === true), 'busy disables every Reinstate');
});
test('the ViewModel refuses a blocked row and opens a report-free reinstate draft otherwise', () => {
  const src = readFileSync('src/features/admin-moderation/viewModels/useAdminModerationViewModel.ts', 'utf8');
  assert.match(src, /if \(!row\.reinstatable\) return;/);
  assert.match(src, /action: 'reinstate_listing', targetUserId: null, targetListingId: row\.listingId, reportId: null/);
  assert.match(src, /viewerId: accountId \?\? null/);
});
