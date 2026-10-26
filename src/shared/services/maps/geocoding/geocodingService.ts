import { env, requireEnvironmentValue } from '../../../../config/env';
export interface GeocodingCandidate { id: string; label: string; longitude: number; latitude: number }
export interface GeocodeAddressOptions { signal?: AbortSignal; limit?: number }
export class GeocodingError extends Error {}
const abortError = () => Object.assign(new Error('Location search cancelled.'), { name: 'AbortError' });
const boundedLimit = (limit = 5) => Number.isFinite(limit) ? Math.max(1, Math.min(10, Math.trunc(limit))) : 5;
export function parseGeocodingCandidates(payload: unknown, limit = 5): GeocodingCandidate[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { features?: unknown }).features)) throw new GeocodingError('Location search returned an unreadable response. Try again.');
  const candidates: GeocodingCandidate[] = [], ids = new Set<string>();
  for (const feature of (payload as { features: unknown[] }).features) {
    if (!feature || typeof feature !== 'object') continue;
    const { id, place_name: label, center } = feature as { id?: unknown; place_name?: unknown; center?: unknown };
    if (typeof id !== 'string' || !id.trim() || typeof label !== 'string' || !label.trim() || !Array.isArray(center) || center.length !== 2) continue;
    const [longitude, latitude] = center;
    if (typeof longitude !== 'number' || typeof latitude !== 'number' || !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90 || ids.has(id.trim())) continue;
    ids.add(id.trim()); candidates.push({ id: id.trim(), label: label.trim(), longitude, latitude });
    if (candidates.length >= boundedLimit(limit)) break;
  }
  return candidates;
}
// Dependency injection permits offline contract tests without logging keys/addresses.
export function createGeocodingService(getKey: () => string, request: typeof fetch) {
  return async (query: string, options: GeocodeAddressOptions = {}): Promise<GeocodingCandidate[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 3) throw new GeocodingError('Enter at least 3 characters to search for a location.');
    if (options.signal?.aborted) throw abortError();
    try {
      const key = getKey();
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(trimmed)}.json?key=${encodeURIComponent(key)}&country=ph&limit=${boundedLimit(options.limit)}`;
      const response = await request(url, options.signal ? { signal: options.signal } : {});
      if (options.signal?.aborted) throw abortError();
      if (!response.ok) throw new GeocodingError('Location search is unavailable. Check your connection and try again.');
      const payload: unknown = await response.json();
      if (options.signal?.aborted) throw abortError();
      return parseGeocodingCandidates(payload, options.limit);
    } catch (error) {
      if (options.signal?.aborted || (error as { name?: string })?.name === 'AbortError') throw abortError();
      if (error instanceof GeocodingError) throw error;
      throw new GeocodingError('Location search could not load. Check the map configuration and your connection, then try again.');
    }
  };
}
export const geocodeAddress = createGeocodingService(() => requireEnvironmentValue(env.mapTilerApiKey, 'EXPO_PUBLIC_MAPTILER_API_KEY'), (...args) => fetch(...args));
