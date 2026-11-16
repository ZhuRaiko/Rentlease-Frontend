import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {careStatuses,CareError,maintenanceTransitions,type CareStatus} from './TenancyCare';

// ---------------------------------------------------------------- categories and urgency
export const CATEGORY_LABELS: Record<string, string> = {plumbing: 'Plumbing', electrical: 'Electrical', appliance: 'Appliance', internet: 'Internet', pests: 'Pests', other: 'Other', structural: 'Structural'};
/** The six categories in the picker. "structural" is valid from the server (existing rows) but is not offered here. */
export const PICKER_CATEGORIES = ['plumbing', 'electrical', 'appliance', 'internet', 'pests', 'other'] as const;
export type PickerCategory = typeof PICKER_CATEGORIES[number];
export const categoryLabel = (c: string | null | undefined): string => (c ? CATEGORY_LABELS[c] ?? 'Other' : 'Other');

export type UrgencyKey = 'urgent' | 'soon' | 'later';
/** Urgent = urgent, Soon = normal, Can wait = low. The server's "high" is never used. */
export const URGENCY_OPTIONS: readonly {key: UrgencyKey; label: string; priority: 'urgent' | 'normal' | 'low'}[] = [
  {key: 'urgent', label: 'Urgent', priority: 'urgent'}, {key: 'soon', label: 'Soon', priority: 'normal'}, {key: 'later', label: 'Can wait', priority: 'low'},
];
export const DEFAULT_URGENCY: UrgencyKey = 'soon';
export const URGENT_HINT = 'Use Urgent for leaks, no power, or anything unsafe.';
export const priorityOf = (k: UrgencyKey): 'urgent' | 'normal' | 'low' => URGENCY_OPTIONS.find(o => o.key === k)!.priority;
export const priorityLabel = (p: string): string => (p === 'urgent' ? 'Urgent' : p === 'low' ? 'Can wait' : 'Soon');
export const isUrgent = (p: string): boolean => p === 'urgent';

export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 2000;
export const TITLE_MAX = 60;
/** The form has no title field but create needs 3 to 100 characters: the first sentence or line, cut at a word boundary to at most 60 characters, else the category label. */
export function deriveTitle(description: string, category: string): string {
  const firstLine = description.trim().split(/\r?\n/).find(l => l.trim()) ?? '';
  const sentence = (firstLine.trim().match(/^.*?[.!?](?=\s|$)/)?.[0] ?? firstLine).trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim();
  let title = sentence;
  if (title.length > TITLE_MAX) {
    const cut = title.slice(0, TITLE_MAX + 1), space = cut.lastIndexOf(' ');
    title = (space >= 15 ? cut.slice(0, space) : cut.slice(0, TITLE_MAX)).trim().replace(/[,;:\-]+$/, '').trim();
  }
  return title.length >= 3 ? title : categoryLabel(category);
}
export const reportValid = (description: string): boolean => description.trim().length >= DESCRIPTION_MIN && description.trim().length <= DESCRIPTION_MAX;
export function createPayload(i: {description: string; category: PickerCategory; urgency: UrgencyKey}): Record<string, string> {
  const description = i.description.trim();
  return {title: deriveTitle(description, i.category), description, category: i.category, priority: priorityOf(i.urgency)};
}

// ---------------------------------------------------------------- the four-step line
export type StepKey = 'sent' | 'seen' | 'progress' | 'resolved';
export type Role = 'tenant' | 'landlord';
/** Sent = submitted; Seen = acknowledged, reopened, needs_information; In progress = in_progress, scheduled; Resolved = resolved. Cancelled and rejected leave the line (-1). */
export function stepIndex(status: CareStatus): number {
  switch (status) {
    case 'submitted': return 0;
    case 'acknowledged': case 'reopened': case 'needs_information': return 1;
    case 'in_progress': case 'scheduled': return 2;
    case 'resolved': return 3;
    default: return -1;
  }
}
export interface Step { key: StepKey; label: string; detail: string; state: 'done' | 'current' | 'upcoming' }
export function trackerSteps(i: {status: CareStatus; confirmed: boolean; role: Role; otherName: string; times?: Partial<Record<StepKey, string>>}): Step[] {
  const at = stepIndex(i.status);
  if (at < 0) return [];
  const confirmed = i.status === 'resolved' && i.confirmed;
  const t = i.times ?? {};
  const resolvedDetail = i.status !== 'resolved' ? (i.role === 'tenant' ? 'You confirm when it’s fixed' : 'The tenant confirms when it’s fixed')
    : confirmed ? (i.role === 'tenant' ? 'Fixed · you confirmed' : 'Fixed · confirmed')
    : i.role === 'tenant' ? 'Waiting for your confirmation' : `Waiting for ${i.otherName} to confirm`;
  const steps: {key: StepKey; label: string; detail: string}[] = [
    {key: 'sent', label: 'Sent', detail: t.sent ?? ''},
    {key: 'seen', label: i.role === 'tenant' ? `Seen by ${i.otherName}` : 'Seen', detail: at >= 1 ? (t.seen ?? '') : 'Waiting'},
    {key: 'progress', label: 'In progress', detail: at >= 2 ? (t.progress ?? '') : 'Waiting'},
    {key: 'resolved', label: 'Resolved', detail: resolvedDetail},
  ];
  return steps.map((s, n) => ({...s, state: confirmed || n < at ? 'done' : n === at ? 'current' : 'upcoming'}));
}
/** "Waiting for your confirmation" and its siblings, for a card that shows a one-line summary instead of the four steps. */
export const resolvedLine = (i: {role: Role; otherName: string; confirmed: boolean}): string =>
  i.confirmed ? (i.role === 'tenant' ? 'Fixed · you confirmed' : 'Fixed · confirmed') : i.role === 'tenant' ? 'Waiting for your confirmation' : `Waiting for ${i.otherName} to confirm`;

export const isFinal = (status: CareStatus, confirmed: boolean): boolean => status === 'cancelled' || status === 'rejected' || (status === 'resolved' && confirmed);
export const isOpen = (status: CareStatus, confirmed: boolean): boolean => !isFinal(status, confirmed);
/** Open tab: not final. Resolved tab: resolved and confirmed. A cancelled request leaves both tabs. */
export const tabOf = (status: CareStatus, confirmed: boolean): 'open' | 'resolved' | 'closed' => (isOpen(status, confirmed) ? 'open' : status === 'resolved' ? 'resolved' : 'closed');

export interface Chip { label: string; tone: 'urgent' | 'warning' | 'positive' | 'neutral' | 'info' }
/** Red only for Urgent while the request is open. */
export function requestChip(i: {priority: string; status: CareStatus; confirmed: boolean}): Chip | null {
  if (isOpen(i.status, i.confirmed) && isUrgent(i.priority)) return {label: 'Urgent', tone: 'urgent'};
  if (i.status === 'in_progress' || i.status === 'scheduled') return {label: 'In progress', tone: 'warning'};
  if (i.status === 'resolved') return i.confirmed ? {label: 'Resolved', tone: 'positive'} : {label: 'Fixed?', tone: 'warning'};
  if (i.status === 'cancelled') return {label: 'Cancelled', tone: 'neutral'};
  return null;
}

// ---------------------------------------------------------------- who may do what
export type TenancyState = 'active' | 'ended' | 'other';
export const tenancyStateOf = (status: string): TenancyState => (status === 'active' ? 'active' : status === 'ended' ? 'ended' : 'other');
export interface Actions { reply: boolean; seen: boolean; start: boolean; resolve: boolean; confirm: boolean; notFixed: boolean; cancel: boolean }
/** The transitions document, as booleans. Replies only while the tenancy is active; confirm, cancel and the landlord's "fixed" are still allowed after it ended. */
export function careActionsFor(i: {role: Role; tenancy: TenancyState; status: CareStatus; confirmed: boolean}): Actions {
  const none: Actions = {reply: false, seen: false, start: false, resolve: false, confirm: false, notFixed: false, cancel: false};
  if (i.tenancy === 'other' || isFinal(i.status, i.confirmed)) return none;
  const active = i.tenancy === 'active', targets = maintenanceTransitions(i.status).filter(s => s !== i.status);
  if (i.role === 'landlord') return {...none, reply: active, seen: active && targets.includes('acknowledged'), start: active && targets.includes('in_progress'), resolve: targets.includes('resolved')};
  const unconfirmedFixed = i.status === 'resolved' && !i.confirmed;
  return {...none, reply: active, confirm: unconfirmedFixed, notFixed: active && unconfirmedFixed, cancel: ['submitted', 'acknowledged', 'reopened'].includes(i.status)};
}
export const DEFAULT_NOTES = {acknowledged: 'Seen', in_progress: 'Work started', resolved: 'Marked as fixed'} as const;
export const defaultNote = (target: 'acknowledged' | 'in_progress' | 'resolved'): string => DEFAULT_NOTES[target];
export const QUICK_REPLIES = ['Coming tomorrow', 'Need more info'] as const;
export const NOTE_MAX = 2000;
/** The note a landlord status control sends: what they typed, or the default when the box is empty. */
export const statusNote = (typed: string, target: 'acknowledged' | 'in_progress' | 'resolved'): string => typed.trim() || defaultNote(target);

/** Plain words for a definite refusal. Never the raw server message. */
export function careErrorMessage(code: string | null | undefined): string {
  if (code === '40001') return 'This changed while you were looking. Updated.';
  if (code === '22023') return 'This request was already updated.';
  if (code === '42501') return 'This isn’t available right now.';
  if (code === 'PGRST202') return 'This isn’t available right now. Try again later.';
  return 'Outcome not confirmed. Retry.';
}

// ---------------------------------------------------------------- strict parsing of the two new reads
const bad = () => new CareError('Maintenance information could not be verified.');
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad(); return v as Record<string, unknown>; };
function exact(r: Record<string, unknown>, keys: readonly string[]) { if (Object.keys(r).sort().join(',') !== [...keys].sort().join(',')) throw bad(); }
const uuid = (v: unknown): string => { if (typeof v !== 'string' || !isUuid(v)) throw bad(); return v; };
const text = (v: unknown, max: number): string => { if (typeof v !== 'string' || v.length > max) throw bad(); return v; };
const stamp = (v: unknown): string => { const s = text(v, 50); if (!Number.isFinite(Date.parse(s))) throw bad(); return s; };
const count = (v: unknown): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw bad(); return v; };
const bool = (v: unknown): boolean => { if (typeof v !== 'boolean') throw bad(); return v; };
const category = (v: unknown): string => { if (typeof v !== 'string' || !CATEGORY_LABELS[v]) throw bad(); return v; };
const priority = (v: unknown): string => { if (v !== 'urgent' && v !== 'normal' && v !== 'low' && v !== 'high') throw bad(); return v === 'high' ? 'normal' : v; };
const status = (v: unknown): CareStatus => { if (!careStatuses.includes(v as CareStatus)) throw bad(); return v as CareStatus; };
const role = (v: unknown): Role => { if (v !== 'tenant' && v !== 'landlord') throw bad(); return v; };

export interface InboxRow { id: string; tenancyId: string; propertyId: string; title: string; category: string; priority: string; status: CareStatus; tenantConfirmedAt: string | null; createdAt: string; updatedAt: string; revision: string; tenancyEnded: boolean; lastNote: {role: Role; note: string; at: string} | null }
export interface InboxCounts { open: number; inProgress: number; awaitingConfirmation: number; resolved: number; urgentOpen: number }
export interface Inbox { counts: InboxCounts; rows: InboxRow[]; hasMore: boolean }
export function parseMaintenanceInbox(v: unknown): Inbox {
  const r = object(v); exact(r, ['counts', 'rows', 'hasMore']);
  const c = object(r.counts); exact(c, ['open', 'inProgress', 'awaitingConfirmation', 'resolved', 'urgentOpen']);
  if (!Array.isArray(r.rows) || r.rows.length > 20) throw bad();
  return {
    counts: {open: count(c.open), inProgress: count(c.inProgress), awaitingConfirmation: count(c.awaitingConfirmation), resolved: count(c.resolved), urgentOpen: count(c.urgentOpen)}, hasMore: bool(r.hasMore),
    rows: r.rows.map(x => {
      const o = object(x); exact(o, ['id', 'tenancyId', 'propertyId', 'title', 'category', 'priority', 'status', 'tenantConfirmedAt', 'createdAt', 'updatedAt', 'revision', 'tenancyEnded', 'lastNote']);
      let lastNote: InboxRow['lastNote'] = null;
      if (o.lastNote !== null) { const n = object(o.lastNote); exact(n, ['role', 'note', 'at']); lastNote = {role: role(n.role), note: text(n.note, 2000), at: stamp(n.at)}; }
      return {id: uuid(o.id), tenancyId: uuid(o.tenancyId), propertyId: uuid(o.propertyId), title: text(o.title, 100), category: category(o.category), priority: priority(o.priority), status: status(o.status),
        tenantConfirmedAt: o.tenantConfirmedAt === null ? null : stamp(o.tenantConfirmedAt), createdAt: stamp(o.createdAt), updatedAt: stamp(o.updatedAt), revision: uuid(o.revision), tenancyEnded: bool(o.tenancyEnded), lastNote};
    }),
  };
}

export interface RequestDetail { id: string; tenancyId: string; propertyId: string; title: string; description: string; category: string; priority: string; status: CareStatus; landlordResponse: string | null; scheduledFor: string | null; resolvedAt: string | null; tenantConfirmedAt: string | null; createdAt: string; updatedAt: string; revision: string; tenancyEnded: boolean; role: Role }
export interface ThreadEntry { id: string; role: Role; fromStatus: CareStatus | null; status: CareStatus; note: string | null; at: string }
export interface RequestRead { request: RequestDetail; thread: ThreadEntry[]; hasMore: boolean }
export function parseMaintenanceRequest(v: unknown, requestId: string): RequestRead {
  const r = object(v); exact(r, ['request', 'thread', 'hasMore']);
  const q = object(r.request); exact(q, ['id', 'tenancyId', 'propertyId', 'title', 'description', 'category', 'priority', 'status', 'landlordResponse', 'scheduledFor', 'resolvedAt', 'tenantConfirmedAt', 'createdAt', 'updatedAt', 'revision', 'tenancyEnded', 'role']);
  if (q.id !== requestId || !Array.isArray(r.thread) || r.thread.length > 20) throw bad();
  const optText = (x: unknown) => (x === null ? null : text(x, 2000)), optStamp = (x: unknown) => (x === null ? null : stamp(x));
  return {
    hasMore: bool(r.hasMore),
    request: {id: uuid(q.id), tenancyId: uuid(q.tenancyId), propertyId: uuid(q.propertyId), title: text(q.title, 100), description: text(q.description, 2000), category: category(q.category), priority: priority(q.priority), status: status(q.status),
      landlordResponse: optText(q.landlordResponse), scheduledFor: optStamp(q.scheduledFor), resolvedAt: optStamp(q.resolvedAt), tenantConfirmedAt: optStamp(q.tenantConfirmedAt), createdAt: stamp(q.createdAt), updatedAt: stamp(q.updatedAt), revision: uuid(q.revision), tenancyEnded: bool(q.tenancyEnded), role: role(q.role)},
    thread: r.thread.map(x => { const o = object(x); exact(o, ['id', 'role', 'fromStatus', 'status', 'note', 'at']); return {id: uuid(o.id), role: role(o.role), fromStatus: o.fromStatus === null ? null : status(o.fromStatus), status: status(o.status), note: o.note === null ? null : text(o.note, 2000), at: stamp(o.at)}; }),
  };
}

/** Step times from the thread: the first time each stage was reached. */
export function stepTimes(thread: readonly ThreadEntry[], createdAt: string, fmt: (iso: string) => string): Partial<Record<StepKey, string>> {
  const out: Partial<Record<StepKey, string>> = {sent: fmt(createdAt)};
  for (const e of thread) {
    const k = stepIndex(e.status);
    if (e.fromStatus === e.status && e.status !== 'resolved') continue;
    if (k === 1 && !out.seen) out.seen = fmt(e.at);
    if (k === 2) { if (!out.seen) out.seen = fmt(e.at); if (!out.progress) out.progress = fmt(e.at); }
    if (k === 3 && e.fromStatus !== 'resolved' && !out.resolved) out.resolved = fmt(e.at);
  }
  return out;
}

/** The person's name for a thread entry: "You" for the viewer's own role. */
export const threadName = (entryRole: Role, viewer: Role, otherName: string): string => (entryRole === viewer ? 'You' : otherName);
export const ageText = (iso: string, now: number): string => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};
