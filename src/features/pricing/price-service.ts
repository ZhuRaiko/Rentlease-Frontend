import { Listing, ListingDraft } from '@/features/listings/types';

export type PriceEstimateRequest = {
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  city: string;
  furnishingStatus: 'furnished' | 'semi_furnished' | 'unfurnished';
  amenities: string[];
};

export type PriceEstimateResponse = {
  predictedRent: number;
  typicalRange: [number, number];
  safeRange: [number, number];
};

export function listingToPriceRequest(listing: Listing): PriceEstimateRequest {
  return {
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sizeSqm: listing.sizeSqm,
    city: listing.city,
    furnishingStatus: listing.furnishingStatus,
    amenities: listing.amenities,
  };
}

export function draftToPriceRequest(draft: ListingDraft): PriceEstimateRequest {
  return {
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    sizeSqm: Number(draft.sizeSqm) || 0,
    city: draft.city,
    furnishingStatus: draft.furnishingStatus,
    amenities: draft.amenities,
  };
}

export async function getPriceEstimate(request: PriceEstimateRequest): Promise<PriceEstimateResponse> {
  // TODO: replace with real FastAPI call once the XGBoost backend is deployed.
  const cityBase = request.city === 'Tagaytay' ? 15000 : request.city === 'Imus' ? 12000 : 10000;
  const furnishingBoost =
    request.furnishingStatus === 'furnished' ? 4500 : request.furnishingStatus === 'semi_furnished' ? 2200 : 0;
  const amenityBoost = request.amenities.length * 650;
  const predictedRent =
    cityBase +
    request.bedrooms * 4200 +
    request.bathrooms * 1800 +
    request.sizeSqm * 155 +
    furnishingBoost +
    amenityBoost;
  const rounded = Math.max(3500, Math.round(predictedRent / 500) * 500);

  return {
    predictedRent: rounded,
    typicalRange: [Math.max(3000, rounded - 4500), rounded + 4500],
    safeRange: [Math.max(3000, rounded - 7500), rounded + 7500],
  };
}
