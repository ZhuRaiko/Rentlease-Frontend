import { validateCoordinates, validateRadiusKm, type SearchOptions } from '@rentlease/gps-local';
import { GpsError, gpsErrorMessages, type Coordinates, type GpsProximityState, type RpcNearbyListing } from '../models/GpsProximity';
import type { DeviceLocationResult } from '../../../shared/services/location/deviceLocationAdapter';

export interface GpsProximityDependencies {
  user(): Promise<string>;
  locate(signal?: AbortSignal): Promise<DeviceLocationResult>;
  search(owner: string, options: SearchOptions, signal?: AbortSignal): Promise<readonly RpcNearbyListing[]>;
  settings(): Promise<void>;
}
const initial = (): GpsProximityState => ({ phase: 'idle', radiusKm: 3, rows: [], loadingMore: false, hasMore: false, error: null });
export function createGpsProximityWorkflow(deps: GpsProximityDependencies) {
  let state = initial(), generation = 0, disposed = false, nextOffset = 0;
  let coordinates: Coordinates | null = null, owner: string | null = null;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<GpsProximityState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (g: number) => !disposed && generation === g;
  const invalidate = () => { generation++; controller?.abort(); controller = null; };
  const fail = (error: unknown) => {
    const safe = error instanceof GpsError ? error : new GpsError('network', gpsErrorMessages.network);
    if (safe.kind === 'identity') { coordinates = null; owner = null; nextOffset = 0; }
    update({ phase: 'error', loadingMore: false, ...(safe.kind === 'identity' || safe.kind === 'eligibility' ? { rows: [], hasMore: false } : {}), error: { kind: safe.kind, message: safe.message } });
  };
  const assertIdentity = async (expected: string) => { if (await deps.user() !== expected) throw new GpsError('identity', gpsErrorMessages.identity); };
  const search = async (append = false) => {
    if (!coordinates || !owner || disposed) return;
    invalidate(); const g = generation; controller = new AbortController();
    const point = coordinates, expected = owner, offset = append ? nextOffset : 0;
    if (!append) nextOffset = 0;
    update({ phase: append ? 'success' : 'searching', rows: append ? state.rows : [], loadingMore: append, hasMore: append ? state.hasMore : false, error: null });
    try {
      await assertIdentity(expected); if (!alive(g)) return;
      const page = await deps.search(expected, { ...point, radiusKm: state.radiusKm, limit: 20, offset }, controller.signal);
      await assertIdentity(expected); if (!alive(g)) return;
      const rows = append ? [...state.rows] : [];
      const ids = new Set(rows.map(row => row.listingId.toLowerCase()));
      for (const row of page) if (!ids.has(row.listingId.toLowerCase())) { rows.push(row); ids.add(row.listingId.toLowerCase()); }
      nextOffset = offset + page.length;
      update({ rows, phase: 'success', loadingMore: false, hasMore: page.length === 20 && nextOffset <= 1000 });
    } catch (error) { if (alive(g)) fail(error); }
  };
  const start = async () => {
    if (disposed || state.phase === 'locating' || state.phase === 'searching' || state.loadingMore) return;
    invalidate(); const g = generation; controller = new AbortController();
    coordinates = null; owner = null; nextOffset = 0;
    update({ phase: 'locating', rows: [], hasMore: false, loadingMore: false, error: null });
    try {
      const expected = await deps.user(); if (!alive(g)) return;
      const position = await deps.locate(controller.signal); if (!alive(g)) return;
      if (position.kind === 'cancelled') { update({ phase: 'idle' }); return; }
      if (position.kind !== 'granted') throw new GpsError(position.kind, gpsErrorMessages[position.kind]);
      await assertIdentity(expected); if (!alive(g)) return;
      coordinates = validateCoordinates(position.coordinates); owner = expected;
      await search();
    } catch (error) { if (alive(g)) fail(error); }
  };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; },
    reset() { invalidate(); coordinates = null; owner = null; nextOffset = 0; update(initial()); },
    dispose() { invalidate(); coordinates = null; owner = null; nextOffset = 0; state = initial(); disposed = true; listeners.clear(); },
    start,
    async setRadius(value: unknown) { const radiusKm = validateRadiusKm(value); if (disposed) return; update({ radiusKm }); if (coordinates) await search(); },
    async loadMore() { if (state.phase !== 'success' || state.loadingMore || !state.hasMore) return; await search(true); },
    async retry() { if (state.phase === 'locating' || state.phase === 'searching' || state.loadingMore || disposed) return; if (!coordinates) await start(); else await search(state.rows.length > 0); },
    async openSettings() { const g = generation; try { await deps.settings(); } catch { if (alive(g)) fail(new GpsError('blocked', 'Could not open Android settings. Open RentLease permissions in device settings.')); } },
  };
}
