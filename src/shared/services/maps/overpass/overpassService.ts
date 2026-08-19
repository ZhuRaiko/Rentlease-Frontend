export type AmenityCategory = 'school' | 'hospital' | 'mall' | 'transport_terminal';

export interface NearbyAmenityQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  categories: AmenityCategory[];
}

export async function fetchNearbyAmenities(query: NearbyAmenityQuery): Promise<unknown> {
  const tags: Record<AmenityCategory, string> = {
    school: '[amenity=school]', hospital: '[amenity=hospital]', mall: '[shop=mall]', transport_terminal: '[amenity=bus_station]',
  };
  const selectors = query.categories.map((category) => `nwr${tags[category]}(around:${query.radiusMeters},${query.latitude},${query.longitude});`).join('');
  const body = `[out:json];(${selectors});out center;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(body)}`,
  });
  if (!response.ok) throw new Error(`Overpass request failed (${response.status}).`);
  return response.json() as Promise<unknown>;
}
