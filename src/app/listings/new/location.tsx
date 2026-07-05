import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FormInput, MapPreview, PostingShell, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { mockListings } from '@/features/listings/mock-data';
import { geocodeAddress } from '@/features/listings/listing-service';
import { useListingDraft } from '@/features/listings/listing-draft-context';
import { listingRoutes } from '@/features/listings/routes';
import { GeocodeResult } from '@/features/listings/types';

export default function PostingLocationScreen() {
  const { draft, updateDraft } = useListingDraft();
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  async function searchAddress() {
    try {
      setIsSearching(true);
      const nextResults = await geocodeAddress(draft.address);
      setResults(nextResults);
      if (nextResults[0]) {
        updateDraft({
          address: nextResults[0].label,
          lat: nextResults[0].lat,
          lng: nextResults[0].lng,
        });
      }
    } catch (error) {
      Alert.alert('Geocoding failed', error instanceof Error ? error.message : 'Try another address.');
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <PostingShell step={4} onNext={() => router.push(listingRoutes.newPricing)}>
      <View style={styles.content}>
        <MapPreview listings={mockListings.slice(0, 1)} />
        <SectionLabel>Address</SectionLabel>
        <ThemedText style={styles.help}>
          You can search your address manually if the provided address is incorrect.
        </ThemedText>
        <FormInput value={draft.address} onChangeText={(address) => updateDraft({ address })} />
        <PrimaryAction
          label={isSearching ? 'Searching...' : 'Search with MapTiler'}
          onPress={searchAddress}
          style={styles.searchButton}
        />
        {results.map((result) => (
          <Pressable
            key={`${result.lat}-${result.lng}`}
            onPress={() => updateDraft({ address: result.label, lat: result.lat, lng: result.lng })}
            style={styles.result}>
            <ThemedText style={styles.resultText}>{result.label}</ThemedText>
          </Pressable>
        ))}
        <PrimaryAction label="Confirm Location" onPress={() => router.push(listingRoutes.newPricing)} />
      </View>
    </PostingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: 28,
    gap: 14,
  },
  help: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '200',
  },
  searchButton: {
    minHeight: 48,
  },
  result: {
    borderWidth: 0.5,
    borderColor: '#B3B3B3',
    borderRadius: 8,
    padding: 12,
  },
  resultText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
