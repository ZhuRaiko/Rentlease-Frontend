import { filterPortfolio, filterPortfolioByStatus, portfolioFilterCounts, PortfolioError, type LandlordPortfolioItem, type PortfolioFilter } from '../models/LandlordPortfolio';
import type { LandlordPortfolioService } from '../services/landlordPortfolioService';
const initial = () => ({ items: [] as LandlordPortfolioItem[], loaded: false, busy: false, refreshing: false, error: null as string | null, query: '', filter: 'all' as PortfolioFilter, selectedPropertyId: null as string | null, selectedListingId: null as string | null });
export function createLandlordPortfolioWorkflow(service: LandlordPortfolioService) {
  let state = initial(), generation = 0, disposed = false, owner: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<typeof state>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (g: number) => !disposed && generation === g;
  return {
    getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; }, dispose() { disposed = true; generation++; state = initial(); owner = null; listeners.clear(); },
    invalidate() { generation++; owner = null; update(initial()); },
    setQuery(query: string) { update({ query }); },
    setFilter(filter: PortfolioFilter) { update({ filter }); },
    select(propertyId: string) { const item = state.items.find(i => i.propertyId === propertyId); if (item) update({ selectedPropertyId: propertyId, selectedListingId: item.currentListing?.id ?? null }); return item ?? null; },
    filtered: () => filterPortfolio(filterPortfolioByStatus(state.items, state.filter), state.query), filterCounts: () => portfolioFilterCounts(state.items),
    async load() {
      if (disposed || state.busy) return;
      const g = generation; update({ busy: true, refreshing: state.loaded, error: null });
      try {
        const next = await service.user(); if (!alive(g)) return;
        if (owner && owner !== next) { owner = null; generation++; update({ ...initial(), error: 'Your account changed. Reload My Rentals.' }); return; }
        owner = next;
        const items = await service.load(next); await service.assertUser(next); if (!alive(g)) return;
        update({ items, loaded: true });
      } catch (error) {
        if (!alive(g)) return;
        if (error instanceof PortfolioError && error.identity) { owner = null; generation++; update({ ...initial(), error: error.message }); }
        else update({ error: error instanceof PortfolioError ? error.message : 'Could not load your properties. Check your connection and try again.' });
      } finally { if (alive(g)) update({ busy: false, refreshing: false }); }
    },
  };
}
