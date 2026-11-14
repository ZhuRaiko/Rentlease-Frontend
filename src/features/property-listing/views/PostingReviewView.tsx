import {PostingSection} from '../components/PostingSection';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {ListingWizardScaffold} from '../components/ListingWizardScaffold';
import {PostingProgress} from '../components/PostingProgress';
import {ListingButton} from '../components/ListingButton';
import {ListingWorkspaceFeedback} from '../components/ListingWorkspaceFeedback';
import {ComposerRecoveryFeedback} from '../components/ComposerRecoveryFeedback';
import {PropertyVerificationAction} from '../components/PropertyVerificationAction';
import {PostingCard} from '../components/PostingCard';
import {rentalTermOptions} from '../models/PersistedListingDraft';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

const Edit=({label,onPress}:{label:string;onPress:()=>void})=><Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.edit} onPress={onPress}><Text style={styles.editText}>Edit</Text></Pressable>;
const Row=({title,detail,onEdit,label,last=false}:{title:string;detail:string;onEdit?:(()=>void)|undefined;label:string;last?:boolean})=><View style={[styles.row,!last&&styles.divider]}><View style={styles.copy}><Text style={ui.body}>{title}</Text><Text style={ui.supporting}>{detail}</Text></View>{onEdit?<Edit label={label} onPress={onEdit}/>:null}</View>;

// Step 4: a final check. Gates are unchanged (saved draft, 80% completeness, approved Tier 3, saved photos, confirmation and server checks).
export function PostingReviewView({viewModel:vm,onClose}:{viewModel:PropertyListingViewModel;onClose:()=>void}){
  const d=vm.draft,p=vm.propertySummary,photo=vm.photoState.photos.find(x=>x.is_cover)??vm.photoState.photos[0],pending=vm.photoState.pendingSelections[0],uri=photo?.publicUrl??pending?.uri;
  const published=vm.publishedEditing,saving=!!vm.composerPhase||vm.listingDraftState.busy;
  const edit=(step:'property'|'listing'|'price')=>published?undefined:()=>vm.editPostingStep(step);
  const footer=published
    ?<ListingButton tone="brand" label={saving?'Saving...':'Save Changes'} disabled={vm.composerSaveDisabled} onPress={()=>void vm.saveComposerDraft()}/>
    :<View style={styles.footer}><ListingButton tone="brand" label="Publish listing" disabled={!vm.postingPublishReady} onPress={vm.requestPublish}/><ListingButton tone="outline" label={saving?'Saving...':'Save and exit'} disabled={vm.saveAndExitDisabled} onPress={()=>void vm.saveAndExit()}/>{!vm.postingPublishReady?<Text style={styles.hint}>Publish unlocks when every item above is checked</Text>:null}</View>;
  return <ListingWizardScaffold menu={vm.postingEditorMenu?.(onClose,published?undefined:{label:'Save and exit',onPress:()=>void vm.saveAndExit(),disabled:vm.saveAndExitDisabled})} title="Review Your Rental" description={published?'Review your changes. Saving preserves the current publication status.':'One last check before you publish.'} progress={<PostingProgress step={4}/>} onBack={vm.goBack} onClose={onClose} footer={footer}>
    {uri?<View><Image source={{uri}} accessibilityLabel={photo?'Saved property cover photo':'Selected property photo, not saved yet'} style={styles.cover}/>{!published?<View style={styles.overlay}><Edit label="Change photos" onPress={()=>vm.editPostingStep('property')}/></View>:null}</View>:<Text style={ui.supporting}>No property photos selected.</Text>}
    <View style={styles.gap}>
      <Text style={ui.sectionTitle}>{d.title||'Listing title not entered'}</Text>
      <View style={styles.priceLine}><Text style={ui.pageTitle}>PHP {d.askingRent||'Not entered'} / month</Text>{vm.postingWithinRange?<Text style={styles.badge}>Within estimate range</Text>:null}</View>
      <View style={styles.chips}>{[p.type,`${p.bedrooms} bd`,`${p.bathrooms} ba`,p.floorAreaSqm?`${p.floorAreaSqm} sqm`:null,p.location].filter(Boolean).map(text=><Text key={String(text)} style={styles.chip}>{text}</Text>)}</View>
    </View>
    {published?<Text style={ui.supporting}>Publication status will be preserved. Save Changes updates this rental without pausing, reactivating or republishing it. Use Manage Status for lifecycle actions.</Text>
      :<Text accessibilityLiveRegion="polite" style={styles.info}>{vm.postingDraftSaved?'Draft saved. Not published yet.':'Your latest changes are not saved yet.'}</Text>}
    {vm.photoState.needsReconcile||vm.photoState.error?<Text accessibilityRole="alert" style={ui.supporting}>Photos need attention. Use Change photos to open the property step and its photo recovery controls.</Text>:null}
    {!published?<PostingCard highlight><Text accessibilityRole="header" style={ui.sectionTitle}>Ready to publish?</Text>
      {vm.postingChecklist.map(item=><View key={item.key} style={styles.check}>
        <View accessible={false} style={[styles.mark,item.done?styles.markDone:styles.markOpen]}><Text style={[styles.markText,item.done?styles.markTextDone:styles.markTextOpen]}>{item.done?'\u2713':'!'}</Text></View>
        <View style={styles.copy}><Text style={ui.body}>{item.label}</Text>{item.detail?<Text style={ui.supporting}>{item.detail}</Text>:null}{item.key==='verification'&&!item.done?<PropertyVerificationAction viewModel={vm}/>:null}</View>
      </View>)}
    </PostingCard>:null}
    <ComposerRecoveryFeedback viewModel={vm}/><ListingWorkspaceFeedback viewModel={vm} scope="draft"/><ListingWorkspaceFeedback viewModel={vm} scope="publication"/>
    <PostingCard>
      <Row title="Property" detail={`${p.type} · ${p.bedrooms} bd · ${p.bathrooms} ba${p.floorAreaSqm?` · ${p.floorAreaSqm} sqm`:''}`} label="Edit property" onEdit={edit('property')}/>
      <Row title="Price" detail={`PHP ${d.askingRent||'Not entered'}${vm.postingEstimate?` · estimate PHP ${vm.postingEstimate.estimatedMonthlyRent.toLocaleString('en-US',{maximumFractionDigits:2})}`:''}`} label="Edit price" onEdit={edit('price')}/>
      <Row title="Description" detail={d.description||'No description entered'} label="Edit description" onEdit={edit('listing')}/>
      <Row title="Terms" detail={`${rentalTermOptions.find(x=>x.value===d.rentalTerm)?.label??'Rental term not entered'} · Deposit ${d.securityDepositMonths||'not specified'} · Advance ${d.advanceRentMonths||'not specified'}${d.minimumStayMonths?` · Minimum stay ${d.minimumStayMonths}`:''} · Available ${d.availableDate||'not specified'}`} label="Edit terms" last={!d.houseRules} onEdit={edit('listing')}/>
      {d.houseRules?<Row title="House rules" detail={d.houseRules} label="Edit house rules" last onEdit={edit('listing')}/>:null}
    </PostingCard>
    {published?<PostingSection title="Rental details" summary="Description, rental terms and house rules"><Text style={ui.body}>{d.description||'No description entered'}</Text></PostingSection>:null}
  </ListingWizardScaffold>;
}
const styles=StyleSheet.create({
  footer:{gap:8},hint:{...ui.supporting,textAlign:'center'},cover:{width:'100%',height:200,borderRadius:12},gap:{gap:spacing.xs},
  priceLine:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm},badge:{...ui.supporting,color:colors.primaryAction,backgroundColor:colors.primaryPale,paddingVertical:4,paddingHorizontal:10,borderRadius:20,fontWeight:'600'},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},chip:{...ui.supporting,borderWidth:1,borderColor:colors.outline,borderRadius:20,paddingVertical:4,paddingHorizontal:10},
  info:{...ui.supporting,backgroundColor:colors.identitySurface,color:colors.identityInk,borderRadius:10,paddingVertical:spacing.sm,paddingHorizontal:spacing.md},
  overlay:{position:'absolute',right:spacing.xs,bottom:spacing.xs,backgroundColor:colors.background,borderRadius:24,paddingHorizontal:spacing.sm,opacity:0.96},
  divider:{borderBottomWidth:1,borderBottomColor:colors.outline},
  check:{flexDirection:'row',gap:spacing.sm,paddingVertical:spacing.xs},mark:{width:24,height:24,borderRadius:12,borderWidth:2,alignItems:'center',justifyContent:'center'},markDone:{borderColor:colors.primaryAction,backgroundColor:colors.primaryAction},markOpen:{borderColor:colors.warning,backgroundColor:colors.warningSurface},
  markText:{fontSize:13,lineHeight:16,fontWeight:'700'},markTextDone:{color:colors.white},markTextOpen:{color:colors.warning},
  row:{flexDirection:'row',alignItems:'center',gap:spacing.sm,minHeight:56},copy:{flex:1,minWidth:0},edit:{minHeight:48,minWidth:48,justifyContent:'center',alignItems:'flex-end'},editText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
});
