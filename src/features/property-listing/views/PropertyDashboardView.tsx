import { Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ListingButton } from '../components/ListingButton';
import { portfolioListingLabels, portfolioTierLabels, portfolioType, portfolioLocation } from '../models/LandlordPortfolio';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function PropertyDashboardView({ viewModel: vm }: { viewModel: PropertyListingViewModel }) {
  const state = vm.portfolioState, stats = vm.portfolioStatistics;
  return <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void vm.portfolio.load()} />}>
    <Text accessibilityRole="header" style={styles.title}>My Listings</Text>
    <TextInput accessibilityLabel="Search properties and listings" placeholder="Search properties or listings..." placeholderTextColor={colors.textMuted} value={state.query} onChangeText={vm.setListingQuery} style={styles.search} />
    <FeedbackNotice message={state.error} tone="error" />
    {state.busy && !state.loaded ? <Text accessibilityLiveRegion="polite" style={styles.body}>Loading your properties...</Text> : null}
    {state.error && !state.busy ? <ListingButton label="Retry loading properties" tone="outline" onPress={() => void vm.portfolio.load()} /> : null}
    {state.loaded ? <View style={styles.stats}>{Object.entries(stats).map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.title}>{value}</Text><Text style={styles.supporting}>{label === 'properties' ? 'Properties' : label === 'published' ? 'Published' : label === 'drafts' ? 'Drafts' : 'Rented'}</Text></View>)}</View> : null}
    {state.loaded && !state.items.length ? <View style={styles.empty}><Text style={styles.heading}>No properties yet</Text><Text style={styles.body}>Start by adding your first rental property.</Text><ListingButton label="Post a property" onPress={vm.startCreate} /></View> : null}
    {vm.portfolioItems.map(item => {
      const listing = item.currentListing;
      const action = !listing ? 'Create listing' : listing.status === 'draft' ? 'Continue draft' : ['active', 'paused'].includes(listing.status) ? 'Manage listing' : listing.status === 'removed' ? 'View status' : 'View listing';
      return <View key={item.propertyId} style={styles.card}>
        {item.coverPhoto ? <Image accessibilityLabel={`Cover of ${listing?.title || portfolioType(item.property)}`} source={{ uri: item.coverPhoto.publicUrl }} style={styles.cover} /> : <View style={styles.placeholder}><Text style={styles.supporting}>Property photos not added yet</Text></View>}
        <View style={styles.content}>
          <Text style={styles.heading}>{listing?.title || `${portfolioType(item.property)} in ${portfolioLocation(item.property).split(', ').at(-1)}`}</Text>
          <Text style={styles.body}>{portfolioLocation(item.property)}</Text>
          {listing ? <Text style={styles.rent}>{"\u20b1"}{listing.asking_rent_monthly.toLocaleString('en-PH')} / month</Text> : null}
          <Text style={styles.status}>{listing ? portfolioListingLabels[listing.status] : 'No listing yet'}</Text>
          <Text style={styles.supporting}>{portfolioTierLabels[item.tier3.status]}</Text>
          {!item.property.is_active ? <Text style={styles.supporting}>Property inactive. Listing changes may be unavailable.</Text> : null}
          <ListingButton label={action} tone="outline" onPress={() => vm.openPortfolioItem(item.propertyId)} />
        </View>
      </View>;
    })}
    {state.loaded && state.items.length > 0 && !vm.portfolioItems.length ? <Text style={styles.body}>No matching properties or listings. Try a title, property type, barangay or city.</Text> : null}
    <ListingButton label="Post a new property" onPress={vm.startCreate} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }, title: { ...ui.pageTitle }, heading: { ...ui.sectionTitle }, body: { ...ui.body }, supporting: { ...ui.supporting },
  search: { ...ui.control, ...ui.body, paddingHorizontal: spacing.md }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, stat: { flexGrow: 1, flexBasis: 100 },
  card: { ...ui.panel, overflow: 'hidden' }, cover: { width: '100%', aspectRatio: 1.7 }, placeholder: { minHeight: 110, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  content: { padding: spacing.md, gap: spacing.xs }, rent: { ...ui.sectionTitle, marginTop: spacing.xs }, status: { ...ui.body, fontWeight: '600', color: colors.primary }, empty: { paddingVertical: spacing.lg, gap: spacing.sm },
});
