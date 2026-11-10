import {TenancyReviewChooser} from './TenancyReviewChooser';
import { useEffect } from 'react';
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
  accountId?:string|undefined;
  actor: RatingsReportsActor;
  canPostProperty: boolean;
  onClose: () => void;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
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
  accountId,
  actor,
  canPostProperty,
  onClose,
  registerBackAction,
  onCreateListing,
  onOpenChat,
  onOpenDiscover,
  onOpenListings,
  onOpenMaintenance,
}: RatingsReportsFlowViewProps) {
  const viewModel = useRatingsReportsViewModel(actor);
  useEffect(() => {
    if(reviewScreens.has(viewModel.screen))return;
    registerBackAction?.(() => viewModel.backFromWorkspace(onClose));
    return () => registerBackAction?.(null);
  });
  const content = viewModel.screen === 'home' ? (
    <RatingsReportsHomeView accountId={accountId} onClose={onClose} viewModel={viewModel} />
  ) : reviewScreens.has(viewModel.screen) ? (
    <TenancyReviewChooser key={accountId} accountId={accountId} onBack={viewModel.openHome} registerBackAction={registerBackAction}/>
  ) : (
    <ReportFlowView viewModel={viewModel} />
  );

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <RentLeaseBottomNavigation
        active={null}
        onChat={onOpenChat}
        onDiscover={onOpenDiscover}
        onListing={() => {
          if (canPostProperty) {
            onOpenListings();
            return;
          }
          viewModel.openHome();
          viewModel.setNotice('Complete account verification to manage listings.');
        }}
        onPost={() => {
          if (canPostProperty) {
            onCreateListing();
            return;
          }
          viewModel.openHome();
          viewModel.setNotice('Complete account verification before posting.');
        }}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
