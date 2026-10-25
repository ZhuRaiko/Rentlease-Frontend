import { PublishedListingStatusView } from './PublishedListingStatusView';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { ListingButton } from '../components/ListingButton';
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
  } else if (viewModel.screen === 'published' && viewModel.showRealPublication && viewModel.publicationState.publishedListingId) {
    content = <PublishedListingStatusView viewModel={viewModel} onClose={close} />;
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
      <FeedbackNotice message={viewModel.publicationState.busy ? 'Checking publication...' : viewModel.publicationState.error} tone={viewModel.publicationState.busy ? 'info' : 'error'} />
      {viewModel.propertyState.propertyId && !viewModel.publicationState.busy && (viewModel.publicationState.error || viewModel.publicationState.uncertain) ? <ListingButton label="Check publication status" tone="outline" onPress={() => void viewModel.checkPublication()} /> : null}
      <FeedbackNotice message={viewModel.listingDraftState.busy ? 'Checking or saving your listing draft...' : viewModel.listingDraftState.error} tone={viewModel.listingDraftState.busy ? 'info' : 'error'} />
      {viewModel.propertyState.propertyId && !viewModel.publicationState.uncertain && viewModel.publicationState.status !== "active" && !viewModel.listingDraftState.busy && (viewModel.listingDraftState.error || viewModel.listingDraftState.uncertain) ? <ListingButton label={viewModel.listingDraftState.uncertain ? 'Load current backend draft to reconcile' : 'Retry loading listing draft'} tone="outline" onPress={() => void (viewModel.listingDraftState.uncertain ? viewModel.listingDraftPersistence.reconcile() : viewModel.listingDraftPersistence.load())} /> : null}
      <View style={styles.content}>{content}</View>
      <NavigationConfirmation title="Leave Property & Listing Management?" body="You have unsaved property, photo, or listing changes. Stay to continue editing, or leave without saving." visible={viewModel.navigationConfirmation} onCancel={viewModel.cancelNavigation} onConfirm={viewModel.confirmNavigation} />
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
