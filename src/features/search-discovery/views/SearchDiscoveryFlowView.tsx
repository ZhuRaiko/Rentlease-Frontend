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
  onClose: () => void;
  onCreateListing?: (() => void) | undefined;
  onOpenListings?: (() => void) | undefined;
  onOpenPriceEstimate: () => void;
  onOpenChat: () => void;
  onOpenMaintenance: () => void;
  onStartInquiry: () => void;
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
  onClose,
  onCreateListing,
  onOpenListings,
  onOpenPriceEstimate,
  onOpenChat,
  onOpenMaintenance,
  onStartInquiry,
}: SearchDiscoveryFlowViewProps) {
  const viewModel = useSearchDiscoveryViewModel(initialScreen);
  let content;

  if (searchScreens.has(viewModel.screen)) {
    content = <SearchLocationView viewModel={viewModel} />;
  } else if (filterScreens.has(viewModel.screen)) {
    content = <DiscoveryFilterView onClose={onClose} viewModel={viewModel} />;
  } else if (viewModel.screen === 'propertyDetails') {
    content = (
      <PropertyDiscoveryDetailView
        onClose={onClose}
        onOpenPriceEstimate={onOpenPriceEstimate}
        onStartInquiry={onStartInquiry}
        viewModel={viewModel}
      />
    );
  } else if (supplementaryScreens.has(viewModel.screen)) {
    content = <PropertySupplementaryView viewModel={viewModel} />;
  } else {
    content = <TenantDiscoveryView onClose={onClose} viewModel={viewModel} />;
  }

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <RentLeaseBottomNavigation
        active="discover"
        onChat={onOpenChat}
        onDiscover={viewModel.openHome}
        onListing={() => {
          if (isLandlord && onOpenListings) {
            onOpenListings();
            return;
          }
          viewModel.setNotice('Listing management unlocks after Tier 3 landlord verification.');
          viewModel.openHome();
        }}
        onPost={() => {
          if (isLandlord && onCreateListing) {
            onCreateListing();
            return;
          }
          viewModel.setNotice('Property posting unlocks after Tier 3 landlord verification.');
          viewModel.openHome();
        }}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
