import {publicIdentityLabel, type PublicIdentity} from '../../../shared/models/PublicIdentity';
import {reviewScreenFor, reviewStatusLabel, type ReviewContext} from '../../../shared/models/RentalReview';
import type {RentalReservation} from '../../messaging-viewing/models/RentalReservation';
import {rentSchedule, type CareContext, type CareStatus} from './TenancyCare';
import type {LifecycleContext} from './TenancyLifecycle';
import type {TenancyCardContext} from './TenancyDetails';
import {openCountLabel, stayProgress, tenancyChip} from './TenancyPresentation';
import type {Chip} from '../../../shared/models/StatusChip';
import {ago, dueLabel, manilaToday, pesos, shortDate} from '../../../shared/utils/rentalDates';
import {placeLine, type Person} from './TenancyWorkspaceScreen';
import type {Role} from './CancelledRentals';
import type {RentalRelationship} from './TenancyWorkspace';

export interface DetailsInput {
  actor: string;
  tenancy: RentalRelationship;
  context: TenancyCardContext;
  identities: Record<string, PublicIdentity>;
  care: CareContext | null;
  lifecycle: LifecycleContext | null;
  reviews: ReviewContext | null;
  reservation: RentalReservation | null;
  conversationId: string | null;
  now: number;
}
export interface TimelineEntry { key: string; label: string; date: string; note: string | null }
export interface DetailsScreen {
  role: Role; chip: Chip; title: string; place: string; muted: boolean;
  dates: {start: string; end: string | null; progress: {fraction: number; label: string} | null};
  summary: string | null;
  actions: {primary: {kind: 'report' | 'open_property'; label: string}; message: boolean} | null;
  ratingPrompt: {title: string; body: string; button: string} | null;
  rent: {dueOn: string; rows: string[]; note: string} | null;
  person: Person;
  maintenance: {chip: string; latest: {title: string; meta: string} | null} | null;
  documents: {key: 'property' | 'reservation' | 'lifecycle'; label: string}[];
  reviews: {key: string; label: string; status: string; rating: number; text: string | null}[] | null;
  timeline: TimelineEntry[] | null;
  endEarly: boolean;
  /** Ended rentals close with Open conversation; active ones carry Message in the action row instead. */
  openConversation: boolean;
}
export const REVIEWS_NOTE = 'Reviews appear publicly only after they are approved. Reviewer names are never shown.';
export const RENT_NOTE = 'This is the agreed schedule. Payments are not tracked here yet.';
const FINAL: CareStatus[] = ['resolved', 'rejected', 'cancelled'];
const longDate = (date: string): string => `${shortDate(date)}, ${date.slice(0, 4)}`;
const ordinal = (n: number): string => { const v = n % 100; return `${n}${v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`; };
export const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
export const careStatusLine = (status: CareStatus, role: Role): string => ({
  submitted: role === 'tenant' ? 'Sent, waiting for the landlord' : 'New', acknowledged: role === 'tenant' ? 'Seen by landlord' : 'Seen', needs_information: 'Needs more information',
  scheduled: 'Scheduled', in_progress: 'In progress', resolved: 'Resolved', reopened: 'Reopened', rejected: 'Not accepted', cancelled: 'Cancelled',
} as Record<CareStatus, string>)[status];

export function detailsScreen(i: DetailsInput): DetailsScreen {
  const t = i.tenancy, role: Role = i.actor === t.tenant_id ? 'tenant' : 'landlord', otherId = role === 'tenant' ? t.landlord_id : t.tenant_id;
  const other = publicIdentityLabel(i.identities[otherId], role === 'tenant' ? 'owner' : 'renter'), title = i.context.title ?? t.listingTitle ?? 'Rental listing unavailable';
  const ended = t.status === 'ended', active = t.status === 'active', end = t.actual_end_date ?? t.expected_end_date;
  const events = [...(i.lifecycle?.events ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const rentLine = t.agreed_monthly_rent === undefined ? '' : ` Rent was ${pesos(t.agreed_monthly_rent)} / month.`;
  const summary = ended
    ? (events.some(e => e.action === 'accept') ? 'Ended early by mutual agreement.' : events.some(e => e.action === 'complete') ? 'Completed at the end of its recorded period.' : `Ended ${end ? shortDate(end) : ''}.`.replace(' .', '.')) + rentLine
    : t.status === 'cancelled' ? 'Setup was cancelled.' : null;
  const progress = active ? stayProgress(t.start_date, end, i.now) : null;
  const review = i.reviews ? reviewScreenFor(i.reviews, i.actor) : null;
  const ratingPrompt = ended && review?.state === 'form'
    ? {title: role === 'tenant' ? `Rate ${title}` : `Rate ${other}`, body: role === 'tenant' ? 'One rating per tenancy. It helps the next renter decide.' : 'One rating per tenancy. It helps other landlords decide.', button: role === 'tenant' ? 'Rate your stay' : 'Rate your tenant'}
    : null;
  const schedule = active ? rentSchedule(t, i.now) : [];
  const requests = i.care?.requests ?? [], open = requests.filter(r => !FINAL.includes(r.status));
  const latest = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const timeline: TimelineEntry[] | null = ended ? (() => {
    const out: TimelineEntry[] = [];
    const approved = i.reservation?.history.find(h => h.action === 'approve');
    if (approved) out.push({key: 'approved', label: 'Reservation approved', date: shortDate(manilaToday(Date.parse(approved.at))), note: null});
    out.push({key: 'started', label: 'Tenancy confirmed and started', date: shortDate(t.start_date), note: null});
    const who = (id: string) => id === i.actor ? 'You' : other;
    for (const e of events) {
      const date = e.date ? shortDate(e.date) : shortDate(manilaToday(Date.parse(e.createdAt))), note = e.reason ? `“${e.reason}”` : null;
      if (e.action === 'request_end') out.push({key: e.id, label: `${who(e.actorId)} asked to end early`, date, note});
      else if (e.action === 'accept') out.push({key: e.id, label: `${who(e.actorId)} accepted · tenancy ended`, date, note});
      else if (e.action === 'reject') out.push({key: e.id, label: `${who(e.actorId)} declined the request`, date, note});
      else if (e.action === 'withdraw') out.push({key: e.id, label: `${who(e.actorId)} withdrew the request`, date, note});
      else out.push({key: e.id, label: 'Tenancy completed', date, note});
    }
    if (!events.some(e => e.action === 'accept' || e.action === 'complete') && end) out.push({key: 'ended', label: 'Tenancy ended', date: shortDate(end), note: null});
    return out;
  })() : null;
  return {
    role, chip: tenancyChip(t, i.actor), title, place: placeLine(i.context), muted: ended || t.status === 'cancelled',
    dates: {start: longDate(t.start_date), end: end ? longDate(end) : null, progress: progress ? {fraction: progress.fraction, label: `Day ${progress.day} of ${progress.total}`} : null},
    summary,
    actions: active ? {primary: role === 'tenant' ? {kind: 'report', label: 'Report an issue'} : {kind: 'open_property', label: 'Open property'}, message: !!i.conversationId} : null,
    ratingPrompt,
    rent: active || ['proposed', 'pending_confirmation'].includes(t.status) ? {dueOn: t.rent_due_day ? `Due on the ${ordinal(t.rent_due_day)}` : 'No due day recorded', rows: schedule.map(d => dueLabel(d, i.now)), note: RENT_NOTE} : null,
    person: {id: otherId, label: other, identity: i.identities[otherId], relation: role === 'tenant' ? 'Landlord' : 'Tenant'},
    maintenance: active ? {chip: openCountLabel(open.length), latest: latest ? {title: latest.title, meta: `${careStatusLine(latest.status, role)} · ${ago(latest.createdAt, i.now)}`} : null} : null,
    documents: [
      ...(i.context.property ? [{key: 'property' as const, label: 'Property information'}] : []),
      ...(i.reservation ? [{key: 'reservation' as const, label: 'Source reservation'}] : []),
      ...(active ? [{key: 'lifecycle' as const, label: 'Lifecycle history'}] : []),
    ],
    reviews: ended && review ? [...(review.own ? [review.own] : []), ...review.earlier].map(r => ({
      key: r.id, status: reviewStatusLabel(r.status), rating: r.rating, text: r.text,
      label: r.kind === 'property' ? 'Your review of this property' : `Your review of ${other}`,
    })) : null,
    timeline,
    endEarly: active,
    openConversation: ended && !!i.conversationId,
  };
}
