import { env, requireEnvironmentValue } from '../../../../config/env';

export interface GeocodingCandidate {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
}

interface MapTilerFeature {
  id?: string;
  place_name?: string;
  center?: [number, number];
}

interface MapTilerResponse { features?: MapTilerFeature[] }

export async function geocodeAddress(query: string): Promise<GeocodingCandidate[]> {
  const key = requireEnvironmentValue(env.mapTilerApiKey, 'EXPO_PUBLIC_MAPTILER_API_KEY');
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(key)}&country=ph`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Geocoding request failed (${response.status}).`);
  const payload = (await response.json()) as MapTilerResponse;
  return (payload.features ?? []).flatMap((feature) => {
    if (!feature.id || !feature.place_name || !feature.center) return [];
    return [{ id: feature.id, label: feature.place_name, longitude: feature.center[0], latitude: feature.center[1] }];
  });
}
