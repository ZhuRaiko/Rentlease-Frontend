import { CompletenessHint } from './CompletenessHint';
import {StyleSheet,Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {ChoiceChip} from './ListingControls';
import {ListingButton} from './ListingButton';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function PropertyAmenitiesFields({viewModel:vm,compact=false}:{viewModel:PropertyListingViewModel;compact?:boolean}) {
  const state=vm.amenityState,saved=!!vm.workspacePropertyId;
  return <View style={styles.section}>
    {!compact?<Text accessibilityRole="header" style={ui.sectionTitle}>Amenities (optional)</Text>:null}
    {!compact?<CompletenessHint value={vm.completeness} factor="amenityCount" hidden={saved} />:null}
    {state.busy?<Text accessibilityLiveRegion="polite" style={ui.supporting}>Loading amenities...</Text>:null}
    <FeedbackNotice message={state.error} tone="error"/>
    <FeedbackNotice message={vm.propertyValidationIssue?.field==='amenityIds'?vm.propertyValidationIssue.message:null} tone="error"/>
    {state.error?<ListingButton label="Retry amenities" tone="outline" disabled={state.busy} onPress={()=>void vm.propertyAmenities.load()}/>:null}
    <View style={[styles.chips,compact&&{gap:8}]}>{state.catalog.map(item=><ChoiceChip comfortable={compact} key={item.id} label={item.name} selected={vm.selectedAmenityIds.includes(item.id)} disabled={saved||state.busy||!state.loaded||vm.propertyState.busy||vm.propertyState.uncertain||!!vm.composerPhase} onPress={()=>vm.togglePropertyAmenity(item.id)}/>)}</View>
    {state.loaded&&!state.catalog.length?<Text style={ui.supporting}>No active amenities are currently available.</Text>:null}
    <Text style={ui.supporting}>{saved?'Saved property amenities are read-only here.':'Select the amenities this property provides. They are saved with the physical property.'}</Text>
    {saved&&state.selectedIds.some(id=>!state.catalog.some(item=>item.id===id))?<Text style={ui.supporting}>Some saved amenities are no longer in the active catalogue.</Text>:null}
  </View>;
}
const styles=StyleSheet.create({section:{gap:spacing.sm},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs}});
