import type { Database, Enums } from '../../../shared/services/supabase/database.types';
import { propertyCityOptions, propertyTypeOptions } from './DraftProperty';
export type PortfolioProperty = Pick<Database['public']['Tables']['properties']['Row'], 'id' | 'landlord_id' | 'property_type' | 'city' | 'barangay' | 'bedrooms' | 'bathrooms' | 'floor_area_sqm' | 'floor_number' | 'total_floors' | 'max_occupants' | 'furnishing_status' | 'is_active' | 'created_at' | 'updated_at'>;
export type PortfolioListing = Database['public']['Tables']['listings']['Row'];
export type PortfolioVerification = Pick<Database['public']['Tables']['verification_submissions']['Row'], 'id' | 'user_id' | 'property_id' | 'tier' | 'status' | 'submitted_at' | 'updated_at'>;
export interface LandlordPortfolioItem {
  propertyId: string; property: PortfolioProperty; listings: PortfolioListing[]; currentListing: PortfolioListing | null;
  coverPhoto: { id: string; publicUrl: string } | null;
  tier3: { status: Enums<'verification_status'> | 'not_submitted'; submissionId: string | null; updatedAt: string | null };
}
export const portfolioListingLabels: Record<Enums<'listing_status'>, string> = { draft: 'Draft', active: 'Published', paused: 'Paused', rented: 'Rented', archived: 'Archived', removed: 'Removed' };
export const portfolioTierLabels: Record<LandlordPortfolioItem['tier3']['status'], string> = { not_submitted: 'Ownership verification not submitted', pending: 'Verification pending', under_review: 'Verification under review', approved: 'Ownership verified', rejected: 'Verification rejected', cancelled: 'Verification cancelled', revoked: 'Verification revoked' };
export const portfolioType = (p: PortfolioProperty) => propertyTypeOptions.find(o => o.value === p.property_type)?.label ?? p.property_type;
export const portfolioLocation = (p: PortfolioProperty) => `${p.barangay}, ${propertyCityOptions.find(o => o.value === p.city)?.label ?? p.city}`;
const recent = <T extends { id: string; updated_at: string; created_at: string }>(a: T, b: T) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id);
export function currentPortfolioListing(rows: PortfolioListing[]) {
  const priority = (status: PortfolioListing['status']) => ['active', 'paused', 'rented'].includes(status) ? 0 : status === 'draft' ? 1 : 2;
  return [...rows].sort((a, b) => priority(a.status) - priority(b.status) || recent(a, b))[0] ?? null;
}
export function assemblePortfolio(properties: PortfolioProperty[], listings: PortfolioListing[], verifications: PortfolioVerification[], covers: Map<string, { id: string; publicUrl: string }>): LandlordPortfolioItem[] {
  return properties.map(property => {
    const history = listings.filter(l => l.property_id === property.id).sort(recent);
    const verification = verifications.filter(v => v.property_id === property.id).sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at) || Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id.localeCompare(a.id))[0];
    return { propertyId: property.id, property, listings: history, currentListing: currentPortfolioListing(history), coverPhoto: covers.get(property.id) ?? null, tier3: { status: verification?.status ?? 'not_submitted', submissionId: verification?.id ?? null, updatedAt: verification?.updated_at ?? null } };
  });
}
export function filterPortfolio(items: LandlordPortfolioItem[], query: string) {
  const text = query.trim().toLocaleLowerCase();
  return items.filter(item => [portfolioType(item.property), portfolioLocation(item.property), ...item.listings.map(l => l.title)].join(' ').toLocaleLowerCase().includes(text));
}
export function portfolioStats(items: LandlordPortfolioItem[]) {
  const listings = items.flatMap(item => item.listings);
  return { properties: items.length, published: listings.filter(l => l.status === 'active').length, drafts: listings.filter(l => l.status === 'draft').length, rented: listings.filter(l => l.status === 'rented').length };
}
export class PortfolioError extends Error { constructor(message: string, public readonly identity = false) { super(message); } }
