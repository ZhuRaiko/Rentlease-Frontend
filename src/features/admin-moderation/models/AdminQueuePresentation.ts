import { identityDisplayFields, type IdentityReviewContext } from '../../../shared/models/PropertyIdentity';
import type { ReviewRow, ReviewStatus } from '../../../shared/models/RentalReview';
import { reasons, reportStatusLabels, type ReportRecord, type ReportStatus } from '../../../shared/models/Reporting';

/** Pure presentation helpers for the Admin queues, dashboard and review screens. No data access. */

export type AdminChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

/** Compact age such as "just now", "5 min ago", "9 h ago" or "2 d ago". Unparseable or future dates read as "just now"/"Date unavailable". */
export function formatAdminAge(timestamp: string | null | undefined, now: number = Date.now()): string {
  const time = timestamp ? Date.parse(timestamp) : NaN;
  if (!Number.isFinite(time)) return 'Date unavailable';
  const elapsed = now - time;
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
}

/** Longer wording for the dashboard line "Oldest waiting: Verification, 9 hours". */
export function formatAdminDuration(timestamp: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(timestamp));
  const unit = (value: number, name: string) => `${value} ${name}${value === 1 ? '' : 's'}`;
  if (elapsed < HOUR) return unit(Math.max(1, Math.floor(elapsed / MINUTE)), 'minute');
  if (elapsed < DAY) return unit(Math.floor(elapsed / HOUR), 'hour');
  return unit(Math.floor(elapsed / DAY), 'day');
}

export const openReportStatuses: readonly ReportStatus[] = ['submitted', 'under_review'];
export const isOpenReport = (status: ReportStatus) => openReportStatuses.includes(status);

export type ReportQueueFilter = 'open' | 'listing' | 'user' | 'closed';
export const reportQueueFilters: readonly { id: ReportQueueFilter; label: string }[] = [
  { id: 'open', label: 'Open' }, { id: 'listing', label: 'Listings' }, { id: 'user', label: 'Users' }, { id: 'closed', label: 'Closed' },
];
export function filterReports(rows: readonly ReportRecord[], filter: ReportQueueFilter): ReportRecord[] {
  return rows.filter((row) => filter === 'closed' ? !isOpenReport(row.status) : isOpenReport(row.status) && (filter === 'open' || row.kind === filter));
}

export const reportReasonLabel = (row: Pick<ReportRecord, 'kind' | 'reason'>) => reasons[row.kind].find((item) => item.id === row.reason)?.label ?? row.reason.replace(/_/g, ' ');
export const reportTypeLabel = (kind: ReportRecord['kind']) => kind === 'listing' ? 'Listing report' : 'User report';
export const reportStatusLabel = (status: ReportStatus) => reportStatusLabels[status];
export function reportStatusTone(status: ReportStatus): AdminChipTone {
  return status === 'submitted' ? 'warning' : status === 'under_review' ? 'info' : status === 'upheld' ? 'success' : 'neutral';
}

export type ReportDecisionStatus = 'under_review' | 'upheld' | 'dismissed';
export interface ReportDecisionOption { status: ReportDecisionStatus; label: string; description: string; disabledReason: string | null }

/**
 * The only decisions moderate_rental_report accepts. Transitions mirror the existing workflow:
 * a pending report is first moved under review (or dismissed); an under-review report is resolved or dismissed.
 * "Needs information" is the under-review step: the case stays open while more detail is gathered.
 * Closed reports have no decision.
 */
export function reportDecisionOptions(status: ReportStatus): ReportDecisionOption[] {
  if (!isOpenReport(status)) return [];
  const pending = status === 'submitted';
  return [
    { status: 'under_review', label: 'Needs information', description: 'Keep the case open while you gather more detail. The reporter is not notified.', disabledReason: pending ? null : 'This report is already under review.' },
    { status: 'upheld', label: 'Uphold report', description: 'The report is valid. This records a decision only; it does not restrict accounts or remove listings.', disabledReason: pending ? 'Move the report to Needs information first.' : null },
    { status: 'dismissed', label: 'Dismiss', description: 'No violation found.', disabledReason: null },
  ];
}
export const reportDecisionConfirmation = (status: ReportDecisionStatus) => `Set report to ${status === 'under_review' ? 'Under review' : status === 'upheld' ? 'Resolved' : 'Dismissed'}? This records a decision only; it does not suspend accounts or remove listings.`;

export interface IdentityChange { key: string; label: string; from: string; to: string }
export interface IdentityChangeSummary { changed: IdentityChange[]; unchanged: { key: string; label: string; value: string }[] }
const identityValue = (value: unknown) => value === null || value === undefined || value === '' ? 'Not specified' : String(value).replace(/_/g, ' ');

/** Before/after rows for a property identity correction; everything else is "unchanged". */
export function summarizeIdentityChanges(identity: IdentityReviewContext): IdentityChangeSummary {
  const changed: IdentityChange[] = [], unchanged: IdentityChangeSummary['unchanged'] = [];
  for (const [key, label] of identityDisplayFields) {
    const from = identityValue(identity.current[key]), to = identityValue(identity.proposed[key]);
    if (identity.current[key] === identity.proposed[key]) unchanged.push({ key, label, value: from });
    else changed.push({ key, label, from, to });
  }
  return { changed, unchanged };
}

export interface AdminWorkSource { count: number | null; oldest: string | null }
export interface AdminWorkSummary { total: number | null; oldest: { label: string; timestamp: string } | null }

/** Dashboard headline. `total` is null until every source has a real count; nothing is estimated. */
export function summarizeAdminWork(sources: { verification: AdminWorkSource; reports: AdminWorkSource; reviews: AdminWorkSource }): AdminWorkSummary {
  const entries: [string, AdminWorkSource][] = [['Verification', sources.verification], ['Reports', sources.reports], ['Reviews', sources.reviews]];
  const known = entries.every(([, source]) => source.count !== null);
  const total = known ? entries.reduce((sum, [, source]) => sum + (source.count ?? 0), 0) : null;
  let oldest: AdminWorkSummary['oldest'] = null;
  for (const [label, source] of entries) {
    if (!source.oldest || !Number.isFinite(Date.parse(source.oldest))) continue;
    if (!oldest || Date.parse(source.oldest) < Date.parse(oldest.timestamp)) oldest = { label, timestamp: source.oldest };
  }
  return { total, oldest };
}

export const oldestOf = (timestamps: readonly string[]): string | null => timestamps.filter((value) => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;

// ---- Review moderation (moderate_rental_review) ----
export type ReviewDecisionStatus = 'approved' | 'rejected' | 'hidden';
export const reviewQueueFilters: readonly { id: ReviewStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' }, { id: 'approved', label: 'Approved' }, { id: 'rejected', label: 'Rejected' }, { id: 'hidden', label: 'Hidden' },
];
export const reviewStatusLabel = (status: ReviewStatus) => reviewQueueFilters.find((item) => item.id === status)?.label ?? status;
export function reviewStatusTone(status: ReviewStatus): AdminChipTone {
  return status === 'pending' ? 'warning' : status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'neutral';
}
export const reviewKindLabel = (kind: ReviewRow['kind']) => kind === 'property' ? 'Property experience' : 'Participant feedback';
export const reviewTypeLabel = (kind: ReviewRow['kind']) => kind === 'property' ? 'Property review' : 'Participant review';

export interface ReviewDecisionOption { status: ReviewDecisionStatus; label: string; description: string }
const reviewOptions: Record<ReviewDecisionStatus, ReviewDecisionOption> = {
  approved: { status: 'approved', label: 'Approve for publication', description: 'The review becomes public. Reviewer identity stays protected.' },
  rejected: { status: 'rejected', label: 'Reject review', description: 'The review stays private and is not published.' },
  hidden: { status: 'hidden', label: 'Hide published review', description: 'Remove this published review from public view.' },
};
/** Same transitions as the previous panel: approved can only be hidden, rejected can only be approved, anything else is approved or rejected. */
export function reviewDecisionOptions(status: ReviewStatus): ReviewDecisionOption[] {
  return (status === 'approved' ? ['hidden'] : status === 'rejected' ? ['approved'] : ['approved', 'rejected']).map((key) => reviewOptions[key as ReviewDecisionStatus]);
}
export const reviewDecisionConfirmation = (status: ReviewDecisionStatus) => `Set review to ${status}?`;
