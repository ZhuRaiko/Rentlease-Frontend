import { derivePublicPropertyPoint } from '../models/PropertyLocationPrivacy';
import type { PropertyLocationInput } from '../models/DraftProperty';
import type { GeocodingCandidate } from '../../../shared/services/maps/geocoding/geocodingService';
import { fromMapLngLat, isExactPropertyPoint, type ExactPropertyPoint, type PropertyLocationContext } from '../models/PropertyLocationConfirmation';
import type { PropertyLocationService } from '../services/propertyLocationService';
import { candidatePrecise, pickPreviewCandidate } from '../models/PinPrecision';
type Stage = 'closed' | 'searching' | 'candidates' | 'map' | 'exactConfirmed';
/** The address checked on the map while the person is still on the page: no stage, no modal, only what the card shows in its map box. */
export interface PreviewState { status: 'idle' | 'searching' | 'ready' | 'none' | 'failed'; revision: number | null; candidate: GeocodingCandidate | null; precise: boolean | null }
const idlePreview: PreviewState = { status: 'idle', revision: null, candidate: null, precise: null };
interface State { preview: PreviewState; confirmedPrecise: boolean | null; pinMoved: boolean; stage: Stage; context: PropertyLocationContext | null; query: string; busy: boolean; candidates: GeocodingCandidate[]; selected: GeocodingCandidate | null; workingPoint: ExactPropertyPoint | null; confirmedPoint: ExactPropertyPoint | null; publicPoint: ExactPropertyPoint | null; confirmedRevision: number | null; confirmedCandidateId: string | null; styleUrl: string | null; mapReady: boolean; error: string | null }
const initial = (context: PropertyLocationContext | null = null): State => ({ preview: idlePreview, confirmedPrecise: null, pinMoved: false, stage: 'closed', context, query: context?.query ?? '', busy: false, candidates: [], selected: null, workingPoint: null, confirmedPoint: null, publicPoint: null, confirmedRevision: null, confirmedCandidateId:null, styleUrl: null, mapReady: false, error: null });
export function createPropertyLocationWorkflow(service: PropertyLocationService, onConfirmedLocation?: (location: PropertyLocationInput, confirmedRevision: number) => boolean, onLocationInvalidated?: () => void) {
  let state = initial(), generation = 0, disposed = false, controller: AbortController | null = null;
  let previewGeneration = 0, previewController: AbortController | null = null;
  const stopPreview = () => { previewGeneration++; previewController?.abort(); previewController = null; };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const invalidate = () => { generation++; controller?.abort(); controller = null; };
  const alive = (g: number) => !disposed && generation === g;
  const invalidateConfirmation = () => {
    update({confirmedPoint:null,publicPoint:null,confirmedRevision:null,confirmedCandidateId:null,confirmedPrecise:null});
    onLocationInvalidated?.();
  };
  const matchesConfirmed = (point:ExactPropertyPoint) => state.confirmedPoint?.latitude===point.latitude && state.confirmedPoint.longitude===point.longitude;
  const syncContext = (context: PropertyLocationContext | null) => {
    if (disposed || JSON.stringify(context) === JSON.stringify(state.context)) return;
    invalidate(); stopPreview(); update(initial(context));
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
    activate() { disposed = false; }, dispose() { invalidate(); stopPreview(); disposed = true; state = initial(); },
    syncContext,
    generationToken: () => generation,
    close() { invalidate(); stopPreview(); update(initial()); },
    /** Looks the typed address up on the map without opening anything. The best match is shown in the card's map box, never confirmed by itself. */
    async previewAddress(context: PropertyLocationContext) {
      if (disposed) return;
      stopPreview(); const g = previewGeneration, request = new AbortController(); previewController = request;
      update({ preview: { status: 'searching', revision: context.addressRevision, candidate: null, precise: null } });
      try {
        const candidates = await service.searchAddress(context.query.trim(), request.signal);
        if (disposed || g !== previewGeneration || request.signal.aborted) return;
        const chosen = pickPreviewCandidate(candidates);
        update({ preview: chosen ? { status: 'ready', revision: context.addressRevision, candidate: chosen, precise: candidatePrecise(chosen) } : { status: 'none', revision: context.addressRevision, candidate: null, precise: null } });
      } catch (error) {
        if (disposed || g !== previewGeneration || request.signal.aborted || (error as { name?: string })?.name === 'AbortError') return;
        update({ preview: { status: 'failed', revision: context.addressRevision, candidate: null, precise: null } });
      } finally { if (g === previewGeneration) previewController = null; }
    },
    clearPreview() { stopPreview(); update({ preview: idlePreview }); },
    /** Confirms the previewed match as the pin, through the same acceptance check the map tool uses. Returns false if it could not be accepted. */
    confirmPreview(context: PropertyLocationContext): boolean {
      const p = state.preview;
      if (disposed || p.status !== 'ready' || !p.candidate || p.revision !== context.addressRevision) return false;
      const exact = { latitude: p.candidate.latitude, longitude: p.candidate.longitude };
      if (!isExactPropertyPoint(exact)) return false;
      try {
        const publicPoint = derivePublicPropertyPoint(exact);
        if (!isExactPropertyPoint(publicPoint)) return false;
        const location: PropertyLocationInput = { exactLatitude: exact.latitude, exactLongitude: exact.longitude, publicLatitude: publicPoint.latitude, publicLongitude: publicPoint.longitude };
        if (onConfirmedLocation && !onConfirmedLocation(location, context.addressRevision)) return false;
        update({ confirmedPoint: exact, publicPoint, confirmedRevision: context.addressRevision, confirmedCandidateId: p.candidate.id, confirmedPrecise: p.precise === true });
        return true;
      } catch { return false; }
    },
    async open(context: PropertyLocationContext, savedLocation?:PropertyLocationInput) {
      if (disposed) return;
      syncContext(context);
      // Hydrate only an already-confirmed owner draft, never a geocoder suggestion.
      if(savedLocation && !state.confirmedPoint){
        const exact={latitude:savedLocation.exactLatitude,longitude:savedLocation.exactLongitude},publicPoint={latitude:savedLocation.publicLatitude,longitude:savedLocation.publicLongitude};
        if(isExactPropertyPoint(exact)&&isExactPropertyPoint(publicPoint))update({confirmedPoint:exact,publicPoint,confirmedRevision:context.addressRevision});
      }
      try { update({ styleUrl: service.getMapStyleUrl(), stage: 'candidates', error: null }); }
      catch { update({ stage: 'candidates', error: 'Map configuration is unavailable. Configure EXPO_PUBLIC_MAPTILER_API_KEY before confirming a location.' }); return; }
      await search();
    },
    updateQuery(query: string) { if (disposed || state.stage === 'closed') return; if(query.trim()!==state.query.trim())invalidateConfirmation(); invalidate(); update({ query, busy: false, stage: 'candidates', candidates: [], selected: null, workingPoint: null, error: null, mapReady: false }); },
    search,
    chooseCandidate(id: string, expectedToken = generation) {
      if (disposed || expectedToken !== generation || state.busy || state.stage !== 'candidates') return;
      const selected = state.candidates.find(candidate => candidate.id === id);
      if (!selected || !isExactPropertyPoint(selected)) return;
      if(!matchesConfirmed(selected)||(state.confirmedCandidateId!==null&&state.confirmedCandidateId!==selected.id))invalidateConfirmation();
      update({ selected, workingPoint: { latitude: selected.latitude, longitude: selected.longitude }, pinMoved: false, stage: 'map', mapReady: false, error: null });
    },
    movePoint(lngLat: unknown, expectedToken = generation) {
      if (disposed || expectedToken !== generation || state.stage !== 'map') return;
      const point = fromMapLngLat(lngLat); if (point) { if(!matchesConfirmed(point))invalidateConfirmation(); update({ workingPoint: point, pinMoved: !state.selected || point.latitude !== state.selected.latitude || point.longitude !== state.selected.longitude }); }
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
        update({ confirmedPoint: exact, publicPoint, confirmedRevision, confirmedCandidateId:state.selected?.id??null, confirmedPrecise: state.pinMoved || candidatePrecise(state.selected), stage: 'exactConfirmed', error: null }); return true;
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
