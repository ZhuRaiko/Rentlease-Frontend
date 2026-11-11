import {routineIssues} from '../models/PropertyRoutineEdit';
import type {PropertyValidationIssue} from '../models/DraftProperty';
import {SavedPropertyFields} from '../components/SavedPropertyFields';
import {PostingSection} from '../components/PostingSection';
import {postingValidationGroup,type PostingGroup} from '../models/PostingPresentation';
import {PostingProgress} from '../components/PostingProgress';
import type {ReactNode} from 'react';
import {ListingButton} from '../components/ListingButton';
import {ScreenContainer} from '../../../shared/components/ScreenContainer';
import { usePropertyFormFocus } from '../components/usePropertyFormFocus';
import { PropertyProgressFooter,PropertyReadinessNotice } from '../components/PropertyProgressFooter';
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
  const routine=vm.propertyRoutineState;
  const editIssues=routine?.attempted&&routine.context&&routine.draft?routineIssues(routine.context,routine.draft):[];
  const target=vm.propertyValidationTarget??(editIssues[0]?{...editIssues[0],field:editIssues[0].field as PropertyValidationIssue['field'],requestId:1}:null);
  const targetGroup=postingValidationGroup(target);
  const focus=usePropertyFormFocus(target,vm.postingWizard&&targetGroup==='details'?'details':undefined);
  const sections:Record<PostingGroup,{title:string;summary:string;open?:boolean}>={about:{title:'About Your Property',summary:'Type, rooms and furnishing',open:true},location:{title:'Location',summary:vm.workspacePropertyId?vm.propertySummary.location:'Address and map confirmation',open:true},photos:{title:'Photos & 360\u00b0',summary:vm.photoState.busy?'Loading photos...':vm.workspacePropertyId&&!vm.photoState.loaded?'Photo count unavailable':`${vm.mediaItems.length} of 10 photos selected`},details:{title:'Additional Property Details',summary:'Optional area, floors, occupancy and parking'},amenities:{title:'Amenities',summary:vm.amenityState.busy?'Loading amenities...':vm.amenityState.loaded?`${vm.selectedAmenityIds.length} selected`:'Choose what your property offers'}};
  const renderGroup=(key:PostingGroup,body:ReactNode)=>{const item=sections[key],fieldError=(editIssues.length?editIssues:vm.propertyVisibleValidationIssues)?.find(issue=>postingValidationGroup(issue)===key),hasError=!!fieldError||key==='photos'&&(!!vm.photoState.error||vm.photoState.needsReconcile)||key==='amenities'&&!!vm.amenityState.error;return <PostingSection key={key} title={item.title} summary={fieldError?.message??(hasError?'Needs attention - open this section':item.summary)} initiallyOpen={item.open??false} revealId={targetGroup===key?target?.requestId:hasError?-1:undefined}>{body}</PostingSection>;};
  if(vm.postingWizard&&vm.editorMode!=='create'&&['loading','error'].includes(vm.draftHydration.status))return <ListingWizardScaffold title="Edit Rental" onBack={vm.goBack} onClose={onClose}><Text style={ui.body}>{vm.draftHydration.error??'Loading your saved rental and photos...'}</Text>{vm.draftHydration.status==='error'?<ListingButton label="Retry loading rental" onPress={vm.retryDraftHydration}/>:null}</ListingWizardScaffold>;
  const mapOpen = ['searching', 'candidates', 'map'].includes(vm.locationState.stage);
  return <>
    <Modal visible={mapOpen} onRequestClose={vm.propertyLocation.cancel} animationType="slide"><ScreenContainer padded={false}><PropertyLocationToolView viewModel={vm} onClose={vm.propertyLocation.cancel} /></ScreenContainer></Modal>
    <ListingWizardScaffold formFocus={focus} footer={<PropertyProgressFooter compact={vm.postingWizard} viewModel={vm} action={vm.postingWizard?{label:vm.composerPhase?"Saving property...":"Continue to Listing",disabled:vm.propertyNextDisabled,onPress:()=>void vm.nextListingDetails()}:undefined} guidance={vm.postingWizard&&vm.propertyNextDisabled&&!vm.composerPhase?<PropertyReadinessNotice viewModel={vm}/>:undefined}/>} progress={vm.postingWizard?<PostingProgress step={1}/>:undefined} title={vm.postingWizard?"Property Details":"Property"} description={vm.postingWizard?"Tell us about your place and confirm its location.":""} onBack={vm.goBack} onClose={onClose}>
      {!vm.postingWizard?<><Text style={styles.copy}>* Required to save the property</Text><PropertyMediaSection viewModel={vm}/></>:null}
      <ComposerRecoveryFeedback viewModel={vm} />
      {!vm.postingWizard?estimateSection:null}
    {!vm.postingWizard&&vm.propertyEditAvailable?<ListingButton label="Edit Property" tone="outline" disabled={vm.portfolioActionsDisabled} onPress={vm.openPropertyDetails}/>:null}
      {vm.postingWizard&&vm.editorMode!=='create'?<><Text style={ui.supporting}>{vm.editorMode==='published'?'Editing a published or paused rental. Ordinary saves preserve its status.':'Editing your saved draft. Nothing publishes automatically.'} Property changes are confirmed when you continue to Listing; listing changes are saved on Review.</Text><SavedPropertyFields focus={focus} viewModel={vm} group={renderGroup} photos={renderGroup('photos',<PropertyMediaSection compact viewModel={vm}/>)}/></>:<ComposerPropertyFields viewModel={vm} focus={focus} renderGroup={vm.postingWizard?renderGroup:undefined} afterLocation={vm.postingWizard?renderGroup('photos',<PropertyMediaSection compact viewModel={vm}/>):undefined}>
        <View collapsable={false} ref={focus.section('amenities')}><PropertyAmenitiesFields compact={vm.postingWizard} viewModel={vm} /></View>
      </ComposerPropertyFields>}
    </ListingWizardScaffold>
  </>;
}
const styles = StyleSheet.create({ section: { gap: spacing.sm }, heading: { ...ui.sectionTitle }, copy: { ...ui.supporting }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
