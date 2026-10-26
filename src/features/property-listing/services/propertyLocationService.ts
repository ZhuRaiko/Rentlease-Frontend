import type { GeocodingCandidate, GeocodeAddressOptions } from '../../../shared/services/maps/geocoding/geocodingService';
export function createPropertyLocationService(geocode: (query: string, options?: GeocodeAddressOptions) => Promise<GeocodingCandidate[]>, styleUrl: () => string) {
  return { searchAddress: (query: string, signal: AbortSignal) => geocode(query, { signal, limit: 5 }), getMapStyleUrl: styleUrl };
}
export type PropertyLocationService = ReturnType<typeof createPropertyLocationService>;
