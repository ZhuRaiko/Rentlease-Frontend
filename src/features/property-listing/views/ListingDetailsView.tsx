import {PostingSection} from '../components/PostingSection';
import {PostingChoices} from '../components/PostingChoices';
import {PostingProgress} from '../components/PostingProgress';
import type {ReactNode} from 'react';
import {PropertyVerificationAction} from '../components/PropertyVerificationAction';
import { PropertyProgressFooter, PropertyReadinessNotice } from '../components/PropertyProgressFooter';
import { CompletenessHint } from '../components/CompletenessHint';
import { AvailabilityDateField } from '../components/AvailabilityDateField';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import {colors} from '../../../shared/theme/colors';
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
  // Rent is entered on the Price step in the posting wizard; published editing still shows it here.
  const issueNow = vm.listingStepIssue;
  const editable = !vm.listingDraftReadOnly && !vm.composerPhase && !(vm.publishedEditing && vm.listingDraftState.busy);
  const saveLabel = vm.publishedEditing&&vm.listingDraftState.busy?'Saving changes...':vm.composerPhase ? (vm.composerPhase === 'property' ? 'Saving property...' : vm.composerPhase === 'photos' ? 'Saving photos...' : 'Saving listing draft...') : vm.publishedEditing?'Save Changes':'Save Draft';
  const footer = <PropertyProgressFooter compact={vm.postingWizard} viewModel={vm} action={vm.postingWizard?{label:vm.returnTo?'Save and return':'Continue to Price',disabled:!editable,onPress:vm.continuePostingEstimate}:{label:saveLabel,disabled:vm.composerSaveDisabled,onPress:()=>void vm.saveComposerDraft()}} guidance={<>
    {vm.propertyValidationIssues?.length ? <PropertyReadinessNotice viewModel={vm}/> : null}
    <ListingWorkspaceFeedback viewModel={vm} scope="draft" />
    {vm.composerPhase && !vm.listingDraftState.busy ? <FeedbackNotice message="Saving your progress. Keep this screen open until saving finishes." /> : null}
    {!vm.composerPhase && !vm.listingDraftState.error && issueNow ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{issueNow.message}</Text> : null}
  </>} />;
  return <ListingWizardScaffold menu={vm.postingEditorMenu?.(onClose)} progress={vm.postingWizard?<PostingProgress step={2}/>:undefined} title={vm.postingWizard?"Rental Listing":vm.listingDraftState.lastConfirmed?"Edit Listing":"Listing Details"} onBack={vm.goBack} onClose={onClose} footer={footer}>
    {vm.publishedEditing?<Text accessibilityLiveRegion="polite" style={styles.copy}>Editing {vm.listingDraftState.lastConfirmed?.status==='paused'?'Paused':'Published'} listing. Saving changes preserves this status.</Text>:null}
    <Text style={styles.copy}>{vm.publishedEditing?'* Required to save changes':'* Required to save a listing draft'}</Text>
    {!vm.postingWizard?<><View style={styles.summary}>
      <Text accessibilityRole="header" style={styles.heading}>Property Details</Text>
      <Text style={styles.body}>{property.type}</Text>
      <Text style={styles.copy}>{property.bedrooms} bedrooms / {property.bathrooms} bathrooms</Text>
      <Text style={styles.copy}>{property.location || 'Location not entered'}</Text>
      {vm.propertyEditAvailable?<ListingButton label="Edit Property" tone="outline" disabled={!editable} onPress={vm.openPropertyDetails}/>:null}
      {!vm.workspacePropertyId?<ListingButton label="Edit property" tone="outline" onPress={vm.editComposerProperty}/>:null}
    </View>
    {vm.workspacePropertyId?<View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Property Photos</Text>
      <Text style={styles.copy}>{vm.mediaItems.length} photos. Shared by listings for this physical property.</Text>
      <ListingButton label="Manage Property Photos" tone="outline" disabled={!editable} onPress={()=>vm.navigate('photoManager')}/>
    </View>:null}
    </>:null}
    {!vm.postingWizard?<Text accessibilityRole="header" style={styles.heading}>Listing Details</Text>:null}
    {vm.listingEditExplanation ? <FeedbackNotice message={vm.listingEditExplanation} /> : null}
    {!vm.postingWizard&&!vm.publishedEditing?<PropertyVerificationAction viewModel={vm} />:null}
    <ComposerRecoveryFeedback viewModel={vm} />
    <View style={styles.section}><ListingField editable={editable} required error={issueNow?.field==='title'?issueNow.message:null} helper={<CompletenessHint value={vm.completeness} factor="title" hidden={vm.postingWizard} />} label="Listing title" placeholder="e.g. Bright 1-bedroom apartment in Imus" value={draft.title} onChangeText={v => vm.updateDraft('title', v)} />
    {!vm.postingWizard||vm.publishedEditing?<ListingField editable={editable} required error={issueNow?.field==='askingRent'?issueNow.message:null} helper={<CompletenessHint value={vm.completeness} factor="rent" hidden={vm.postingWizard} />} label="Monthly asking rent" prefix="₱" keyboardType="numeric" placeholder="Enter monthly rent" value={draft.askingRent} onChangeText={v => vm.updateDraft('askingRent', v)} />:null}
    {!vm.postingWizard?priceGuidance:null}
    <ListingField editable={editable} required helper={<CompletenessHint value={vm.completeness} factor="description" hidden={vm.postingWizard} />} error={issueNow?.field==='description'?issueNow.message:null} label="Description" multiline placeholder="Describe the space and what tenants should know." value={draft.description} onChangeText={v => vm.updateDraft('description', v)} />
    </View>
    <View style={[styles.section,vm.postingWizard&&styles.terms]}><Text accessibilityRole="header" style={styles.heading}>Rental terms</Text>
      <FeedbackNotice message={issueNow?.field==='rentalTerm'?issueNow.message:null} tone="error" />
      {vm.postingWizard?<PostingChoices label="Rental term" options={rentalTermOptions} value={draft.rentalTerm} disabled={!editable} onChange={v=>vm.updateDraft('rentalTerm',v)}/>:<View style={styles.chips}>{rentalTermOptions.map(option => <ChoiceChip disabled={!editable} key={option.value} label={option.label} selected={draft.rentalTerm === option.value} onPress={() => vm.updateDraft('rentalTerm', option.value)} />)}</View>}
      <ListingField editable={editable} error={issueNow?.field==='securityDepositMonths'?issueNow.message:null} label="Security deposit (months)" placeholder="1" keyboardType="numeric" value={draft.securityDepositMonths} onChangeText={v => vm.updateDraft('securityDepositMonths', v)} />
      <ListingField editable={editable} error={issueNow?.field==='advanceRentMonths'?issueNow.message:null} label="Advance rent (months)" placeholder="1" keyboardType="numeric" value={draft.advanceRentMonths} onChangeText={v => vm.updateDraft('advanceRentMonths', v)} />
      <ListingField editable={editable} error={issueNow?.field==='minimumStayMonths'?issueNow.message:null} label="Minimum stay (months, optional)" placeholder="Leave blank if not specified" keyboardType="numeric" value={draft.minimumStayMonths} onChangeText={v => vm.updateDraft('minimumStayMonths', v)} />
    <AvailabilityDateField disabled={!editable} value={draft.availableDate} onChange={v => vm.updateDraft('availableDate', v)} />
    <CompletenessHint value={vm.completeness} factor="availableDate" hidden={vm.postingWizard} />
    <FeedbackNotice message={issueNow?.field==='availableDate'?issueNow.message:null} tone="error" />
    </View>
    {vm.postingWizard?<PostingSection title="House rules" summary={draft.houseRules.trim()?'Rules added - optional':'Optional'}><ListingField editable={editable} label="House rules (optional)" multiline placeholder="Include any rules tenants need to know." value={draft.houseRules} onChangeText={v => vm.updateDraft('houseRules', v)} /></PostingSection>:<ListingField editable={editable} label="House rules (optional)" multiline placeholder="Include any rules tenants need to know." value={draft.houseRules} onChangeText={v => vm.updateDraft('houseRules', v)} />}
    <Text style={styles.copy}>{vm.postingWizard?(vm.publishedEditing?'Continue keeps your listing details in this session. Save Changes on Review saves them.':'Your listing details are saved to your account when you continue from the Price step.'):vm.publishedEditing?'Save changes updates this listing without changing its publication status.':vm.listingDraftState.lastConfirmed?.status==='draft'?'Save draft updates this existing listing. It does not publish it.':'Save draft keeps confirmed property and photo progress. Nothing is published automatically.'}</Text>
    {!vm.postingWizard&&vm.publicationReview?.visible ? <>
      <Text accessibilityLiveRegion="polite" style={styles.copy}>{vm.publicationReview.state}. {vm.publicationReview.message}</Text>
      <ListingButton label="Review Publication" tone="outline" disabled={vm.publicationReviewDisabled} onPress={vm.requestPublish} />
    </> : null}
    {!vm.postingWizard&&!vm.publishedEditing?<ListingButton label="Preview listing" tone="outline" disabled={vm.photoState.busy || !!vm.composerPhase} onPress={vm.openComposerPreview} />:null}
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({ terms:{borderTopWidth:1,borderTopColor:colors.outline,paddingTop:16}, heading: { ...ui.sectionTitle }, body: { ...ui.body }, copy: { ...ui.supporting }, section: { gap: spacing.sm }, summary: { gap: spacing.xs, paddingVertical: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
