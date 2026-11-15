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
import { InfoNote } from '../components/InfoNote';
import { PostingCard } from '../components/PostingCard';
import { LOCATION_TAG } from '../models/LocationConsent';
import { MORE_DETAILS_SUMMARY } from '../models/RangeCard';
import { ComposerPropertyFields } from '../components/ComposerPropertyFields';
import { ComposerRecoveryFeedback } from '../components/ComposerRecoveryFeedback';
import { PropertyMediaSection } from '../components/PropertyMediaSection';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { PropertyLocationToolView } from './PropertyLocationToolView';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

// Page 1: physical property only. Next confirms property persistence before opening listing details.
export function ListingComposerView({ viewModel: vm, onClose, estimateSection, accountId }: { accountId?:string|undefined; estimateSection?:ReactNode; viewModel: PropertyListingViewModel; onClose: () => void }) {
  const routine=vm.propertyRoutineState;
  const editIssues=routine?.attempted&&routine.context&&routine.draft?routineIssues(routine.context,routine.draft):[];
  const target=vm.propertyValidationTarget??(editIssues[0]?{...editIssues[0],field:editIssues[0].field as PropertyValidationIssue['field'],requestId:1}:null);
  const targetGroup=postingValidationGroup(target);
  const focus=usePropertyFormFocus(target,vm.postingWizard&&!String(target?.section).startsWith('detail:')&&(targetGroup==='details'||targetGroup==='more')?targetGroup:undefined);
  // Page order: Property type, Where is it?, the range card (or a plain Details card), More details. Photos are the first card of the Listing step. A new property and a saved one use the same cards.
  const sections:Record<PostingGroup,{title:string;summary:string;open?:boolean}>={about:{title:'Property type',summary:'',open:true},location:{title:'Where is it?',summary:vm.workspacePropertyId?vm.propertySummary.location:'Address and map confirmation',open:true},details:{title:'Details that set your range',summary:'',open:true},more:{title:'More details',summary:MORE_DETAILS_SUMMARY}};
  const renderGroup=(key:PostingGroup,body:ReactNode)=>{const item=sections[key],fieldError=(editIssues.length?editIssues:vm.propertyVisibleValidationIssues)?.find(issue=>postingValidationGroup(issue)===key),hasError=!!fieldError;
    // The field itself says what is wrong. A card never repeats it in red; it only says "Needs attention" for problems that have no field (photos).
    // The range card is its own frame, so it is not wrapped in a second card.
    if(key==='details')return <View key={key}>{body}</View>;
    if(key==='more')return <PostingSection key={key} title={item.title} summary={hasError?'Needs attention - open this section':item.summary} initiallyOpen={item.open??false} revealId={targetGroup===key?target?.requestId:hasError?-1:undefined} toggleWords={key==='more'?['Add','Hide']:undefined}>{body}</PostingSection>;return <PostingCard key={key} title={item.title} tag={key==='location'?LOCATION_TAG:undefined} message={null}>{body}</PostingCard>;};
  if(vm.postingWizard&&vm.editorMode!=='create'&&['loading','error'].includes(vm.draftHydration.status))return <ListingWizardScaffold title="Edit Rental" onBack={vm.goBack} onClose={onClose}><Text style={ui.body}>{vm.draftHydration.error??'Loading your saved rental and photos...'}</Text>{vm.draftHydration.status==='error'?<ListingButton label="Retry loading rental" onPress={vm.retryDraftHydration}/>:null}</ListingWizardScaffold>;
  const mapOpen = ['searching', 'candidates', 'map'].includes(vm.locationState.stage);
  return <>
    <Modal visible={mapOpen} onRequestClose={vm.propertyLocation.cancel} animationType="slide"><ScreenContainer padded={false}><PropertyLocationToolView viewModel={vm} onClose={vm.propertyLocation.cancel} /></ScreenContainer></Modal>
    <ListingWizardScaffold menu={vm.postingEditorMenu?.(onClose)} formFocus={focus} footer={<PropertyProgressFooter compact={vm.postingWizard} viewModel={vm} action={vm.postingWizard?{label:vm.composerPhase?"Saving property...":vm.returnTo?"Save and return":"Continue to Listing",disabled:vm.propertyNextDisabled,onPress:()=>void vm.nextListingDetails()}:undefined} guidance={vm.postingWizard&&vm.propertyNextDisabled&&!vm.composerPhase?<PropertyReadinessNotice viewModel={vm}/>:undefined}/>} progress={vm.postingWizard?<PostingProgress step={1} onSelect={vm.goToPostingStep}/>:undefined} title={vm.postingWizard?"Property Details":"Property"} description={vm.postingWizard?"Tell us about your place and confirm its location.":""} onBack={vm.goBack} onClose={onClose}>
      {!vm.postingWizard?<><Text style={styles.copy}>* Required to save the property</Text><PropertyMediaSection viewModel={vm}/></>:null}
      {vm.postingWizard?<InfoNote message="To publish, this property must be verified (Tier 3). You can start that after saving."/>:null}
      <ComposerRecoveryFeedback viewModel={vm} />
      {!vm.postingWizard?estimateSection:null}
      {vm.postingWizard&&vm.editorMode!=='create'?<><Text style={ui.supporting}>{vm.editorMode==='published'?'Editing a published or paused rental. Ordinary saves preserve its status. Property changes are saved when you continue to Listing; listing changes are saved on Review.':'Your property is saved. Changes here are saved when you continue to Listing. Nothing publishes automatically.'}</Text><SavedPropertyFields accountId={accountId} focus={focus} viewModel={vm} group={renderGroup}/></>:<ComposerPropertyFields accountId={accountId} viewModel={vm} focus={focus} renderGroup={vm.postingWizard?renderGroup:undefined}>
        <View collapsable={false} ref={focus.section('amenities')}><PropertyAmenitiesFields compact={vm.postingWizard} viewModel={vm} /></View>
      </ComposerPropertyFields>}
    </ListingWizardScaffold>
  </>;
}
const styles = StyleSheet.create({ section: { gap: spacing.sm }, heading: { ...ui.sectionTitle }, copy: { ...ui.supporting }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
