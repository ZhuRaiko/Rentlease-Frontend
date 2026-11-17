import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getSupabaseClient } from '../shared/services/supabase/client';
import { createRentalReviewService } from '../shared/services/rentalReviewService';
import { usePublicIdentitiesViewModel } from '../shared/viewModels/usePublicIdentitiesViewModel';
import { createLandlordTenanciesService } from '../features/tenancy/services/landlordTenanciesService';
import { createTenancyCareService } from '../features/tenancy/services/tenancyCareService';
import type { InboxRow } from '../features/tenancy/models/Maintenance';
import { propertyMaintenance } from '../features/tenancy/models/MaintenanceInbox';
import { createTenancyActivityService, emptyActivity, type TenancyActivity } from '../features/tenancy/services/tenancyActivityService';
import { createRentLedgerService } from '../features/tenancy/services/rentLedgerService';
import { rentErrorText } from '../features/tenancy/models/RentLedger';
import { nextScheduledRentDate } from '../features/tenancy/models/TenancyWorkspace';
import type { RentalRelationship } from '../features/tenancy/models/TenancyWorkspace';
import { effectiveReservationStatus } from '../features/messaging-viewing/models/RentalReservation';
import { reservationService, messageId } from '../features/messaging-viewing/services/messagingDependencies';
import { scopedReservationService } from '../features/messaging-viewing/services/requestScope';
import { createReservationWorkflow } from '../features/messaging-viewing/viewModels/reservationWorkflow';
import type { useRequestSnapshot } from '../features/messaging-viewing/viewModels/useRequestSnapshot';
import { beginManagementRefresh, failManagementRefresh, readManagementFacts, seedManagement, type ManagementData, type ManagementState } from './managementRead';
import { createAccountCache } from '../shared/utils/accountCache';
import { emptyFacts, type ManagedFacts, type NeedsTarget, type PropertyManagementPort } from '../features/property-listing/models/PropertyManagement';
import type { LandlordPortfolioItem } from '../features/property-listing/models/LandlordPortfolio';

const activityService = createTenancyActivityService(getSupabaseClient);
const tenancyService = createLandlordTenanciesService(getSupabaseClient);
const rentService = createRentLedgerService(getSupabaseClient);
const reviewService = createRentalReviewService(getSupabaseClient);
const careService = createTenancyCareService(getSupabaseClient);
/** The last Manage facts per signed-in user (memory only); emptied on sign-out, account switch and every write. */
const managementCache = createAccountCache<ManagementData<RentalRelationship, TenancyActivity, InboxRow[]>>();
/** The landlord's whole maintenance inbox, page by page (20 per page, at most 25 pages), the same read the inbox screen uses. */
async function readInbox(actor: string, signal: AbortSignal): Promise<InboxRow[]> {
  let rows: InboxRow[] = [];
  for (let page = 0; page < 25; page++) {
    const read = await careService.inbox(actor, page * 20, signal);
    const seen = new Set(rows.map(r => r.id));
    rows = [...rows, ...read.rows.filter(r => !seen.has(r.id))];
    if (!read.hasMore) break;
  }
  return rows;
}

export interface PropertyManagementNavigation {
  openTenancy: (open: { tenancyId?: string; panel?: 'care' | 'lifecycle' | 'reviews' | 'rent' | 'extension'; requestId?: string }) => void;
  message: (conversationId: string) => void;
}

/**
 * Composes the facts the My properties overview and Manage screens show, using only reads that already exist: the landlord's own
 * open tenancies, get_tenancy_care, get_tenancy_lifecycle, get_published_rental_reviews and the reservation snapshot the root already
 * holds. A failed read leaves its fact empty (hidden), never a guessed value. Account-scoped; an account change drops everything.
 */
export function usePropertyManagement(accountId: string | undefined, snapshot: ReturnType<typeof useRequestSnapshot>, navigation: PropertyManagementNavigation, openRequests: (item: LandlordPortfolioItem) => void): PropertyManagementPort {
  const [state, setState] = useState<ManagementState<RentalRelationship, TenancyActivity, InboxRow[]>>(() => seedManagement(accountId, managementCache.peek(accountId), emptyActivity));
  const [reviews, setReviews] = useState<{ owner: string | undefined; byProperty: Record<string, { average: number; count: number } | null> }>({ owner: undefined, byProperty: {} });
  const [revision, setRevision] = useState(0);
  const requested = useRef(new Set<string>());
  useEffect(() => {
    const c = new AbortController();
    setState(prev => beginManagementRefresh(prev, accountId, managementCache.peek(accountId), emptyActivity));
    requested.current = new Set(); setReviews({ owner: accountId, byProperty: {} });
    if (!accountId) return () => c.abort();
    (async () => {
      const token = managementCache.begin();
      try {
        const { tenancies, activity, inbox } = await readManagementFacts({
          tenancies: () => tenancyService.open(accountId, c.signal),
          activity: rows => activityService.read(accountId, rows, c.signal),
          inbox: () => readInbox(accountId, c.signal),
        });
        if (!c.signal.aborted) { setState({ owner: accountId, tenancies, activity, inbox, loaded: true, busy: false, error: null }); managementCache.set(accountId, { tenancies, activity, inbox }, token); }
      } catch {
        if (!c.signal.aborted) setState(prev => failManagementRefresh(prev, accountId, 'Tenant and maintenance details could not load. Pull to refresh to retry.', emptyActivity));
      }
    })();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') setRevision(v => v + 1); });
    return () => { c.abort(); sub.remove(); };
  }, [accountId, revision]);
  const current = state.owner === accountId ? state : seedManagement(accountId, managementCache.peek(accountId), emptyActivity);
  const reservations = snapshot.owner === accountId ? snapshot.reservations.filter(r => r.landlordId === accountId && effectiveReservationStatus(r, snapshot.now) === 'pending') : [];
  const identities = usePublicIdentitiesViewModel(accountId, [...current.tenancies.map(t => t.tenant_id), ...reservations.map(r => r.tenantId)]);
  const facts = useMemo(() => {
    const out: Record<string, ManagedFacts> = {};
    const of = (propertyId: string) => out[propertyId] ??= emptyFacts();
    for (const t of current.tenancies) {
      const f = of(t.property_id);
      if (t.status === 'active' && !f.stay) {
        const lifecycle = current.activity.lifecycle[t.id];
        f.stay = { tenancyId: t.id, tenantId: t.tenant_id, tenantName: identities[t.tenant_id]?.nickname ?? null, startDate: t.start_date, endDate: t.actual_end_date ?? t.expected_end_date, rent: t.agreed_monthly_rent ?? null, nextDue: nextScheduledRentDate(t), conversationId: t.conversation_id };
        if (current.inbox) f.maintenance = propertyMaintenance(current.inbox, t.property_id);
        const extension = current.activity.extensions?.find(x => x.tenancyId === t.id);
        f.extension = extension ? { tenancyId: t.id, requestedEndDate: extension.requestedEndDate, currentEndDate: extension.currentEndDate } : null;
        f.endRequest = lifecycle?.pending ? { tenancyId: t.id, fromTenant: lifecycle.pending.initiatorId === t.tenant_id } : null;
        const ledger = current.activity.rent[t.id], waiting = ledger?.awaiting ? ledger.rows.find(r => r.dueDate === ledger.awaiting!.dueDate) : undefined;
        f.rentAwaiting = ledger?.awaiting && waiting ? { tenancyId: t.id, dueDate: ledger.awaiting.dueDate, revision: ledger.awaiting.revision, paidAt: waiting.tenantMarkedPaidAt } : null;
      } else if (t.status !== 'active' && !f.setup) f.setup = { tenancyId: t.id };
    }
    for (const r of reservations) of(r.propertyId).reservations.push({ id: r.id, conversationId: r.conversationId, applicantId: r.tenantId, applicantName: identities[r.tenantId]?.nickname ?? null, moveInDate: r.moveInDate, endDate: r.endDate, applicantTier1: r.applicantTier1 });
    if (reviews.owner === accountId) for (const [propertyId, value] of Object.entries(reviews.byProperty)) of(propertyId).reviews = value;
    return out;
  }, [current, reservations, identities, reviews, accountId]);
  const refresh = useCallback(() => { setRevision(v => v + 1); void snapshot.refresh(); }, [snapshot.refresh]);
  const loadReviews = useCallback((propertyId: string) => {
    if (!accountId || requested.current.has(propertyId)) return;
    requested.current.add(propertyId);
    const c = new AbortController();
    void reviewService.read(accountId, { mode: 'property', id: propertyId }, 0, c.signal).then(data => {
      if (data.type === 'public') setReviews(old => old.owner === accountId ? { owner: accountId, byProperty: { ...old.byProperty, [propertyId]: { average: data.value.average ?? 0, count: data.value.count } } } : old);
    }).catch(() => { requested.current.delete(propertyId); });
  }, [accountId]);
  const decline = useCallback(async (propertyId: string, reservationId: string): Promise<string | null> => {
    const row = snapshot.reservations.find(r => r.id === reservationId && r.propertyId === propertyId && r.landlordId === accountId);
    if (!accountId || !row) return 'This request is no longer available.';
    const workflow = createReservationWorkflow(scopedReservationService(reservationService, { kind: 'property', propertyId, listingIds: [row.listingId] }, accountId), messageId);
    workflow.activate();
    try {
      await workflow.open(null);
      const found = workflow.getSnapshot().rows.find(r => r.id === reservationId);
      if (!found) return 'This request is no longer available.';
      workflow.edit(found, 'decline');
      if (!workflow.getSnapshot().editor) return 'This request can no longer be declined.';
      await workflow.submit();
      const after = workflow.getSnapshot();
      return after.editor || after.error ? (after.error ?? 'The request could not be declined. Try again.') : null;
    } finally { workflow.dispose(); }
  }, [accountId, snapshot.reservations]);
  // One tap, one operation id. A definite refusal or an unknown outcome is reported in a sentence; the ledger screen holds the full Retry flow.
  const acknowledgeRent = useCallback(async (tenancyId: string, dueDate: string, revision: string): Promise<string | null> => {
    if (!accountId) return 'Sign in again to continue.';
    const c = new AbortController();
    try { await rentService.write(accountId, { tenancyId, operationId: messageId(), action: 'acknowledge', dueDate, revision }, c.signal); refresh(); return null; }
    catch (e) { const m = rentErrorText(e); if (m.reload) refresh(); return m.message; }
  }, [accountId, refresh]);
  const openTarget = useCallback((_propertyId: string, target: NeedsTarget) => {
    if (target.kind === 'care') navigation.openTenancy({ tenancyId: target.tenancyId, panel: 'care', ...(target.requestId ? { requestId: target.requestId } : {}) });
    else if (target.kind === 'lifecycle') navigation.openTenancy({ tenancyId: target.tenancyId, panel: 'lifecycle' });
    else if (target.kind === 'rent') navigation.openTenancy({ tenancyId: target.tenancyId, panel: 'rent' });
    else if (target.kind === 'extension') navigation.openTenancy({ tenancyId: target.tenancyId, panel: 'extension' });
    else navigation.openTenancy({});
  }, [navigation.openTenancy]);
  return {
    factsOf: (propertyId: string) => facts[propertyId] ?? emptyFacts(),
    loading: current.busy, error: current.error, refresh, openTarget,
    openTenancy: (tenancyId, panel) => navigation.openTenancy({ tenancyId, ...(panel ? { panel } : {}) }),
    message: navigation.message, reviewRequests: openRequests, loadReviews, decline, acknowledgeRent,
    reviewsFor: (propertyId: string) => reviews.owner === accountId ? reviews.byProperty[propertyId] ?? null : null,
  };
}
