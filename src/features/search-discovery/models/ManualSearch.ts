import type { Database } from '../../../shared/services/supabase/database.types';
type Enums = Database['public']['Enums'];
export type SearchSort = 'Recently Listed' | 'Price: Low to High' | 'Price: High to Low';
export interface SearchFilters { city: '' | Enums['cavite_city']; types: Enums['property_type'][]; minRent: number | null; maxRent: number | null; minBeds: number; minBaths: number; minFloorArea: number | null; furnishing: '' | Enums['furnishing_status']; amenityIds: number[] }
export const defaultSearchFilters = (): SearchFilters => ({ city: '', types: [], minRent: null, maxRent: null, minBeds: 0, minBaths: 0, minFloorArea: null, furnishing: '', amenityIds: [] });
export interface SearchInput { query: string; filters: SearchFilters; sort: SearchSort; offset: number }
export interface SearchListing { listingId: string; propertyId: string; ownerId: string; title: string; description: string; rent: number; availableFrom: string | null; city: string; barangay: string; propertyType: string; bedrooms: number; bathrooms: number; floorArea: number | null; furnishing: string; thumbnailUrl: string | null; houseRules: string | null; rentalTerm: string; depositMonths: number; advanceMonths: number; minimumStay: number | null }
export interface SearchPhoto { id: string; url: string; alt: string | null }
export interface SearchDetail extends SearchListing { photos: SearchPhoto[]; amenities: string[] }
export interface AvailableLocation { key: string; city: string; barangay: string; label: string; query: string }
export interface SearchAmenity { id: number; name: string }
export const cityLabels: Record<string, string> = { imus: 'Imus', dasmarinas: 'Dasmariñas', tagaytay: 'Tagaytay' };
export function locationQuery(input: string): { city?: Enums['cavite_city']; pattern: string } {
  const text = input.trim().slice(0,100), normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/,?\s*cavite$/,'').trim();
  const city = ['imus','dasmarinas','tagaytay'].find(c => c === normalized) as Enums['cavite_city'] | undefined;
  const clean = text.replace(/[^\p{L}\p{N}\s'-]/gu,'').trim();
  if (text && !clean) throw new ManualSearchError('Enter a city or barangay.');
  return { ...(city ? { city } : {}), pattern: `*${clean}*` };
}
export class ManualSearchError extends Error { constructor(message = 'Could not load rentals. Check your connection and try again.', readonly identity = false) { super(message); this.name = 'ManualSearchError'; } }
export function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ManualSearchError('The rental response could not be read safely.'); return value as Record<string,unknown>; }
function str(v: unknown): string { if (typeof v !== 'string') throw new ManualSearchError('The rental response could not be read safely.'); return v; }
function num(v: unknown): number { if (typeof v !== 'number' || !Number.isFinite(v)) throw new ManualSearchError('The rental response could not be read safely.'); return v; }
function nullableString(v: unknown) { return v === null ? null : str(v); }
function nullableNumber(v: unknown) { return v === null ? null : num(v); }
export function parseSearchListing(value: unknown): SearchListing {
  const r = record(value), p = record(r.properties);
  if (r.status !== 'active' || p.is_active !== true || p.id !== r.property_id) throw new ManualSearchError('This rental is no longer available.');
  return { listingId: str(r.id), propertyId: str(r.property_id), ownerId: str(p.landlord_id), title: str(r.title), description: str(r.description), rent: num(r.asking_rent_monthly), availableFrom: nullableString(r.available_from), city: str(p.city), barangay: str(p.barangay), propertyType: str(p.property_type), bedrooms: num(p.bedrooms), bathrooms: num(p.bathrooms), floorArea: nullableNumber(p.floor_area_sqm), furnishing: str(p.furnishing_status), thumbnailUrl: null, houseRules: nullableString(r.house_rules), rentalTerm: str(r.rental_term), depositMonths: num(r.security_deposit_months), advanceMonths: num(r.advance_rent_months), minimumStay: nullableNumber(r.minimum_stay_months) };
}
export function validateSearchInput(input: SearchInput) {
  const f = input.filters;
  if (!['Recently Listed','Price: Low to High','Price: High to Low'].includes(input.sort) || !Number.isInteger(input.offset) || input.offset < 0) throw new ManualSearchError('Choose a supported sort and page.');
  for (const v of [f.minRent,f.maxRent,f.minFloorArea,f.minBeds,f.minBaths]) if (v !== null && (!Number.isFinite(v) || v < 0)) throw new ManualSearchError('Use nonnegative numbers for rental filters.');
  if (f.minRent !== null && f.maxRent !== null && f.minRent > f.maxRent) throw new ManualSearchError('Minimum rent must not exceed maximum rent.');
  if (f.amenityIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new ManualSearchError('Choose an available property amenity.');
}
