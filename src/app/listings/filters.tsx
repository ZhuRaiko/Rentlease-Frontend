import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppScreen, Chip, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { amenityLabels } from '@/features/listings/mock-data';
import { ListingAmenity } from '@/features/listings/types';

const amenities = Object.keys(amenityLabels) as ListingAmenity[];

export default function FiltersScreen() {
  const [city, setCity] = useState('All');
  const [selectedAmenities, setSelectedAmenities] = useState<ListingAmenity[]>([]);

  function toggleAmenity(amenity: ListingAmenity) {
    setSelectedAmenities((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity]
    );
  }

  return (
    <AppScreen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={styles.back}>{'<'}</ThemedText>
        </Pressable>
        <ThemedText style={styles.title}>Search Filters</ThemedText>
      </View>

      <SectionLabel>City</SectionLabel>
      <View style={styles.chips}>
        {['All', 'Imus', 'Dasmarinas', 'Tagaytay'].map((item) => (
          <Chip key={item} label={item} selected={city === item} onPress={() => setCity(item)} />
        ))}
      </View>

      <SectionLabel>Price Range</SectionLabel>
      <View style={styles.row}>
        <FormInput placeholder="Min" keyboardType="numeric" style={styles.halfInput} />
        <FormInput placeholder="Max" keyboardType="numeric" style={styles.halfInput} />
      </View>

      <SectionLabel>Amenities</SectionLabel>
      <View style={styles.chips}>
        {amenities.map((amenity) => (
          <Chip
            key={amenity}
            label={amenityLabels[amenity]}
            selected={selectedAmenities.includes(amenity)}
            onPress={() => toggleAmenity(amenity)}
            color="accent"
          />
        ))}
      </View>

      <SectionLabel>GPS Radius</SectionLabel>
      <FormInput placeholder="e.g. 10 km" keyboardType="numeric" />

      <PrimaryAction label="Apply Filters" onPress={() => router.back()} style={styles.apply} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  back: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  chips: {
    marginTop: 12,
    marginBottom: 26,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  row: {
    marginTop: 12,
    marginBottom: 26,
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  apply: {
    marginTop: 32,
  },
});
