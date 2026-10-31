import { Text, StyleSheet } from 'react-native';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { ListingButton } from '../components/ListingButton';
import { ui } from '../../../shared/theme/ui';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function ListingDraftSavedView({viewModel:vm,onClose}:{viewModel:PropertyListingViewModel;onClose:()=>void}) {
  return <ListingWizardScaffold title="Listing Draft Saved!" onBack={vm.goDashboard} onClose={onClose}>
    <Text accessibilityLiveRegion="polite" style={styles.body}>Your listing draft is saved to your account. It is not published. You can keep editing and publish when it is ready.</Text>
    <ListingButton label="Open saved listing" onPress={vm.openSavedDraft} />
    <ListingButton label="My Listings" tone="outline" onPress={vm.goDashboard} />
  </ListingWizardScaffold>;
}
const styles=StyleSheet.create({body:{...ui.body}});
