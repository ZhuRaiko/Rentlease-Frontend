import { isPropertyUuid } from '../models/DraftProperty';
import { lifecycleActions, lifecycleMessage, type LifecycleListing, type LifecycleOperation } from '../models/ListingLifecycle';
import type { LifecycleContext, ListingLifecycleService } from '../services/listingLifecycleService';
interface State { propertyId: string | null; listingId: string | null; loaded: boolean; busy: boolean; uncertain: boolean; error: string | null; notice: string | null; row: LifecycleListing | null; confirmation: LifecycleOperation | null }
const initial = (row: LifecycleListing | null = null): State => ({ propertyId: row?.property_id ?? null, listingId: row?.id ?? null, loaded: !row, busy: false, uncertain: false, error: null, notice: null, row, confirmation: null });
export function createListingLifecycleWorkflow(service: ListingLifecycleService, onResolved: (row: LifecycleListing) => void, canOperate = () => true) {
  let state = initial(), generation = 0, disposed = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (g: number) => !disposed && generation === g;
  const fail = (g: number, error: unknown) => {
    if (!alive(g)) return;
    if ((error as { kind?: string })?.kind === 'identity') { generation++; update({ ...initial(), loaded: false, error: 'Your account or listing access changed. Reopen the workspace.' }); }
    else update({ error: lifecycleMessage(error), ...((error as { kind?: string })?.kind === 'uncertain' ? { uncertain: true } : {}) });
  };
  const accept = (row: LifecycleListing) => { onResolved(row); update({ row, loaded: true, uncertain: false, confirmation: null }); };
  const restore = async () => {
    if (disposed || state.busy || !state.propertyId || !state.listingId) return false;
    const g = generation; update({ busy: true, error: null, confirmation: null });
    try {
      const c = await service.context(state.propertyId, state.listingId); if (!alive(g)) return false;
      const result = await service.inspect(c); await service.assertContext(c); if (!alive(g)) return false;
      if (result.operations.length) { update({ row: result.row, loaded: true, uncertain: true, error: 'A previous listing change needs checking before another action.' }); return false; }
      accept(result.row); return true;
    } catch (error) { fail(g, error); return false; }
    finally { if (alive(g)) update({ busy: false }); }
  };
  return {
    getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; }, dispose() { disposed = true; generation++; state = initial(); listeners.clear(); },
    setListing(row: LifecycleListing | null) {
      if (disposed || (row && (!isPropertyUuid(row.id) || !isPropertyUuid(row.property_id)))) return;
      if (row?.id === state.listingId && row?.property_id === state.propertyId) return;
      generation++; update(initial(row));
    },
    restore,
    request(operation: LifecycleOperation) {
      if (disposed || state.busy || state.uncertain || !state.loaded || !state.row || !canOperate() || !lifecycleActions(state.row.status).includes(operation)) return false;
      update({ confirmation: operation, error: null, notice: null }); return true;
    },
    cancel() { if (!disposed && !state.busy) update({ confirmation: null }); },
    async confirm() {
      const operation = state.confirmation;
      if (disposed || state.busy || state.uncertain || !state.loaded || !state.row || !operation || !canOperate()) return false;
      const before = state.row, g = generation; update({ busy: true, confirmation: null, error: null, notice: null });
      let c: LifecycleContext | null = null;
      try {
        c = await service.context(before.property_id, before.id); if (!alive(g)) return false;
        const row = await service.mutate(c, operation, before.status); await service.assertContext(c); if (!alive(g)) return false;
        accept(row); update({ notice: 'Listing status confirmed by RentLease.' }); return true;
      } catch (error) {
        if (alive(g) && c) { try { await service.assertContext(c); } catch (changed) { fail(g, changed); } }
        fail(g, error); return false;
      } finally { if (alive(g)) update({ busy: false }); }
    },
    async reconcile() {
      if (disposed || state.busy || !state.propertyId || !state.listingId || !canOperate()) return false;
      const g = generation; update({ busy: true, error: null, confirmation: null });
      try {
        const c = await service.context(state.propertyId, state.listingId); if (!alive(g)) return false;
        const row = await service.reconcile(c); await service.assertContext(c); if (!alive(g)) return false;
        accept(row); update({ notice: 'Current listing status loaded. No action was retried; review the status before choosing another action.' }); return true;
      } catch (error) { fail(g, error); return false; }
      finally { if (alive(g)) update({ busy: false }); }
    },
  };
}
