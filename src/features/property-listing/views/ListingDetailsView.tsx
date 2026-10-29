import { StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ComposerRecoveryFeedback } from '../components/ComposerRecoveryFeedback';
import { ListingWorkspaceFeedback } from '../components/ListingWorkspaceFeedback';
import { ChoiceChip, ListingField } from '../components/ListingControls';
import { ListingButton } from '../components/ListingButton';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { draftPropertyError, hasConfirmedPropertyLocation } from '../models/DraftProperty';
import { rentalTermOptions } from '../models/PersistedListingDraft';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

// Page 2: rental offering only; persistence is coordinated by the ViewModel.
export function ListingDetailsView({ viewModel: vm, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const draft = vm.draft, property = vm.propertySummary;
  return <ListingWizardScaffold title="Listing details" onBack={vm.goBack} onClose={onClose}>
    <View style={styles.summary}>
      <Text style={styles.heading}>{property.type}</Text>
      <Text style={styles.body}>{property.bedrooms} bedrooms · {property.bathrooms} bathrooms</Text>
      <Text style={styles.copy}>{property.location || 'Location not entered'}</Text>
      <Text style={styles.copy}>{vm.mediaItems.length} photos · {vm.workspacePropertyId ? 'Saved property location' : hasConfirmedPropertyLocation(vm.propertyState.draft) ? 'Location confirmed' : 'Location not confirmed'}</Text>
      <ListingButton label="Edit property" tone="outline" onPress={vm.editComposerProperty} />
    </View>
    <ComposerRecoveryFeedback viewModel={vm} />
    <ListingWorkspaceFeedback viewModel={vm} scope="draft" />
    <ListingField label="Listing title" placeholder="e.g. Bright 1-bedroom apartment in Imus" value={draft.title} onChangeText={v => vm.updateDraft('title', v)} />
    <ListingField label="Monthly asking rent" prefix="₱" keyboardType="numeric" placeholder="Enter monthly rent" value={draft.askingRent} onChangeText={v => vm.updateDraft('askingRent', v)} />
    <ListingField label="Description" multiline placeholder="Describe the space and what tenants should know." value={draft.description} onChangeText={v => vm.updateDraft('description', v)} />
    <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Rental terms</Text>
      <View style={styles.chips}>{rentalTermOptions.map(option => <ChoiceChip key={option.value} label={option.label} selected={draft.rentalTerm === option.value} onPress={() => vm.updateDraft('rentalTerm', option.value)} />)}</View>
      <ListingField label="Security deposit (months)" placeholder="1" keyboardType="numeric" value={draft.securityDepositMonths} onChangeText={v => vm.updateDraft('securityDepositMonths', v)} />
      <ListingField label="Advance rent (months)" placeholder="1" keyboardType="numeric" value={draft.advanceRentMonths} onChangeText={v => vm.updateDraft('advanceRentMonths', v)} />
      <ListingField label="Minimum stay (months, optional)" placeholder="Leave blank if not specified" keyboardType="numeric" value={draft.minimumStayMonths} onChangeText={v => vm.updateDraft('minimumStayMonths', v)} />
    </View>
    <ListingField label="House rules (optional)" multiline placeholder="Include any rules tenants need to know." value={draft.houseRules} onChangeText={v => vm.updateDraft('houseRules', v)} />
    <ListingField label="Available from (optional)" placeholder="YYYY-MM-DD" value={draft.availableDate} onChangeText={v => vm.updateDraft('availableDate', v)} />
    {!vm.workspacePropertyId && !vm.propertyState.uncertain ? <FeedbackNotice message={draftPropertyError(vm.propertyState.draft)} /> : null}
    <Text style={styles.copy}>Save draft keeps confirmed property and photo progress. Nothing is published automatically.</Text>
    <ListingButton label={vm.composerPhase ? (vm.composerPhase === 'property' ? 'Saving property...' : vm.composerPhase === 'photos' ? 'Saving photos...' : 'Saving listing draft...') : 'Save draft'} disabled={vm.composerSaveDisabled} onPress={() => void vm.saveComposerDraft()} />
    <ListingButton label="Preview listing" tone="outline" disabled={vm.photoState.busy || !!vm.composerPhase} onPress={vm.openComposerPreview} />
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({ heading: { ...ui.sectionTitle }, body: { ...ui.body }, copy: { ...ui.supporting }, section: { gap: spacing.sm }, summary: { gap: spacing.xs, paddingVertical: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
