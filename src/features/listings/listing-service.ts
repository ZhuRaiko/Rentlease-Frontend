import { supabase } from '@/lib/supabase';
import { mockListings } from '@/features/listings/mock-data';
import {
  GeocodeResult,
  Listing,
  ListingAmenity,
  ListingDraft,
  ListingFilters,
} from '@/features/listings/types';

const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_KEY;

type ListingRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  city: Listing['city'];
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  size_sqm: number;
  safety_rating: number | null;
  property_type: string;
  furnishing_status: Listing['furnishingStatus'];
  amenities: ListingAmenity[];
  lat: number | null;
  lng: number | null;
  status: Listing['status'];
  created_at: string;
};

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? '',
    city: row.city,
    address: row.address,
    price: row.price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parkingSpaces: row.parking_spaces,
    sizeSqm: row.size_sqm,
    safetyRating: row.safety_rating ?? 3,
    propertyType: row.property_type,
    furnishingStatus: row.furnishing_status,
    amenities: row.amenities ?? [],
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    imageGradient: ['#D6E4F1', '#A8BFD6', '#8DAFC7'],
    landlordName: 'RentLease Landlord',
    landlordBadge: 'Tier 1 Verified',
    createdAt: row.created_at,
  };
}

export function filterListings(
  listings: Listing[],
  filters: ListingFilters,
  userLocation?: { lat: number; lng: number } | null
) {
  return listings.filter((listing) => {
    if (filters.city && filters.city !== 'All' && listing.city !== filters.city) {
      return false;
    }
    if (filters.minPrice && listing.price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice && listing.price > filters.maxPrice) {
      return false;
    }
    if (filters.amenities.some((amenity) => !listing.amenities.includes(amenity))) {
      return false;
    }
    if (filters.radiusKm && userLocation && listing.lat && listing.lng) {
      return getDistanceKm(userLocation, { lat: listing.lat, lng: listing.lng }) <= filters.radiusKm;
    }
    return true;
  });
}

export async function getListings(filters: ListingFilters = { amenities: [] }) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Using mock listings because Supabase listings fetch failed.', error.message);
    return filterListings(mockListings, filters);
  }

  const listings = (data as ListingRow[]).map(rowToListing);
  return filterListings(listings.length > 0 ? listings : mockListings, filters);
}

export async function getListingById(id: string) {
  const mock = mockListings.find((listing) => listing.id === id);

  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();

  if (error || !data) {
    return mock ?? mockListings[0];
  }

  return rowToListing(data as ListingRow);
}

export async function createListingFromDraft(draft: ListingDraft, ownerId: string) {
  const payload = {
    owner_id: ownerId,
    title: draft.title,
    description: draft.description,
    city: draft.city,
    address: draft.address,
    price: Number(draft.price) || 0,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    parking_spaces: draft.parkingSpaces,
    size_sqm: Number(draft.sizeSqm) || 0,
    safety_rating: 3,
    property_type: draft.propertyType,
    furnishing_status: draft.furnishingStatus,
    amenities: draft.amenities,
    lat: draft.lat,
    lng: draft.lng,
    status: 'active',
    payment_terms: draft.paymentTerms,
    used_suggested_price: draft.usedSuggestedPrice,
  };

  const { data, error } = await supabase.from('listings').insert(payload).select('*').single();

  if (error) {
    throw error;
  }

  return rowToListing(data as ListingRow);
}

export async function updateListingFromDraft(id: string, draft: ListingDraft) {
  const payload = {
    title: draft.title,
    description: draft.description,
    city: draft.city,
    address: draft.address,
    price: Number(draft.price) || 0,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    parking_spaces: draft.parkingSpaces,
    size_sqm: Number(draft.sizeSqm) || 0,
    property_type: draft.propertyType,
    furnishing_status: draft.furnishingStatus,
    amenities: draft.amenities,
    lat: draft.lat,
    lng: draft.lng,
    payment_terms: draft.paymentTerms,
    used_suggested_price: draft.usedSuggestedPrice,
  };

  const { data, error } = await supabase.from('listings').update(payload).eq('id', id).select('*').single();

  if (error) {
    throw error;
  }

  return rowToListing(data as ListingRow);
}

export async function delistListing(id: string) {
  const { error } = await supabase.from('listings').update({ status: 'delisted' }).eq('id', id);

  if (error) {
    throw error;
  }
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  if (!mapTilerKey || !query.trim()) {
    return [];
  }

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${mapTilerKey}&country=ph&limit=5`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('MapTiler geocoding failed.');
  }

  const body = await response.json();

  return (body.features ?? []).map(
    (feature: { place_name: string; center: [number, number]; text?: string }) => ({
      label: feature.place_name,
      lng: feature.center[0],
      lat: feature.center[1],
      city: feature.text,
    })
  );
}

export function getDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}
