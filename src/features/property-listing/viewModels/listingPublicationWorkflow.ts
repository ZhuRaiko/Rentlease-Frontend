import { isLifecycleStatus } from '../models/ListingLifecycle';
import { isPropertyUuid } from '../models/DraftProperty';
import type { ListingDraftFields } from '../models/PersistedListingDraft';
import { isPublishedListing, PublicationError, publicationEligibility, publicationMessage, type PublicationListing } from '../models/ListingPublication';
import type { ListingPublicationService, PublicationContext } from '../services/listingPublicationService';
interface State { propertyId: string | null; listingId: string | null; loaded: boolean; busy: boolean; error: string | null; uncertain: boolean; status: PublicationListing['status'] | null; publishedListingId: string | null; completenessScore: number | null; publishedAt: string | null; lastConfirmed: PublicationListing | null }
const initial = (propertyId: string | null = null): State => ({ propertyId, listingId: null, loaded: false, busy: false, error: null, uncertain: false, status: null, publishedListingId: null, completenessScore: null, publishedAt: null, lastConfirmed: null });
export function createListingPublicationWorkflow(service: ListingPublicationService, onResolved: (row: PublicationListing) => void, canWrite = () => true) {
  let state = initial(), generation = 0, disposed = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (g: number) => !disposed && generation === g;
  const fail = (g: number, error: unknown) => {
    if (!alive(g)) return;
    if ((error as { kind?: string })?.kind === 'identity') { generation++; update({ ...initial(), error: 'Your account or listing access changed. Reopen the workspace.' }); }
    else update({ error: publicationMessage(error), ...((error as { kind?: string })?.kind === 'uncertain' ? { uncertain: true } : {}) });
  };
  const accept = (row: PublicationListing) => {
    if (row.status === 'active' && !isPublishedListing(row)) throw new PublicationError('Published state could not be verified. Check status again.', 'uncertain');
    if (!isLifecycleStatus(row.status)) { update({ listingId: row.id, status: row.status, uncertain: true, loaded: true }); throw new PublicationError('This listing has a different backend status. Further changes are unavailable in this phase.', 'uncertain'); }
    onResolved(row);
    update({ listingId: row.id, status: row.status, lastConfirmed: row, loaded: true, uncertain: false, publishedListingId: row.status === 'active' ? row.id : null, completenessScore: row.completeness_score, publishedAt: row.published_at });
  };
  const restore = async () => {
    if (disposed || state.busy || !state.propertyId) return false;
    const g = generation; update({ busy: true, error: null });
    try {
      const result = await service.restore(state.propertyId); if (!alive(g)) return false;
      if (!result) { update({ loaded: true }); return true; }
      if (result.pending) { update({ loaded: true, listingId: result.row.id, status: result.row.status, uncertain: true, error: 'A previous publication needs checking before further changes.' }); return false; }
      accept(result.row); return true;
    } catch (error) { fail(g, error); return false; }
    finally { if (alive(g)) update({ busy: false }); }
  };
  return {
    getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; }, dispose() { disposed = true; generation++; state = initial(); listeners.clear(); },
    setProperty(id: string | null) { if (id === state.propertyId) return; generation++; update(initial(isPropertyUuid(id) ? id : null)); },
    setDraft(row: PublicationListing) { if (!disposed && !state.busy && !state.uncertain && (!state.status || state.status === 'draft') && row.status === 'draft' && row.property_id === state.propertyId) update({ listingId: row.id, status: 'draft', lastConfirmed: row }); },
    adoptLifecycle(row: PublicationListing) { if (!disposed && !state.busy && !state.uncertain && row.property_id === state.propertyId) accept(row); },
    report(message: string) { if (!state.busy) update({ error: message }); },
    restore,
    async publish(row: PublicationListing | null, form: ListingDraftFields, uncertainSave: boolean) {
      if (disposed || state.busy || state.uncertain || (!!state.status && state.status !== 'draft') || !canWrite()) return false;
      const error = publicationEligibility(state.propertyId, row, form, uncertainSave);
      if (error) { update({ error }); return false; }
      if (!state.loaded || !row || !state.propertyId) { update({ error: 'Check the current listing before publishing.' }); return false; }
      const g = generation; update({ busy: true, error: null });
      let context: PublicationContext | null = null;
      try {
        context = await service.context(state.propertyId, row.id); if (!alive(g)) return false;
        const result = await service.publish(context, { ...form }); await service.assertContext(context); if (!alive(g)) return false;
        accept(result); return true;
      } catch (error) {
        if (alive(g) && context) { try { await service.assertContext(context); } catch (changed) { fail(g, changed); } }
        fail(g, error); return false;
      } finally { if (alive(g)) update({ busy: false }); }
    },
    async reconcile() {
      if (disposed || state.busy || !state.propertyId || !state.listingId) return false;
      const g = generation; update({ busy: true, error: null });
      try {
        const c = await service.context(state.propertyId, state.listingId); if (!alive(g)) return false;
        const row = await service.reconcile(c); await service.assertContext(c); if (!alive(g)) return false;
        accept(row); if (row.status === 'draft') update({ error: 'The listing is still a draft; publication is not confirmed. Review it and explicitly confirm again when ready.' }); return true;
      } catch (error) { fail(g, error); return false; }
      finally { if (alive(g)) update({ busy: false }); }
    },
  };
}
