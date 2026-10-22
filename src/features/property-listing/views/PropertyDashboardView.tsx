import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { LandlordListingCard } from '../components/LandlordListingCard';
import { ListingButton } from '../components/ListingButton';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

const propertyIcon = require('../../../assets/verification/property.png');

interface PropertyDashboardViewProps {
  viewModel: PropertyListingViewModel;
}

function DashboardStat({
  label,
  value,
  tone = 'dark',
}: {
  label: string;
  value: string;
  tone?: 'dark' | 'green' | 'red' | 'orange';
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, styles[`${tone}Stat`]]}>{value}</Text>
      <Text numberOfLines={2} style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function PropertyDashboardView({ viewModel }: PropertyDashboardViewProps) {
  if (viewModel.screen === 'empty') {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyHeader}>
          <Pressable accessibilityRole="button" onPress={viewModel.goDashboard}>
            <Text style={styles.headerAction}>Back</Text>
          </Pressable>
          <Text style={styles.emptyHeaderTitle}>My Listings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconShell}>
            <Image resizeMode="contain" source={propertyIcon} style={styles.emptyIcon} />
          </View>
          <Text accessibilityRole="header" style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyCopy}>
            Add your first property, complete its listing details, and publish when everything is ready.
          </Text>
          <View style={styles.emptyButton}>
            <ListingButton label="Add your first property" onPress={viewModel.startCreate} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>My Listings</Text>
            <Text style={styles.subtitle}>Listing management preview</Text>
          </View>
          <Pressable
            accessibilityLabel="Listing notifications"
            accessibilityRole="button"
            onPress={() => viewModel.setNotice('No new listing notifications in this frontend preview.')}
            style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
          >
            <View style={styles.bell}>
              <View style={styles.bellClapper} />
            </View>
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <View style={styles.searchIcon}>
            <View style={styles.searchCircle} />
            <View style={styles.searchHandle} />
          </View>
          <TextInput
            accessibilityLabel="Search your listings"
            onChangeText={viewModel.setListingQuery}
            placeholder="Search your listings..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={viewModel.listingQuery}
          />
        </View>

        <View style={styles.stats}>
          <DashboardStat label="LISTINGS" value="4" />
          <DashboardStat label="TENANTED" tone="green" value="2" />
          <DashboardStat label="OVERDUE" tone="red" value="2" />
          <DashboardStat label="AVG RATING" tone="orange" value="4.8" />
        </View>

        {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionLabel}>TENANTED</Text>
          <Text style={styles.unitCode}>UC-06</Text>
        </View>

        <View style={styles.cards}>
          {viewModel.filteredListingPreviews.map((listing) => (
            <LandlordListingCard
              key={listing.id}
              listing={listing}
              onManage={() => viewModel.openManagement(listing.id)}
              onOpen={() => viewModel.openListing(listing.id)}
            />
          ))}
        </View>

        {viewModel.filteredListingPreviews.length === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsTitle}>No matching listings</Text>
            <Text style={styles.noResultsBody}>Try a property title, city, or unit code.</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => viewModel.setNotice('Boost visibility is a frontend preview. No ranking request was sent.')}
          style={({ pressed }) => [styles.boostCard, pressed && styles.pressed]}
        >
          <View style={styles.boostIcon}><View style={styles.boostSpark} /></View>
          <View style={styles.boostCopy}>
            <Text style={styles.boostTitle}>Boost visibility</Text>
            <Text style={styles.boostBody}>Complete your listing to rank higher in the recommendation algorithm</Text>
          </View>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('empty')}>
          <Text style={styles.previewLink}>Preview empty My Listings state</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { paddingBottom: spacing.xl, paddingHorizontal: spacing.md },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.xs, paddingTop: spacing.lg },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, marginTop: 2 },
  notificationButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  bell: { borderColor: colors.textSecondary, borderRadius: 7, borderWidth: 1.2, height: 12, position: 'relative', width: 10 },
  bellClapper: { backgroundColor: colors.textSecondary, borderRadius: 2, bottom: -4, height: 3, left: 3, position: 'absolute', width: 3 },
  searchBar: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, height: 40, marginTop: spacing.xs, paddingHorizontal: spacing.md },
  searchIcon: { height: 17, position: 'relative', width: 17 },
  searchCircle: { borderColor: colors.textMuted, borderRadius: 8, borderWidth: 1.3, height: 10, left: 1, position: 'absolute', top: 1, width: 10 },
  searchHandle: { backgroundColor: colors.textMuted, height: 1.3, left: 10, position: 'absolute', top: 11, transform: [{ rotate: '45deg' }], width: 6 },
  searchInput: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 12, padding: 0 },
  stats: { flexDirection: 'row', marginTop: spacing.xl },
  stat: { alignItems: 'center', borderRightColor: colors.surfaceStrong, borderRightWidth: 1, flex: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 4 },
  statValue: { fontFamily: typography.family, fontSize: 18, fontWeight: '900' },
  darkStat: { color: colors.text },
  greenStat: { color: '#16845C' },
  redStat: { color: '#E34848' },
  orangeStat: { color: '#C67B14' },
  statLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, lineHeight: 10, marginTop: 4, textAlign: 'center' },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 14, marginTop: spacing.md, padding: spacing.sm },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs, marginTop: spacing.lg },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  unitCode: { color: '#158B5D', fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  cards: { gap: spacing.sm },
  noResults: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, gap: spacing.xs, padding: spacing.lg },
  noResultsTitle: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '800' },
  noResultsBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11 },
  boostCard: { alignItems: 'center', backgroundColor: '#EAF5FF', borderColor: '#86BEEA', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.sm },
  boostIcon: { alignItems: 'center', backgroundColor: '#D6ECFF', borderColor: '#82BDF0', borderRadius: radius.pill, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  boostSpark: { borderColor: '#1876BF', borderWidth: 1.5, height: 11, transform: [{ rotate: '45deg' }], width: 11 },
  boostCopy: { flex: 1 },
  boostTitle: { color: '#0764B6', fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  boostBody: { color: '#0764B6', fontFamily: typography.family, fontSize: 9, lineHeight: 13, marginTop: 2 },
  previewLink: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.md, textAlign: 'center', textDecorationLine: 'underline' },
  emptyHeader: { alignItems: 'center', flexDirection: 'row', height: 64, justifyContent: 'space-between', paddingHorizontal: spacing.md },
  emptyHeaderTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800' },
  headerAction: { color: colors.primary, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  headerSpacer: { width: 38 },
  emptyState: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  emptyIconShell: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 112, justifyContent: 'center', width: 112 },
  emptyIcon: { height: 62, width: 62 },
  emptyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 28, fontWeight: '800', marginTop: spacing.lg },
  emptyCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, maxWidth: 310, textAlign: 'center' },
  emptyButton: { marginTop: spacing.xl, width: '100%' },
  pressed: { opacity: 0.72 },
});

