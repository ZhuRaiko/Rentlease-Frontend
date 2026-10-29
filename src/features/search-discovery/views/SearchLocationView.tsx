import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton, DiscoveryHeader, DiscoverySearchBar } from '../components/DiscoveryControls';
import { DiscoveryIcon } from '../components/DiscoveryIcon';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

interface SearchLocationViewProps {
  viewModel: SearchDiscoveryViewModel;
}

export function SearchLocationView({ viewModel }: SearchLocationViewProps) {
  if (viewModel.screen === 'locationPermission') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Location Access" />
        <ScrollView contentContainerStyle={styles.permissionContent}>
          <View style={styles.permissionGraphic}>
            <DiscoveryIcon color={colors.primary} name="location" size={48} />
          </View>
          <Text accessibilityRole="header" style={styles.permissionTitle}>
            Find rentals near you
          </Text>
          <Text style={styles.permissionBody}>
            RentLease uses your current location only while you search for nearby rentals. Your location is not saved to your profile or listing history.
          </Text>
          <Text style={styles.permissionBody}>Nearby search requires a Tier 1-verified Tenant account. You can also keep searching by city.</Text>
          <DiscoveryButton label="Use current location" onPress={viewModel.allowCurrentLocation} />
          <DiscoveryButton label="Not now" onPress={viewModel.declineCurrentLocation} tone="outline" />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DiscoveryHeader onBack={viewModel.goBack} title="Search Location" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <DiscoverySearchBar
          onChangeText={viewModel.setQuery}
          onSubmit={viewModel.submitSearch}
          placeholder="Enter a city, barangay, or landmark"
          value={viewModel.query}
        />
        <Pressable accessibilityRole="button" onPress={viewModel.requestCurrentLocation} style={styles.currentLocation}>
          <View style={styles.iconCircle}><DiscoveryIcon color={colors.primary} name="location" size={21} /></View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Use my current location</Text>
            <Text style={styles.rowDetail}>Find rentals within 1, 3 or 5 km</Text>
          </View>
          <Text style={styles.rowAction}>Use</Text>
        </Pressable>
        <Text style={styles.sectionLabel}>{viewModel.query ? 'SEARCH SUGGESTIONS' : 'POPULAR LOCATIONS'}</Text>
        <View style={styles.suggestions}>
          {viewModel.suggestions.map((suggestion) => (
            <Pressable
              accessibilityRole="button"
              key={suggestion}
              onPress={() => viewModel.chooseSuggestion(suggestion)}
              style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
            >
              <DiscoveryIcon color={colors.textSecondary} name="location" size={18} />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
          {viewModel.suggestions.length === 0 ? (
            <Text style={styles.noSuggestion}>No local suggestions. Submit the search to preview the no-results state.</Text>
          ) : null}
        </View>
        <DiscoveryButton disabled={!viewModel.query.trim()} label="Search properties" onPress={viewModel.submitSearch} tone="dark" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg },
  currentLocation: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  iconCircle: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 44, justifyContent: 'center', width: 44 },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  rowDetail: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, marginTop: spacing.xxs },
  rowAction: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  suggestions: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  suggestionRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 60, paddingHorizontal: spacing.md },
  suggestionText: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 13, fontWeight: '600' },
  noSuggestion: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18, padding: spacing.md },
  permissionContent: { alignItems: 'center', flexGrow: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
  permissionGraphic: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 112, justifyContent: 'center', width: 112 },
  permissionGraphicDenied: { backgroundColor: colors.restrictedSurface },
  permissionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  permissionBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, maxWidth: 340, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
