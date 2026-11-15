/** Amenities lead with the common ones; "Show all" reveals the rest. A chosen amenity is always visible, common or not. */
export interface AmenityItem { id: number; name: string }
/** Exact catalog names, in the order they are offered. Matching is exact on purpose: a renamed or missing entry is not guessed at. */
export const COMMON_AMENITY_NAMES = ['Wi-Fi', 'Air Conditioning', 'Parking', 'Laundry Area', 'Balcony', '24/7 Security'] as const;

export function visibleAmenities<T extends AmenityItem>(catalog: readonly T[], selectedIds: readonly number[], expanded: boolean): { visible: T[]; hidden: number } {
  if (expanded) return { visible: [...catalog], hidden: 0 };
  const common = COMMON_AMENITY_NAMES.flatMap(name => catalog.filter(a => a.name === name));
  const ids = new Set(common.map(a => a.id));
  const chosen = catalog.filter(a => selectedIds.includes(a.id) && !ids.has(a.id));
  const visible = [...common, ...chosen];
  return { visible, hidden: catalog.length - visible.length };
}
export const selectedCountLabel = (n: number) => `${n} selected`;
