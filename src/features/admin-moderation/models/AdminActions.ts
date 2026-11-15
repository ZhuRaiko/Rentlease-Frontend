import { isUuid } from '../../messaging-viewing/models/PersistentMessaging';
import { reasons, type ReportRecord } from '../../../shared/models/Reporting';

/** Admin actions (suspend, restore, remove) and the audit log. Backend: migration 20261113180000_admin_actions_audit.sql. */

export type AdminActionKind = 'suspend_account' | 'restore_account' | 'remove_listing' | 'reinstate_listing';
export type RestrictionStatus = 'suspended' | 'restricted';
export type AuditKind = 'all' | 'verification' | 'reports' | 'actions' | 'reviews';
export const ADMIN_REASON_MIN = 10;
export const ADMIN_REASON_MAX = 500;
export const AUDIT_PAGE_SIZE = 25;

export interface AdminRestriction { userId: string; name: string; status: RestrictionStatus; reason: string | null; endsAt: string | null; startedAt: string | null; ended: boolean; restorable: boolean }
export interface AdminRestrictionPage { count: number; rows: AdminRestriction[] }
/** One removed listing from get_admin_removed_listings. It already leaves out listings this Admin is conflicted on. */
export interface AdminRemovedListing { listingId: string; title: string; ownerName: string; removedAt: string | null; reason: string | null; reinstatable: boolean }
export interface AdminRemovedListingPage { count: number; rows: AdminRemovedListing[] }
export interface AdminAuditEntry {
  id: string; createdAt: string; action: string; entityType: string; entityId: string | null; actor: string; actorId?: string | null; subject: string | null;
  reportReason: string | null; reason: string | null; status: string | null; previousStatus: string | null; tier: string | null; kind: string | null; endsAt: string | null; reportId: string | null;
}
export interface AdminAuditPage { count: number; rows: AdminAuditEntry[] }
export interface AdminActionResult { id: string; action: AdminActionKind; status: string; targetUserId: string | null; targetListingId: string | null; reportId: string | null; endsAt: string | null }
export interface AdminActionInput { operationId: string; action: AdminActionKind; targetUserId: string | null; targetListingId: string | null; reportId: string | null; reason: string; endsAt: string | null }

export class AdminActionsFormatError extends Error { constructor() { super('The server response could not be verified.'); this.name = 'AdminActionsFormatError'; } }

// ---- Strict parsers: a malformed server response is an error, never a half-rendered list.
const obj = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new AdminActionsFormatError(); return v as Record<string, unknown>; };
const str = (v: unknown, max = 2000): string => { if (typeof v !== 'string' || v.length > max) throw new AdminActionsFormatError(); return v; };
const optStr = (v: unknown, max = 2000): string | null => v === null || v === undefined ? null : str(v, max);
const stamp = (v: unknown): string => { const s = str(v, 60); if (!Number.isFinite(Date.parse(s))) throw new AdminActionsFormatError(); return s; };
const optStamp = (v: unknown): string | null => v === null || v === undefined ? null : stamp(v);
const uuid = (v: unknown): string => { const s = str(v, 36); if (!isUuid(s)) throw new AdminActionsFormatError(); return s; };
const optUuid = (v: unknown): string | null => v === null || v === undefined ? null : uuid(v);
const count = (v: unknown): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new AdminActionsFormatError(); return v; };
const list = (v: unknown, max: number): unknown[] => { if (!Array.isArray(v) || v.length > max) throw new AdminActionsFormatError(); return v; };
const bool = (v: unknown): boolean => { if (typeof v !== 'boolean') throw new AdminActionsFormatError(); return v; };

export function parseRestrictions(value: unknown): AdminRestrictionPage {
  const page = obj(value);
  const rows = list(page.rows, 100).map((raw): AdminRestriction => {
    const r = obj(raw), status = r.status;
    if (status !== 'suspended' && status !== 'restricted') throw new AdminActionsFormatError();
    return { userId: uuid(r.userId), name: str(r.name, 200), status, reason: optStr(r.reason), endsAt: optStamp(r.endsAt), startedAt: optStamp(r.startedAt), ended: bool(r.ended), restorable: bool(r.restorable) };
  });
  if (new Set(rows.map((row) => row.userId)).size !== rows.length) throw new AdminActionsFormatError();
  return { count: count(page.count), rows };
}

export function parseAuditPage(value: unknown): AdminAuditPage {
  const page = obj(value);
  const rows = list(page.rows, AUDIT_PAGE_SIZE).map((raw): AdminAuditEntry => {
    const r = obj(raw);
    if (typeof r.id !== 'number' && typeof r.id !== 'string') throw new AdminActionsFormatError();
    return {
      id: String(r.id), createdAt: stamp(r.createdAt), action: str(r.action, 80), entityType: str(r.entityType, 80), entityId: optUuid(r.entityId), actor: str(r.actor, 200), actorId: typeof r.actorId === 'string' && isUuid(r.actorId) ? r.actorId : null,
      subject: optStr(r.subject, 300), reportReason: optStr(r.reportReason, 80), reason: optStr(r.reason, 1100), status: optStr(r.status, 80), previousStatus: optStr(r.previousStatus, 80),
      tier: optStr(r.tier, 40), kind: optStr(r.kind, 40), endsAt: optStr(r.endsAt, 60), reportId: optStr(r.reportId, 40),
    };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new AdminActionsFormatError();
  return { count: count(page.count), rows };
}

export function parseRemovedListings(value: unknown): AdminRemovedListingPage {
  const page = obj(value);
  const rows = list(page.rows, 100).map((raw): AdminRemovedListing => {
    const r = obj(raw);
    return { listingId: uuid(r.listingId), title: str(r.title, 300), ownerName: str(r.ownerName, 200), removedAt: optStamp(r.removedAt), reason: optStr(r.reason), reinstatable: bool(r.reinstatable) };
  });
  if (new Set(rows.map((row) => row.listingId)).size !== rows.length) throw new AdminActionsFormatError();
  return { count: count(page.count), rows };
}

export function parseActionResult(value: unknown): AdminActionResult {
  const r = obj(value), action = r.action;
  if (action !== 'suspend_account' && action !== 'restore_account' && action !== 'remove_listing' && action !== 'reinstate_listing') throw new AdminActionsFormatError();
  return { id: uuid(r.id), action, status: str(r.status, 40), targetUserId: optUuid(r.targetUserId), targetListingId: optUuid(r.targetListingId), reportId: optUuid(r.reportId), endsAt: optStr(r.endsAt, 60) };
}

// ---- Presentation
export const auditFilters: readonly { id: AuditKind; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'verification', label: 'Verification' }, { id: 'reports', label: 'Reports' }, { id: 'actions', label: 'Actions' }, { id: 'reviews', label: 'Reviews' },
];

const dayFormatter = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
export function formatAdminDay(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? dayFormatter.format(date) : 'Date unavailable';
}

const timeFormatter = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
/** Minute precision for audit rows ("Nov 13, 2026, 12:01 PM PHT"); the verification screens keep their own seconds-level format. */
export function formatAdminDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? `${timeFormatter.format(date)} PHT` : 'Date unavailable';
}

export const restrictionStatusLabel = (status: RestrictionStatus) => status === 'suspended' ? 'Suspended' : 'Restricted';
export const restrictionStatusTone = (status: RestrictionStatus) => status === 'suspended' ? 'danger' as const : 'warning' as const;
/** "Ends Nov 20, 2026", "Ended Nov 3, 2026" or "No end date". The end date is informational: nothing restores an account by itself. */
export function restrictionEndsLabel(r: Pick<AdminRestriction, 'endsAt' | 'ended'>): string {
  if (!r.endsAt) return 'No end date';
  return `${r.ended ? 'Ended' : 'Ends'} ${formatAdminDay(r.endsAt)}`;
}
export const restrictionNeedsRestore = (r: Pick<AdminRestriction, 'ended'>) => r.ended;

const actionTitles: Record<string, string> = {
  suspend_account: 'Account suspended', restore_account: 'Account restored', restrict_account: 'Account restricted', warning: 'Warning recorded',
  pause_listing: 'Listing paused', remove_listing: 'Listing removed', reinstate_listing: 'Listing reinstated', dismiss_report: 'Report dismissed',
};
const tierLabel = (tier: string | null) => tier === 'tier_3_property' ? 'Tier 3 property' : tier === 'tier_2_identity' ? 'Tier 2 identity' : 'Verification';
const humanize = (value: string) => { const text = value.replace(/_/g, ' ').trim(); return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Admin decision'; };

/** One plain-language headline per audit row. Unknown actions fall back to a readable form of the action code. */
export function auditEntryTitle(e: Pick<AdminAuditEntry, 'action' | 'tier'>): string {
  if (actionTitles[e.action]) return actionTitles[e.action]!;
  if (e.action.startsWith('verification_')) {
    const step = e.action.slice('verification_'.length);
    const word = step === 'under_review' ? 'moved to review' : step.replace(/_/g, ' ');
    return `${e.tier ? tierLabel(e.tier) : 'Verification'} ${word}`;
  }
  if (e.action.startsWith('report_')) {
    const step = e.action.slice('report_'.length);
    const word = step === 'under_review' ? 'moved to under review' : step === 'needs_information' ? 'marked needs information' : step.replace(/_/g, ' ');
    return `Report ${word}`;
  }
  if (e.action.startsWith('review_')) return `Review ${e.action.slice('review_'.length).replace(/_/g, ' ')}`;
  return humanize(e.action);
}

export const reasonLabel = (code: string | null) => code ? [...reasons.listing, ...reasons.user].find((item) => item.id === code)?.label ?? humanize(code) : null;
/** The line under the headline: who or what it was about. */
export function auditEntrySubject(e: Pick<AdminAuditEntry, 'entityType' | 'subject' | 'reportReason' | 'kind'>): string | null {
  if (e.entityType === 'report') return [e.kind === 'listing' ? 'Listing report' : e.kind === 'user' ? 'User report' : null, reasonLabel(e.reportReason), e.subject?.trim() || null].filter(Boolean).join(' · ') || null;
  if (e.entityType === 'review') return e.kind === 'property' ? 'Property review' : e.kind === 'user' ? 'Participant review' : null;
  return e.subject;
}

// ---- Taking an action
export type ReportActionKind = Exclude<AdminActionKind, 'restore_account' | 'reinstate_listing'>;
export interface ReportActionOption { action: ReportActionKind; label: string; confirmLabel: string; targetUserId: string | null; targetListingId: string | null; danger: boolean }

/** Actions offered from an upheld report: suspend the reported user, or remove the reported listing. Nothing else. Pausing is not offered: the owner can undo a pause, so it would not be enforceable. */
export function reportActionOptions(report: Pick<ReportRecord, 'status' | 'kind' | 'targetId'> | null): ReportActionOption[] {
  if (!report || report.status !== 'upheld' || !report.targetId) return [];
  if (report.kind === 'user') return [{ action: 'suspend_account', label: 'Suspend user', confirmLabel: 'Suspend account', targetUserId: report.targetId, targetListingId: null, danger: true }];
  return [{ action: 'remove_listing', label: 'Remove listing', confirmLabel: 'Remove listing', targetUserId: null, targetListingId: report.targetId, danger: true }];
}

export type EndPresetId = '7d' | '30d' | '90d' | 'none';
export const endDatePresets: readonly { id: EndPresetId; label: string; days: number | null }[] = [
  { id: '7d', label: '7 days', days: 7 }, { id: '30d', label: '30 days', days: 30 }, { id: '90d', label: '90 days', days: 90 }, { id: 'none', label: 'No end date', days: null },
];
export function endsAtFor(preset: EndPresetId, now: number = Date.now()): string | null {
  const days = endDatePresets.find((item) => item.id === preset)?.days ?? null;
  return days === null ? null : new Date(now + days * 86_400_000).toISOString();
}

export function validateActionReason(reason: string): string | null {
  const length = Array.from(reason.trim()).length;
  return length >= ADMIN_REASON_MIN && length <= ADMIN_REASON_MAX ? null : `Enter a reason of ${ADMIN_REASON_MIN} to ${ADMIN_REASON_MAX} characters.`;
}

/** Plain-language statement of what confirming will do. Verified against the app's account routing and the backend: no overclaiming. */
export function actionEffectText(action: AdminActionKind, endsAt: string | null): string {
  switch (action) {
    case 'suspend_account': return `The account is marked suspended, and the app shows the person a restricted-account screen instead of normal use. ${endsAt ? `The end date is a reminder only: the account stays suspended until an Admin restores it from the Actions tab.` : 'There is no end date. Restore the account from the Actions tab when appropriate.'}`;
    case 'restore_account': return 'The account becomes active again and the suspension details are cleared.';
    case 'reinstate_listing': return "The listing comes back as paused, not live. The owner must reactivate it from their app before tenants can see it. Your reason is recorded in the audit log. This is refused if the property already has another live listing.";
    case 'remove_listing': return "This listing will be removed. The owner can't reopen it from the app. Your reason is recorded in the audit log. Removal is blocked while a tenancy is proposed, awaiting confirmation or active.";
  }
}
export const actionConfirmLabel = (action: AdminActionKind) => action === 'suspend_account' ? 'Suspend account' : action === 'restore_account' ? 'Restore account' : action === 'reinstate_listing' ? 'Reinstate listing' : 'Remove listing';
export const actionNotice = (action: AdminActionKind) => action === 'suspend_account' ? 'Account suspended. It now appears in Actions and the audit log.' : action === 'restore_account' ? 'Account restored.' : action === 'reinstate_listing' ? 'Listing reinstated as paused. The owner can now reactivate it.' : 'Listing removed.';

// ---- Removed listings and reinstating
export const REINSTATE_BLOCKED_REASON = "Can't be reinstated by you: the owner is an admin, or the property already has a live listing.";
/** One plain line when Reinstate is disabled, otherwise null. The server only says yes or no, so the line names both possible causes. */
export const reinstateBlockedReason = (row: Pick<AdminRemovedListing, 'reinstatable'>): string | null => row.reinstatable ? null : REINSTATE_BLOCKED_REASON;
export const removedListingMeta = (row: Pick<AdminRemovedListing, 'ownerName' | 'removedAt'>): string => `Owner: ${row.ownerName.trim() || 'Unknown'} · ${row.removedAt ? `Removed ${formatAdminDay(row.removedAt)}` : 'Removal date unavailable'}`;
export const removedListingReason = (row: Pick<AdminRemovedListing, 'reason'>): string => row.reason?.trim() ? `Reason: ${row.reason.trim()}` : 'No reason recorded';
export const removedListingsHeading = (count: number): string => `${count} removed ${count === 1 ? 'listing' : 'listings'}`;
