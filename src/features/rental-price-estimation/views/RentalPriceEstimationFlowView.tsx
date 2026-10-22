import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import type { EstimateActor } from '../models/RentalPriceEstimate';
import { useRentalPriceEstimationViewModel } from '../viewModels/useRentalPriceEstimationViewModel';
import { RentalPriceEstimationView } from './RentalPriceEstimationView';

interface RentalPriceEstimationFlowViewProps {
  actor: EstimateActor;
  isLandlord: boolean;
  onClose: () => void;
  onCreateListing: () => void;
  onOpenChat: () => void;
  onOpenDiscover: () => void;
  onOpenListings: () => void;
  onOpenMaintenance: () => void;
}

export function RentalPriceEstimationFlowView({
  actor,
  isLandlord,
  onClose,
  onCreateListing,
  onOpenChat,
  onOpenDiscover,
  onOpenListings,
  onOpenMaintenance,
}: RentalPriceEstimationFlowViewProps) {
  const viewModel = useRentalPriceEstimationViewModel(actor);

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
          if (isLandlord) {
            onOpenListings();
            return;
          }
          viewModel.setNotice('Listings require the Landlord role. You can continue browsing in Discover.');
        }}
        onPost={() => {
          if (isLandlord) {
            onCreateListing();
            return;
          }
          viewModel.setNotice('Posting requires the Landlord role. Verification does not grant roles.');
        }}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
