import { PropertyProgressFooter, PropertyReadinessNotice } from '../components/PropertyProgressFooter';
import { CompletenessHint } from '../components/CompletenessHint';
import { AvailabilityDateField } from '../components/AvailabilityDateField';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ComposerRecoveryFeedback } from '../components/ComposerRecoveryFeedback';
import { ListingWorkspaceFeedback } from '../components/ListingWorkspaceFeedback';
import { ChoiceChip, ListingField } from '../components/ListingControls';
import { ListingButton } from '../components/ListingButton';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { hasConfirmedPropertyLocation } from '../models/DraftProperty';
import { rentalTermOptions } from '../models/PersistedListingDraft';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

// Page 2: rental offering only; persistence is coordinated by the ViewModel.
export function ListingDetailsView({ viewModel: vm, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const draft = vm.draft, property = vm.propertySummary;
  const editable = !vm.listingDraftReadOnly && !vm.composerPhase;
  const saveLabel = vm.composerPhase ? (vm.composerPhase === 'property' ? 'Saving property...' : vm.composerPhase === 'photos' ? 'Saving photos...' : 'Saving listing draft...') : 'Save Draft';
  const footer = <PropertyProgressFooter viewModel={vm} action={{label:saveLabel,disabled:vm.composerSaveDisabled,onPress:()=>void vm.saveComposerDraft()}} guidance={<>
    {vm.propertyValidationIssues?.length ? <PropertyReadinessNotice viewModel={vm}/> : null}
    <ListingWorkspaceFeedback viewModel={vm} scope="draft" />
    {vm.composerPhase && !vm.listingDraftState.busy ? <FeedbackNotice message="Saving your progress. Keep this screen open until saving finishes." /> : null}
    {!vm.composerPhase && !vm.listingDraftState.error && vm.listingValidationIssue ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{vm.listingValidationIssue.message}</Text> : null}
  </>} />;
  return <ListingWizardScaffold title="Listing details" onBack={vm.goBack} onClose={onClose} footer={footer}>
    <Text style={styles.copy}>* Required to save a listing draft</Text>
    <View style={styles.summary}>
      <Text style={styles.heading}>{property.type}</Text>
      <Text style={styles.body}>{property.bedrooms} bedrooms · {property.bathrooms} bathrooms</Text>
      <Text style={styles.copy}>{property.location || 'Location not entered'}</Text>
      <Text style={styles.copy}>{vm.mediaItems.length} photos · {vm.workspacePropertyId ? 'Saved property location' : hasConfirmedPropertyLocation(vm.propertyState.draft) ? 'Location confirmed' : 'Location not confirmed'}</Text>
      <ListingButton label={vm.workspacePropertyId ? "Property and photos" : "Edit property"} tone="outline" onPress={vm.editComposerProperty} />
    </View>
    {vm.listingEditExplanation ? <FeedbackNotice message={vm.listingEditExplanation} /> : null}
    {vm.workspacePropertyId ? <Text style={styles.copy}>{vm.propertyVerificationLabel ? `${vm.propertyVerificationLabel}. ` : ""}Property-specific Tier 3 approval is required to publish. Photos and draft editing do not require it.</Text> : null}
    <ComposerRecoveryFeedback viewModel={vm} />
    <ListingField editable={editable} required error={vm.listingValidationIssue?.field==='title'?vm.listingValidationIssue.message:null} helper={<CompletenessHint value={vm.completeness} factor="title" />} label="Listing title" placeholder="e.g. Bright 1-bedroom apartment in Imus" value={draft.title} onChangeText={v => vm.updateDraft('title', v)} />
    <ListingField editable={editable} required error={vm.listingValidationIssue?.field==='askingRent'?vm.listingValidationIssue.message:null} helper={<CompletenessHint value={vm.completeness} factor="rent" />} label="Monthly asking rent" prefix="₱" keyboardType="numeric" placeholder="Enter monthly rent" value={draft.askingRent} onChangeText={v => vm.updateDraft('askingRent', v)} />
    <ListingField editable={editable} required helper={<CompletenessHint value={vm.completeness} factor="description" />} error={vm.listingValidationIssue?.field==='description'?vm.listingValidationIssue.message:null} label="Description" multiline placeholder="Describe the space and what tenants should know." value={draft.description} onChangeText={v => vm.updateDraft('description', v)} />
    <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Rental terms</Text>
      <FeedbackNotice message={vm.listingValidationIssue?.field==='rentalTerm'?vm.listingValidationIssue.message:null} tone="error" />
      <View style={styles.chips}>{rentalTermOptions.map(option => <ChoiceChip disabled={!editable} key={option.value} label={option.label} selected={draft.rentalTerm === option.value} onPress={() => vm.updateDraft('rentalTerm', option.value)} />)}</View>
      <ListingField editable={editable} error={vm.listingValidationIssue?.field==='securityDepositMonths'?vm.listingValidationIssue.message:null} label="Security deposit (months)" placeholder="1" keyboardType="numeric" value={draft.securityDepositMonths} onChangeText={v => vm.updateDraft('securityDepositMonths', v)} />
      <ListingField editable={editable} error={vm.listingValidationIssue?.field==='advanceRentMonths'?vm.listingValidationIssue.message:null} label="Advance rent (months)" placeholder="1" keyboardType="numeric" value={draft.advanceRentMonths} onChangeText={v => vm.updateDraft('advanceRentMonths', v)} />
      <ListingField editable={editable} error={vm.listingValidationIssue?.field==='minimumStayMonths'?vm.listingValidationIssue.message:null} label="Minimum stay (months, optional)" placeholder="Leave blank if not specified" keyboardType="numeric" value={draft.minimumStayMonths} onChangeText={v => vm.updateDraft('minimumStayMonths', v)} />
    </View>
    <ListingField editable={editable} label="House rules (optional)" multiline placeholder="Include any rules tenants need to know." value={draft.houseRules} onChangeText={v => vm.updateDraft('houseRules', v)} />
    <AvailabilityDateField disabled={!editable} value={draft.availableDate} onChange={v => vm.updateDraft('availableDate', v)} />
    <CompletenessHint value={vm.completeness} factor="availableDate" />
    <FeedbackNotice message={vm.listingValidationIssue?.field==='availableDate'?vm.listingValidationIssue.message:null} tone="error" />
    <Text style={styles.copy}>Save draft keeps confirmed property and photo progress. Nothing is published automatically.</Text>
    {vm.publicationReview?.visible ? <>
      <Text accessibilityLiveRegion="polite" style={styles.copy}>{vm.publicationReview.state}. {vm.publicationReview.message}</Text>
      <ListingButton label="Review Publication" tone="outline" disabled={vm.publicationReviewDisabled} onPress={vm.requestPublish} />
    </> : null}
    <ListingButton label="Preview listing" tone="outline" disabled={vm.photoState.busy || !!vm.composerPhase} onPress={vm.openComposerPreview} />
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({ heading: { ...ui.sectionTitle }, body: { ...ui.body }, copy: { ...ui.supporting }, section: { gap: spacing.sm }, summary: { gap: spacing.xs, paddingVertical: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
