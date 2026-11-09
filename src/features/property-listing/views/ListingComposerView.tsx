import type {ReactNode} from 'react';
import {ListingButton} from '../components/ListingButton';
import {ScreenContainer} from '../../../shared/components/ScreenContainer';
import { usePropertyFormFocus } from '../components/usePropertyFormFocus';
import { PropertyProgressFooter } from '../components/PropertyProgressFooter';
import { PropertyAmenitiesFields } from '../components/PropertyAmenitiesFields';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ComposerPropertyFields } from '../components/ComposerPropertyFields';
import { ComposerRecoveryFeedback } from '../components/ComposerRecoveryFeedback';
import { PropertyMediaSection } from '../components/PropertyMediaSection';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { PropertyLocationToolView } from './PropertyLocationToolView';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

// Page 1: physical property only. Next confirms property persistence before opening listing details.
export function ListingComposerView({ viewModel: vm, onClose, estimateSection }: { estimateSection?:ReactNode; viewModel: PropertyListingViewModel; onClose: () => void }) {
  const focus=usePropertyFormFocus(vm.propertyValidationTarget);
  const mapOpen = ['searching', 'candidates', 'map'].includes(vm.locationState.stage);
  return <>
    <Modal visible={mapOpen} onRequestClose={vm.propertyLocation.cancel} animationType="slide"><ScreenContainer padded={false}><PropertyLocationToolView viewModel={vm} onClose={vm.propertyLocation.cancel} /></ScreenContainer></Modal>
    <ListingWizardScaffold formFocus={focus} footer={<PropertyProgressFooter viewModel={vm}/>} title="Property" onBack={vm.goBack} onClose={onClose}>
      {!vm.workspacePropertyId ? <Text style={styles.copy}>* Required to save the property</Text> : null}
      <PropertyMediaSection viewModel={vm} />
      <ComposerRecoveryFeedback viewModel={vm} />
      {estimateSection}
    {vm.propertyEditAvailable?<ListingButton label="Edit Property Details" tone="outline" disabled={vm.portfolioActionsDisabled} onPress={vm.openPropertyDetails}/>:null}
      <ComposerPropertyFields viewModel={vm} focus={focus}>
        <View collapsable={false} ref={focus.section('amenities')}><PropertyAmenitiesFields viewModel={vm} /></View>
      </ComposerPropertyFields>
    </ListingWizardScaffold>
  </>;
}
const styles = StyleSheet.create({ section: { gap: spacing.sm }, heading: { ...ui.sectionTitle }, copy: { ...ui.supporting }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
