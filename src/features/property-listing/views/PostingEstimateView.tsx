import {PostingSection} from '../components/PostingSection';
import {PostingCard} from '../components/PostingCard';
import type {ReactNode} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {ListingWizardScaffold} from '../components/ListingWizardScaffold';
import {PostingProgress} from '../components/PostingProgress';
import {ListingButton} from '../components/ListingButton';
import {ListingField} from '../components/ListingControls';
import {ComposerRecoveryFeedback} from '../components/ComposerRecoveryFeedback';
import {ListingWorkspaceFeedback} from '../components/ListingWorkspaceFeedback';
import {colors} from '../../../shared/theme/colors';
import {askingRentLabel} from '../models/PostingPrice';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

/** Inline fix for an estimate blocked only by a missing floor area. State lives in the caller; saving reuses the versioned property save. */
export interface FloorAreaFix {value:string;onChange:(value:string)=>void;onSave:()=>void;saving:boolean;error:string|null}
interface Props {viewModel:PropertyListingViewModel;onClose:()=>void;estimateSection:ReactNode;locationSection?:ReactNode;floorAreaFix?:FloorAreaFix|null}

// Step 3: estimate first, then the landlord's own asking rent. Published editing keeps its rent on the Listing step and shows it read-only here.
export function PostingEstimateView({viewModel:vm,onClose,estimateSection,locationSection,floorAreaFix}:Props){
  const rentHere=!vm.publishedEditing,saving=!!vm.composerPhase||vm.listingDraftState.busy;
  const rentMessage=vm.priceAttempted&&vm.priceIssue?.field==='askingRent'?vm.priceIssue.message:null;
  const blocked=rentHere&&!!vm.priceIssue;
  const hint=vm.composerPhase||vm.listingDraftState.busy?'Keep this screen open until saving finishes.':blocked?(vm.priceIssue?.field==='askingRent'?'Enter your asking rent to continue':vm.priceIssue!.message):rentHere?'Saves your draft, then opens Review':undefined;
  const label=vm.composerPhase==='photos'?'Saving photos...':saving?'Saving listing draft...':'Continue to Review';
  return <ListingWizardScaffold menu={vm.postingEditorMenu?.(onClose)} title="Set Your Price" description="See the typical rent range, then choose your monthly asking rent." progress={<PostingProgress step={3}/>} onBack={vm.goBack} onClose={onClose}
    footer={<View style={styles.footer}><ListingButton tone="brand" label={label} disabled={saving||blocked} onPress={()=>void vm.continuePostingReview()}/>{hint?<Text accessibilityLiveRegion="polite" style={styles.hint}>{hint}</Text>:null}</View>}>
    <PostingCard highlight>
      {floorAreaFix?<View style={styles.gap}>
        <Text style={ui.body}>Add your floor area to see an estimate for this property.</Text>
        <ListingField label="Floor area (sqm)" required placeholder="e.g. 85" keyboardType="numeric" value={floorAreaFix.value} error={floorAreaFix.error} editable={!floorAreaFix.saving} onChangeText={floorAreaFix.onChange}/>
        <ListingButton tone="brand" label={floorAreaFix.saving?'Saving...':'Save and estimate'} disabled={floorAreaFix.saving||!floorAreaFix.value.trim()} onPress={floorAreaFix.onSave}/>
      </View>:estimateSection}
      {vm.estimateBasisText?<View style={styles.basis}><Text style={[ui.supporting,styles.flex]}>Based on: {vm.estimateBasisText}</Text>{vm.propertyEditAvailable?<Pressable accessibilityRole="button" accessibilityLabel="Edit property details" style={styles.link} onPress={()=>vm.editPostingStep('property')}><Text style={styles.linkText}>Edit details</Text></Pressable>:null}</View>:null}
    </PostingCard>
    {rentHere?<PostingCard title="Your monthly asking rent">
      <ListingField label="Monthly asking rent" required prefix={'₱'} keyboardType="numeric" placeholder="Enter amount" value={vm.draft.askingRent} error={rentMessage} editable={!vm.listingDraftReadOnly&&!saving} onChangeText={vm.typeAskingRent}/>
      {vm.priceKeepAvailable?<View style={styles.chips}>
        {vm.priceKeepAvailable?<Pressable accessibilityRole="button" accessibilityLabel="Keep My Price" accessibilityHint="Restores the rent you entered" disabled={saving} style={styles.chip} onPress={vm.keepPostingPrice}><Text style={styles.chipText}>Keep My Price</Text></Pressable>:null}
      </View>:null}
      <Text style={ui.supporting}>Or type your own price. Any amount is allowed.</Text>
    </PostingCard>:<Text style={ui.body}>Your asking rent: {askingRentLabel(vm.draft.askingRent)} / month. Edit it on the Listing step.</Text>}
    {locationSection}
    <ComposerRecoveryFeedback viewModel={vm}/><ListingWorkspaceFeedback viewModel={vm} scope="draft"/>
    <PostingSection title="About the range" plain><Text style={ui.supporting}>The range is optional. Continue with your own price if it is unavailable. Applying a rent from the slider only fills your asking rent field. Your property details are already saved; continuing saves your listing draft and selected photos.</Text></PostingSection>
  </ListingWizardScaffold>;
}
const styles=StyleSheet.create({
  card:{borderWidth:1,borderColor:colors.outline,borderRadius:12,padding:spacing.md,gap:spacing.sm,backgroundColor:colors.background},gap:{gap:spacing.sm},flex:{flex:1},
  basis:{flexDirection:'row',alignItems:'center',gap:spacing.sm},link:{minHeight:48,justifyContent:'center'},linkText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},chip:{minHeight:48,paddingHorizontal:spacing.md,justifyContent:'center',borderWidth:1,borderColor:colors.controlBorder,borderRadius:24},chipText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
  footer:{gap:spacing.xs},hint:{...ui.supporting,textAlign:'center'},
});
