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
  onCreateListing,
  onOpenChat,
  onOpenDiscover,
  onOpenListings,
}: MaintenanceRequestsFlowViewProps) {
  const viewModel = useMaintenanceRequestsViewModel(actor);
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
          viewModel.setNotice('Listing management unlocks after Tier 3 landlord verification.');
        }}
        onPost={() => {
          if (isLandlord) {
            onCreateListing();
            return;
          }
          viewModel.openRequests();
          viewModel.setNotice('Property posting unlocks after Tier 3 landlord verification.');
        }}
        onTenancy={viewModel.openRequests}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
