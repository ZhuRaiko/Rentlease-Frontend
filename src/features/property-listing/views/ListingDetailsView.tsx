import type {ReactNode} from 'react';
import {PropertyVerificationAction} from '../components/PropertyVerificationAction';
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
import { rentalTermOptions } from '../models/PersistedListingDraft';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

// Page 2: rental offering only; persistence is coordinated by the ViewModel.
export function ListingDetailsView({ viewModel: vm, onClose, priceGuidance }: { priceGuidance?:ReactNode; viewModel: PropertyListingViewModel; onClose: () => void }) {
  if(vm.draftHydration.status==='loading'||vm.draftHydration.status==='error')return <ListingWizardScaffold title="Listing details" onBack={vm.goBack} onClose={onClose}>
    <Text accessibilityRole="header" style={styles.heading}>{vm.draftHydration.status==='error'?'Saved details could not load':'Loading saved details'}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{vm.draftHydration.error??'Loading your saved listing, property details, and photos. You can go back while this finishes.'}</Text>
    {vm.draftHydration.status==='error'?<><ListingWorkspaceFeedback viewModel={vm} scope="draft"/><ListingButton label="Retry loading" onPress={vm.retryDraftHydration}/></>:null}
    <ListingButton label="Back to My Rentals" tone="outline" onPress={vm.goBack}/>
  </ListingWizardScaffold>;
  const draft = vm.draft, property = vm.propertySummary;
  const editable = !vm.listingDraftReadOnly && !vm.composerPhase && !(vm.publishedEditing && vm.listingDraftState.busy);
  const saveLabel = vm.publishedEditing&&vm.listingDraftState.busy?'Saving changes...':vm.composerPhase ? (vm.composerPhase === 'property' ? 'Saving property...' : vm.composerPhase === 'photos' ? 'Saving photos...' : 'Saving listing draft...') : vm.publishedEditing?'Save Changes':'Save Draft';
  const footer = <PropertyProgressFooter viewModel={vm} action={{label:saveLabel,disabled:vm.composerSaveDisabled,onPress:()=>void vm.saveComposerDraft()}} guidance={<>
    {vm.propertyValidationIssues?.length ? <PropertyReadinessNotice viewModel={vm}/> : null}
    <ListingWorkspaceFeedback viewModel={vm} scope="draft" />
    {vm.composerPhase && !vm.listingDraftState.busy ? <FeedbackNotice message="Saving your progress. Keep this screen open until saving finishes." /> : null}
    {!vm.composerPhase && !vm.listingDraftState.error && vm.listingValidationIssue ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{vm.listingValidationIssue.message}</Text> : null}
  </>} />;
  return <ListingWizardScaffold title={vm.listingDraftState.lastConfirmed?"Edit Listing":"Listing Details"} onBack={vm.goBack} onClose={onClose} footer={footer}>
    {vm.publishedEditing?<Text accessibilityLiveRegion="polite" style={styles.copy}>Editing {vm.listingDraftState.lastConfirmed?.status==='paused'?'Paused':'Published'} listing. Saving changes preserves this status.</Text>:null}
    <Text style={styles.copy}>{vm.publishedEditing?'* Required to save changes':'* Required to save a listing draft'}</Text>
    <View style={styles.summary}>
      <Text accessibilityRole="header" style={styles.heading}>Property Details</Text>
      <Text style={styles.body}>{property.type}</Text>
      <Text style={styles.copy}>{property.bedrooms} bedrooms ? {property.bathrooms} bathrooms</Text>
      <Text style={styles.copy}>{property.location || 'Location not entered'}</Text>
      {vm.propertyEditAvailable?<ListingButton label="Edit Property" tone="outline" disabled={!editable} onPress={vm.openPropertyDetails}/>:null}
      {!vm.workspacePropertyId?<ListingButton label="Edit property" tone="outline" onPress={vm.editComposerProperty}/>:null}
    </View>
    {vm.workspacePropertyId?<View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Property Photos</Text>
      <Text style={styles.copy}>{vm.mediaItems.length} photos. Shared by listings for this physical property.</Text>
      <ListingButton label="Manage Property Photos" tone="outline" disabled={!editable} onPress={()=>vm.navigate('photoManager')}/>
    </View>:null}
    <Text accessibilityRole="header" style={styles.heading}>Listing Details</Text>
    {vm.listingEditExplanation ? <FeedbackNotice message={vm.listingEditExplanation} /> : null}
    {!vm.publishedEditing?<PropertyVerificationAction viewModel={vm} />:null}
    <ComposerRecoveryFeedback viewModel={vm} />
    <ListingField editable={editable} required error={vm.listingValidationIssue?.field==='title'?vm.listingValidationIssue.message:null} helper={<CompletenessHint value={vm.completeness} factor="title" />} label="Listing title" placeholder="e.g. Bright 1-bedroom apartment in Imus" value={draft.title} onChangeText={v => vm.updateDraft('title', v)} />
    <ListingField editable={editable} required error={vm.listingValidationIssue?.field==='askingRent'?vm.listingValidationIssue.message:null} helper={<CompletenessHint value={vm.completeness} factor="rent" />} label="Monthly asking rent" prefix="₱" keyboardType="numeric" placeholder="Enter monthly rent" value={draft.askingRent} onChangeText={v => vm.updateDraft('askingRent', v)} />
    {priceGuidance}
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
    <Text style={styles.copy}>{vm.publishedEditing?'Save changes updates this listing without changing its publication status.':vm.listingDraftState.lastConfirmed?.status==='draft'?'Save draft updates this existing listing. It does not publish it.':'Save draft keeps confirmed property and photo progress. Nothing is published automatically.'}</Text>
    {vm.publicationReview?.visible ? <>
      <Text accessibilityLiveRegion="polite" style={styles.copy}>{vm.publicationReview.state}. {vm.publicationReview.message}</Text>
      <ListingButton label="Review Publication" tone="outline" disabled={vm.publicationReviewDisabled} onPress={vm.requestPublish} />
    </> : null}
    {!vm.publishedEditing?<ListingButton label="Preview listing" tone="outline" disabled={vm.photoState.busy || !!vm.composerPhase} onPress={vm.openComposerPreview} />:null}
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({ heading: { ...ui.sectionTitle }, body: { ...ui.body }, copy: { ...ui.supporting }, section: { gap: spacing.sm }, summary: { gap: spacing.xs, paddingVertical: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
