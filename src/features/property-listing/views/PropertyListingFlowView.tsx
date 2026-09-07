import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { usePropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
import { CreateListingView } from './CreateListingView';
import { ListingDetailView } from './ListingDetailView';
import { ListingManagementView } from './ListingManagementView';
import { ListingPreviewView } from './ListingPreviewView';
import { PropertyDashboardView } from './PropertyDashboardView';

interface PropertyListingFlowViewProps {
  initialScreen?: 'dashboard' | 'postingType';
  onClose: () => void;
  onOpenDiscover: () => void;
  onOpenPriceEstimate: () => void;
  onOpenChat: () => void;
  onOpenMaintenance: () => void;
}

const createScreens = new Set([
  'postingType',
  'photoUpload',
  'photoManager',
  'basicInfo',
  'specifications',
  'address',
  'mapConfirm',
  'amenities',
  'rentTerms',
  'description',
  'rules',
  'availability',
]);

const previewScreens = new Set(['preview', 'missingRequirements', 'publishConfirmation']);

const managementScreens = new Set([
  'management',
  'editListing',
  'pauseConfirmation',
  'reactivateConfirmation',
  'unavailableConfirmation',
  'archiveConfirmation',
]);

export function PropertyListingFlowView({
  initialScreen = 'dashboard',
  onClose,
  onOpenDiscover,
  onOpenPriceEstimate,
  onOpenChat,
  onOpenMaintenance,
}: PropertyListingFlowViewProps) {
  const viewModel = usePropertyListingViewModel(initialScreen);
  let content;

  if (viewModel.screen === 'dashboard' || viewModel.screen === 'empty') {
    content = <PropertyDashboardView viewModel={viewModel} />;
  } else if (createScreens.has(viewModel.screen)) {
    content = <CreateListingView onClose={onClose} viewModel={viewModel} />;
  } else if (previewScreens.has(viewModel.screen)) {
    content = <ListingPreviewView onClose={onClose} viewModel={viewModel} />;
  } else if (managementScreens.has(viewModel.screen)) {
    content = (
      <ListingManagementView
        onClose={onClose}
        onOpenPriceEstimate={onOpenPriceEstimate}
        viewModel={viewModel}
      />
    );
  } else {
    content = (
      <ListingDetailView
        onClose={onClose}
        onOpenPriceEstimate={onOpenPriceEstimate}
        viewModel={viewModel}
      />
    );
  }

  const activeTab =
    createScreens.has(viewModel.screen) || previewScreens.has(viewModel.screen)
      ? 'post'
      : 'listing';

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <RentLeaseBottomNavigation
        active={activeTab}
        onChat={onOpenChat}
        onDiscover={onOpenDiscover}
        onListing={viewModel.goDashboard}
        onPost={viewModel.startCreate}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
