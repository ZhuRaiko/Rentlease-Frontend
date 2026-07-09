import { Listing, ListingAmenity } from '@/features/listings/types';
import {
  RecommendationPreference,
  RecommendationSpecKey,
  RecommendationTopFactor,
  ScoredListing,
} from '@/features/recommendations/types';

export const defaultTopWeights: Record<RecommendationTopFactor, number> = {
  budget: 0.2889,
  location: 0.2452,
  unit_specs: 0.2262,
  amenities: 0.2398,
};

export const defaultSpecWeights: Record<RecommendationSpecKey, number> = {
  safety_rating: 10,
  bedrooms: 8,
  bathrooms: 8,
  size_sqm: 4,
};

export const defaultAmenityWeights: Record<ListingAmenity, number> = {
  near_public_transport: 11,
  parking: 10,
  near_grocery: 10,
  air_conditioning: 8,
  pet_friendly: 7,
  near_mall: 7,
  near_hospital: 6,
  near_school: 6,
  wifi: 5,
  furnished: 3,
};

export const defaultRecommendationPreference: RecommendationPreference = {
  budget: 12000,
  city: 'Dasmarinas',
  minBedrooms: 1,
  minBathrooms: 1,
  minSizeSqm: 20,
  minSafetyRating: 3,
  amenities: ['near_public_transport', 'near_grocery', 'wifi'],
  priorityRanking: [],
  specRanking: [],
  amenityRanking: [],
};

export function buildWeightsFromRanking<T extends string>(
  rankedKeys: T[],
  allKeys: T[],
  defaultWeights: Record<T, number>
) {
  const userWeights = {} as Record<T, number>;
  const rankedCount = rankedKeys.length;

  rankedKeys.forEach((key, index) => {
    userWeights[key] = rankedCount - index;
  });

  const rankedValues = Object.values(userWeights) as number[];
  const minRanked = rankedValues.reduce((min, value) => Math.min(min, value), Infinity);
  const maxDefault = allKeys.reduce((max, key) => Math.max(max, defaultWeights[key] ?? 1), 1);

  allKeys.forEach((key) => {
    if (userWeights[key] === undefined) {
      const scaledFloor = Number.isFinite(minRanked) ? Math.max(minRanked - 0.01, 0.5) : 1;
      userWeights[key] = Number((((defaultWeights[key] ?? 1) / maxDefault) * scaledFloor).toFixed(4));
    }
  });

  return userWeights;
}

export function normalizeWeights<T extends string>(weights: Record<T, number>) {
  const total = (Object.values(weights) as number[]).reduce((sum, value) => sum + value, 0);

  if (!total) {
    return weights;
  }

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, Number(value) / total])
  ) as Record<T, number>;
}

export function scoreListing(preference: RecommendationPreference, listing: Listing): ScoredListing {
  const budgetScore = Math.max(0, 1 - Math.abs(preference.budget - listing.price) / preference.budget);
  const locationScore = listing.city === preference.city ? 1 : 0;

  const activeSpecs = getActiveSpecs(preference);
  const specWeights =
    preference.specRanking.length > 0
      ? buildWeightsFromRanking(preference.specRanking, activeSpecs, defaultSpecWeights)
      : defaultSpecWeights;
  const specTotal = activeSpecs.reduce((sum, key) => sum + specWeights[key], 0);
  const specsScore =
    activeSpecs.length > 0 && specTotal > 0
      ? activeSpecs.reduce(
          (sum, key) => sum + Math.min(getListingSpec(listing, key) / getPreferenceSpec(preference, key), 1) * specWeights[key],
          0
        ) / specTotal
      : 1;

  const activeAmenities = preference.amenities;
  const amenityWeights =
    preference.amenityRanking.length > 0
      ? buildWeightsFromRanking(preference.amenityRanking, activeAmenities, defaultAmenityWeights)
      : defaultAmenityWeights;
  const amenityTotal = activeAmenities.reduce((sum, key) => sum + amenityWeights[key], 0);
  const amenityScore =
    activeAmenities.length > 0 && amenityTotal > 0
      ? activeAmenities.reduce(
          (sum, key) => sum + (listing.amenities.includes(key) ? amenityWeights[key] : 0),
          0
        ) / amenityTotal
      : 1;

  const topWeights =
    preference.priorityRanking.length > 0
      ? normalizeWeights(
          buildWeightsFromRanking(
            preference.priorityRanking,
            ['budget', 'location', 'unit_specs', 'amenities'],
            defaultTopWeights
          )
        )
      : defaultTopWeights;
  const rawMatchScore =
    topWeights.budget * budgetScore +
    topWeights.location * locationScore +
    topWeights.unit_specs * specsScore +
    topWeights.amenities * amenityScore;
  const matchScore = Math.min(rawMatchScore, 1);

  return {
    ...listing,
    matchScore: Number(matchScore.toFixed(4)),
    matchBreakdown: {
      budget: Number(budgetScore.toFixed(4)),
      location: Number(locationScore.toFixed(4)),
      unitSpecs: Number(specsScore.toFixed(4)),
      amenities: Number(amenityScore.toFixed(4)),
    },
  };
}

export function rankListings(preference: RecommendationPreference, listings: Listing[]) {
  return listings
    .filter((listing) => listing.city === preference.city)
    .map((listing) => scoreListing(preference, listing))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);
}

function getActiveSpecs(preference: RecommendationPreference) {
  return [
    preference.minSafetyRating > 0 ? 'safety_rating' : null,
    preference.minBedrooms > 0 ? 'bedrooms' : null,
    preference.minBathrooms > 0 ? 'bathrooms' : null,
    preference.minSizeSqm > 0 ? 'size_sqm' : null,
  ].filter(Boolean) as RecommendationSpecKey[];
}

function getPreferenceSpec(preference: RecommendationPreference, key: RecommendationSpecKey) {
  if (key === 'safety_rating') return preference.minSafetyRating;
  if (key === 'bedrooms') return preference.minBedrooms;
  if (key === 'bathrooms') return preference.minBathrooms;
  return preference.minSizeSqm;
}

function getListingSpec(listing: Listing, key: RecommendationSpecKey) {
  if (key === 'safety_rating') return listing.safetyRating;
  if (key === 'bedrooms') return listing.bedrooms;
  if (key === 'bathrooms') return listing.bathrooms;
  return listing.sizeSqm;
}
