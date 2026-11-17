import { filterPortfolio, filterPortfolioByStatus, portfolioFilterCounts, PortfolioError, type LandlordPortfolioItem, type PortfolioFilter } from '../models/LandlordPortfolio';
import type { LandlordPortfolioService } from '../services/landlordPortfolioService';
import type { AccountCache } from '../../../shared/utils/accountCache';
/** The last result per signed-in user (memory only). `owner` is the signed-in user id the screen already knows. */
export interface PortfolioCache { store: AccountCache<LandlordPortfolioItem[]>; owner: string | undefined }
const initial = () => ({ items: [] as LandlordPortfolioItem[], loaded: false, busy: false, refreshing: false, error: null as string | null, /** A background refresh failed while the list is on screen: the list stays, the screen shows a quiet retry. */ refreshError: null as string | null, query: '', filter: 'all' as PortfolioFilter, selectedPropertyId: null as string | null, selectedListingId: null as string | null });
export function createLandlordPortfolioWorkflow(service: LandlordPortfolioService, cache?: PortfolioCache) {
  // A cached result for this user is on screen at once; the identity check inside load() still runs before it is replaced.
  const cached = cache?.owner ? cache.store.peek(cache.owner) : null;
  let state = cached ? { ...initial(), items: cached, loaded: true } : initial(), generation = 0, disposed = false, owner: string | null = cached && cache?.owner ? cache.owner : null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<typeof state>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (g: number) => !disposed && generation === g;
  return {
    getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; }, dispose() { disposed = true; generation++; state = initial(); owner = null; listeners.clear(); },
    invalidate() { generation++; owner = null; cache?.store.clear(); update(initial()); },
    /** After the user's own delete: the item leaves the list at once, then the list is read again in the background. A failed read keeps the list. */
    remove(propertyId: string) {
      generation++; cache?.store.clear();
      const items = state.items.filter(i => i.propertyId !== propertyId);
      update({ items, busy: false, refreshing: false, refreshError: null, ...(state.selectedPropertyId === propertyId ? { selectedPropertyId: null, selectedListingId: null } : {}) });
      return this.load();
    },
    setQuery(query: string) { update({ query }); },
    setFilter(filter: PortfolioFilter) { update({ filter }); },
    select(propertyId: string) { const item = state.items.find(i => i.propertyId === propertyId); if (item) update({ selectedPropertyId: propertyId, selectedListingId: item.currentListing?.id ?? null }); return item ?? null; },
    filtered: () => filterPortfolio(filterPortfolioByStatus(state.items, state.filter), state.query), filterCounts: () => portfolioFilterCounts(state.items),
    async load() {
      if (disposed || state.busy) return;
      const g = generation, token = cache?.store.begin() ?? 0; update({ busy: true, refreshing: state.loaded, error: null, refreshError: null });
      try {
        const next = await service.user(); if (!alive(g)) return;
        if (owner && owner !== next) { owner = null; generation++; update({ ...initial(), error: 'Your account changed. Reload My Rentals.' }); return; }
        owner = next;
        const items = await service.load(next); await service.assertUser(next); if (!alive(g)) return;
        update({ items, loaded: true, refreshError: null }); cache?.store.set(next, items, token);
      } catch (error) {
        if (!alive(g)) return;
        if (error instanceof PortfolioError && error.identity) { owner = null; generation++; update({ ...initial(), error: error.message }); }
        else if (state.loaded) update({ refreshError: error instanceof PortfolioError ? error.message : 'Could not refresh your properties.' });
        else update({ error: error instanceof PortfolioError ? error.message : 'Could not load your properties. Check your connection and try again.' });
      } finally { if (alive(g)) update({ busy: false, refreshing: false }); }
    },
  };
}
