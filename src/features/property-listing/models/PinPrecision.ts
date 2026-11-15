import type { GeocodingCandidate } from '../../../shared/services/maps/geocoding/geocodingService';
import { derivePublicPropertyPoint } from './PropertyLocationPrivacy';

/**
 * What a pin is derived from. The geocoder answers with the best match it found: an address, a street or a place of interest is derived from
 * what the owner typed; a neighborhood, a municipality or a region is only its centre, a fallback for an address that was not meaningful.
 * An answer that says nothing about its type is not called a fallback (it cannot be shown to be one); a pin the owner moved by hand is theirs.
 */
export const PRECISE_PLACE_TYPES: readonly string[] = ['address', 'street', 'poi'];
export const candidatePrecise = (candidate: Pick<GeocodingCandidate, 'placeTypes'> | null | undefined): boolean =>
  !!candidate && (!candidate.placeTypes || candidate.placeTypes.length === 0 || candidate.placeTypes.some(type => PRECISE_PLACE_TYPES.includes(type)));
/** The best match for the address: the first one derived from it, else the first one the geocoder returned. */
export const pickPreviewCandidate = (candidates: readonly GeocodingCandidate[]): GeocodingCandidate | null =>
  candidates.find(candidate => candidatePrecise(candidate)) ?? candidates[0] ?? null;
/** The point the map may show: the generalized grid point, never the exact pin. */
export const previewPublicPoint = (candidate: Pick<GeocodingCandidate, 'latitude' | 'longitude'>) => derivePublicPropertyPoint({ latitude: candidate.latitude, longitude: candidate.longitude });

export const FALLBACK_NOTE = "We couldn't place this address precisely, so only the city is used";
/** The address is checked on the map this long after the person stops typing it. */
export const PREVIEW_DEBOUNCE_MS = 700;
