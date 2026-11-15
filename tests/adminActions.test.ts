/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  actionConfirmLabel, actionEffectText, actionNotice, AdminActionsFormatError, auditEntrySubject, auditEntryTitle, auditFilters, endsAtFor, formatAdminDay,
  formatAdminDateTime, parseActionResult, parseAuditPage, parseRestrictions, reportActionOptions, restrictionEndsLabel, restrictionNeedsRestore, restrictionStatusLabel, restrictionStatusTone, validateActionReason,
} from '../src/features/admin-moderation/models/AdminActions';

const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', L1 = '33333333-3333-4333-8333-333333333333';
const restriction = (over: Record<string, unknown> = {}) => ({ userId: U1, name: 'Landlord Lee', status: 'suspended', reason: 'Repeated misleading listings', endsAt: '2026-12-01T00:00:00Z', startedAt: '2026-11-13T01:00:00Z', ended: false, restorable: true, ...over });
const entry = (over: Record<string, unknown> = {}) => ({ id: 7, createdAt: '2026-11-13T02:00:00Z', action: 'suspend_account', entityType: 'user', entityId: U1, actor: 'Admin 1a2b3c4d', subject: 'Landlord Lee', reportReason: null, reason: 'Harassment confirmed', status: null, previousStatus: null, tier: null, kind: null, endsAt: null, reportId: null, ...over });

test('restriction responses are parsed strictly: a malformed response is an error, never a half-rendered list', () => {
  const page = parseRestrictions({ count: 1, rows: [restriction()] });
  assert.equal(page.count, 1); assert.equal(page.rows[0]!.name, 'Landlord Lee'); assert.equal(page.rows[0]!.restorable, true);
  for (const bad of [null, [], { count: 1 }, { count: -1, rows: [] }, { count: 1, rows: [restriction({ status: 'active' })] }, { count: 1, rows: [restriction({ userId: 'not-a-uuid' })] },
    { count: 1, rows: [restriction({ ended: 'no' })] }, { count: 2, rows: [restriction(), restriction()] }, { count: 1, rows: [restriction({ endsAt: 'tomorrow' })] }, { count: 1, rows: [restriction({ name: 7 })] }]) {
    assert.throws(() => parseRestrictions(bad), AdminActionsFormatError, JSON.stringify(bad));
  }
  assert.equal(parseRestrictions({ count: 0, rows: [] }).rows.length, 0);
  assert.equal(parseRestrictions({ count: 1, rows: [restriction({ reason: null, endsAt: null, startedAt: null })] }).rows[0]!.reason, null);
});

test('audit pages are parsed strictly and bigint ids become stable string keys', () => {
  const page = parseAuditPage({ count: 2, rows: [entry(), entry({ id: 8 })] });
  assert.deepEqual(page.rows.map((r) => r.id), ['7', '8']);
  for (const bad of [{ count: 1, rows: [entry({ createdAt: 'nope' })] }, { count: 1, rows: [entry({ id: null })] }, { count: 1, rows: [entry(), entry()] }, { count: 1, rows: [entry({ entityId: 'x' })] },
    { count: 1, rows: new Array(26).fill(0).map((_, i) => entry({ id: i })) }, { rows: [] }]) assert.throws(() => parseAuditPage(bad), AdminActionsFormatError);
});

test('an action result must be a known action with a valid id', () => {
  const ok = { id: U2, action: 'remove_listing', status: 'removed', targetUserId: null, targetListingId: L1, reportId: null, endsAt: null };
  assert.equal(parseActionResult(ok).status, 'removed');
  assert.throws(() => parseActionResult({ ...ok, action: 'pause_listing', status: 'paused' }), AdminActionsFormatError, 'pause_listing is no longer an accepted result');
  assert.throws(() => parseActionResult({ ...ok, action: 'warning' }), AdminActionsFormatError);
  assert.throws(() => parseActionResult({ ...ok, id: 'x' }), AdminActionsFormatError);
  assert.throws(() => parseActionResult(null), AdminActionsFormatError);
});

test('restriction labels are plain language and the end date is shown as informational', () => {
  assert.equal(restrictionStatusLabel('suspended'), 'Suspended'); assert.equal(restrictionStatusLabel('restricted'), 'Restricted');
  assert.equal(restrictionStatusTone('suspended'), 'danger'); assert.equal(restrictionStatusTone('restricted'), 'warning');
  assert.equal(restrictionEndsLabel({ endsAt: null, ended: false }), 'No end date');
  assert.match(restrictionEndsLabel({ endsAt: '2026-12-01T00:00:00Z', ended: false }), /^Ends Dec 1, 2026$/);
  assert.match(restrictionEndsLabel({ endsAt: '2026-11-03T00:00:00Z', ended: true }), /^Ended Nov 3, 2026$/);
  assert.equal(restrictionNeedsRestore({ ended: true }), true); assert.equal(restrictionNeedsRestore({ ended: false }), false);
  assert.equal(formatAdminDay('garbage'), 'Date unavailable');
  assert.equal(formatAdminDateTime('2026-11-13T04:01:09Z'), 'Nov 13, 2026, 12:01 PM PHT', 'minute precision, Manila time, no seconds');
  assert.equal(formatAdminDateTime('nope'), 'Date unavailable');
});

test('every audit action has a plain-language headline and unknown ones stay readable', () => {
  const t = (action: string, tier: string | null = null) => auditEntryTitle({ action, tier });
  assert.equal(t('suspend_account'), 'Account suspended'); assert.equal(t('restore_account'), 'Account restored');
  assert.equal(t('pause_listing'), 'Listing paused'); assert.equal(t('remove_listing'), 'Listing removed'); assert.equal(t('dismiss_report'), 'Report dismissed');
  assert.equal(t('verification_approved', 'tier_3_property'), 'Tier 3 property approved');
  assert.equal(t('verification_rejected', 'tier_2_identity'), 'Tier 2 identity rejected');
  assert.equal(t('verification_under_review', 'tier_2_identity'), 'Tier 2 identity moved to review');
  assert.equal(t('report_under_review'), 'Report moved to under review'); assert.equal(t('report_upheld'), 'Report upheld'); assert.equal(t('report_dismissed'), 'Report dismissed');
  assert.equal(t('report_needs_information'), 'Report marked needs information');
  assert.equal(t('review_approved'), 'Review approved'); assert.equal(t('review_hidden'), 'Review hidden');
  assert.equal(t('something_new_happened'), 'Something new happened');
  assert.doesNotMatch(t('verification_approved', null), /null|undefined/);
});

test('audit subjects use public labels, report reasons and review kinds', () => {
  assert.equal(auditEntrySubject({ entityType: 'user', subject: 'Landlord Lee', reportReason: null, kind: null }), 'Landlord Lee');
  assert.equal(auditEntrySubject({ entityType: 'report', subject: null, reportReason: 'misleading_information', kind: 'listing' }), 'Listing report · Misleading information or photos');
  assert.equal(auditEntrySubject({ entityType: 'report', subject: null, reportReason: 'harassment', kind: 'user' }), 'User report · Harassment or inappropriate communication');
  assert.equal(auditEntrySubject({ entityType: 'review', subject: null, reportReason: null, kind: 'property' }), 'Property review');
  assert.equal(auditEntrySubject({ entityType: 'verification_submission', subject: null, reportReason: null, kind: null }), null);
  assert.deepEqual(auditFilters.map((f) => f.id), ['all', 'verification', 'reports', 'actions', 'reviews']);
});

test('actions are offered only from an upheld report, and only the supported ones', () => {
  const r = (over: Record<string, unknown>) => reportActionOptions({ status: 'upheld', kind: 'user', targetId: U1, ...over } as never);
  assert.deepEqual(r({}).map((o) => o.action), ['suspend_account']);
  assert.deepEqual(r({}).map((o) => [o.targetUserId, o.targetListingId]), [[U1, null]]);
  assert.deepEqual(r({ kind: 'listing', targetId: L1 }).map((o) => o.action), ['remove_listing']);
  assert.deepEqual(r({ kind: 'listing', targetId: L1 }).map((o) => [o.targetUserId, o.targetListingId]), [[null, L1]]);
  for (const status of ['submitted', 'under_review', 'dismissed', 'needs_information', 'closed']) assert.deepEqual(r({ status }), [], status);
  assert.deepEqual(r({ targetId: undefined }), []); assert.deepEqual(reportActionOptions(null), []);
  assert.ok(![...r({}), ...r({ kind: 'listing' })].some((o) => (o.action as string) === 'warning' || (o.action as string) === 'restrict_account' || (o.action as string) === 'pause_listing'), 'warn, restrict and pause are not wired');
});

test('reasons need 10 to 500 characters after trimming', () => {
  assert.notEqual(validateActionReason(''), null); assert.notEqual(validateActionReason('         x'), null); assert.notEqual(validateActionReason('x'.repeat(9)), null);
  assert.equal(validateActionReason('x'.repeat(10)), null); assert.equal(validateActionReason('  ' + 'x'.repeat(10) + '  '), null);
  assert.equal(validateActionReason('x'.repeat(500)), null); assert.notEqual(validateActionReason('x'.repeat(501)), null);
});

test('end dates come from fixed presets, are computed once from a given clock, and "none" means none', () => {
  const now = Date.parse('2026-11-13T00:00:00Z');
  assert.equal(endsAtFor('none', now), null);
  assert.equal(endsAtFor('7d', now), '2026-11-20T00:00:00.000Z'); assert.equal(endsAtFor('30d', now), '2026-12-13T00:00:00.000Z'); assert.equal(endsAtFor('90d', now), '2027-02-11T00:00:00.000Z');
});

test('the confirmation text states the real effect without overclaiming', () => {
  assert.match(actionEffectText('suspend_account', '2026-12-01T00:00:00Z'), /restricted-account screen/);
  assert.match(actionEffectText('suspend_account', '2026-12-01T00:00:00Z'), /reminder only[\s\S]*stays suspended until an Admin restores it/, 'the end date does not restore anything by itself');
  assert.match(actionEffectText('suspend_account', null), /no end date/i);
  assert.match(actionEffectText('remove_listing', null), /^This listing will be removed\. The owner can't reopen it from the app\.[\s\S]*tenancy/);
  assert.doesNotMatch(actionEffectText('remove_listing', null), /re-?list|undone|permanent/i, 'does not promise the property cannot be listed again');
  assert.match(actionEffectText('restore_account', null), /active again/);
  for (const a of ['suspend_account', 'restore_account', 'remove_listing'] as const) { assert.ok(actionConfirmLabel(a).length > 0); assert.ok(actionNotice(a).endsWith('.')); }
});
