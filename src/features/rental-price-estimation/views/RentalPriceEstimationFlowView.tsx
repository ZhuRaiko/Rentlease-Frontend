import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import type { EstimateActor } from '../models/RentalPriceEstimate';
import { useRentalPriceEstimationViewModel } from '../viewModels/useRentalPriceEstimationViewModel';
import { RentalPriceEstimationView } from './RentalPriceEstimationView';

interface RentalPriceEstimationFlowViewProps {
  actor: EstimateActor;
  accountId?:string|undefined;
  canPostProperty: boolean;
  onClose: () => void;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
  onCreateListing: () => void;
  onOpenChat: () => void;
  onOpenDiscover: () => void;
  onOpenListings: () => void;
  onOpenMaintenance: () => void;
}

export function RentalPriceEstimationFlowView({
  actor,
  accountId,
  canPostProperty,
  onClose,
  registerBackAction,
  onCreateListing,
  onOpenChat,
  onOpenDiscover,
  onOpenListings,
  onOpenMaintenance,
}: RentalPriceEstimationFlowViewProps) {
  const viewModel = useRentalPriceEstimationViewModel(actor,accountId);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onClose));
    return () => registerBackAction?.(null);
  });

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>
        <RentalPriceEstimationView onClose={onClose} viewModel={viewModel} />
      </View>
      <RentLeaseBottomNavigation
        active={null}
        onChat={onOpenChat}
        onDiscover={onOpenDiscover}
        onListing={() => {
          if (canPostProperty) {
            onOpenListings();
            return;
          }
        }}
        onPost={() => {
          if (canPostProperty) {
            onCreateListing();
            return;
          }
        }}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
