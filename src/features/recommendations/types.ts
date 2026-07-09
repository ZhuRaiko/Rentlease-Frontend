import { Listing, ListingAmenity } from '@/features/listings/types';

export type RecommendationTopFactor = 'budget' | 'location' | 'unit_specs' | 'amenities';

export type RecommendationSpecKey = 'safety_rating' | 'bedrooms' | 'bathrooms' | 'size_sqm';

export type RecommendationPreference = {
  budget: number;
  city: Listing['city'];
  minBedrooms: number;
  minBathrooms: number;
  minSizeSqm: number;
  minSafetyRating: number;
  amenities: ListingAmenity[];
  priorityRanking: RecommendationTopFactor[];
  specRanking: RecommendationSpecKey[];
  amenityRanking: ListingAmenity[];
};

export type RecommendationScoreBreakdown = {
  budget: number;
  location: number;
  unitSpecs: number;
  amenities: number;
};

export type ScoredListing = Listing & {
  matchScore: number;
  matchBreakdown: RecommendationScoreBreakdown;
};

export type TenantPreferenceRow = {
  id: string;
  user_id: string;
  budget: number;
  city: Listing['city'];
  min_bedrooms: number;
  min_bathrooms: number;
  min_size_sqm: number;
  min_safety_rating: number;
  amenities: ListingAmenity[];
  priority_ranking: RecommendationTopFactor[];
  spec_ranking: RecommendationSpecKey[];
  amenity_ranking: ListingAmenity[];
  skipped: boolean;
  created_at: string;
  updated_at: string;
};
