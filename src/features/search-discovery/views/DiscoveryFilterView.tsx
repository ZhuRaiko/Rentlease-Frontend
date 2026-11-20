import {KeyboardAwareScrollView as ScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton, DiscoveryChip, DiscoveryCounter, DiscoveryHeader, DiscoverySectionCard } from '../components/DiscoveryControls';
import { MatchingPreferencesView } from './MatchingPreferencesView';
import {
  discoveryAmenities,
  propertyKinds,
  sortOptions,
  type DiscoveryFilters,
  type PropertyKind,
} from '../models/SearchDiscovery';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

interface DiscoveryFilterViewProps {
  viewModel: SearchDiscoveryViewModel;
  onClose: () => void;
}

interface PreferenceFieldsProps {
  values: DiscoveryFilters;
  onCity: (city: string) => void;
  onMinimumRent: (value: number) => void;
  onMaximumRent: (value: number) => void;
  onToggleKind: (kind: PropertyKind) => void;
  onBedrooms: (value: number) => void;
  onBathrooms: (value: number) => void;
  onLandArea: (value: number) => void;
  onFurnished: (value: boolean) => void;
  onToggleAmenity: (amenity: string) => void;
}

function amountFromText(value: string) {
  const amount = Number(value.replace(/\D/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function PreferenceFields({
  values,
  onCity,
  onMinimumRent,
  onMaximumRent,
  onToggleKind,
  onBedrooms,
  onBathrooms,
  onLandArea,
  onFurnished,
  onToggleAmenity,
}: PreferenceFieldsProps) {
  return (
    <>
      <DiscoverySectionCard description="Choose one city or leave all cities available." title="Preferred location">
        <View style={styles.chips}>
          {['Imus', 'Dasmariñas', 'Tagaytay'].map((city) => (
            <DiscoveryChip key={city} label={city} onPress={() => onCity(values.city === city ? '' : city)} selected={values.city === city} />
          ))}
        </View>
      </DiscoverySectionCard>
      <DiscoverySectionCard description="Monthly rent in Philippine pesos." title="Budget range">
        <View style={styles.budgetRow}>
          <View style={styles.amountField}>
            <Text style={styles.amountPrefix}>₱</Text>
            <TextInput
              accessibilityLabel="Minimum monthly rent"
              inputMode="numeric"
              onChangeText={(text) => onMinimumRent(amountFromText(text))}
              placeholder="Minimum"
              placeholderTextColor={colors.textMuted}
              style={styles.amountInput}
              value={values.minimumRent ? String(values.minimumRent) : ''}
            />
          </View>
          <Text style={styles.rangeTo}>to</Text>
          <View style={styles.amountField}>
            <Text style={styles.amountPrefix}>₱</Text>
            <TextInput
              accessibilityLabel="Maximum monthly rent"
              inputMode="numeric"
              onChangeText={(text) => onMaximumRent(amountFromText(text))}
              placeholder="Maximum"
              placeholderTextColor={colors.textMuted}
              style={styles.amountInput}
              value={values.maximumRent ? String(values.maximumRent) : ''}
            />
          </View>
        </View>
      </DiscoverySectionCard>
      <DiscoverySectionCard title="Property type">
        <View style={styles.chips}>
          {propertyKinds.map((kind) => (
            <DiscoveryChip key={kind} label={kind} onPress={() => onToggleKind(kind)} selected={values.propertyKinds.includes(kind)} />
          ))}
        </View>
      </DiscoverySectionCard>
      <DiscoverySectionCard title="Rooms">
        <DiscoveryCounter label="Bedrooms" onDecrease={() => onBedrooms(Math.max(0, values.minimumBedrooms - 1))} onIncrease={() => onBedrooms(values.minimumBedrooms + 1)} value={values.minimumBedrooms} />
        <DiscoveryCounter label="Bathrooms" onDecrease={() => onBathrooms(Math.max(0, values.minimumBathrooms - 1))} onIncrease={() => onBathrooms(values.minimumBathrooms + 1)} value={values.minimumBathrooms} />
        <DiscoveryCounter label="Minimum land area (sqm)" onDecrease={() => onLandArea(Math.max(0, values.minimumLandArea - 10))} onIncrease={() => onLandArea(values.minimumLandArea + 10)} value={values.minimumLandArea} />
      </DiscoverySectionCard>
      <DiscoverySectionCard title="Furnishing">
        <View style={styles.chips}>
          <DiscoveryChip label="Any" onPress={() => onFurnished(false)} selected={!values.furnishedOnly} />
          <DiscoveryChip label="Furnished only" onPress={() => onFurnished(true)} selected={values.furnishedOnly} />
        </View>
      </DiscoverySectionCard>
      <DiscoverySectionCard title="Amenities">
        <View style={styles.chips}>
          {discoveryAmenities.map((amenity) => (
            <DiscoveryChip key={amenity} label={amenity} onPress={() => onToggleAmenity(amenity)} selected={values.amenities.includes(amenity)} />
          ))}
        </View>
      </DiscoverySectionCard>
    </>
  );
}

export function DiscoveryFilterView({ viewModel, onClose }: DiscoveryFilterViewProps) {
  if (viewModel.screen === 'sort') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Sort Properties" />
        <View style={styles.sortList}>
          {sortOptions.map((option) => {
            const selected = viewModel.sortOption === option;
            return (
              <Pressable accessibilityRole="radio" accessibilityState={{ selected }} key={option} onPress={() => viewModel.chooseSort(option)} style={styles.sortRow}>
                <Text style={styles.sortLabel}>{option}</Text>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (viewModel.screen === 'matchingPreferences') return <MatchingPreferencesView onClose={onClose} viewModel={viewModel} />;

  const draft = viewModel.filterDraft;
  return (
    <View style={styles.screen}>
      <DiscoveryHeader actionLabel="Reset" onAction={viewModel.resetFilterDraft} onBack={viewModel.goBack} title="Filters" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PreferenceFields
          onBathrooms={(value) => viewModel.updateFilterDraft('minimumBathrooms', value)}
          onBedrooms={(value) => viewModel.updateFilterDraft('minimumBedrooms', value)}
          onLandArea={(value) => viewModel.updateFilterDraft('minimumLandArea', value)}
          onCity={(value) => viewModel.updateFilterDraft('city', value)}
          onFurnished={(value) => viewModel.updateFilterDraft('furnishedOnly', value)}
          onMaximumRent={(value) => viewModel.updateFilterDraft('maximumRent', value)}
          onMinimumRent={(value) => viewModel.updateFilterDraft('minimumRent', value)}
          onToggleAmenity={viewModel.toggleFilterAmenity}
          onToggleKind={viewModel.toggleFilterPropertyKind}
          values={draft}
        />
        <DiscoveryButton label="Show matching properties" onPress={viewModel.applyFilters} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  budgetRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  amountField: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: 'row', minHeight: 48, paddingHorizontal: spacing.sm },
  amountPrefix: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  amountInput: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 13, paddingVertical: spacing.sm },
  rangeTo: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11 },
  sortList: { paddingHorizontal: spacing.lg },
  sortRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 66 },
  sortLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  radio: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 },
  radioSelected: { borderColor: colors.primary },
  radioDot: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 10, width: 10 },
});
