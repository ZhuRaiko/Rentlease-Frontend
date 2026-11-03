import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { DiscoveryButton, DiscoveryChip, DiscoveryHeader } from '../components/DiscoveryControls';
import {NearbyMapResultsView} from './NearbyMapResultsView';
import { NearbyRadiusSlider } from '../components/NearbyRadiusSlider';
import { NearbyListingCard } from '../components/NearbyListingCard';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

export function NearbyListingsView({ viewModel: vm }: { viewModel: SearchDiscoveryViewModel }) {
  const state = vm.gpsState;
  if(state.presentation==='map')return <NearbyMapResultsView viewModel={vm}/>;
  const busy = state.phase === 'locating' || state.phase === 'searching' || state.loadingMore;
  return <View style={styles.screen}>
    <DiscoveryHeader title="Nearby rentals" onBack={vm.goBack} />
    <FlatList data={state.rows} keyExtractor={item => item.listingId} contentContainerStyle={styles.content}
      renderItem={({ item }) => <NearbyListingCard listing={item} onPress={()=>vm.openProperty(item.listingId)} />}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.switcher}><DiscoveryChip label="Map" selected={false} onPress={()=>vm.gps.setPresentation('map')}/><DiscoveryChip label="List" selected onPress={()=>vm.gps.setPresentation('list')}/></View>
        <Text style={styles.copy}>Nearest first · Distances use approximate public property locations.</Text>
        <NearbyRadiusSlider value={state.radiusKm} disabled={state.phase==='locating'} onComplete={radius=>void vm.gps.setRadius(radius)}/>
        {state.photoError?<Text accessibilityRole="alert" style={styles.copy}>{state.photoError}</Text>:null}
        {busy ? <View accessibilityLiveRegion="polite" style={styles.progress}><ActivityIndicator color={colors.primary} /><Text style={styles.copy}>{state.phase === 'locating' ? 'Getting your current location…' : state.loadingMore ? 'Loading more rentals…' : 'Searching nearby rentals…'}</Text></View> : null}
        {state.error ? <View style={styles.header}>
          <Text accessibilityRole="alert" style={styles.error}>{state.error.message}</Text>
          {state.error.kind === 'blocked' ? <DiscoveryButton label="Open app settings" tone="outline" onPress={() => void vm.gps.openSettings()} /> : null}
          {!busy ? <DiscoveryButton label={state.rows.length ? 'Retry loading more' : 'Try again'} tone="outline" onPress={() => void vm.gps.retry()} /> : null}
        </View> : null}
        {state.phase === 'success' && state.rows.length === 0 ? <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>No nearby rentals found within {state.radiusKm} km</Text><Text style={styles.copy}>Try a wider radius or search by city. Listings may not yet be available in this area.</Text></View> : null}
      </View>}
      ListFooterComponent={<View style={styles.header}>
        {state.hasMore && !state.error ? <DiscoveryButton disabled={busy} label="Load more" onPress={() => void vm.gps.loadMore()} /> : null}
        <DiscoveryButton disabled={busy} label="Update my location" tone="outline" onPress={() => void vm.gps.start()} />
        <DiscoveryButton label="Search by city" tone="outline" onPress={() => vm.navigate('searchLocation')} />
        <Text style={styles.copy}>Your location is used for this search only and is not saved. Manual city search uses available RentLease listings.</Text>
      </View>} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg }, header: { gap: spacing.md },
  switcher:{flexDirection:'row',gap:spacing.sm},
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '700' },
  error: { color: colors.restricted, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
});
