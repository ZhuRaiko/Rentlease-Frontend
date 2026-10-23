import { useEffect } from 'react';
import { NavigationConfirmation } from '../../../shared/components/NavigationConfirmation';
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
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
  onClose: () => void;
  onRootBack: () => void;
  onOpenDiscover: () => void;
  onOpenPriceEstimate: () => void;
  onOpenChat: () => void;
  onOpenMaintenance: () => void;
}

const createScreens = new Set([
  'postingType',
  'propertySetup',
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
  registerBackAction,
  onClose,
  onRootBack,
  onOpenDiscover,
  onOpenPriceEstimate,
  onOpenChat,
  onOpenMaintenance,
}: PropertyListingFlowViewProps) {
  const viewModel = usePropertyListingViewModel(initialScreen);
  const close = () => viewModel.requestNavigation(onClose);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onRootBack));
    return () => registerBackAction?.(null);
  });
  let content;

  if (viewModel.screen === 'dashboard' || viewModel.screen === 'empty') {
    content = <PropertyDashboardView viewModel={viewModel} />;
  } else if (createScreens.has(viewModel.screen)) {
    content = <CreateListingView onClose={close} viewModel={viewModel} />;
  } else if (previewScreens.has(viewModel.screen)) {
    content = <ListingPreviewView onClose={close} viewModel={viewModel} />;
  } else if (managementScreens.has(viewModel.screen)) {
    content = (
      <ListingManagementView
        onClose={close}
        onOpenPriceEstimate={() => viewModel.requestNavigation(onOpenPriceEstimate)}
        viewModel={viewModel}
      />
    );
  } else {
    content = (
      <ListingDetailView
        onClose={close}
        onOpenPriceEstimate={() => viewModel.requestNavigation(onOpenPriceEstimate)}
        viewModel={viewModel}
      />
    );
  }


  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <NavigationConfirmation visible={viewModel.navigationConfirmation} onCancel={viewModel.cancelNavigation} onConfirm={viewModel.confirmNavigation} />
      <RentLeaseBottomNavigation
        active={viewModel.activeTab}
        onChat={() => viewModel.requestNavigation(onOpenChat)}
        onDiscover={() => viewModel.requestNavigation(onOpenDiscover)}
        onListing={viewModel.goDashboard}
        onPost={viewModel.startCreate}
        onTenancy={() => viewModel.requestNavigation(onOpenMaintenance)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
