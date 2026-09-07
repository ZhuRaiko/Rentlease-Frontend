import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import type { RatingsReportsActor } from '../models/RatingsReports';
import { useRatingsReportsViewModel } from '../viewModels/useRatingsReportsViewModel';
import { RatingsReportsHomeView } from './RatingsReportsHomeView';
import { ReportFlowView } from './ReportFlowView';
import { ReviewFlowView } from './ReviewFlowView';

interface RatingsReportsFlowViewProps {
  actor: RatingsReportsActor;
  isLandlord: boolean;
  onClose: () => void;
  onCreateListing: () => void;
  onOpenChat: () => void;
  onOpenDiscover: () => void;
  onOpenListings: () => void;
  onOpenMaintenance: () => void;
}

const reviewScreens = new Set([
  'reviewAvailable',
  'rateParticipant',
  'starRating',
  'writtenReview',
  'reviewConfirmation',
  'reviewSubmitted',
  'awaitingPublication',
  'reviewsSummary',
]);

export function RatingsReportsFlowView({
  actor,
  isLandlord,
  onClose,
  onCreateListing,
  onOpenChat,
  onOpenDiscover,
  onOpenListings,
  onOpenMaintenance,
}: RatingsReportsFlowViewProps) {
  const viewModel = useRatingsReportsViewModel(actor);
  const content = viewModel.screen === 'home' ? (
    <RatingsReportsHomeView onClose={onClose} viewModel={viewModel} />
  ) : reviewScreens.has(viewModel.screen) ? (
    <ReviewFlowView viewModel={viewModel} />
  ) : (
    <ReportFlowView viewModel={viewModel} />
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
          viewModel.openHome();
          viewModel.setNotice('Listing management unlocks after Tier 3 landlord verification.');
        }}
        onPost={() => {
          if (isLandlord) {
            onCreateListing();
            return;
          }
          viewModel.openHome();
          viewModel.setNotice('Property posting unlocks after Tier 3 landlord verification.');
        }}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
