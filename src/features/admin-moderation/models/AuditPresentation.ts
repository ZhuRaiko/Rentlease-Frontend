import { auditEntrySubject, auditEntryTitle, formatAdminDateTime, formatAdminDay, reasonLabel, type AdminAuditEntry } from './AdminActions';
import type { AdminChipTone } from './AdminQueuePresentation';

/**
 * One presentation mapper for the Audit tab: list rows, day groups and the detail screen all read from here, so a headline, an outcome pill
 * or a label is never worded twice. It only uses the fields get_admin_audit_log already returns and never invents a value: a row with
 * nothing to show is omitted, not shown as "None".
 */

export interface AuditOutcome { label: string; tone: AdminChipTone; icon: string }
export interface AuditDetailRow { label: string; value: string }
export type AuditRelatedKind = 'report' | 'verification' | 'review';
export interface AuditRelated { kind: AuditRelatedKind; id: string; label: string }
export interface AuditPresentation {
  headline: string;
  subject: string | null;
  /** Full reason text. The list shows one line of it; the detail shows all of it. */
  reason: string | null;
  outcome: AuditOutcome;
  time: string;
  whenFull: string;
  actor: string;
  /** Short reference of an Admin without a public nickname. Shown in the detail only. */
  actorReference: string | null;
  detailRows: AuditDetailRow[];
  related: AuditRelated | null;
  listLabel: string;
}

const FALLBACK_ACTOR = /^Admin ([0-9a-f]{8})$/;
/** "Admin 21ad99f1" is the server's fallback for an Admin with no confirmed public nickname. It reads as a bug, so it becomes "Administrator". */
export function auditActorLabel(actor: string): string {
  const trimmed = actor.trim();
  if (!trimmed) return 'Administrator';
  return FALLBACK_ACTOR.test(trimmed) ? 'Administrator' : trimmed;
}
export function auditActorReference(actor: string): string | null {
  return FALLBACK_ACTOR.exec(actor.trim())?.[1] ?? null;
}

const humanize = (value: string) => { const text = value.replace(/_/g, ' ').trim(); return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''; };

const outcomes: Record<string, AuditOutcome> = {
  suspend_account: { label: 'Suspended', tone: 'warning', icon: '!' },
  restore_account: { label: 'Restored', tone: 'success', icon: '✓' },
  restrict_account: { label: 'Restricted', tone: 'warning', icon: '!' },
  warning: { label: 'Warning', tone: 'warning', icon: '!' },
  pause_listing: { label: 'Paused', tone: 'warning', icon: '!' },
  remove_listing: { label: 'Removed', tone: 'danger', icon: '✕' },
  dismiss_report: { label: 'Dismissed', tone: 'neutral', icon: '–' },
};
const stepOutcomes: Record<string, AuditOutcome> = {
  approved: { label: 'Approved', tone: 'success', icon: '✓' },
  rejected: { label: 'Rejected', tone: 'danger', icon: '✕' },
  under_review: { label: 'In review', tone: 'info', icon: 'i' },
  upheld: { label: 'Upheld', tone: 'warning', icon: '!' },
  dismissed: { label: 'Dismissed', tone: 'neutral', icon: '–' },
  needs_information: { label: 'Needs information', tone: 'warning', icon: '?' },
  hidden: { label: 'Hidden', tone: 'info', icon: 'i' },
};

/** The result of the decision, as a short pill label with a tone and a glyph (the label always carries the meaning). */
export function auditOutcome(entry: Pick<AdminAuditEntry, 'action'>): AuditOutcome {
  const known = outcomes[entry.action];
  if (known) return known;
  const underscore = entry.action.indexOf('_');
  const step = underscore > 0 ? entry.action.slice(underscore + 1) : entry.action;
  return stepOutcomes[step] ?? { label: humanize(step) || 'Recorded', tone: 'neutral', icon: '–' };
}

const MANILA_OFFSET_MS = 8 * 3_600_000;
const dayKey = (ms: number) => new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
const timeOnly = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
export function formatAuditTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? timeOnly.format(date) : '';
}

/** "Today", "Yesterday", or the date, all in Manila time (the same zone the times are shown in). */
export function auditDayLabel(timestamp: string, now: number = Date.now()): string {
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) return 'Date unavailable';
  const key = dayKey(ms);
  if (key === dayKey(now)) return 'Today';
  if (key === dayKey(now - 86_400_000)) return 'Yesterday';
  return formatAdminDay(timestamp);
}

export interface AuditDayGroup { label: string; entries: AdminAuditEntry[] }
/** Groups rows (already newest first) into consecutive day sections. Order is preserved; nothing is re-sorted or dropped. */
export function groupAuditByDay(entries: readonly AdminAuditEntry[], now: number = Date.now()): AuditDayGroup[] {
  const groups: AuditDayGroup[] = [];
  for (const entry of entries) {
    const label = auditDayLabel(entry.createdAt, now);
    const last = groups.at(-1);
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

const tierDetail = (tier: string | null) => tier === 'tier_3_property' ? '3 · Property' : tier === 'tier_2_identity' ? '2 · Identity' : tier ? humanize(tier) : null;
const statusText = (status: string) => humanize(status);
const reportKindLabel = (kind: string | null) => kind === 'listing' ? 'Listing' : kind === 'user' ? 'User' : null;
const actionDecisionLabel: Record<string, string> = { suspend_account: 'Suspend account', restore_account: 'Restore account', remove_listing: 'Remove listing', pause_listing: 'Pause listing', restrict_account: 'Restrict account', warning: 'Warning', dismiss_report: 'Dismiss report' };

/** The "Open report / submission / review" target, if this row has one. Whether it can really be opened is decided where the data lives. */
export function auditRelatedTarget(entry: Pick<AdminAuditEntry, 'entityType' | 'entityId' | 'reportId'>): AuditRelated | null {
  if (entry.entityType === 'report' && entry.entityId) return { kind: 'report', id: entry.entityId, label: 'Open report' };
  if (entry.entityType === 'verification_submission' && entry.entityId) return { kind: 'verification', id: entry.entityId, label: 'Open submission' };
  if (entry.entityType === 'review' && entry.entityId) return { kind: 'review', id: entry.entityId, label: 'Open review' };
  if ((entry.entityType === 'user' || entry.entityType === 'listing') && entry.reportId) return { kind: 'report', id: entry.reportId, label: 'Open report' };
  return null;
}

function detailRows(entry: AdminAuditEntry, outcome: AuditOutcome): AuditDetailRow[] {
  const rows: AuditDetailRow[] = [];
  const add = (label: string, value: string | null | undefined) => { if (value && value.trim()) rows.push({ label, value: value.trim() }); };
  const change = entry.status && entry.previousStatus && entry.previousStatus !== entry.status ? `${statusText(entry.previousStatus)} → ${statusText(entry.status)}` : null;
  if (entry.entityType === 'verification_submission') {
    add('Tier', tierDetail(entry.tier)); add('Decision', outcome.label); add('Status', change);
  } else if (entry.entityType === 'report') {
    add('Report type', reportKindLabel(entry.kind)); add('Report reason', reasonLabel(entry.reportReason)); add('Decision', outcome.label); add('Status', change);
  } else if (entry.entityType === 'review') {
    add('Review type', entry.kind === 'property' ? 'Property' : entry.kind === 'user' ? 'Participant' : null); add('Decision', outcome.label); add('Status', change);
  } else {
    add('Subject', entry.subject); add('Action', actionDecisionLabel[entry.action] ?? humanize(entry.action)); add('Status', change);
    if (entry.endsAt && Number.isFinite(Date.parse(entry.endsAt))) add('Ends on', `${formatAdminDay(entry.endsAt)} (reminder only)`);
    add('Report', entry.reportId ? 'Linked to a report' : null);
  }
  return rows;
}

/** Everything the Audit list row and the Audit entry screen show for one record. */
export function presentAuditEntry(entry: AdminAuditEntry): AuditPresentation {
  const headline = auditEntryTitle(entry);
  const subject = auditEntrySubject(entry);
  const outcome = auditOutcome(entry);
  const reason = entry.reason && entry.reason.trim() ? entry.reason.trim() : null;
  const time = formatAuditTime(entry.createdAt);
  const actor = auditActorLabel(entry.actor);
  return {
    headline, subject, reason, outcome, time,
    whenFull: formatAdminDateTime(entry.createdAt),
    actor, actorReference: auditActorReference(entry.actor),
    detailRows: detailRows(entry, outcome),
    related: auditRelatedTarget(entry),
    listLabel: [headline, subject, outcome.label, reason ? `Reason: ${reason}` : null, time ? `at ${time}` : null].filter((part): part is string => !!part).map((part) => part.replace(/[.\s]+$/, '')).join('. '),
  };
}

export const auditEmptyCopy = (kind: string): { title: string; body: string } => kind === 'all'
  ? { title: 'Nothing here yet', body: 'Decisions on verifications, reports, actions and reviews will appear as they are made.' }
  : { title: 'Nothing here yet', body: `No ${kind === 'verification' ? 'verification' : kind === 'reports' ? 'report' : kind === 'actions' ? 'action' : 'review'} decisions yet.` };
