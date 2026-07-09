import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppScreen, BottomNav, BrandHeader, PrimaryAction } from '@/features/listings/components';
import { listingRoutes } from '@/features/listings/routes';
import { recommendationRoutes } from '@/features/recommendations/routes';
import {
  getRecommendedListings,
  getTenantPreference,
} from '@/features/recommendations/recommendation-service';
import { defaultRecommendationPreference } from '@/features/recommendations/recommender';
import { ScoredListing } from '@/features/recommendations/types';
import { ScoredListingCard } from '@/features/recommendations/components';
import { useAuth } from '@/features/auth/auth-context';

export default function RecommendationResultsScreen() {
  const { session } = useAuth();
  const [listings, setListings] = useState<ScoredListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const preference = (await getTenantPreference(session?.user.id)) ?? defaultRecommendationPreference;
      const nextListings = await getRecommendedListings(preference);
      setListings(nextListings);
      setIsLoading(false);
    }

    load();
  }, [session?.user.id]);

  return (
    <View style={styles.root}>
      <AppScreen>
        <BrandHeader title="Your Matches" />
        <View style={styles.heading}>
          <ThemedText style={styles.title}>Ranked for your preferences</ThemedText>
          <ThemedText style={styles.copy}>
            Results use budget, city, unit specs, amenities, and any rankings you gave in the survey.
          </ThemedText>
        </View>
        <View style={styles.actions}>
          <PrimaryAction label="Edit Survey" tone="green" onPress={() => router.push(recommendationRoutes.survey)} style={styles.action} />
          <PrimaryAction label="All Listings" onPress={() => router.replace(listingRoutes.home)} style={styles.action} />
        </View>
        <View style={styles.list}>
          {isLoading ? <ThemedText>Finding your best matches...</ThemedText> : null}
          {!isLoading && listings.length === 0 ? (
            <ThemedText>No matches yet. Try a nearby city or fewer required amenities.</ThemedText>
          ) : null}
          {listings.map((listing) => (
            <ScoredListingCard
              key={listing.id}
              listing={listing}
              onPress={() => router.push(listingRoutes.detail(listing.id))}
            />
          ))}
        </View>
      </AppScreen>
      <BottomNav active="discover" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heading: {
    marginTop: 8,
    gap: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  copy: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
    minHeight: 46,
  },
  list: {
    marginTop: 22,
    gap: 18,
  },
});
