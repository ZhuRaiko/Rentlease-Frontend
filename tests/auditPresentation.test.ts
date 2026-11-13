/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { AdminAuditEntry } from '../src/features/admin-moderation/models/AdminActions';
import {
  auditActorLabel, auditActorReference, auditDayLabel, auditEmptyCopy, auditOutcome, auditRelatedTarget, formatAuditTime, groupAuditByDay, presentAuditEntry,
} from '../src/features/admin-moderation/models/AuditPresentation';

const U = '11111111-1111-4111-8111-111111111111', L = '33333333-3333-4333-8333-333333333333', R = '44444444-4444-4444-8444-444444444444', S = '55555555-5555-4555-8555-555555555555';
const entry = (over: Partial<AdminAuditEntry> = {}): AdminAuditEntry => ({
  id: '1', createdAt: '2026-11-13T07:21:00Z', action: 'report_dismissed', entityType: 'report', entityId: R, actor: 'Admin 21ad99f1', subject: null,
  reportReason: 'other', reason: 'Insufficient evidence, reporters have a habit of mass reporting.', status: 'dismissed', previousStatus: 'under_review', tier: null, kind: 'listing', endsAt: null, reportId: null, ...over,
});
const NOW = Date.parse('2026-11-13T08:00:00Z');

test('the fallback "Admin xxxxxxxx" actor becomes "Administrator", a real nickname is kept, and the short id is detail-only', () => {
  assert.equal(auditActorLabel('Admin 21ad99f1'), 'Administrator');
  assert.equal(auditActorLabel('Landlord Lee'), 'Landlord Lee');
  assert.equal(auditActorLabel('System'), 'System');
  assert.equal(auditActorLabel('  '), 'Administrator');
  assert.equal(auditActorReference('Admin 21ad99f1'), '21ad99f1');
  assert.equal(auditActorReference('Landlord Lee'), null);
  const view = presentAuditEntry(entry());
  assert.equal(view.actor, 'Administrator'); assert.equal(view.actorReference, '21ad99f1');
  assert.doesNotMatch(`${view.headline} ${view.subject} ${view.listLabel}`, /21ad99f1/, 'the short id never appears in the list text');
});

test('headlines, outcome pills and tones come from one mapper', () => {
  const view = (over: Partial<AdminAuditEntry>) => presentAuditEntry(entry(over));
  assert.deepEqual([view({}).headline, view({}).outcome.label, view({}).outcome.tone], ['Report dismissed', 'Dismissed', 'neutral']);
  assert.deepEqual([view({ action: 'report_upheld' }).outcome.label, view({ action: 'report_upheld' }).outcome.tone], ['Upheld', 'warning']);
  assert.equal(view({ action: 'report_under_review' }).outcome.label, 'In review');
  assert.equal(view({ action: 'report_needs_information' }).outcome.label, 'Needs information');
  const v = view({ action: 'verification_rejected', entityType: 'verification_submission', tier: 'tier_2_identity' });
  assert.deepEqual([v.headline, v.outcome.label, v.outcome.tone], ['Tier 2 identity rejected', 'Rejected', 'danger']);
  assert.equal(view({ action: 'verification_approved', entityType: 'verification_submission', tier: 'tier_3_property' }).headline, 'Tier 3 property approved');
  assert.equal(view({ action: 'verification_under_review', entityType: 'verification_submission', tier: 'tier_2_identity' }).headline, 'Tier 2 identity moved to review');
  assert.deepEqual([auditOutcome({ action: 'suspend_account' }).label, auditOutcome({ action: 'suspend_account' }).tone], ['Suspended', 'warning']);
  assert.deepEqual([auditOutcome({ action: 'remove_listing' }).label, auditOutcome({ action: 'remove_listing' }).tone], ['Removed', 'danger']);
  assert.deepEqual([auditOutcome({ action: 'restore_account' }).label, auditOutcome({ action: 'restore_account' }).tone], ['Restored', 'success']);
  assert.deepEqual([auditOutcome({ action: 'review_hidden' }).label, auditOutcome({ action: 'review_hidden' }).tone], ['Hidden', 'info']);
  assert.deepEqual([auditOutcome({ action: 'review_approved' }).label, auditOutcome({ action: 'review_rejected' }).label], ['Approved', 'Rejected']);
  assert.equal(auditOutcome({ action: 'something_new_here' }).label, 'New here', 'an unknown action stays readable and neutral');
  assert.equal(auditOutcome({ action: 'something_new_here' }).tone, 'neutral');
  for (const a of ['suspend_account', 'restore_account', 'remove_listing', 'report_upheld', 'verification_approved', 'review_hidden', 'x_y']) assert.ok(auditOutcome({ action: a }).icon.length > 0 && auditOutcome({ action: a }).label.length > 0, a);
});

test('rows group by Manila day as Today, Yesterday, then the date, in order and without dropping anything', () => {
  assert.equal(auditDayLabel('2026-11-13T07:21:00Z', NOW), 'Today');
  assert.equal(auditDayLabel('2026-11-12T20:00:00Z', NOW), 'Today', '4 AM Manila on Nov 13 is still Nov 13 there');
  assert.equal(auditDayLabel('2026-11-12T10:00:00Z', NOW), 'Yesterday');
  assert.equal(auditDayLabel('2026-11-11T10:00:00Z', NOW), 'Nov 11, 2026');
  assert.equal(auditDayLabel('garbage', NOW), 'Date unavailable');
  const rows = [entry({ id: '5' }), entry({ id: '4', createdAt: '2026-11-13T02:00:00Z' }), entry({ id: '3', createdAt: '2026-11-12T10:00:00Z' }), entry({ id: '2', createdAt: '2026-11-11T10:00:00Z' }), entry({ id: '1', createdAt: '2026-11-11T09:00:00Z' })];
  const groups = groupAuditByDay(rows, NOW);
  assert.deepEqual(groups.map((g) => [g.label, g.entries.map((e) => e.id)]), [['Today', ['5', '4']], ['Yesterday', ['3']], ['Nov 11, 2026', ['2', '1']]]);
  assert.deepEqual(groupAuditByDay([], NOW), []);
  assert.equal(formatAuditTime('2026-11-13T07:21:00Z'), '3:21 PM');
});

test('the detail shows only rows that have a value and never the backend-only fields', () => {
  const labels = (e: AdminAuditEntry) => presentAuditEntry(e).detailRows.map((r) => r.label);
  assert.deepEqual(labels(entry()), ['Report type', 'Report reason', 'Decision', 'Status']);
  assert.deepEqual(presentAuditEntry(entry()).detailRows.find((r) => r.label === 'Status')?.value, 'Under review → Dismissed');
  assert.deepEqual(labels(entry({ kind: null, reportReason: null, status: null, previousStatus: null })), ['Decision']);
  const v = presentAuditEntry(entry({ action: 'verification_approved', entityType: 'verification_submission', tier: 'tier_3_property', kind: null, reportReason: null, status: 'approved', previousStatus: 'under_review' }));
  assert.deepEqual(v.detailRows, [{ label: 'Tier', value: '3 · Property' }, { label: 'Decision', value: 'Approved' }, { label: 'Status', value: 'Under review → Approved' }]);
  const act = presentAuditEntry(entry({ action: 'suspend_account', entityType: 'user', entityId: U, subject: 'Juan D.', kind: null, reportReason: null, status: null, previousStatus: null, endsAt: '2026-12-13T00:00:00Z', reportId: R }));
  assert.deepEqual(act.detailRows.map((r) => r.label), ['Subject', 'Action', 'Ends on', 'Report']);
  assert.match(act.detailRows.find((r) => r.label === 'Ends on')!.value, /^Dec 13, 2026 \(reminder only\)$/);
  const none = presentAuditEntry(entry({ action: 'remove_listing', entityType: 'listing', entityId: L, subject: null, kind: null, reportReason: null, status: null, previousStatus: null, reason: null }));
  assert.deepEqual(none.detailRows.map((r) => r.label), ['Action']); assert.equal(none.reason, null);
  assert.equal(presentAuditEntry(entry({ reason: '   ' })).reason, null, 'a blank reason is hidden, not shown as empty');
  for (const e of [entry(), entry({ action: 'suspend_account', entityType: 'user', entityId: U, subject: 'Juan D.' })]) {
    const v2 = presentAuditEntry(e), text = [v2.headline, v2.subject ?? '', v2.reason ?? '', v2.actor, ...v2.detailRows.map((r) => `${r.label} ${r.value}`)].join(' ');
    assert.doesNotMatch(text, /Applicant|applicant|Target|None|null|undefined/, 'no backend-only fields, placeholders or raw nulls');
    assert.ok(!v2.detailRows.some((r) => r.label === 'Applicant' || r.label === 'Target' || r.label === 'Admin ID'));
  }
});

test('"Open report / submission / review" targets exist only for rows that really point at one', () => {
  assert.deepEqual(auditRelatedTarget(entry()), { kind: 'report', id: R, label: 'Open report' });
  assert.deepEqual(auditRelatedTarget(entry({ entityType: 'verification_submission', entityId: S })), { kind: 'verification', id: S, label: 'Open submission' });
  assert.deepEqual(auditRelatedTarget(entry({ entityType: 'review', entityId: S })), { kind: 'review', id: S, label: 'Open review' });
  assert.deepEqual(auditRelatedTarget(entry({ entityType: 'listing', entityId: L, reportId: R })), { kind: 'report', id: R, label: 'Open report' }, 'an action that used a report points at that report');
  assert.equal(auditRelatedTarget(entry({ entityType: 'user', entityId: U, reportId: null })), null, 'a restore without a report has nothing to open');
  assert.equal(auditRelatedTarget(entry({ entityType: 'report', entityId: null })), null);
  assert.equal(auditRelatedTarget(entry({ entityType: 'mystery', entityId: S })), null);
});

test('list accessibility text carries headline, subject, outcome, reason and time, and empty copy is per tab', () => {
  const label = presentAuditEntry(entry({ subject: null })).listLabel;
  assert.match(label, /^Report dismissed\. Listing report · Other concern\. Dismissed\. Reason: Insufficient evidence/);
  assert.match(label, /at 3:21 PM$/);
  assert.equal(auditEmptyCopy('all').title, 'Nothing here yet');
  assert.match(auditEmptyCopy('reports').body, /No report decisions yet/);
  assert.match(auditEmptyCopy('verification').body, /No verification decisions yet/);
});

test('the Audit screens use theme tokens only, never reach the backend, and the app wiring opens the entry and related screens', () => {
  const dir = 'src/features/admin-moderation/';
  for (const file of ['views/AdminAuditView.tsx', 'views/AdminAuditEntryView.tsx', 'components/AdminAuditRow.tsx']) {
    const text = readFileSync(dir + file, 'utf8');
    assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${file}: no hardcoded colors`);
    assert.doesNotMatch(text, /getSupabaseClient|supabase\/client|\.rpc\(|\.from\(/, file);
  }
  const vm = readFileSync(dir + 'viewModels/useAdminModerationViewModel.ts', 'utf8');
  assert.match(vm, /auditRelatedAvailable/); assert.match(vm, /openAuditRelated/); assert.match(vm, /loadMoreAudit/);
  assert.match(readFileSync(dir + 'views/AdminModerationFlowView.tsx', 'utf8'), /'auditEntry'[\s\S]*AdminAuditEntryView/);
  const row = readFileSync(dir + 'components/AdminAuditRow.tsx', 'utf8');
  assert.match(row, /minHeight: 72/, 'rows are at least 48dp'); assert.match(row, /fontScale >= 1\.3/, 'pill and time move under the title at large text');
});
