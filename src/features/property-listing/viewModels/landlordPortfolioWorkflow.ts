import { currentPortfolioListing, filterPortfolio, filterPortfolioByStatus, portfolioFilterCounts, PortfolioError, type LandlordPortfolioItem, type PortfolioFilter, type PortfolioListing } from '../models/LandlordPortfolio';
import type { LandlordPortfolioService } from '../services/landlordPortfolioService';
import type { AccountCache } from '../../../shared/utils/accountCache';
/** The last result per signed-in user (memory only). `owner` is the signed-in user id the screen already knows. */
export interface PortfolioCache { store: AccountCache<LandlordPortfolioItem[]>; owner: string | undefined }
const initial = () => ({ items: [] as LandlordPortfolioItem[], loaded: false, busy: false, refreshing: false, error: null as string | null, /** A background refresh failed while the list is on screen: the list stays, the screen shows a quiet retry. */ refreshError: null as string | null, /** The user's own action changed something: the list stays on screen and is read again as soon as it is showing. */ stale: false, query: '', filter: 'all' as PortfolioFilter, selectedPropertyId: null as string | null, selectedListingId: null as string | null });
/** The item with one listing updated (or added) from a confirmed backend row; the current listing is chosen again by the same rule the list uses. */
export function patchListing(item: LandlordPortfolioItem, row: { id: string; property_id: string; status: string } & Record<string, unknown>): LandlordPortfolioItem {
  const known = item.listings.some(l => l.id === row.id);
  const listings: PortfolioListing[] = known ? item.listings.map(l => { if (l.id !== row.id) return l; const next: Record<string, unknown> = { ...l }; for (const key of Object.keys(l)) if (key in row) next[key] = row[key]; return next as unknown as PortfolioListing; }) : [row as unknown as PortfolioListing, ...item.listings];
  return { ...item, listings, currentListing: currentPortfolioListing(listings) };
}
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
    /** The user's own action changed something (a save, a photo, a verification): keep the list, read it again in the background when it is showing. */
    changed() { generation++; cache?.store.clear(); update({ stale: true, busy: false, refreshing: false, refreshError: null }); },
    /** A listing was saved, published, paused, archived or relisted: that item is updated in place now, then the list is read again in the background. */
    applyListing(row: { id: string; property_id: string; status: string } & Record<string, unknown>) {
      const items = state.items.map(item => item.propertyId === row.property_id ? patchListing(item, row) : item);
      generation++; cache?.store.clear(); update({ items, stale: true, busy: false, refreshing: false, refreshError: null });
    },
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
      const g = generation, token = cache?.store.begin() ?? 0; update({ busy: true, refreshing: state.loaded, error: null, refreshError: null, stale: false });
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
