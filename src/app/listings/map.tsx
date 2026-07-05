import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppScreen, BottomNav, ListingCard, MapPreview, PrimaryAction } from '@/features/listings/components';
import { getDistanceKm, getListings } from '@/features/listings/listing-service';
import { listingRoutes } from '@/features/listings/routes';
import { Listing } from '@/features/listings/types';

export default function ListingMapScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getListings().then(setListings);
  }, []);

  async function locateMe() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert('Location unavailable', 'Allow location access to use proximity filtering.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
  }

  const nearbyListings = userLocation
    ? listings
        .map((listing) => ({
          listing,
          distance:
            listing.lat && listing.lng
              ? getDistanceKm(userLocation, { lat: listing.lat, lng: listing.lng })
              : null,
        }))
        .filter((item) => item.distance === null || item.distance <= 20)
        .map((item) => item.listing)
    : listings;

  return (
    <View style={styles.root}>
      <AppScreen>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()}>
            <ThemedText style={styles.back}>{'<'}</ThemedText>
          </Pressable>
          <ThemedText style={styles.title}>Map View</ThemedText>
          <Pressable onPress={() => router.push(listingRoutes.filters)}>
            <ThemedText style={styles.filter}>Filter</ThemedText>
          </Pressable>
        </View>
        <MapPreview listings={nearbyListings} />
        <PrimaryAction label="Use my location" onPress={locateMe} style={styles.locateButton} />
        <ThemedText style={styles.caption}>
          {userLocation
            ? 'Showing listings within about 20 km of your current location.'
            : 'Tap to enable GPS proximity filtering.'}
        </ThemedText>
        <View style={styles.list}>
          {nearbyListings.map((listing) => (
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
  topRow: {
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  filter: {
    fontSize: 14,
    fontWeight: '700',
  },
  locateButton: {
    marginTop: 16,
  },
  caption: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.56,
  },
  list: {
    marginTop: 20,
    gap: 16,
  },
});
