import { Modal, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ComposerPropertyFields } from '../components/ComposerPropertyFields';
import { ComposerRecoveryFeedback } from '../components/ComposerRecoveryFeedback';
import { PropertyMediaSection } from '../components/PropertyMediaSection';
import { ChoiceChip } from '../components/ListingControls';
import { ListingButton } from '../components/ListingButton';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { amenities } from '../models/PropertyListing';
import { PropertyLocationToolView } from './PropertyLocationToolView';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

// Page 1: physical property only. Next is local navigation, never persistence.
export function ListingComposerView({ viewModel: vm, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const mapOpen = ['searching', 'candidates', 'map'].includes(vm.locationState.stage);
  return <>
    <Modal visible={mapOpen} onRequestClose={vm.propertyLocation.cancel} animationType="slide"><PropertyLocationToolView viewModel={vm} onClose={vm.propertyLocation.cancel} /></Modal>
    <ListingWizardScaffold title="Property" onBack={vm.goBack} onClose={onClose}>
      <PropertyMediaSection viewModel={vm} />
      <ComposerRecoveryFeedback viewModel={vm} />
      <ComposerPropertyFields viewModel={vm}>
        <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Amenities</Text>
          <View style={styles.chips}>{amenities.map(amenity => <ChoiceChip key={amenity} label={amenity} selected={vm.draft.amenities.includes(amenity)} disabled={!!vm.composerPhase || vm.listingDraftReadOnly} onPress={() => vm.toggleAmenity(amenity)} />)}</View>
          <Text style={styles.copy}>Amenity choices are local only. The backend catalogue is not connected yet.</Text>
        </View>
      </ComposerPropertyFields>
      <ListingButton label="Next: Listing details" disabled={vm.photoState.busy || vm.propertyState.busy || !!vm.composerPhase} onPress={vm.nextListingDetails} />
    </ListingWizardScaffold>
  </>;
}
const styles = StyleSheet.create({ section: { gap: spacing.sm }, heading: { ...ui.sectionTitle }, copy: { ...ui.supporting }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
