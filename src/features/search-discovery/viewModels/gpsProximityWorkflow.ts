import { validateCoordinates, validateRadiusKm, type SearchOptions } from '@rentlease/gps-local';
import { GpsError, gpsErrorMessages, type Coordinates, type GpsProximityState, type RpcNearbyListing } from '../models/GpsProximity';
import type { DeviceLocationResult } from '../../../shared/services/location/deviceLocationAdapter';
import {approximateSearchOrigin,type NearbyCamera} from '../models/NearbyMap';

export interface GpsProximityDependencies {
  user(): Promise<string>;
  locate(signal?: AbortSignal): Promise<DeviceLocationResult>;
  search(owner: string, options: SearchOptions, signal?: AbortSignal): Promise<readonly RpcNearbyListing[]>;
  thumbnails?(owner: string, rows: readonly RpcNearbyListing[], signal?: AbortSignal): Promise<Record<string,string>>;
  settings(): Promise<void>;
}
const initial = (): GpsProximityState => ({ presentation:'map',selectedListingId:null,approximateOrigin:null,phase: 'idle', radiusKm: 3, rows: [], loadingMore: false, hasMore: false, error: null, photoError: null });
export function createGpsProximityWorkflow(deps: GpsProximityDependencies) {
  let state = initial(), generation = 0, disposed = false, nextOffset = 0;
  let coordinates: Coordinates | null = null, owner: string | null = null;
  let savedCamera:NearbyCamera|null=null;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<GpsProximityState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (g: number) => !disposed && generation === g;
  const invalidate = () => { generation++; controller?.abort(); controller = null; };
  const fail = (error: unknown) => {
    const safe = error instanceof GpsError ? error : new GpsError('network', gpsErrorMessages.network);
    if (safe.kind === 'identity' || safe.kind==='eligibility') { coordinates = null; owner = null; savedCamera=null; nextOffset = 0; }
    update({ phase: 'error', loadingMore: false, ...(safe.kind === 'identity' || safe.kind === 'eligibility' ? { rows: [], hasMore: false,selectedListingId:null,approximateOrigin:null } : {}), error: { kind: safe.kind, message: safe.message } });
  };
  const assertIdentity = async (expected: string) => { if (await deps.user() !== expected) throw new GpsError('identity', gpsErrorMessages.identity); };
  const search = async (append = false) => {
    if (!coordinates || !owner || disposed) return;
    invalidate(); const g = generation; controller = new AbortController();
    const point = coordinates, expected = owner, offset = append ? nextOffset : 0;
    if (!append) nextOffset = 0;
    update({ phase: append ? 'success' : 'searching', rows: append ? state.rows : [], loadingMore: append, hasMore: append ? state.hasMore : false, error: null, photoError: null });
    try {
      await assertIdentity(expected); if (!alive(g)) return;
      const page = await deps.search(expected, { ...point, radiusKm: state.radiusKm, limit: 20, offset }, controller.signal);
      if (!alive(g)) return;
      let thumbnails: Record<string,string> = {}, photoError: string|null = null;
      if (page.length && deps.thumbnails) {
        try { thumbnails = await deps.thumbnails(expected,page,controller.signal); }
        catch { photoError = 'Photos could not load. Open a listing to retry its gallery.'; }
      }
      await assertIdentity(expected); if (!alive(g)) return;
      const rows = append ? [...state.rows] : [];
      const ids = new Set(rows.map(row => row.listingId.toLowerCase()));
      for (const row of page) if (!ids.has(row.listingId.toLowerCase())) { rows.push({ ...row, thumbnailUrl: thumbnails[row.propertyId] ?? null }); ids.add(row.listingId.toLowerCase()); }
      nextOffset = offset + page.length;
      update({ rows, selectedListingId:rows.some(r=>r.listingId===state.selectedListingId)?state.selectedListingId:null,phase: 'success', loadingMore: false, photoError, hasMore: page.length === 20 && nextOffset <= 1000 });
    } catch (error) { if (alive(g)) fail(error); }
  };
  const start = async () => {
    if (disposed || state.phase === 'locating' || state.phase === 'searching' || state.loadingMore) return;
    invalidate(); const g = generation; controller = new AbortController();
    coordinates = null; owner = null; savedCamera=null; nextOffset = 0;
    update({ phase: 'locating', rows: [], hasMore: false, loadingMore: false, error: null,photoError:null,selectedListingId:null,approximateOrigin:null });
    try {
      const expected = await deps.user(); if (!alive(g)) return;
      const position = await deps.locate(controller.signal); if (!alive(g)) return;
      if (position.kind === 'cancelled') { update({ phase: 'idle' }); return; }
      if (position.kind !== 'granted') throw new GpsError(position.kind, gpsErrorMessages[position.kind]);
      await assertIdentity(expected); if (!alive(g)) return;
      coordinates = validateCoordinates(position.coordinates); owner = expected;
      update({approximateOrigin:approximateSearchOrigin(coordinates)});
      await search();
    } catch (error) { if (alive(g)) fail(error); }
  };
  return {
    getSnapshot: () => state,
    getCamera: () => savedCamera,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; },
    reset() { invalidate(); coordinates = null; owner = null; savedCamera=null; nextOffset = 0; update(initial()); },
    dispose() { invalidate(); coordinates = null; owner = null; savedCamera=null; nextOffset = 0; state = initial(); disposed = true; listeners.clear(); },
    start,
    setPresentation(presentation:'map'|'list'){if(!disposed)update({presentation});},
    selectListing(id:string){if(!disposed&&state.rows.some(r=>r.listingId===id))update({selectedListingId:id});},
    clearSelection(){if(!disposed)update({selectedListingId:null});},
    setCamera(camera:NearbyCamera,radius=state.radiusKm,origin=state.approximateOrigin){if(!disposed&&origin===state.approximateOrigin&&radius===state.radiusKm&&state.approximateOrigin&&camera.center.every(Number.isFinite)&&Math.abs(camera.center[0])<=180&&Math.abs(camera.center[1])<=90&&Number.isFinite(camera.zoom)&&camera.zoom>=0&&camera.zoom<=24&&Number.isFinite(camera.bearing??0)&&Number.isFinite(camera.pitch??0))savedCamera=camera;},
    async setRadius(value: unknown) { const radiusKm = validateRadiusKm(value); if (disposed) return; savedCamera=null;update({ radiusKm,selectedListingId:null }); if (coordinates) await search(); },
    async loadMore() { if (state.phase !== 'success' || state.loadingMore || !state.hasMore) return; await search(true); },
    async retry() { if (state.phase === 'locating' || state.phase === 'searching' || state.loadingMore || disposed) return; if (!coordinates) await start(); else await search(state.rows.length > 0); },
    async openSettings() { const g = generation; try { await deps.settings(); } catch { if (alive(g)) fail(new GpsError('blocked', 'Could not open Android settings. Open RentLease permissions in device settings.')); } },
  };
}
