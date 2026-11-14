import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { InterfaceIcon } from '../../../shared/components/InterfaceIcon';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ListingButton } from '../components/ListingButton';
import { PortfolioFilterTabs } from '../components/PortfolioFilterTabs';
import { PortfolioRentalCard } from '../components/PortfolioRentalCard';
import { portfolioFilterEmptyText, type LandlordPortfolioItem } from '../models/LandlordPortfolio';
import type { PortfolioActionKey, PortfolioRequestActivity } from '../models/PortfolioCardPresentation';
import { deleteBlockedReason, offersUnfinishedDelete } from '../models/UnfinishedPostMenu';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function PropertyDashboardView({ viewModel: vm, requestActivity }: { viewModel: PropertyListingViewModel; requestActivity?: ((item: LandlordPortfolioItem) => PortfolioRequestActivity | null) | undefined }) {
  const state = vm.portfolioState;
  const [searchOpen, setSearchOpen] = useState(state.query.trim().length > 0);
  const toggleSearch = () => { if (searchOpen) vm.setListingQuery(''); setSearchOpen(!searchOpen); };
  const act = (propertyId: string, key: PortfolioActionKey) => {
    if (key === 'open') vm.openPortfolioItem(propertyId);
    else if (key === 'editProperty') vm.openPortfolioProperty(propertyId);
    else if (key === 'editRental') vm.editPortfolioListing(propertyId);
    else if (key === 'verification') void vm.openPortfolioVerification(propertyId);
    else vm.reviewPortfolioPublication(propertyId);
  };
  const noMatch = state.loaded && state.items.length > 0 && !vm.portfolioItems.length;
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void vm.portfolio.load()} />}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>My Rentals</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? 'Close search' : 'Search my rentals'} accessibilityState={{ expanded: searchOpen }} onPress={toggleSearch} style={styles.iconButton}>
        {searchOpen ? <Text style={styles.closeGlyph}>{'×'}</Text> : <InterfaceIcon name="search" size={22} color={colors.ink} />}
      </Pressable>
    </View>
    {searchOpen ? <TextInput autoFocus accessibilityLabel="Search properties and listings" placeholder="Search properties or listings..." placeholderTextColor={colors.textMuted} value={state.query} onChangeText={vm.setListingQuery} style={styles.search} /> : null}
    <FeedbackNotice message={vm.notice}/>
    <FeedbackNotice message={state.error} tone="error" />
    {state.busy && !state.loaded ? <Text accessibilityLiveRegion="polite" style={styles.body}>Loading your properties...</Text> : null}
    {state.error && !state.busy ? <ListingButton label="Retry loading properties" tone="outline" onPress={() => void vm.portfolio.load()} /> : null}
    {state.loaded && state.items.length > 0 ? <PortfolioFilterTabs active={state.filter} counts={vm.portfolioFilterCounts} onSelect={vm.setPortfolioFilter} /> : null}
    {state.loaded && !state.items.length ? <View style={styles.empty}><Text style={styles.heading}>No properties yet</Text><Text style={styles.body}>Use Post below to add your first rental property.</Text></View> : null}
    {vm.portfolioItems.map(item => <PortfolioRentalCard key={item.propertyId} item={item} disabled={vm.portfolioActionsDisabled} onAction={key => act(item.propertyId, key)} request={requestActivity?.(item)} verificationError={vm.propertyVerificationState?.propertyId === item.propertyId ? vm.propertyVerificationState.error : null}
      deletion={offersUnfinishedDelete(item) ? { onDelete: () => void vm.requestPortfolioDeletion(item.propertyId), reason: deleteBlockedReason(vm.unfinishedPostState, item.propertyId) } : null}
      cleanup={vm.unfinishedPostState?.pending.some(job => job.propertyId === item.propertyId) ? { busy: vm.unfinishedPostState.busy, onRetry: () => vm.resumeUnfinishedPostCleanup(item.propertyId) } : null} />)}
    {noMatch ? <Text style={styles.body}>{state.query.trim() || state.filter === 'all' ? 'No matching properties or listings. Try a title, property type, barangay or city.' : portfolioFilterEmptyText[state.filter]}</Text> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...ui.pageTitle, flex: 1, minWidth: 0 }, heading: { ...ui.sectionTitle }, body: { ...ui.body },
  iconButton: { ...ui.panel, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { ...ui.sectionTitle, fontSize: 24, lineHeight: 28 },
  search: { ...ui.control, ...ui.body, paddingHorizontal: spacing.md }, empty: { paddingVertical: spacing.lg, gap: spacing.xs },
});
