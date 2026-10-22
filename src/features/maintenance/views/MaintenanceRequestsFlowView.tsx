import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import type { MaintenanceActor } from '../models/MaintenanceRequest';
import { useMaintenanceRequestsViewModel } from '../viewModels/useMaintenanceRequestsViewModel';
import { MaintenanceDetailView } from './MaintenanceDetailView';
import { MaintenanceListView } from './MaintenanceListView';
import { MaintenanceRequestFormView } from './MaintenanceRequestFormView';

interface MaintenanceRequestsFlowViewProps {
  actor: MaintenanceActor;
  isLandlord: boolean;
  onClose: () => void;
  onRootBack: () => void;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
  onCreateListing: () => void;
  onOpenChat: () => void;
  onOpenDiscover: () => void;
  onOpenListings: () => void;
}

const listScreens = new Set(['requests', 'empty']);
const formScreens = new Set(['create', 'issueDetails', 'priority', 'photoUpload', 'review', 'submitted']);

export function MaintenanceRequestsFlowView({
  actor,
  isLandlord,
  onClose,
  onRootBack,
  registerBackAction,
  onCreateListing,
  onOpenChat,
  onOpenDiscover,
  onOpenListings,
}: MaintenanceRequestsFlowViewProps) {
  const viewModel = useMaintenanceRequestsViewModel(actor);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onRootBack));
    return () => registerBackAction?.(null);
  });
  const content = listScreens.has(viewModel.screen) ? (
    <MaintenanceListView onClose={onClose} viewModel={viewModel} />
  ) : formScreens.has(viewModel.screen) ? (
    <MaintenanceRequestFormView viewModel={viewModel} />
  ) : (
    <MaintenanceDetailView viewModel={viewModel} />
  );

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <RentLeaseBottomNavigation
        active="tenancy"
        onChat={onOpenChat}
        onDiscover={onOpenDiscover}
        onListing={() => {
          if (isLandlord) {
            onOpenListings();
            return;
          }
          viewModel.openRequests();
          viewModel.setNotice('Listings require the Landlord role. You can continue browsing in Discover.');
        }}
        onPost={() => {
          if (isLandlord) {
            onCreateListing();
            return;
          }
          viewModel.openRequests();
          viewModel.setNotice('Posting requires the Landlord role. Verification does not grant roles.');
        }}
        onTenancy={viewModel.openRequests}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
