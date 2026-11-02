import { useEffect } from 'react';
import { NavigationConfirmation } from '../../../shared/components/NavigationConfirmation';
import type { MatchingPreferences } from '../models/SearchDiscovery';
import { StatusBar, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { colors } from '../../../shared/theme/colors';
import { useSearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';
import { DiscoveryFilterView } from './DiscoveryFilterView';
import { SearchLocationView } from './SearchLocationView';
import { TenantDiscoveryView } from './TenantDiscoveryView';
import { NearbyListingsView } from './NearbyListingsView';
import { LiveSearchResultsView, LivePropertyDetailView, LiveSearchFiltersView } from './LiveSearchViews';

interface SearchDiscoveryFlowViewProps {
  accountId?: string | undefined;
  canPostProperty: boolean;
  initialScreen?: 'home' | 'matchingPreferences';
  introduction?: boolean;
  initialPreferences?: MatchingPreferences | undefined;
  onSavePreferences?: ((value: MatchingPreferences) => void) | undefined;
  onIntroductionComplete?: (() => Promise<boolean>) | undefined;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
  onClose: () => void;
  onRootBack: () => void;
  onCreateListing?: (() => void) | undefined;
  onOpenListings?: (() => void) | undefined;
  onOpenPriceEstimate: () => void;
  onOpenChat: () => void;
  onOpenMaintenance: () => void;
  onStartInquiry: () => void;
  onOpenNotifications: () => void;
}

const searchScreens = new Set(['searchLocation', 'locationPermission']);
const filterScreens = new Set(['filters', 'sort', 'matchingPreferences']);
const supplementaryScreens = new Set([
  'photoGallery',
  'propertyAmenities',
  'nearbyPlaces',
  'propertyLocation',
]);

export function SearchDiscoveryFlowView({
  accountId,
  canPostProperty,
  initialScreen = 'home',
  introduction = false, initialPreferences, onSavePreferences, onIntroductionComplete, registerBackAction,
  onClose,
  onRootBack,
  onCreateListing,
  onOpenListings,
  onOpenPriceEstimate,
  onOpenChat,
  onOpenMaintenance,
  onStartInquiry, onOpenNotifications,
}: SearchDiscoveryFlowViewProps) {
  const viewModel = useSearchDiscoveryViewModel(initialScreen, { accountId, introduction, initialPreferences, onSavePreferences, onIntroductionComplete });
  const close = () => viewModel.closeFromWorkspace(onClose);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onClose, onRootBack));
    return () => registerBackAction?.(null);
  });
  let content;

  if (viewModel.screen === 'nearbyResults') {
    content = <NearbyListingsView viewModel={viewModel} />;
  } else if (['resultsList','noResults','searchError'].includes(viewModel.screen)) {
    content = <LiveSearchResultsView viewModel={viewModel} />;
  } else if (viewModel.screen === 'filters' || viewModel.screen === 'sort') {
    content = <LiveSearchFiltersView viewModel={viewModel} />;
  } else if (viewModel.screen === 'propertyDetails') {
    content = <LivePropertyDetailView viewModel={viewModel} />;
  } else if (searchScreens.has(viewModel.screen)) {
    content = <SearchLocationView viewModel={viewModel} />;
  } else if (filterScreens.has(viewModel.screen)) {
    content = <DiscoveryFilterView onClose={close} viewModel={viewModel} />;
  } else {
    content = <TenantDiscoveryView onClose={close} onOpenNotifications={() => viewModel.requestNavigation(onOpenNotifications)} viewModel={viewModel} />;
  }

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <NavigationConfirmation visible={viewModel.navigationConfirmation} onCancel={viewModel.cancelNavigation} onConfirm={viewModel.confirmNavigation} />
      <RentLeaseBottomNavigation
        disabled={viewModel.isCompletingIntroduction}
        active={viewModel.screen === 'matchingPreferences' ? null : 'discover'}
        onChat={() => viewModel.requestNavigation(onOpenChat)}
        onDiscover={() => viewModel.requestNavigation(viewModel.openHome)}
        onListing={() => {
          if (canPostProperty && onOpenListings) {
            viewModel.requestNavigation(onOpenListings);
            return;
          }
          viewModel.setNotice('Complete account verification to manage listings.');
        }}
        onPost={() => {
          if (canPostProperty && onCreateListing) {
            viewModel.requestNavigation(onCreateListing);
            return;
          }
          viewModel.setNotice('Complete account verification before posting.');
        }}
        onTenancy={() => viewModel.requestNavigation(onOpenMaintenance)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
