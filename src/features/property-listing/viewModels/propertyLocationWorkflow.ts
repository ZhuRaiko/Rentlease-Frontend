import { derivePublicPropertyPoint } from '../models/PropertyLocationPrivacy';
import type { PropertyLocationInput } from '../models/DraftProperty';
import type { GeocodingCandidate } from '../../../shared/services/maps/geocoding/geocodingService';
import { fromMapLngLat, isExactPropertyPoint, type ExactPropertyPoint, type PropertyLocationContext } from '../models/PropertyLocationConfirmation';
import type { PropertyLocationService } from '../services/propertyLocationService';
type Stage = 'closed' | 'searching' | 'candidates' | 'map' | 'exactConfirmed';
interface State { stage: Stage; context: PropertyLocationContext | null; query: string; busy: boolean; candidates: GeocodingCandidate[]; selected: GeocodingCandidate | null; workingPoint: ExactPropertyPoint | null; confirmedPoint: ExactPropertyPoint | null; publicPoint: ExactPropertyPoint | null; confirmedRevision: number | null; styleUrl: string | null; mapReady: boolean; error: string | null }
const initial = (context: PropertyLocationContext | null = null): State => ({ stage: 'closed', context, query: context?.query ?? '', busy: false, candidates: [], selected: null, workingPoint: null, confirmedPoint: null, publicPoint: null, confirmedRevision: null, styleUrl: null, mapReady: false, error: null });
export function createPropertyLocationWorkflow(service: PropertyLocationService, onConfirmedLocation?: (location: PropertyLocationInput, confirmedRevision: number) => boolean) {
  let state = initial(), generation = 0, disposed = false, controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const invalidate = () => { generation++; controller?.abort(); controller = null; };
  const alive = (g: number) => !disposed && generation === g;
  const syncContext = (context: PropertyLocationContext | null) => {
    if (disposed || JSON.stringify(context) === JSON.stringify(state.context)) return;
    invalidate(); update(initial(context));
  };
  const search = async () => {
    if (disposed || !state.context || state.stage === 'closed') return;
    invalidate(); const g = generation, request = new AbortController(); controller = request;
    update({ busy: true, stage: 'searching', error: null, candidates: [], selected: null, workingPoint: null, mapReady: false });
    try {
      const candidates = await service.searchAddress(state.query.trim(), request.signal);
      if (!alive(g) || request.signal.aborted) return;
      update({ candidates, stage: 'candidates' });
    } catch (error) {
      if (!alive(g) || request.signal.aborted) return;
      update({ stage: 'candidates', error: (error as { name?: string })?.name === 'AbortError' ? null : 'Location search could not load. Check map configuration and your connection, then try again.' });
    } finally { if (alive(g)) { controller = null; update({ busy: false }); } }
  };
  return {
    getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; }, dispose() { invalidate(); disposed = true; state = initial(); listeners.clear(); },
    syncContext,
    generationToken: () => generation,
    close() { invalidate(); update(initial()); },
    async open(context: PropertyLocationContext) {
      if (disposed) return;
      syncContext(context);
      try { update({ styleUrl: service.getMapStyleUrl(), stage: 'candidates', error: null }); }
      catch { update({ stage: 'candidates', error: 'Map configuration is unavailable. Configure EXPO_PUBLIC_MAPTILER_API_KEY before confirming a location.' }); return; }
      await search();
    },
    updateQuery(query: string) { if (disposed || state.stage === 'closed') return; invalidate(); update({ query, busy: false, stage: 'candidates', candidates: [], selected: null, workingPoint: null, error: null, mapReady: false }); },
    search,
    chooseCandidate(id: string, expectedToken = generation) {
      if (disposed || expectedToken !== generation || state.busy || state.stage !== 'candidates') return;
      const selected = state.candidates.find(candidate => candidate.id === id);
      if (!selected || !isExactPropertyPoint(selected)) return;
      update({ selected, workingPoint: { latitude: selected.latitude, longitude: selected.longitude }, stage: 'map', mapReady: false, error: null });
    },
    movePoint(lngLat: unknown, expectedToken = generation) {
      if (disposed || expectedToken !== generation || state.stage !== 'map') return;
      const point = fromMapLngLat(lngLat); if (point) update({ workingPoint: point });
    },
    mapLoaded(expectedToken = generation) { if (expectedToken === generation && !disposed && state.stage === 'map') update({ mapReady: true, error: null }); },
    mapFailed(expectedToken = generation) { if (expectedToken === generation && !disposed && state.stage === 'map') update({ mapReady: false, error: 'The map could not load. Check your connection and map configuration, then search again.' }); },
    confirmExact(expectedToken = generation) {
      if (disposed || expectedToken !== generation || state.stage !== 'map' || !state.context || !state.mapReady || !isExactPropertyPoint(state.workingPoint)) return false;
      const exact = { ...state.workingPoint }, confirmedRevision = state.context.addressRevision;
      try {
        const publicPoint = derivePublicPropertyPoint(exact);
        if (!isExactPropertyPoint(publicPoint)) throw new Error('Invalid generalized point.');
        const location: PropertyLocationInput = { exactLatitude: exact.latitude, exactLongitude: exact.longitude, publicLatitude: publicPoint.latitude, publicLongitude: publicPoint.longitude };
        // The composed owner checks this captured revision again at the existing boundary.
        if (onConfirmedLocation && !onConfirmedLocation(location, confirmedRevision)) {
          if (alive(expectedToken)) update({ error: 'Location confirmation could not be accepted. Check the current address and confirm again.' });
          return false;
        }
        if (!alive(expectedToken) || state.context?.addressRevision !== confirmedRevision) return false;
        update({ confirmedPoint: exact, publicPoint, confirmedRevision, stage: 'exactConfirmed', error: null }); return true;
      } catch {
        if (alive(expectedToken)) update({ error: 'Location confirmation could not be completed. Check the address and confirm again.' });
        return false;
      }
    },
    cancel() {
      invalidate(); update({ stage: state.confirmedPoint ? 'exactConfirmed' : 'closed', busy: false, candidates: [], selected: null, workingPoint: null, styleUrl: null, mapReady: false, error: null });
    },
  };
}
