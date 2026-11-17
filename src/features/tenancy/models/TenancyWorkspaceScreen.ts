import {publicIdentityLabel, type PublicIdentity} from '../../../shared/models/PublicIdentity';
import {reviewScreenFor, type ReviewContext} from '../../../shared/models/RentalReview';
import {propertyCityOptions, propertyTypeOptions} from '../../property-listing/models/DraftProperty';
import type {RentalReservation} from '../../messaging-viewing/models/RentalReservation';
import {cancelledLine, releaseTarget, type Role} from './CancelledRentals';
import {rentSchedule, type CareContext} from './TenancyCare';
import type {TenancyActivity} from '../services/tenancyActivityService';
import type {LifecycleContext} from './TenancyLifecycle';
import type {TenancyCardContext} from './TenancyDetails';
import {CHIP, tenancyChip, tenantNeedsOk, type TileKind} from './TenancyPresentation';
import type {Chip} from '../../../shared/models/StatusChip';
import {ago, dateRange, dueLabel, inDays, pesos, shortDate} from '../../../shared/utils/rentalDates';
import {tenancyCounts, tenancySections, type RentalRelationship} from './TenancyWorkspace';

export interface Link { reservation_id: string; tenancy_id: string }
export interface WorkspaceInput {
  actor: string;
  tenancies: readonly RentalRelationship[];
  reservations: readonly RentalReservation[];
  links: readonly Link[] | null;
  contexts: Record<string, TenancyCardContext>;
  identities: Record<string, PublicIdentity>;
  activity: TenancyActivity;
  now: number;
}

// ---- Attention: what is waiting on this person, from reads the tab already makes
export type AttentionAction =
  | {kind: 'setup'; reservationId: string}
  | {kind: 'details'; tenancyId: string; panel: 'lifecycle' | 'care' | 'extension'};
export interface AttentionItem {
  key: string;
  role: Role;
  kind: 'confirm_terms' | 'start_setup' | 'end_request' | 'maintenance' | 'extension_request';
  title: string;
  subtitle: string;
  chip: Chip;
  buttonLabel: string;
  action: AttentionAction;
}
const FINAL_MAINTENANCE = ['resolved', 'rejected', 'cancelled'];
const roleOf = (actor: string, t: Pick<RentalRelationship, 'tenant_id'>): Role => actor === t.tenant_id ? 'tenant' : 'landlord';
const otherId = (actor: string, t: Pick<RentalRelationship, 'tenant_id' | 'landlord_id'>) => actor === t.tenant_id ? t.landlord_id : t.tenant_id;
const titleOf = (i: WorkspaceInput, t: RentalRelationship) => i.contexts[t.id]?.title ?? t.listingTitle ?? 'Rental listing unavailable';
const nameOf = (i: WorkspaceInput, id: string, role: Role) => publicIdentityLabel(i.identities[id], role === 'tenant' ? 'owner' : 'renter');

export function attentionItems(i: WorkspaceInput): AttentionItem[] {
  const out: (AttentionItem & {rank: number})[] = [];
  const sections = tenancySections(i.actor, [...i.tenancies], [...i.reservations], i.now, i.links ? [...i.links] : null);
  for (const t of sections.pending) {
    const link = i.links?.find(l => l.tenancy_id === t.id);
    if (tenantNeedsOk(t, i.actor) && link) out.push({rank: 0, key: `ok:${t.id}`, role: 'tenant', kind: 'confirm_terms', title: 'Confirm your tenancy terms',
      subtitle: `${titleOf(i, t)} · move-in ${shortDate(t.start_date)}. ${nameOf(i, t.landlord_id, 'tenant')} shared the terms.`, chip: CHIP.needsOk, buttonLabel: 'Review terms', action: {kind: 'setup', reservationId: link.reservation_id}});
  }
  for (const r of sections.upcoming) {
    if (r.landlordId !== i.actor) continue;
    out.push({rank: 1, key: `setup:${r.id}`, role: 'landlord', kind: 'start_setup', title: 'Set up tenancy', subtitle: `${r.listingTitle ?? 'Rental reservation'} · ${nameOf(i, r.tenantId, 'landlord')} approved`,
      chip: {label: 'Do now', tone: 'warning'}, buttonLabel: 'Set up tenancy', action: {kind: 'setup', reservationId: r.id}});
  }
  for (const t of sections.active) {
    const role = roleOf(i.actor, t), other = nameOf(i, otherId(i.actor, t), role), title = titleOf(i, t);
    const life: LifecycleContext | null | undefined = i.activity.lifecycle[t.id];
    if (life?.pending && life.pending.initiatorId !== i.actor)
      out.push({rank: 2, key: `end:${t.id}`, role, kind: 'end_request', title: 'Early-end request', subtitle: `${title} · ${other} asked to end the stay`, chip: {label: 'Reply', tone: 'warning'}, buttonLabel: 'Reply', action: {kind: 'details', tenancyId: t.id, panel: 'lifecycle'}});
    // A tenant's request to stay longer, from get_pending_tenancy_extensions (the owner's reads only). The server already leaves out inactive tenancies; this loop is active ones only.
    const asked = role === 'landlord' ? (i.activity.extensions ?? []).find(x => x.tenancyId === t.id) : undefined;
    if (asked)
      out.push({rank: 2, key: `extension:${asked.requestId}`, role, kind: 'extension_request', title: 'Extension request', subtitle: `${title} · ${other} asks to stay until ${shortDate(asked.requestedEndDate)}`, chip: {label: 'Needs your OK', tone: 'warning'}, buttonLabel: 'Review', action: {kind: 'details', tenancyId: t.id, panel: 'extension'}});
    const care: CareContext | null | undefined = i.activity.care[t.id];
    for (const req of care?.requests ?? []) {
      const open = !FINAL_MAINTENANCE.includes(req.status);
      // The tenant is only asked when the landlord is waiting on them; the landlord sees every open request.
      if (!open || (role === 'tenant' && req.status !== 'needs_information')) continue;
      const urgent = req.priority === 'urgent';
      out.push({rank: urgent ? -1 : 3, key: `care:${req.id}`, role, kind: 'maintenance', title: req.title,
        subtitle: role === 'tenant' ? `${title} · needs your reply` : `${title} · ${other} · ${ago(req.createdAt, i.now)}`,
        chip: urgent ? {label: 'Urgent', tone: 'urgent'} : role === 'tenant' ? {label: 'Reply', tone: 'warning'} : {label: 'Open', tone: 'warning'}, buttonLabel: role === 'tenant' ? 'Open' : 'View', action: {kind: 'details', tenancyId: t.id, panel: 'care'}});
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map(({rank: _rank, ...item}) => item);
}

// ---- Cards
export interface Person { id: string; label: string; identity: PublicIdentity | undefined; relation: 'Landlord' | 'Tenant' }
export interface StayCard {
  id: string; role: Role; title: string; place: string; chip: Chip; photos: TenancyCardContext['photos']; other: Person;
  rent: string; nextDue: string; propertyId: string; reservationId: string | null;
  primary: {kind: 'report' | 'open_property'; label: string}; secondary: {label: 'Details'};
}
export interface UpcomingCard {
  id: string; kind: 'tenancy' | 'reservation'; tenancyId: string | null; reservationId: string | null; role: Role; title: string; place: string | null;
  chip: Chip; photos: TenancyCardContext['photos']; moveIn: string; rent: string | null; buttonLabel: 'Open';
}
export interface PastCard {
  id: string; role: Role; title: string; subtitle: string; chip: Chip; photos: TenancyCardContext['photos'];
  note: string | null;
  prompt: {title: string; body: string; button: string} | null;
  buttons: {key: 'start_request' | 'find_similar' | 'message' | 'release' | 'rate' | 'view'; label: string; primary: boolean}[];
  conversationId: string | null; reservationId: string | null; similar: {city: string; type: string} | null; sourceId: string | null;
}
export const placeLine = (c: TenancyCardContext | undefined): string => {
  const p = c?.property;
  if (!p) return 'Location unavailable';
  const city = propertyCityOptions.find(o => o.value === p.city)?.label ?? p.city, type = propertyTypeOptions.find(o => o.value === p.type)?.label ?? p.type;
  return [p.barangay, city].filter(Boolean).join(', ') + (type ? ` · ${type}` : '');
};

export interface WorkspaceScreen {
  order: ('attention' | 'active' | 'upcoming' | 'past')[];
  tiles: {kind: TileKind; count: number}[];
  needsOk: AttentionItem[];
  attention: AttentionItem[];
  activeTitle: string;
  active: StayCard[];
  upcoming: UpcomingCard[];
  past: PastCard[];
}

export function workspaceScreen(i: WorkspaceInput): WorkspaceScreen {
  const links = i.links ? [...i.links] : null;
  const sections = tenancySections(i.actor, [...i.tenancies], [...i.reservations], i.now, links);
  const counts = tenancyCounts(sections), items = attentionItems(i);
  const active: StayCard[] = sections.active.map(t => {
    const role = roleOf(i.actor, t), ctx = i.contexts[t.id], oid = otherId(i.actor, t);
    return {
      id: t.id, role, title: titleOf(i, t), place: placeLine(ctx), chip: tenancyChip(t, i.actor), photos: ctx?.photos ?? [],
      other: {id: oid, label: nameOf(i, oid, role), identity: i.identities[oid], relation: role === 'tenant' ? 'Landlord' : 'Tenant'},
      rent: t.agreed_monthly_rent === undefined ? '—' : `${pesos(t.agreed_monthly_rent)} / mo`,
      nextDue: (() => { const d = rentSchedule(t, i.now)[0]; return d ? dueLabel(d, i.now) : 'No date set'; })(),
      propertyId: t.property_id, reservationId: i.links?.find(l => l.tenancy_id === t.id)?.reservation_id ?? null,
      primary: role === 'tenant' ? {kind: 'report', label: 'Report an issue'} : {kind: 'open_property', label: 'Open property'}, secondary: {label: 'Details'},
    };
  });
  const upcoming: UpcomingCard[] = [
    ...sections.pending.map((t): UpcomingCard => {
      const ctx = i.contexts[t.id], role = roleOf(i.actor, t);
      return {id: `t:${t.id}`, kind: 'tenancy', tenancyId: t.id, reservationId: i.links?.find(l => l.tenancy_id === t.id)?.reservation_id ?? null, role, title: titleOf(i, t), place: placeLine(ctx),
        chip: tenancyChip(t, i.actor), photos: ctx?.photos ?? [], moveIn: `${shortDate(t.start_date)} · ${inDays(t.start_date, i.now)}`, rent: t.agreed_monthly_rent === undefined ? null : `${pesos(t.agreed_monthly_rent)} / mo`, buttonLabel: 'Open'};
    }),
    ...sections.upcoming.map((r): UpcomingCard => ({id: `r:${r.id}`, kind: 'reservation', tenancyId: null, reservationId: r.id, role: r.tenantId === i.actor ? 'tenant' : 'landlord', title: r.listingTitle ?? 'Rental reservation', place: null,
      chip: CHIP.upcoming, photos: [], moveIn: `${shortDate(r.moveInDate)} · ${inDays(r.moveInDate, i.now)}`, rent: null, buttonLabel: 'Open'})),
  ];
  const past: PastCard[] = sections.past.map(t => {
    const role = roleOf(i.actor, t), ctx = i.contexts[t.id], oid = otherId(i.actor, t), other = nameOf(i, oid, role), title = titleOf(i, t);
    const end = t.actual_end_date ?? t.expected_end_date, range = dateRange(t.start_date, end);
    const common = {id: t.id, role, title, chip: tenancyChip(t, i.actor), photos: ctx?.photos ?? [], sourceId: i.links?.find(l => l.tenancy_id === t.id)?.reservation_id ?? null};
    if (t.status === 'cancelled') {
      const target = releaseTarget(t, links, [...i.reservations], i.now), property = ctx?.property;
      const buttons: PastCard['buttons'] = role === 'tenant'
        ? [...(target.conversationId ? [{key: 'start_request' as const, label: 'Start a new request', primary: true}] : []), ...(property ? [{key: 'find_similar' as const, label: 'Find similar', primary: false}] : []), ...(target.conversationId ? [{key: 'message' as const, label: 'Message', primary: false}] : [])]
        : [...(target.needsRelease ? [{key: 'release' as const, label: 'Release it', primary: true}] : []), ...(target.conversationId ? [{key: 'message' as const, label: 'Message', primary: false}] : [])];
      return {...common, subtitle: role === 'tenant' ? `${other} · ${range}` : `${other} · setup cancelled`, note: cancelledLine(role, target.needsRelease, range), prompt: null, buttons,
        conversationId: target.conversationId, reservationId: target.reservation?.id ?? null, similar: property ? {city: property.city, type: property.type} : null};
    }
    const review = i.activity.reviews[t.id], screen = review ? reviewScreenFor(review, i.actor) : null;
    const rated = screen?.own ? `Rated ${screen.own.rating.toFixed(1)} · ${range}` : null;
    const prompt = screen?.state === 'form'
      ? {title: role === 'tenant' ? `Rate ${title}` : `Rate ${other}`, body: role === 'tenant' ? 'Your rating helps the next renter. Takes under a minute.' : 'Your rating helps other landlords. Takes under a minute.', button: role === 'tenant' ? 'Rate your stay' : 'Rate your tenant'}
      : null;
    return {...common, subtitle: rated ?? `${other} · ${range}`, note: null, prompt, conversationId: t.conversation_id || null, reservationId: null, similar: null,
      buttons: prompt ? [{key: 'rate', label: prompt.button, primary: true}, {key: 'view', label: 'View', primary: false}] : screen?.own ? [{key: 'rate', label: 'Your review', primary: false}, {key: 'view', label: 'View', primary: false}] : [{key: 'view', label: 'View', primary: false}]};
  });
  const needsOk = items.filter(x => x.role === 'tenant'), attention = items.filter(x => x.role === 'landlord');
  return {
    order: ['attention', 'active', 'upcoming', 'past'],
    tiles: [{kind: 'upcoming', count: counts.upcoming}, {kind: 'active', count: counts.active}, {kind: 'past', count: counts.past}],
    needsOk, attention,
    activeTitle: active.length === 1 && active.every(a => a.role === 'tenant') ? 'Active stay' : 'Active stays',
    active, upcoming, past,
  };
}
