import { useEffect } from 'react';
import { NavigationConfirmation } from '../../../shared/components/NavigationConfirmation';
import type { MatchingPreferences } from '../models/SearchDiscovery';
import { StatusBar, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { colors } from '../../../shared/theme/colors';
import { useSearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';
import { DiscoveryFilterView } from './DiscoveryFilterView';
import { PropertyDiscoveryDetailView } from './PropertyDiscoveryDetailView';
import { PropertySupplementaryView } from './PropertySupplementaryView';
import { SearchLocationView } from './SearchLocationView';
import { TenantDiscoveryView } from './TenantDiscoveryView';

interface SearchDiscoveryFlowViewProps {
  isLandlord: boolean;
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
  isLandlord,
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
  const viewModel = useSearchDiscoveryViewModel(initialScreen, { introduction, initialPreferences, onSavePreferences, onIntroductionComplete });
  const close = () => viewModel.closeFromWorkspace(onClose);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onClose, onRootBack));
    return () => registerBackAction?.(null);
  });
  let content;

  if (searchScreens.has(viewModel.screen)) {
    content = <SearchLocationView viewModel={viewModel} />;
  } else if (filterScreens.has(viewModel.screen)) {
    content = <DiscoveryFilterView onClose={close} viewModel={viewModel} />;
  } else if (viewModel.screen === 'propertyDetails') {
    content = (
      <PropertyDiscoveryDetailView
        onClose={close}
        onOpenPriceEstimate={onOpenPriceEstimate}
        onStartInquiry={onStartInquiry}
        viewModel={viewModel}
      />
    );
  } else if (supplementaryScreens.has(viewModel.screen)) {
    content = <PropertySupplementaryView viewModel={viewModel} />;
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
          if (isLandlord && onOpenListings) {
            viewModel.requestNavigation(onOpenListings);
            return;
          }
          viewModel.setNotice('Listings require the Landlord role. You can continue browsing in Discover.');
        }}
        onPost={() => {
          if (isLandlord && onCreateListing) {
            viewModel.requestNavigation(onCreateListing);
            return;
          }
          viewModel.setNotice('Posting requires the Landlord role. Verification does not grant roles.');
        }}
        onTenancy={() => viewModel.requestNavigation(onOpenMaintenance)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
