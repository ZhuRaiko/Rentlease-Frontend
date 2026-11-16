import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ListingButton } from '../components/ListingButton';
import { PortfolioFilterTabs } from '../components/PortfolioFilterTabs';
import { PortfolioRentalCard } from '../components/PortfolioRentalCard';
import { portfolioFilterEmptyText, type LandlordPortfolioItem, type PortfolioFilter } from '../models/LandlordPortfolio';
import type { PortfolioActionKey, PortfolioRequestActivity } from '../models/PortfolioCardPresentation';
import { emptyFacts, onlyNeedingYou, portfolioSummary, type PropertyManagementPort } from '../models/PropertyManagement';
import { deleteBlockedReason, offersUnfinishedDelete } from '../models/UnfinishedPostMenu';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

type Tile = 'occupied' | 'vacant' | 'need';
const tileColors: Record<Tile, { backgroundColor: string; color: string; borderColor: string }> = {
  occupied: { backgroundColor: colors.primaryAction, color: colors.white, borderColor: colors.primaryAction },
  vacant: { backgroundColor: colors.identitySurface, color: colors.identityInk, borderColor: colors.identitySurface },
  need: { backgroundColor: colors.warningSurface, color: colors.warning, borderColor: colors.warning },
};
const tileLabels: Record<Tile, string> = { occupied: 'Occupied', vacant: 'Vacant', need: 'Need you' };

/**
 * My properties: summary tiles that filter the list, search, filter chips and one card per property. Counts and facts come from the
 * ViewModel and the root's management port; the View only renders and reports taps.
 */
export function PropertyDashboardView({ viewModel: vm, requestActivity, management }: { viewModel: PropertyListingViewModel; requestActivity?: ((item: LandlordPortfolioItem) => PortfolioRequestActivity | null) | undefined; management?: PropertyManagementPort | undefined }) {
  const state = vm.portfolioState;
  const [needOnly, setNeedOnly] = useState(false);
  const factsOf = management?.factsOf ?? (() => emptyFacts());
  const summary = portfolioSummary(state.items, factsOf);
  const shown = needOnly ? onlyNeedingYou(vm.portfolioItems, factsOf) : vm.portfolioItems;
  const act = (propertyId: string, key: PortfolioActionKey) => {
    if (key === 'open' || key === 'continueEditing' || key === 'manageStatus') vm.openPortfolioItem(propertyId);
    else if (key === 'continuePosting') vm.continuePortfolioPosting(propertyId);
    else if (key === 'editListing') vm.editPortfolioListing(propertyId);
    else if (key === 'editPropertyDetails') vm.editPortfolioPropertyDetails(propertyId);
    else if (key === 'verification') void vm.openPortfolioVerification(propertyId);
    else if (key === 'createListing') vm.createListingForProperty(propertyId);
    else vm.reviewPortfolioPublication(propertyId);
  };
  const choose = (filter: PortfolioFilter) => { setNeedOnly(false); vm.setPortfolioFilter(filter); };
  const tap = (tile: Tile) => { if (tile === 'need') { setNeedOnly(true); vm.setPortfolioFilter('all'); } else choose(tile === 'occupied' ? 'rented' : 'published'); };
  const noMatch = state.loaded && state.items.length > 0 && !shown.length;
  const ready = state.loaded && state.items.length > 0;
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => { void vm.portfolio.load(); management?.refresh(); }} />}>
    <Text accessibilityRole="header" style={styles.title}>My properties</Text>
    {ready ? <View style={styles.tiles}>
      {(['occupied', 'vacant', 'need'] as const).map(tile => {
        const count = tile === 'occupied' ? summary.occupied : tile === 'vacant' ? summary.vacant : summary.needYou, c = tileColors[tile];
        return <Pressable key={tile} accessibilityRole="button" accessibilityLabel={`${tileLabels[tile]}: ${count}. Show these properties`} onPress={() => tap(tile)} style={[styles.tile, { backgroundColor: c.backgroundColor, borderColor: c.borderColor }]}>
          <Text style={[styles.count, { color: c.color }]}>{count}</Text><Text style={[ui.supporting, { color: c.color, fontWeight: '700' }]}>{tileLabels[tile]}</Text>
        </Pressable>;
      })}
    </View> : null}
    {ready ? <TextInput accessibilityLabel="Search properties and listings" placeholder="Search properties" placeholderTextColor={colors.textMuted} value={state.query} onChangeText={vm.setListingQuery} style={styles.search} /> : null}
    <FeedbackNotice message={vm.notice} />
    <FeedbackNotice message={state.error} tone="error" />
    {state.busy && !state.loaded ? <Text accessibilityLiveRegion="polite" style={styles.body}>Loading your properties...</Text> : null}
    {state.error && !state.busy ? <ListingButton label="Retry loading properties" tone="outline" onPress={() => void vm.portfolio.load()} /> : null}
    {ready ? <PortfolioFilterTabs active={needOnly ? 'all' : state.filter} counts={vm.portfolioFilterCounts} onSelect={choose} /> : null}
    {state.loaded && !state.items.length ? <View style={styles.empty}><Text style={styles.heading}>No properties yet</Text><Text style={styles.body}>Use Post below to add your first rental property.</Text></View> : null}
    {shown.map(item => <PortfolioRentalCard key={item.propertyId} item={item} facts={factsOf(item.propertyId)} disabled={vm.portfolioActionsDisabled} onAction={key => act(item.propertyId, key)} request={requestActivity?.(item)} verificationError={vm.propertyVerificationState?.propertyId === item.propertyId ? vm.propertyVerificationState.error : null}
      deletion={offersUnfinishedDelete(item) ? { onDelete: () => void vm.requestPortfolioDeletion(item.propertyId), reason: deleteBlockedReason(vm.unfinishedPostState, item.propertyId) } : null}
      cleanup={vm.unfinishedPostState?.pending.some(job => job.propertyId === item.propertyId) ? { busy: vm.unfinishedPostState.busy, onRetry: () => vm.resumeUnfinishedPostCleanup(item.propertyId) } : null} />)}
    {noMatch ? <Text style={styles.body}>{needOnly ? 'Nothing needs you right now.' : state.query.trim() || state.filter === 'all' ? 'No matching properties or listings. Try a title, property type, barangay or city.' : portfolioFilterEmptyText[state.filter]}</Text> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  title: { ...ui.pageTitle }, heading: { ...ui.sectionTitle }, body: { ...ui.body },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tile: { flex: 1, flexBasis: 90, minHeight: 72, padding: spacing.sm, gap: 2, borderRadius: 14, borderWidth: 1, justifyContent: 'center' },
  count: { ...ui.pageTitle, fontSize: 26, lineHeight: 32 },
  search: { ...ui.control, ...ui.body, paddingHorizontal: spacing.md, borderRadius: radius.control },
  empty: { paddingVertical: spacing.lg, gap: spacing.xs },
});
