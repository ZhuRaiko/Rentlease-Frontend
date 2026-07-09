import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { AppScreen, Chip, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { amenityLabels } from '@/features/listings/mock-data';
import { Listing, ListingAmenity } from '@/features/listings/types';
import { useAuth } from '@/features/auth/auth-context';
import {
  RecommendationSpecKey,
  RecommendationTopFactor,
} from '@/features/recommendations/types';
import { saveTenantPreference } from '@/features/recommendations/recommendation-service';
import { defaultRecommendationPreference } from '@/features/recommendations/recommender';
import { recommendationRoutes } from '@/features/recommendations/routes';
import { useTheme } from '@/hooks/use-theme';

const cityOptions: Listing['city'][] = ['Dasmarinas', 'Imus', 'Tagaytay'];
const topFactors: { key: RecommendationTopFactor; label: string }[] = [
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'unit_specs', label: 'Unit Specs' },
  { key: 'amenities', label: 'Amenities' },
];
const specOptions: { key: RecommendationSpecKey; label: string }[] = [
  { key: 'safety_rating', label: 'Safety' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'size_sqm', label: 'Unit Size' },
];
const amenityOptions = Object.keys(amenityLabels) as ListingAmenity[];

export default function RecommendationSurveyScreen() {
  const { session } = useAuth();
  const theme = useTheme();
  const [budget, setBudget] = useState(String(defaultRecommendationPreference.budget));
  const [city, setCity] = useState<Listing['city']>(defaultRecommendationPreference.city);
  const [minBedrooms, setMinBedrooms] = useState(defaultRecommendationPreference.minBedrooms);
  const [minBathrooms, setMinBathrooms] = useState(defaultRecommendationPreference.minBathrooms);
  const [minSizeSqm, setMinSizeSqm] = useState(String(defaultRecommendationPreference.minSizeSqm));
  const [minSafetyRating, setMinSafetyRating] = useState(defaultRecommendationPreference.minSafetyRating);
  const [amenities, setAmenities] = useState<ListingAmenity[]>(defaultRecommendationPreference.amenities);
  const [priorityRanking, setPriorityRanking] = useState<RecommendationTopFactor[]>([]);
  const [specRanking, setSpecRanking] = useState<RecommendationSpecKey[]>([]);
  const [amenityRanking, setAmenityRanking] = useState<ListingAmenity[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const preference = useMemo(
    () => ({
      budget: Number(budget) || defaultRecommendationPreference.budget,
      city,
      minBedrooms,
      minBathrooms,
      minSizeSqm: Number(minSizeSqm) || 0,
      minSafetyRating,
      amenities,
      priorityRanking,
      specRanking,
      amenityRanking,
    }),
    [amenities, amenityRanking, budget, city, minBathrooms, minBedrooms, minSafetyRating, minSizeSqm, priorityRanking, specRanking]
  );

  async function handleSave() {
    if (!session?.user.id) {
      Alert.alert('Sign in needed', 'Please sign in again before saving preferences.');
      return;
    }

    try {
      setIsSaving(true);
      await saveTenantPreference(session.user.id, preference);
      router.replace(recommendationRoutes.results);
    } catch (error) {
      Alert.alert('Could not save survey', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.dim, { backgroundColor: theme.overlay }]} />
      <AppScreen>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <ThemedText style={styles.closeText}>x</ThemedText>
        </Pressable>
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ThemedText style={styles.title}>Preference Survey</ThemedText>
          <ThemedText style={styles.helper}>
            You can answer lightly. Anything left unranked uses the survey defaults from the thesis model.
          </ThemedText>

          <SectionLabel>Budget and City</SectionLabel>
          <FormInput keyboardType="numeric" value={budget} onChangeText={setBudget} placeholder="Monthly budget" />
          <View style={styles.optionRow}>
            {cityOptions.map((option) => (
              <Chip key={option} label={option} selected={city === option} onPress={() => setCity(option)} />
            ))}
          </View>

          <SectionLabel>Unit Specs</SectionLabel>
          <Counter label="Bedrooms" value={minBedrooms} onChange={setMinBedrooms} />
          <Counter label="Bathrooms" value={minBathrooms} onChange={setMinBathrooms} />
          <Counter label="Safety Rating" value={minSafetyRating} max={5} onChange={setMinSafetyRating} />
          <FormInput keyboardType="numeric" value={minSizeSqm} onChangeText={setMinSizeSqm} placeholder="Minimum size in sqm" />

          <SectionLabel>Amenities</SectionLabel>
          <View style={styles.optionRow}>
            {amenityOptions.map((amenity) => (
              <Chip
                key={amenity}
                color="accent"
                label={amenityLabels[amenity]}
                selected={amenities.includes(amenity)}
                onPress={() => toggleKey(amenity, amenities, setAmenities)}
              />
            ))}
          </View>

          <SectionLabel>Rank What Matters Most</SectionLabel>
          <RankPicker
            items={topFactors}
            selected={priorityRanking}
            onSelect={(key) => pushRank(key, priorityRanking, setPriorityRanking)}
            onClear={() => setPriorityRanking([])}
          />

          <SectionLabel>Rank Specs</SectionLabel>
          <RankPicker
            items={specOptions}
            selected={specRanking}
            onSelect={(key) => pushRank(key, specRanking, setSpecRanking)}
            onClear={() => setSpecRanking([])}
          />

          <SectionLabel>Rank Selected Amenities</SectionLabel>
          <RankPicker
            items={amenities.map((key) => ({ key, label: amenityLabels[key] }))}
            selected={amenityRanking}
            onSelect={(key) => pushRank(key, amenityRanking, setAmenityRanking)}
            onClear={() => setAmenityRanking([])}
          />

          <PrimaryAction
            label={isSaving ? 'Saving...' : 'See My Matches'}
            onPress={handleSave}
            style={styles.submit}
          />
        </View>
      </AppScreen>
    </View>
  );
}

function Counter({
  label,
  value,
  max = 8,
  onChange,
}: {
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.counter}>
      <ThemedText style={styles.counterLabel}>{label}</ThemedText>
      <View style={styles.counterControls}>
        <Pressable style={styles.counterButton} onPress={() => onChange(Math.max(0, value - 1))}>
          <ThemedText style={styles.counterButtonText}>-</ThemedText>
        </Pressable>
        <ThemedText style={styles.counterValue}>{value}</ThemedText>
        <Pressable style={styles.counterButton} onPress={() => onChange(Math.min(max, value + 1))}>
          <ThemedText style={styles.counterButtonText}>+</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function RankPicker<T extends string>({
  items,
  selected,
  onSelect,
  onClear,
}: {
  items: { key: T; label: string }[];
  selected: T[];
  onSelect: (key: T) => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.rankBox}>
      <View style={styles.optionRow}>
        {items.map((item) => (
          <Chip
            key={item.key}
            label={selected.includes(item.key) ? `${selected.indexOf(item.key) + 1}. ${item.label}` : item.label}
            selected={selected.includes(item.key)}
            onPress={() => onSelect(item.key)}
          />
        ))}
      </View>
      {selected.length > 0 ? (
        <Pressable onPress={onClear} style={styles.clearRank}>
          <ThemedText style={styles.clearRankText}>Clear ranking</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function toggleKey<T extends string>(key: T, values: T[], setValues: (values: T[]) => void) {
  setValues(values.includes(key) ? values.filter((value) => value !== key) : [...values, key]);
}

function pushRank<T extends string>(key: T, values: T[], setValues: (values: T[]) => void) {
  if (values.includes(key)) {
    setValues(values.filter((value) => value !== key));
    return;
  }
  setValues([...values, key]);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  close: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 24,
    lineHeight: 28,
    opacity: 0.5,
  },
  sheet: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 18,
    gap: 14,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  helper: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  counter: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  counterButton: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
  },
  counterValue: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  rankBox: {
    gap: 8,
  },
  clearRank: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  clearRankText: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.55,
  },
  submit: {
    marginTop: 8,
  },
});
