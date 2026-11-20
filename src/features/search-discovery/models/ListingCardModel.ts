import {cityLabels, type SearchListing} from './ManualSearch';
import type {NearbyListing} from './GpsProximity';

/** What the one shared listing card shows. Every field is something the screens already load; the adapters below only reshape it. */
export interface ListingCardModel {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  propertyType: string;
  /** Monthly rent text without the currency, already formatted; null when the listing has none. */
  rent: string | null;
  location: string;
  bedrooms: number | null;
  bathrooms: number | null;
  /** Extra plain lines under the chips (the nearby list's distance and availability). */
  notes: string[];
}

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment', boarding_house: 'Boarding house', bedspace: 'Bedspace', room: 'Room', studio: 'Studio',
  condominium: 'Condominium', house: 'House', dormitory: 'Dormitory', other: 'Other',
};
/** "boarding_house" becomes "Boarding house". A value this app does not know yet still reads well: underscores become spaces and the first letter is a capital. */
export function propertyTypeLabel(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const known = TYPE_LABELS[raw.toLowerCase()];
  if (known) return known;
  const spaced = raw.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const count = (value: number | null | undefined, one: string, many: string): string | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1 ? `${value} ${value === 1 ? one : many}` : null;
/** "1 bedroom", "2 bedrooms"; null (so the chip is hidden) when there are none or the number is missing. */
export const bedroomsText = (value: number | null | undefined): string | null => count(value, 'bedroom', 'bedrooms');
export const bathroomsText = (value: number | null | undefined): string | null => count(value, 'bathroom', 'bathrooms');

/** Groups the whole-number part of a rent with commas and keeps any decimals as they came (rent from the nearby list arrives as a decimal string). */
export function rentDigits(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = /^(\d+)(\.\d+)?$/.exec(text);
  return match ? match[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (match[2] ?? '') : text;
}
export const rentText = (digits: string | null): string => digits === null ? 'Rent not provided' : `PHP ${digits}`;

export const locationText = (barangay: string | null | undefined, city: string | null | undefined): string =>
  [barangay, city ? cityLabels[city] ?? city : null].filter(Boolean).join(', ');

export function listingCardFromSearch(listing: SearchListing): ListingCardModel {
  return {
    id: listing.listingId, title: listing.title, thumbnailUrl: listing.thumbnailUrl ?? null, propertyType: propertyTypeLabel(listing.propertyType),
    rent: rentDigits(Number.isFinite(listing.rent) ? listing.rent : null), location: locationText(listing.barangay, listing.city),
    bedrooms: Number.isFinite(listing.bedrooms) ? listing.bedrooms : null, bathrooms: Number.isFinite(listing.bathrooms) ? listing.bathrooms : null, notes: [],
  };
}

export function listingCardFromNearby(listing: NearbyListing): ListingCardModel {
  return {
    id: listing.listingId, title: listing.title || 'Rental listing', thumbnailUrl: listing.thumbnailUrl ?? null, propertyType: propertyTypeLabel(listing.propertyType),
    rent: rentDigits(listing.askingRentMonthly as number | string | null), location: locationText(listing.barangay, listing.city), bedrooms: null, bathrooms: null,
    notes: [`${listing.distanceMeters} m away`, listing.availableFrom ? `Available from ${listing.availableFrom}` : 'Availability date not provided'],
  };
}
