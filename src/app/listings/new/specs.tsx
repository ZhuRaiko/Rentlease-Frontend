import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip, FormInput, PostingShell, SectionLabel } from '@/features/listings/components';
import { amenityLabels } from '@/features/listings/mock-data';
import { useListingDraft } from '@/features/listings/listing-draft-context';
import { listingRoutes } from '@/features/listings/routes';
import { ListingAmenity } from '@/features/listings/types';

const amenities = Object.keys(amenityLabels) as ListingAmenity[];

export default function PostingSpecsScreen() {
  const { draft, updateDraft } = useListingDraft();

  function updateCount(key: 'bedrooms' | 'bathrooms' | 'parkingSpaces', delta: number) {
    updateDraft({ [key]: Math.max(0, draft[key] + delta) });
  }

  function toggleAmenity(amenity: ListingAmenity) {
    updateDraft({
      amenities: draft.amenities.includes(amenity)
        ? draft.amenities.filter((item) => item !== amenity)
        : [...draft.amenities, amenity],
    });
  }

  return (
    <PostingShell step={3} onNext={() => router.push(listingRoutes.newLocation)}>
      <View style={styles.content}>
        <ThemedText style={styles.bigTitle}>Unit specifications</ThemedText>
        <SectionLabel>Land Area (sqm)</SectionLabel>
        <FormInput
          keyboardType="numeric"
          value={draft.sizeSqm}
          onChangeText={(sizeSqm) => updateDraft({ sizeSqm })}
          placeholder="e.g. 430"
        />
        <Counter label="Bedrooms" value={draft.bedrooms} onMinus={() => updateCount('bedrooms', -1)} onPlus={() => updateCount('bedrooms', 1)} />
        <Counter label="Bathrooms" value={draft.bathrooms} onMinus={() => updateCount('bathrooms', -1)} onPlus={() => updateCount('bathrooms', 1)} />
        <Counter label="Parking Spaces" value={draft.parkingSpaces} onMinus={() => updateCount('parkingSpaces', -1)} onPlus={() => updateCount('parkingSpaces', 1)} />

        <ThemedText style={styles.bigTitle}>Amenities</ThemedText>
        <View style={styles.chips}>
          {amenities.slice(0, 6).map((amenity) => (
            <Chip
              key={amenity}
              label={amenityLabels[amenity]}
              selected={draft.amenities.includes(amenity)}
              onPress={() => toggleAmenity(amenity)}
              color="accent"
            />
          ))}
        </View>
      </View>
    </PostingShell>
  );
}

function Counter({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.counter}>
      <ThemedText style={styles.counterLabel}>{label}</ThemedText>
      <View style={styles.counterControls}>
        <Pressable onPress={onMinus} style={styles.counterButton}>
          <ThemedText>-</ThemedText>
        </Pressable>
        <ThemedText style={styles.counterValue}>{value}</ThemedText>
        <Pressable onPress={onPlus} style={styles.counterButton}>
          <ThemedText>+</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: 28,
    gap: 15,
  },
  bigTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 8,
  },
  counter: {
    minHeight: 62,
    borderTopWidth: 1,
    borderTopColor: '#B3B3B3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  counterButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    minWidth: 18,
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
