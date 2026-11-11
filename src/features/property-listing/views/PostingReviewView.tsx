import {PostingSection} from '../components/PostingSection';
import {Image,Text,View} from 'react-native';
import {ListingWizardScaffold} from '../components/ListingWizardScaffold';
import {PostingProgress} from '../components/PostingProgress';
import {ListingButton} from '../components/ListingButton';
import {ListingCompletenessSummary} from '../components/ListingCompletenessSummary';
import {ListingWorkspaceFeedback} from '../components/ListingWorkspaceFeedback';
import {ComposerRecoveryFeedback} from '../components/ComposerRecoveryFeedback';
import {PropertyVerificationAction} from '../components/PropertyVerificationAction';
import {rentalTermOptions} from '../models/PersistedListingDraft';
import {ui} from '../../../shared/theme/ui';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function PostingReviewView({viewModel:vm,onClose}:{viewModel:PropertyListingViewModel;onClose:()=>void}){const d=vm.draft,p=vm.propertySummary,photo=vm.photoState.photos.find(x=>x.is_cover)??vm.photoState.photos[0],pending=vm.photoState.pendingSelections[0],uri=photo?.publicUrl??pending?.uri;
 return <ListingWizardScaffold title="Review Your Rental" description={vm.publishedEditing?'Review your changes. Saving preserves the current publication status.':'Check your details, then save a draft or publish when eligible.'} progress={<PostingProgress step={4}/>} onBack={vm.goBack} onClose={onClose} footer={<View style={{gap:8}}><ListingButton tone="brand" label={vm.composerPhase||vm.listingDraftState.busy?'Saving...':vm.publishedEditing?'Save Changes':'Save Draft'} disabled={vm.composerSaveDisabled} onPress={()=>void vm.saveComposerDraft()}/>{!vm.publishedEditing?<ListingButton label="Publish Listing" tone="outline" disabled={!vm.postingPublishReady} onPress={vm.requestPublish}/>:null}</View>}>
 {uri?<Image source={{uri}} accessibilityLabel={photo?'Saved property cover photo':'Selected property photo, not saved yet'} style={{width:'100%',height:200,borderRadius:12}}/>:<Text style={ui.supporting}>No property photos selected.</Text>}
 <Text style={ui.sectionTitle}>{d.title||'Listing title not entered'}</Text><Text style={ui.pageTitle}>PHP {d.askingRent||'Not entered'} / month</Text><Text style={ui.body}>{p.location||'Public location unavailable'}</Text><Text style={ui.supporting}>{p.type} · {p.bedrooms} bedrooms · {p.bathrooms} bathrooms{p.floorAreaSqm?` · ${p.floorAreaSqm} sqm`:''}</Text>
 <Text style={ui.supporting}>{vm.photoState.photos.length} saved photos · {vm.photoState.pendingSelections.length} selected photos awaiting save</Text>
 {vm.photoState.needsReconcile||vm.photoState.error?<Text accessibilityRole="alert" style={ui.supporting}>Photos need attention. Return to Property Details with Back and use the existing photo recovery controls before saving.</Text>:null}
 <ListingCompletenessSummary value={vm.completeness}/><ComposerRecoveryFeedback viewModel={vm}/><ListingWorkspaceFeedback viewModel={vm} scope="draft"/><ListingWorkspaceFeedback viewModel={vm} scope="publication"/>
 {!vm.publishedEditing?<PropertyVerificationAction viewModel={vm}/>:null}<Text style={ui.supporting}>{vm.publishedEditing?'Publication status will be preserved.':vm.postingPublishReady?'Your saved draft can be reviewed for publication. Publishing still requires confirmation and server checks.':vm.publicationReview.message}</Text><Text style={ui.supporting}>{vm.publishedEditing?'Save Changes updates this rental without pausing, reactivating or republishing it. Use Manage Status for lifecycle actions.':'Save Draft keeps this rental unpublished. Publication requires saved details and photos, at least 80% completeness, and approved Tier 3 verification for this property. An estimate is never required.'}</Text>
 <PostingSection title="Rental details" summary="Description, rental terms and house rules"> <Text style={ui.sectionTitle}>Description</Text><Text style={ui.body}>{d.description||'No description entered'}</Text>
 <Text style={ui.sectionTitle}>Rental terms</Text><Text style={ui.body}>{rentalTermOptions.find(x=>x.value===d.rentalTerm)?.label??'Rental term not entered'}</Text><Text style={ui.body}>Security deposit: {d.securityDepositMonths||'Not specified'} months</Text><Text style={ui.body}>Advance rent: {d.advanceRentMonths||'Not specified'} months</Text>{d.minimumStayMonths?<Text style={ui.body}>Minimum stay: {d.minimumStayMonths} months</Text>:null}<Text style={ui.body}>Available from: {d.availableDate||'Not specified'}</Text>{d.houseRules?<><Text style={ui.sectionTitle}>House rules</Text><Text style={ui.body}>{d.houseRules}</Text></>:null}


 </PostingSection></ListingWizardScaffold>;
}
