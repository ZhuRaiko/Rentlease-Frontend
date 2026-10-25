import { hasListingMinimum, ListingDraftError, listingDraftMessage, listingDraftValidation, type ListingDraftFields, type SavedListingDraft } from '../models/PersistedListingDraft';
import type { ListingDraftContext, ListingDraftService } from '../services/listingDraftService';
import { isPropertyUuid } from '../models/DraftProperty';
interface State { propertyId: string | null; listingId: string | null; loaded: boolean; busy: boolean; error: string | null; uncertain: boolean; lastConfirmed: SavedListingDraft | null; notice: string | null }
const initial = (propertyId: string | null = null): State => ({ propertyId, listingId: null, loaded: false, busy: false, error: null, uncertain: false, lastConfirmed: null, notice: null });
export function createListingDraftWorkflow(service: ListingDraftService, onConfirmed: (row: SavedListingDraft) => void) {
  let state = initial(), generation = 0, disposed = false, context: ListingDraftContext | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (g: number) => !disposed && generation === g;
  const identity = async (g: number) => {
    if (!alive(g) || !context) throw new Error('Closed');
    await service.assertContext(context); if (!alive(g)) throw new Error('Closed'); return context;
  };
  const fail = (g: number, error: unknown) => {
    if (!alive(g)) return;
    if (error instanceof ListingDraftError && error.kind === 'identity') { generation++; context = null; update({ ...initial(), error: listingDraftMessage(error) }); }
    else update({ error: listingDraftMessage(error), ...(error instanceof ListingDraftError && error.kind === 'uncertain' ? { uncertain: true } : {}) });
  };
  const accept = (row: SavedListingDraft) => { onConfirmed(row); update({ listingId: row.id, lastConfirmed: row, loaded: true }); };
  const load = async (reconcile = false) => {
    if (disposed || state.busy || !state.propertyId) return false;
    if (state.lastConfirmed && state.lastConfirmed.status !== 'draft') return true;
    const g = generation; update({ busy: true, error: null, notice: null });
    try {
      const next = await service.context(state.propertyId); if (!alive(g)) return false;
      if (context && context.userId !== next.userId) throw new ListingDraftError('Your account changed. Reopen the listing.', 'identity');
      context = next;
      const pending = await service.hasPending(next); await identity(g);
      if ((pending || state.uncertain) && !reconcile) { update({ loaded: true, uncertain: true, error: 'A previous save needs checking. Load the current backend draft before another save.' }); return false; }
      const row = reconcile ? await service.reconcile(next) : await service.read(next); await identity(g);
      if (row) accept(row); else update({ loaded: true });
      update({ uncertain: false, notice: reconcile ? 'Current backend draft loaded. Review it before saving again; this does not prove the earlier save applied.' : null }); return true;
    } catch (error) { fail(g, error); return false; }
    finally { if (alive(g)) update({ busy: false }); }
  };
  return {
    getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; }, dispose() { disposed = true; generation++; context = null; state = initial(); listeners.clear(); },
    setProperty(id: string | null) { if (state.propertyId === id) return; generation++; context = null; update(initial(isPropertyUuid(id) ? id : null)); },
    adoptBackendListing(row: SavedListingDraft) {
      if (disposed || row.property_id !== state.propertyId || !['draft', 'active'].includes(row.status)) return;
      accept(row); update({ uncertain: false, error: null, notice: null });
    },
    load, reconcile: () => load(true),
    clearNotice() { if (!state.busy) update({ notice: null, error: null }); },
    async save(form: ListingDraftFields): Promise<'local' | 'saved' | 'blocked'> {
      if (disposed || state.busy || state.uncertain) return 'blocked';
      if (state.lastConfirmed && state.lastConfirmed.status !== 'draft') { update({ error: 'This listing is published. Draft saving is unavailable.' }); return 'blocked'; }
      if (!hasListingMinimum(state.propertyId, form)) { update({ notice: 'Progress is local to this session, not saved to your account. A saved property, title, description and positive monthly rent are required.' }); return 'local'; }
      const error = listingDraftValidation(state.propertyId, form); if (error) { update({ error, notice: null }); return 'blocked'; }
      if (!state.loaded || !context) { update({ error: 'Load the current property draft before saving.' }); return 'blocked'; }
      const g = generation; update({ busy: true, error: null, notice: null });
      try { const c = await identity(g); const row = await service.save(c, { ...form }); await identity(g); accept(row); update({ notice: 'Listing draft saved to your account. It is not published.' }); return 'saved'; }
      catch (error) { if (alive(g)) { try { await identity(g); } catch (changed) { fail(g, changed); } fail(g, error); } return 'blocked'; }
      finally { if (alive(g)) update({ busy: false }); }
    },
  };
}
