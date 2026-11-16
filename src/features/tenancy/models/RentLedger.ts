import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {validCalendarDate} from '../../messaging-viewing/models/RentalReservation';
import type {Chip} from '../../../shared/models/StatusChip';
import {inDays, manilaToday, pesos, shortDate} from '../../../shared/utils/rentalDates';

/** The rule shown on the ledger screen and repeated wherever the ledger is mentioned. */
export const RULE_LINE = 'This ledger records what each person says. It does not move money. Payments stay between landlord and tenant.';
export const RENT_PAGE = 12;

export type RentStatus = 'upcoming' | 'due' | 'past_due' | 'tenant_marked_paid' | 'landlord_acknowledged' | 'disputed' | 'waived';
export const RENT_STATUSES: readonly RentStatus[] = ['upcoming', 'due', 'past_due', 'tenant_marked_paid', 'landlord_acknowledged', 'disputed', 'waived'];
export type RentAction = 'mark_paid' | 'acknowledge' | 'dispute';
/** The status each action must produce; a response that disagrees is treated as unconfirmed. */
export const ACTION_RESULT: Record<RentAction, RentStatus> = {mark_paid: 'tenant_marked_paid', acknowledge: 'landlord_acknowledged', dispute: 'disputed'};

export type Role = 'tenant' | 'landlord';
export interface RentRow {
  dueDate: string; amount: number; storedStatus: string | null; status: RentStatus; revision: string | null;
  tenantMarkedPaidAt: string | null; landlordAcknowledgedAt: string | null; changedAt: string | null;
  canMarkPaid: boolean; canAcknowledge: boolean; canDispute: boolean;
}
export interface RentLedger {
  tenancyId: string; tenantId: string; landlordId: string; status: string; today: string; monthlyRent: number; dueDay: number;
  rows: RentRow[]; hasMore: boolean; awaiting: {dueDate: string; revision: string} | null;
}
export interface RentOperation {tenancyId: string; operationId: string; action: RentAction; dueDate: string; revision: string | null}
export interface RentWriteResult {dueDate: string; status: RentStatus; revision: string}

/** `code` is the Postgres SQLSTATE when the server answered; `uncertain` means the write may or may not have happened. */
export class RentLedgerError extends Error {
  constructor(message: string, readonly code: string | null = null, readonly uncertain = false) {super(message);}
}

const bad = (what: string): never => {throw new RentLedgerError(`The rent ledger response could not be read (${what}).`);};
const object = (v: unknown, what: string): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad(what));
const date = (v: unknown, what: string): string => (validCalendarDate(v) ? v : bad(what));
const uuid = (v: unknown, what: string): string => (typeof v === 'string' && isUuid(v) ? v : bad(what));
const nullableUuid = (v: unknown, what: string): string | null => (v === null || v === undefined ? null : uuid(v, what));
const money = (v: unknown, what: string): number => { const n = typeof v === 'string' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : bad(what); };
const stamp = (v: unknown, what: string): string | null => (v === null || v === undefined ? null : typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : bad(what));
const flag = (v: unknown, what: string): boolean => (typeof v === 'boolean' ? v : bad(what));

function parseRow(value: unknown): RentRow {
  const r = object(value, 'row');
  const status = r.displayStatus;
  if (typeof status !== 'string' || !RENT_STATUSES.includes(status as RentStatus)) bad('status');
  const row: RentRow = {
    dueDate: date(r.dueDate, 'due date'), amount: money(r.amount, 'amount'), storedStatus: typeof r.storedStatus === 'string' ? r.storedStatus : null,
    status: status as RentStatus, revision: nullableUuid(r.revision, 'revision'),
    tenantMarkedPaidAt: stamp(r.tenantMarkedPaidAt, 'paid time'), landlordAcknowledgedAt: stamp(r.landlordAcknowledgedAt, 'received time'), changedAt: stamp(r.changedAt, 'changed time'),
    canMarkPaid: flag(r.canMarkPaid, 'flag'), canAcknowledge: flag(r.canAcknowledge, 'flag'), canDispute: flag(r.canDispute, 'flag'),
  };
  // A stored status always has a revision; a month with no stored row has none and nothing to dispute.
  if ((row.storedStatus === null) !== (row.revision === null)) bad('revision');
  if (row.status === 'tenant_marked_paid' && !row.tenantMarkedPaidAt) bad('paid time');
  if (row.status === 'landlord_acknowledged' && !row.landlordAcknowledgedAt) bad('received time');
  return row;
}

/** Strict parse of get_rent_ledger. The caller must be a party and the ids must be the ones requested. */
export function parseRentLedger(value: unknown, actor: string, tenancyId: string): RentLedger {
  const r = object(value, 'ledger');
  const tenantId = uuid(r.tenantId, 'tenant'), landlordId = uuid(r.landlordId, 'landlord');
  if (uuid(r.tenancyId, 'tenancy') !== tenancyId || tenantId === landlordId || ![tenantId, landlordId].includes(actor)) bad('parties');
  if (!Array.isArray(r.rows) || r.rows.length > RENT_PAGE) bad('rows');
  const rows = (r.rows as unknown[]).map(parseRow);
  for (let i = 1; i < rows.length; i++) if (rows[i]!.dueDate >= rows[i - 1]!.dueDate) bad('order');
  if (typeof r.hasMore !== 'boolean') bad('more');
  let awaiting: RentLedger['awaiting'] = null;
  if (r.awaiting !== null && r.awaiting !== undefined) {
    const a = object(r.awaiting, 'awaiting'), dueDate = date(a.dueDate, 'awaiting date'), revision = uuid(a.revision, 'awaiting revision');
    if (actor !== landlordId || !rows.some(x => x.dueDate === dueDate && x.status === 'tenant_marked_paid' && x.revision === revision)) bad('awaiting');
    awaiting = {dueDate, revision};
  }
  const dueDay = r.dueDay;
  if (typeof dueDay !== 'number' || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) bad('due day');
  return {tenancyId, tenantId, landlordId, status: typeof r.status === 'string' ? r.status : bad('status'), today: date(r.today, 'today'), monthlyRent: money(r.monthlyRent, 'rent'), dueDay: dueDay as number, rows, hasMore: r.hasMore as boolean, awaiting};
}

/** Strict parse of write_rent_ledger against the operation that was sent. */
export function parseRentWrite(value: unknown, op: RentOperation): RentWriteResult {
  // The server already answered without an error, so any response we cannot match to this operation is "not confirmed": the caller retries
  // the same operation id and the server replays its stored result.
  try {
    const r = object(value, 'result');
    const status = r.status;
    if (r.dueDate !== op.dueDate || status !== ACTION_RESULT[op.action]) throw new Error('mismatch');
    return {dueDate: op.dueDate, status: status as RentStatus, revision: uuid(r.revision, 'revision')};
  } catch { throw new RentLedgerError('Outcome not confirmed. Retry the same action.', null, true); }
}

export function validateRentOperation(op: RentOperation): void {
  if (!isUuid(op.tenancyId) || !isUuid(op.operationId) || !validCalendarDate(op.dueDate) || !(op.action in ACTION_RESULT) || (op.revision !== null && !isUuid(op.revision))) throw new RentLedgerError('Invalid rent action.');
}

// ---- Presentation
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthShort = (dueDate: string): string => MONTHS[Number(dueDate.split('-')[1]) - 1] ?? dueDate;
/** "Nov 1" for a timestamp, in Manila time like every other date in the app. */
export const stampDate = (iso: string): string => shortDate(manilaToday(Date.parse(iso)));
export const ordinal = (n: number): string => { const v = n % 100; return `${n}${v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`; };
export const ledgerSummary = (l: Pick<RentLedger, 'monthlyRent' | 'dueDay'>): string => `${pesos(l.monthlyRent)} / month · due on the ${ordinal(l.dueDay)}`;

/** The month the rent card offers "I've paid" for: the tenant's newest actionable month that is already due (not one still upcoming), on an active rental. */
export const payableRow = (rows: readonly RentRow[], role: Role | null, tenancyStatus: string): RentRow | undefined => (role === 'tenant' && tenancyStatus === 'active' ? rows.find(r => r.canMarkPaid && r.status !== 'upcoming') : undefined);
export const roleOf = (l: Pick<RentLedger, 'tenantId' | 'landlordId'>, actor: string): Role => (actor === l.tenantId ? 'tenant' : 'landlord');

/** Chip per status. Waiting reads from the tenant's side, Confirm from the landlord's. Palette: blue upcoming, amber due and needs someone, red past due, green received. */
export function rowChip(row: Pick<RentRow, 'status'>, role: Role, otherName: string): Chip {
  switch (row.status) {
    case 'upcoming': return {label: 'Upcoming', tone: 'info'};
    case 'due': return {label: 'Due', tone: 'warning'};
    case 'past_due': return {label: 'Past due', tone: 'restricted'};
    case 'tenant_marked_paid': return role === 'landlord' ? {label: 'Confirm', tone: 'warning'} : {label: `Waiting for ${otherName}`, tone: 'info'};
    case 'landlord_acknowledged': return {label: 'Received', tone: 'positive'};
    case 'disputed': return {label: 'Checking', tone: 'warning'};
    default: return {label: 'Waived', tone: 'neutral'};
  }
}
/** The small line under "Due Nov 2", built only from the stored timestamps and the schedule. */
export function rowLine(row: RentRow, role: Role, otherName: string, now: number): string {
  switch (row.status) {
    case 'upcoming': case 'due': case 'past_due': return inDays(row.dueDate, now);
    case 'tenant_marked_paid': return role === 'landlord' ? `${otherName} marked paid ${stampDate(row.tenantMarkedPaidAt!)}` : `You marked paid ${stampDate(row.tenantMarkedPaidAt!)}`;
    case 'landlord_acknowledged': return `Received ${stampDate(row.landlordAcknowledgedAt!)}`;
    case 'disputed': return role === 'landlord' ? `You asked ${otherName} to check${row.changedAt ? ` ${stampDate(row.changedAt)}` : ''}` : `${otherName} asked you to check${row.changedAt ? ` ${stampDate(row.changedAt)}` : ''}`;
    default: return 'Waived';
  }
}
export const rowTitle = (row: Pick<RentRow, 'dueDate'>): string => `Due ${shortDate(row.dueDate)}`;
export function bannerText(row: RentRow, tenantName: string): {title: string; body: string} {
  return {title: `${tenantName} says rent for ${monthShort(row.dueDate)} was paid on ${row.tenantMarkedPaidAt ? stampDate(row.tenantMarkedPaidAt) : shortDate(row.dueDate)}`, body: `Confirm that you received it, or ask ${tenantName} to check.`};
}

/** The exact text sent to the chat after "Not received". Fixed wording: no names, no amounts, no accusation. */
export const disputeMessage = (dueDate: string): string => `Rent ledger: I can't see the rent for ${shortDate(dueDate)} on my side yet. Could you please check it? It may just be a delay. Thank you.`;
export const DISPUTE_SEND_LABEL = 'Send and mark not received';
export const NO_CONVERSATION_NOTE = 'No chat conversation was found for this rental, so no message will be sent. The ledger will still show that you could not confirm it.';

export const CHANGED_NOTICE = 'This changed while you were looking. Updated.';
export const CONFIRMED_NOTICE = 'Already confirmed.';
export const UNAVAILABLE_TEXT = "This isn't available right now.";
export const NETWORK_TEXT = "We couldn't confirm that. Check your connection and retry.";
/** Plain words for every failure. `reload` means the ledger should be read again and the message shown after it. */
export function rentErrorText(e: unknown): {message: string; reload: boolean} {
  if (!(e instanceof RentLedgerError)) return {message: NETWORK_TEXT, reload: false};
  if (e.uncertain) return {message: NETWORK_TEXT, reload: false};
  if (e.code === '40001') return {message: CHANGED_NOTICE, reload: true};
  if (e.code === '22023') return /already confirmed/i.test(e.message) ? {message: CONFIRMED_NOTICE, reload: true} : {message: CHANGED_NOTICE, reload: true};
  if (e.code === '42501') return {message: UNAVAILABLE_TEXT, reload: false};
  if (e.code === 'PGRST202') return {message: 'This feature is not available right now. Try again later.', reload: false};
  return {message: e.message || NETWORK_TEXT, reload: false};
}
