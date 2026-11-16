import type { LandlordPortfolioItem } from './LandlordPortfolio';
import { lifecycleActions, type LifecycleOperation } from './ListingLifecycle';
import { ago, dateRange, shortDate } from '../../../shared/utils/rentalDates';

/**
 * Facts the My properties overview and the Manage screen show beyond the listing itself. The root composes them from reads that already
 * exist (tenancies, get_tenancy_care, get_tenancy_lifecycle, get_published_rental_reviews, reservations). Nothing here is invented: a
 * fact that could not be read is null/empty and the element that needs it is hidden. Views and saved counts are deliberately absent:
 * no landlord-readable source exists (listing_views has no client grant, saved listings are tenant-scoped).
 */
export interface ManagedStay { tenancyId: string; tenantId: string; tenantName: string | null; startDate: string; endDate: string | null; rent: number | null; nextDue: string | null; conversationId: string | null }
export interface ManagedMaintenance { open: number; urgent: { id: string; title: string; createdAt: string }[] }
export interface ManagedEndRequest { tenancyId: string; fromTenant: boolean }
export interface ManagedReservation { id: string; conversationId: string; applicantName: string | null; moveInDate: string; endDate: string; applicantTier1: boolean }
export interface ManagedFacts {
  stay: ManagedStay | null;
  setup: { tenancyId: string } | null;
  maintenance: ManagedMaintenance;
  endRequest: ManagedEndRequest | null;
  reviews: { average: number; count: number } | null;
  reservations: ManagedReservation[];
  /** The newest month the tenant says was paid and the landlord has not answered (from the rent ledger); null when none or the read failed. */
  rentAwaiting: { tenancyId: string; dueDate: string; revision: string; paidAt: string | null } | null;
}
export const emptyFacts = (): ManagedFacts => ({ stay: null, setup: null, maintenance: { open: 0, urgent: [] }, endRequest: null, reviews: null, reservations: [], rentAwaiting: null });

export type NeedsTone = 'danger' | 'attention';
export type NeedsTarget = { kind: 'care'; tenancyId: string } | { kind: 'lifecycle'; tenancyId: string } | { kind: 'setup'; tenancyId: string } | { kind: 'rent'; tenancyId: string } | { kind: 'requests' };
export interface NeedsItem { key: string; chip: string; tone: NeedsTone; text: string; target: NeedsTarget }

const name = (value: string | null) => value || 'The renter';
/** "2h ago" / "3d ago"; an unreadable or future timestamp reads "recently". */
export function ageText(iso: string, now = Date.now()): string {
  const at = Date.parse(iso);
  return !Number.isFinite(at) || at > now ? 'recently' : ago(iso, now);
}

/** What waits on the landlord, in a fixed order: urgent repairs, the renter's early-end request, a tenancy setup, reservation requests. */
export function needsYou(facts: ManagedFacts, now = Date.now()): NeedsItem[] {
  const items: NeedsItem[] = [];
  const tenancyId = facts.stay?.tenancyId;
  if (tenancyId) for (const request of facts.maintenance.urgent) items.push({ key: `urgent:${request.id}`, chip: 'Urgent', tone: 'danger', text: `${request.title} reported ${ageText(request.createdAt, now)}`, target: { kind: 'care', tenancyId } });
  if (facts.endRequest?.fromTenant) items.push({ key: `end:${facts.endRequest.tenancyId}`, chip: 'Reply', tone: 'attention', text: `${name(facts.stay?.tenantName ?? null)}'s early-end request`, target: { kind: 'lifecycle', tenancyId: facts.endRequest.tenancyId } });
  if (facts.rentAwaiting && facts.stay) items.push({ key: `rent:${facts.rentAwaiting.tenancyId}:${facts.rentAwaiting.dueDate}`, chip: 'Confirm', tone: 'attention', text: `${name(facts.stay.tenantName)} says rent for ${shortDate(facts.rentAwaiting.dueDate).split(' ')[0]} was paid`, target: { kind: 'rent', tenancyId: facts.rentAwaiting.tenancyId } });
  if (facts.setup) items.push({ key: `setup:${facts.setup.tenancyId}`, chip: 'Setup', tone: 'attention', text: 'Tenancy setup is waiting for confirmation', target: { kind: 'setup', tenancyId: facts.setup.tenancyId } });
  for (const r of facts.reservations) items.push({ key: `reservation:${r.id}`, chip: 'Request', tone: 'attention', text: `${name(r.applicantName)} asked to reserve`, target: { kind: 'requests' } });
  return items;
}

/** Occupied is the listing the tenancy sync marked rented; the filter chip, the summary tile and this check always agree. */
export const isOccupied = (item: LandlordPortfolioItem) => item.currentListing?.status === 'rented';
export const isListed = (item: LandlordPortfolioItem) => item.currentListing?.status === 'active';

export interface PortfolioSummary { occupied: number; vacant: number; needYou: number }
export function portfolioSummary(items: readonly LandlordPortfolioItem[], factsOf: (propertyId: string) => ManagedFacts | undefined, now = Date.now()): PortfolioSummary {
  return {
    occupied: items.filter(isOccupied).length,
    vacant: items.filter(isListed).length,
    needYou: items.reduce((sum, item) => sum + needsYou(factsOf(item.propertyId) ?? emptyFacts(), now).length, 0),
  };
}

export interface CardChip { label: string; tone: 'attention' | 'info' | 'neutral' }
/** The one line that matters on a card: tenant and next rent when occupied. Listed cards use the price on the card itself. */
export function cardLine(item: LandlordPortfolioItem, facts: ManagedFacts): string | null {
  if (!isOccupied(item) || !facts.stay) return null;
  const parts = [facts.stay.tenantName || 'Tenant'];
  if (facts.stay.nextDue) parts.push(`rent due ${shortDate(facts.stay.nextDue)}`);
  return parts.join(' · ');
}
export function cardChips(item: LandlordPortfolioItem, facts: ManagedFacts): CardChip[] {
  const chips: CardChip[] = [];
  if (isOccupied(item)) {
    if (facts.maintenance.open > 0) chips.push({ label: `${facts.maintenance.open} maintenance`, tone: 'attention' });
    if (facts.endRequest) chips.push({ label: 'Ending request', tone: 'attention' });
  }
  if (facts.reservations.length > 0) chips.push({ label: `${facts.reservations.length} reservation request${facts.reservations.length === 1 ? '' : 's'}`, tone: 'attention' });
  return chips;
}

/** The recorded stay as real dates, "Nov 12 – Dec 12"; "From Nov 12" without a recorded end. */
export const stayDates = (stay: ManagedStay): string => dateRange(stay.startDate, stay.endDate);

export type SegmentKey = 'listed' | 'paused' | 'archived';
export interface LifecycleSegment { key: SegmentKey; label: string; selected: boolean; operation: LifecycleOperation | null; reason: string | null }
const SEGMENT_STATUS: Record<SegmentKey, string> = { listed: 'active', paused: 'paused', archived: 'archived' };
/**
 * Listed / Paused / Archived as one control. The existing lifecycleActions rules decide what a tap does: active -> pause or archive,
 * paused -> reactivate or archive; every other status offers nothing. A segment with no action is disabled with one line saying why.
 */
export function lifecycleSegments(status: Parameters<typeof lifecycleActions>[0], occupied: boolean): { segments: LifecycleSegment[]; reason: string | null } {
  const actions = lifecycleActions(status);
  const op = (key: SegmentKey): LifecycleOperation | null => key === 'listed' ? (actions.includes('reactivate') ? 'reactivate' : null) : key === 'paused' ? (actions.includes('pause') ? 'pause' : null) : (actions.includes('archive') ? 'archive' : null);
  const reason = occupied || status === 'rented' ? 'Pause and archive are unavailable while a tenancy is active.'
    : status === 'archived' ? 'Archived listings stay archived. Create a new listing from My properties.'
    : status === 'removed' ? 'This listing was removed from RentLease.'
    : status === 'draft' ? 'Publish this draft to manage its status.'
    : null;
  const segments = (['listed', 'paused', 'archived'] as const).map(key => ({ key, label: key === 'listed' ? 'Listed' : key === 'paused' ? 'Paused' : 'Archived', selected: SEGMENT_STATUS[key] === status, operation: reason ? null : op(key), reason: null }));
  return { segments, reason };
}
export const PAUSED_HINT = 'Paused listings are hidden from search. Existing requests stay.';

/** Properties with something waiting on the landlord (the "Need you" tile filter). */
export function onlyNeedingYou(items: readonly LandlordPortfolioItem[], factsOf: (propertyId: string) => ManagedFacts | undefined, now = Date.now()): LandlordPortfolioItem[] {
  return items.filter(item => needsYou(factsOf(item.propertyId) ?? emptyFacts(), now).length > 0);
}
export const itemFor = (items: readonly LandlordPortfolioItem[], propertyId: string | null | undefined): LandlordPortfolioItem | null => items.find(i => i.propertyId === propertyId) ?? null;

/** The one status chip on a card and on the Manage header. Palette: green active, blue vacant, amber needs someone, grey over, red removed. */
export type PillTone = 'positive' | 'info' | 'attention' | 'neutral' | 'danger';
export function managementPill(item: LandlordPortfolioItem): { label: string; tone: PillTone } {
  switch (item.currentListing?.status) {
    case 'rented': return { label: 'Occupied', tone: 'positive' };
    case 'active': return { label: 'Listed', tone: 'info' };
    case 'paused': return { label: 'Paused', tone: 'attention' };
    case 'archived': return { label: 'Archived', tone: 'neutral' };
    case 'removed': return { label: 'Removed', tone: 'danger' };
    case 'draft': return { label: 'Draft', tone: 'neutral' };
    default: return { label: 'No listing yet', tone: 'neutral' };
  }
}
/** "Draft · 85% complete" from the listing's own completeness score; null unless the current listing is a draft. */
export function draftLine(item: LandlordPortfolioItem): string | null {
  const listing = item.currentListing;
  return listing?.status === 'draft' ? `Draft · ${Math.round((listing.completeness_score ?? 0) * 100)}% complete` : null;
}
/** A saved draft listing. A property with no listing at all is not a draft: it shows "No listing yet" and Create listing. */
export const isDraftCard = (item: LandlordPortfolioItem): boolean => item.currentListing?.status === 'draft';
export const isUnlisted = (item: LandlordPortfolioItem): boolean => !item.currentListing;
export const NO_LISTING_LINE = 'Add a listing to start renting this place.';

/**
 * Everything the root composes for the management screens. The feature never imports messaging or tenancy ViewModels; App supplies this.
 * `factsOf` is the same snapshot the overview uses, so a card and its Manage screen can never disagree.
 */
export interface PropertyManagementPort {
  factsOf: (propertyId: string) => ManagedFacts;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Opens the existing screen a "Needs you" row points at (care and lifecycle panels, tenancy setup, the property's requests). */
  openTarget: (propertyId: string, target: NeedsTarget) => void;
  openTenancy: (tenancyId: string, panel?: 'care' | 'lifecycle' | 'reviews' | 'rent') => void;
  /** "Mark received" for the month the tenant says was paid. Resolves null on success, otherwise one sentence. */
  acknowledgeRent: (tenancyId: string, dueDate: string, revision: string) => Promise<string | null>;
  message: (conversationId: string) => void;
  reviewRequests: (item: LandlordPortfolioItem) => void;
  /** Starts the one review read for a property; the result appears through reviewsFor. Safe to call repeatedly. */
  loadReviews: (propertyId: string) => void;
  /** The existing decline action. Resolves null on success, otherwise one sentence for the landlord. */
  decline: (propertyId: string, reservationId: string) => Promise<string | null>;
  /** Published review average and count for one property, or null when that read is unavailable. */
  reviewsFor: (propertyId: string) => { average: number; count: number } | null;
}

/**
 * Where Back from the Manage screen goes. A Manage screen opened from another screen (Tenancy's "Open property") returns there; one
 * opened from the My properties list returns to the list. The origin is 'pending' from the moment the open is requested, 'shown' once
 * any screen other than the list has appeared, and cleared when the list is shown again, so opening a property from the list later
 * never returns to the old origin.
 */
export type ManageOrigin = 'none' | 'pending' | 'shown';
export type ManageBack = 'origin' | 'list';
const isList = (screen: string) => screen === 'dashboard' || screen === 'empty';
export function nextOrigin(origin: ManageOrigin, screen: string): ManageOrigin {
  if (origin === 'none') return 'none';
  if (origin === 'pending') return isList(screen) ? 'pending' : 'shown';
  return isList(screen) ? 'none' : 'shown';
}
export function manageBack(origin: ManageOrigin, screen: string): ManageBack { return origin !== 'none' && screen === 'published' ? 'origin' : 'list'; }
