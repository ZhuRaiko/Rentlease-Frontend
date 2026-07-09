import { supabase } from '@/lib/supabase';
import { getListings } from '@/features/listings/listing-service';
import { Listing } from '@/features/listings/types';
import { defaultRecommendationPreference, rankListings } from '@/features/recommendations/recommender';
import {
  RecommendationPreference,
  ScoredListing,
  TenantPreferenceRow,
} from '@/features/recommendations/types';

const recommenderUrl = process.env.EXPO_PUBLIC_RECOMMENDER_URL;

export function rowToPreference(row: TenantPreferenceRow): RecommendationPreference {
  return {
    budget: Number(row.budget),
    city: row.city,
    minBedrooms: row.min_bedrooms,
    minBathrooms: row.min_bathrooms,
    minSizeSqm: Number(row.min_size_sqm),
    minSafetyRating: row.min_safety_rating,
    amenities: row.amenities ?? [],
    priorityRanking: row.priority_ranking ?? [],
    specRanking: row.spec_ranking ?? [],
    amenityRanking: row.amenity_ranking ?? [],
  };
}

export async function getTenantPreference(userId?: string) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('tenant_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn('Tenant preference fetch failed.', error.message);
    }
    return null;
  }

  return rowToPreference(data as TenantPreferenceRow);
}

export async function saveTenantPreference(userId: string, preference: RecommendationPreference, skipped = false) {
  const payload = {
    user_id: userId,
    budget: preference.budget,
    city: preference.city,
    min_bedrooms: preference.minBedrooms,
    min_bathrooms: preference.minBathrooms,
    min_size_sqm: preference.minSizeSqm,
    min_safety_rating: preference.minSafetyRating,
    amenities: preference.amenities,
    priority_ranking: preference.priorityRanking,
    spec_ranking: preference.specRanking,
    amenity_ranking: preference.amenityRanking,
    skipped,
  };

  const { error } = await supabase.from('tenant_preferences').upsert(payload, {
    onConflict: 'user_id',
  });

  if (error) {
    throw error;
  }
}

export async function getRecommendedListings(
  preference: RecommendationPreference = defaultRecommendationPreference
) {
  const listings = await getListings({ city: preference.city, amenities: [] });

  if (recommenderUrl) {
    try {
      return await getPythonRecommendations(recommenderUrl, preference, listings);
    } catch (error) {
      console.warn(
        'Python recommender unavailable; using TypeScript fallback.',
        error instanceof Error ? error.message : error
      );
    }
  }

  return rankListings(preference, listings);
}

async function getPythonRecommendations(
  baseUrl: string,
  preference: RecommendationPreference,
  listings: Listing[]
): Promise<ScoredListing[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preference, listings }),
  });

  if (!response.ok) {
    throw new Error(`Recommendation API returned ${response.status}.`);
  }

  const body = (await response.json()) as { recommendations: ScoredListing[] };
  return body.recommendations;
}
