import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { AppButton } from '../../../shared/components/AppButton';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton, DiscoveryChip, DiscoveryCounter, DiscoveryHeader, DiscoverySectionCard } from '../components/DiscoveryControls';
import {
  discoveryAmenities,
  propertyKinds,
  renterProfiles,
  sortOptions,
  stayLengths,
  type DiscoveryFilters,
  type MatchingPreferences,
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

type PreferenceTone = 'green' | 'orange' | 'purple' | 'dark';

function PreferenceChoice({
  label,
  selected,
  tone,
  onPress,
  wide = false,
}: {
  label: string;
  selected: boolean;
  tone: PreferenceTone;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.preferenceChoice,
        styles[`${tone}Choice`],
        wide && styles.preferenceChoiceWide,
        !selected && styles.preferenceChoiceIdle,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.preferenceChoiceLabel, !selected && styles.preferenceChoiceLabelIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PreferenceSection({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.preferenceSection}>
      <Text style={styles.preferenceSectionTitle}>{title}</Text>
      {body ? <Text style={styles.preferenceSectionBody}>{body}</Text> : null}
      {children}
    </View>
  );
}

function PreferenceRanking({
  title,
  body,
  values,
  onMove,
}: {
  title: string;
  body: string;
  values: readonly string[];
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <PreferenceSection body={body} title={title}>
      <View style={styles.rankingList}>
        {values.map((value, index) => (
          <View key={value} style={styles.rankingRow}>
            <View style={styles.rankingNumber}><Text style={styles.rankingNumberText}>{index + 1}</Text></View>
            <Text style={styles.rankingLabel}>{value}</Text>
            <Pressable
              accessibilityLabel={`Move ${value} up`}
              accessibilityRole="button"
              disabled={index === 0}
              onPress={() => onMove(index, -1)}
              style={[styles.rankButton, index === 0 && styles.rankButtonDisabled]}
            >
              <Text style={styles.rankButtonLabel}>Up</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Move ${value} down`}
              accessibilityRole="button"
              disabled={index === values.length - 1}
              onPress={() => onMove(index, 1)}
              style={[styles.rankButton, index === values.length - 1 && styles.rankButtonDisabled]}
            >
              <Text style={styles.rankButtonLabel}>Down</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </PreferenceSection>
  );
}

function MatchingPreferencesContent({
  preferences,
  viewModel,
}: {
  preferences: MatchingPreferences;
  viewModel: SearchDiscoveryViewModel;
}) {
  return (
    <>
      <View style={styles.newHereBlock}>
        <Text style={styles.newHereSubtitle}>A place that fits your needs</Text>
        <Text style={styles.newHereBody}>Every choice is optional. Edit these preferences later from Profile. They filter sample listings for this session; live recommendations are not connected.</Text>
      </View>

      <PreferenceSection title="What type of renter are you?">
        <View style={styles.preferenceChoices}>
          {renterProfiles.map((profile, index) => (
            <PreferenceChoice
              key={profile}
              label={profile}
              onPress={() => viewModel.updateMatchingPreference('renterProfile', profile)}
              selected={preferences.renterProfile === profile}
              tone={index % 2 === 0 ? 'green' : 'purple'}
            />
          ))}
        </View>
      </PreferenceSection>

      <PreferenceSection title="Preferred length of stay.">
        <View style={styles.preferenceChoices}>
          {stayLengths.map((length, index) => (
            <PreferenceChoice
              key={length}
              label={length}
              onPress={() => viewModel.updateMatchingPreference('stayLength', length)}
              selected={preferences.stayLength === length}
              tone={index % 2 === 0 ? 'green' : 'purple'}
              wide
            />
          ))}
        </View>
      </PreferenceSection>

      <PreferenceSection title="Which city or area in Cavite are you planning to rent in?">
        <View style={styles.preferenceChoices}>
          {['Imus', 'Dasmariñas', 'Tagaytay'].map((city) => (
            <PreferenceChoice
              key={city}
              label={city === 'Dasmariñas' ? 'City of Dasmariñas' : `${city} City`}
              onPress={() => viewModel.updateMatchingPreference('city', city)}
              selected={preferences.city === city}
              tone="dark"
              wide
            />
          ))}
        </View>
      </PreferenceSection>

      <View style={styles.optionalDivider}>
        <Text style={styles.optionalTitle}>Property Preferences (Optional)</Text>
        <Text style={styles.optionalBody}>
          Filter sample listings locally. This does not activate live recommendations.
        </Text>
      </View>

      <PreferenceSection title="What type of property are you currently looking for?">
        <View style={styles.preferenceChoices}>
          {propertyKinds.map((kind) => (
            <PreferenceChoice
              key={kind}
              label={kind === 'House' ? 'House For Rent' : kind}
              onPress={() => viewModel.togglePreferencePropertyKind(kind)}
              selected={preferences.propertyKinds.includes(kind)}
              tone="dark"
              wide
            />
          ))}
        </View>
      </PreferenceSection>

      <PreferenceSection
        body="Tap the controls to set the unit specifications you prioritize most."
        title="Unit specifications"
      >
        <View style={styles.specificationCard}>
          <DiscoveryCounter
            label="Land Area (sqm)"
            onDecrease={() => viewModel.updateMatchingPreference('minimumLandArea', Math.max(0, preferences.minimumLandArea - 10))}
            onIncrease={() => viewModel.updateMatchingPreference('minimumLandArea', preferences.minimumLandArea + 10)}
            value={preferences.minimumLandArea}
          />
          <DiscoveryCounter
            label="Bedrooms"
            onDecrease={() => viewModel.updateMatchingPreference('minimumBedrooms', Math.max(0, preferences.minimumBedrooms - 1))}
            onIncrease={() => viewModel.updateMatchingPreference('minimumBedrooms', preferences.minimumBedrooms + 1)}
            value={preferences.minimumBedrooms}
          />
          <DiscoveryCounter
            label="Bathrooms"
            onDecrease={() => viewModel.updateMatchingPreference('minimumBathrooms', Math.max(0, preferences.minimumBathrooms - 1))}
            onIncrease={() => viewModel.updateMatchingPreference('minimumBathrooms', preferences.minimumBathrooms + 1)}
            value={preferences.minimumBathrooms}
          />
        </View>
      </PreferenceSection>

      <PreferenceSection body="Select or remove amenities to match your needs." title="Amenities">
        <View style={styles.preferenceChoices}>
          {discoveryAmenities.map((amenity) => (
            <PreferenceChoice
              key={amenity}
              label={amenity}
              onPress={() => viewModel.togglePreferenceAmenity(amenity)}
              selected={preferences.amenities.includes(amenity)}
              tone="orange"
            />
          ))}
        </View>
      </PreferenceSection>

      <PreferenceRanking
        body="Use the controls to place your most important specification first."
        onMove={(index, direction) => viewModel.movePreferenceItem('unitSpecificationRanking', index, direction)}
        title="Rank the unit specifications you considered (top 5)."
        values={preferences.unitSpecificationRanking}
      />
      <PreferenceRanking
        body="Use the controls to place your most important amenity first."
        onMove={(index, direction) => viewModel.movePreferenceItem('amenityRanking', index, direction)}
        title="Rank the amenities you considered (top 5)."
        values={preferences.amenityRanking}
      />
      <PreferenceRanking
        body="Rank from 1 most important to 4 least important."
        onMove={(index, direction) => viewModel.movePreferenceItem('factorRanking', index, direction)}
        title="Lastly rank the factors."
        values={preferences.factorRanking}
      />

      <PreferenceSection
        body="Use RENTLEASE price estimation later, or enter your own monthly budget range now."
        title="Rental Budget Range"
      >
        <View style={styles.budgetModeRow}>
          <PreferenceChoice
            label="Yes, estimate budget range"
            onPress={() => viewModel.updateMatchingPreference('budgetMode', 'estimate')}
            selected={preferences.budgetMode === 'estimate'}
            tone="dark"
          />
          <PreferenceChoice
            label="No thanks, I have my own."
            onPress={() => viewModel.updateMatchingPreference('budgetMode', 'own')}
            selected={preferences.budgetMode === 'own'}
            tone="dark"
          />
        </View>
        <View style={styles.budgetRow}>
          <View style={styles.amountField}>
            <Text style={styles.amountPrefix}>₱</Text>
            <TextInput
              accessibilityLabel="Minimum preferred monthly rent"
              inputMode="numeric"
              onChangeText={(text) => viewModel.updateMatchingPreference('minimumRent', amountFromText(text))}
              placeholder="Minimum"
              placeholderTextColor={colors.textMuted}
              style={styles.amountInput}
              value={preferences.minimumRent ? String(preferences.minimumRent) : ''}
            />
          </View>
          <Text style={styles.rangeTo}>to</Text>
          <View style={styles.amountField}>
            <Text style={styles.amountPrefix}>₱</Text>
            <TextInput
              accessibilityLabel="Maximum preferred monthly rent"
              inputMode="numeric"
              onChangeText={(text) => viewModel.updateMatchingPreference('maximumRent', amountFromText(text))}
              placeholder="Maximum"
              placeholderTextColor={colors.textMuted}
              style={styles.amountInput}
              value={preferences.maximumRent ? String(preferences.maximumRent) : ''}
            />
          </View>
        </View>
      </PreferenceSection>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: preferences.prioritizeNearbyPlaces }}
        onPress={() => viewModel.updateMatchingPreference('prioritizeNearbyPlaces', !preferences.prioritizeNearbyPlaces)}
        style={styles.checkRow}
      >
        <View style={[styles.checkbox, preferences.prioritizeNearbyPlaces && styles.checkboxSelected]}>
          {preferences.prioritizeNearbyPlaces ? <View style={styles.checkMark} /> : null}
        </View>
        <View style={styles.checkCopy}>
          <Text style={styles.checkTitle}>Prioritize nearby essentials</Text>
          <Text style={styles.checkBody}>Schools, hospitals, malls, and transport terminals.</Text>
        </View>
      </Pressable>

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

  if (viewModel.screen === 'matchingPreferences') {
    const preferences = viewModel.matchingPreferences;
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : 'padding'} style={styles.screen}>
        <ScreenHeader onClose={onClose} title="Matching Preferences" disabled={viewModel.isCompletingIntroduction} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.preferenceContent} showsVerticalScrollIndicator={false}>
          <FeedbackNotice message={viewModel.notice} />
          <MatchingPreferencesContent preferences={preferences} viewModel={viewModel} />
        </ScrollView>
        <View style={styles.preferenceFooter}>
          <FeedbackNotice tone="error" message={viewModel.introductionError} />
          <AppButton label={viewModel.isCompletingIntroduction ? 'Saving...' : viewModel.introductionPending ? 'Save and continue' : 'Save preferences'} disabled={viewModel.isCompletingIntroduction} onPress={() => void viewModel.saveMatchingPreferences()} />
          {viewModel.introductionPending ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: viewModel.isCompletingIntroduction }} disabled={viewModel.isCompletingIntroduction} style={styles.skipAction} onPress={() => void viewModel.skipMatchingIntroduction()}><Text style={styles.skipLabel}>Skip for now</Text></Pressable> : null}
        </View>
      </KeyboardAvoidingView>
    );
  }

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
  preferenceContent: { alignSelf: 'center', maxWidth: 460, paddingBottom: spacing.lg, width: '100%' },
  preferenceFooter: { alignSelf: 'center', borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, maxWidth: 460, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs, width: '100%' },
  skipAction: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  skipLabel: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  newHereBlock: { gap: spacing.xxs, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  newHereSubtitle: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '700' },
  newHereBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 20, maxWidth: 340 },
  preferenceSection: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  preferenceSectionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '700', lineHeight: 25 },
  preferenceSectionBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19 },
  preferenceChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  preferenceChoice: { alignItems: 'center', borderRadius: radius.pill, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  preferenceChoiceWide: { flexBasis: '100%' },
  greenChoice: { backgroundColor: colors.primaryAction },
  orangeChoice: { backgroundColor: colors.primaryAction },
  purpleChoice: { backgroundColor: colors.primaryAction },
  darkChoice: { backgroundColor: colors.primaryAction },
  preferenceChoiceIdle: { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderWidth: 1 },
  preferenceChoiceLabel: { color: colors.white, fontFamily: typography.family, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  preferenceChoiceLabelIdle: { color: colors.textSecondary },
  optionalDivider: { alignItems: 'center', backgroundColor: colors.surface, gap: spacing.xs, marginVertical: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  optionalTitle: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  optionalBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  specificationCard: { borderColor: colors.border, borderRadius: 26, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rankingList: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  rankingRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 58, paddingHorizontal: spacing.sm },
  rankingNumber: { alignItems: 'center', backgroundColor: colors.text, borderRadius: radius.pill, height: 28, justifyContent: 'center', width: 28 },
  rankingNumberText: { color: colors.white, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  rankingLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  rankButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 48, paddingHorizontal: spacing.xs },
  rankButtonDisabled: { opacity: 0.28 },
  rankButtonLabel: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  budgetModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
  checkRow: { alignItems: 'flex-start', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  checkbox: { alignItems: 'center', borderColor: colors.border, borderRadius: 5, borderWidth: 1.5, height: 24, justifyContent: 'center', width: 24 },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { borderBottomColor: colors.white, borderBottomWidth: 2, borderRightColor: colors.white, borderRightWidth: 2, height: 11, transform: [{ rotate: '45deg' }], width: 6 },
  checkCopy: { flex: 1 },
  checkTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  checkBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, marginTop: spacing.xxs },
  pressed: { opacity: 0.72 },
});
