import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  AppScreen,
  BottomNav,
  BrandHeader,
  ListingCard,
  PrimaryAction,
} from '@/features/listings/components';
import { getListings } from '@/features/listings/listing-service';
import { listingRoutes } from '@/features/listings/routes';
import { Listing } from '@/features/listings/types';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const theme = useTheme();

  useEffect(() => {
    getListings().then(setListings);
  }, []);

  return (
    <View style={styles.root}>
      <AppScreen>
        <BrandHeader />
        <View style={styles.tabs}>
          <ThemedText style={styles.inactiveTab}>Discover</ThemedText>
          <View style={styles.divider} />
          <ThemedText style={styles.activeTab}>For You</ThemedText>
        </View>
        <View style={styles.actions}>
          <PrimaryAction label="Map View" onPress={() => router.push(listingRoutes.map)} style={styles.actionButton} />
          <Pressable
            onPress={() => router.push(listingRoutes.filters)}
            style={[styles.filterButton, { borderColor: theme.borderStrong }]}>
            <ThemedText style={styles.filterText}>Filter</ThemedText>
          </Pressable>
        </View>
        <View style={styles.list}>
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
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
