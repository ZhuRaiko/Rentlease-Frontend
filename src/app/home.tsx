import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  AppScreen,
  BottomNav,
  BrandHeader,
  PrimaryAction,
  ScreenSlide,
} from '@/features/listings/components';
import { listingRoutes } from '@/features/listings/routes';
import { ScoredListingCard } from '@/features/recommendations/components';
import {
  getRecommendedListings,
  getTenantPreference,
} from '@/features/recommendations/recommendation-service';
import { defaultRecommendationPreference } from '@/features/recommendations/recommender';
import { recommendationRoutes } from '@/features/recommendations/routes';
import { ScoredListing } from '@/features/recommendations/types';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { session } = useAuth();
  const [listings, setListings] = useState<ScoredListing[]>([]);
  const theme = useTheme();

  useEffect(() => {
    async function loadRecommendations() {
      const preference = (await getTenantPreference(session?.user.id)) ?? defaultRecommendationPreference;
      setListings(await getRecommendedListings(preference));
    }

    loadRecommendations();
  }, [session?.user.id]);

  return (
    <View style={styles.root}>
      <ScreenSlide from="left">
        <AppScreen>
          <BrandHeader />
          <View style={styles.tabs}>
            <ThemedText style={styles.inactiveTab}>Discover</ThemedText>
            <View style={styles.divider} />
            <ThemedText style={styles.activeTab}>For You</ThemedText>
          </View>
          <View style={styles.actions}>
            <PrimaryAction label="Map View" onPress={() => router.push(listingRoutes.map)} style={styles.actionButton} />
            <PrimaryAction
              label="Survey"
              tone="green"
              onPress={() => router.push(recommendationRoutes.survey)}
              style={styles.surveyButton}
            />
            <Pressable
              onPress={() => router.push(listingRoutes.filters)}
              style={[styles.filterButton, { borderColor: theme.borderStrong }]}>
              <ThemedText style={styles.filterText}>Filter</ThemedText>
            </Pressable>
          </View>
          <View style={styles.list}>
            {listings.map((listing) => (
              <ScoredListingCard
                key={listing.id}
                listing={listing}
                onPress={() => router.push(listingRoutes.detail(listing.id))}
              />
            ))}
          </View>
        </AppScreen>
      </ScreenSlide>
      <BottomNav active="discover" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabs: {
    marginTop: -8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  inactiveTab: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    opacity: 0.23,
  },
  activeTab: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  divider: {
    height: 19,
    width: 1,
    backgroundColor: '#000000',
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
  },
  surveyButton: {
    flex: 1,
    minHeight: 46,
  },
  filterButton: {
    width: 104,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    marginTop: 22,
    gap: 18,
  },
});
