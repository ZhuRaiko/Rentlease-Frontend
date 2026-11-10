import {useState,type ReactNode} from 'react';
import {AccessibilityInfo,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {ListingButton} from './ListingButton';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function PropertyReadinessNotice({viewModel:vm}:{viewModel:PropertyListingViewModel}) {
  return vm.propertyReadinessReviewAvailable?<Pressable accessibilityRole="button" accessibilityLabel={`${vm.propertyNextStatus} Review the first field.`} onPress={vm.reviewPropertyReadiness} style={styles.review}>
    <Text accessibilityLiveRegion="polite" style={ui.supporting}>{vm.propertyNextStatus} <Text style={styles.link}>Review field</Text></Text>
  </Pressable>:<Text accessibilityLiveRegion="polite" style={ui.supporting}>{vm.propertyNextStatus}</Text>;
}
interface ProgressFooterProps {
  viewModel: PropertyListingViewModel;
  action?: {label:string;disabled:boolean;onPress:()=>void};
  guidance?: ReactNode;
}
// Shared presentation for both posting steps; readiness and saving stay in the ViewModel.
export function PropertyProgressFooter({viewModel:vm,action,guidance}:ProgressFooterProps) {
  const [expanded,setExpanded]=useState(false);
  const {height}=useWindowDimensions();
  const value=vm.completeness;
  const toggleInformation=()=>{
    const next=!expanded;setExpanded(next);
    AccessibilityInfo.announceForAccessibility(next?'Completeness information expanded.':'Completeness information collapsed.');
  };
  return <View style={styles.footer}>
    {expanded?<ScrollView style={{maxHeight:Math.min(180,height*0.25)}} contentContainerStyle={styles.information} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" nestedScrollEnabled accessibilityLabel="Listing completeness explanation">
      <Text accessibilityRole="header" style={styles.informationTitle}>About completeness</Text>
      <Text style={ui.supporting}>{value.source==='server'?'Backend-confirmed score. Unsaved changes are not included.':'This is a local estimate until saved information is confirmed by the backend.'}</Text>
      <Text style={ui.supporting}>Property details, photos and listing details contribute.</Text>
      <Text style={ui.supporting}>Publication requires at least 80% completeness.</Text>
      <Text style={ui.supporting}>Property-specific Tier 3 approval and other publication checks are separate.</Text>
    </ScrollView>:null}
    <View style={styles.summary}>
      <Text style={styles.summaryLabel}>Listing completeness</Text>
      <Text style={styles.percent}>{`${value.percent}%`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="About listing completeness" accessibilityHint={expanded?'Collapse the information panel.':'Expand the information panel.'} accessibilityState={{expanded}} onPress={toggleInformation} style={styles.infoButton}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.infoIcon}><View style={styles.infoDot}/><View style={styles.infoStem}/></View>
      </Pressable>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Listing completeness" accessibilityValue={{min:0,max:100,now:value.percent,text:`${value.percent} percent, ${value.source==='server'?'backend-confirmed score':'local estimate'}`}} style={styles.track}><View style={[styles.fill,{width:`${value.percent}%`}]}/></View>
    {action ? guidance : vm.propertyNextDisabled?<PropertyReadinessNotice viewModel={vm}/>:null}
    <ListingButton label={action?.label ?? (vm.composerPhase==='property'?"Saving property...":"Next: Listing")} disabled={action ? action.disabled : vm.propertyNextDisabled} onPress={action?.onPress ?? vm.nextListingDetails}/>
  </View>;
}
const styles=StyleSheet.create({
  footer:{gap:spacing.xs},review:{minHeight:48,justifyContent:'center'},link:{textDecorationLine:'underline'},
  summary:{flexDirection:'row',alignItems:'center',gap:spacing.sm},summaryLabel:{...ui.supporting,flex:1,flexShrink:1,fontWeight:'600'},percent:{...ui.sectionTitle},
  infoButton:{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'},
  infoIcon:{height:20,width:20,borderRadius:10,borderWidth:1.4,borderColor:colors.primaryAction,alignItems:'center',justifyContent:'center',gap:2},infoDot:{width:3,height:3,borderRadius:2,backgroundColor:colors.primaryAction},infoStem:{width:2,height:7,borderRadius:1,backgroundColor:colors.primaryAction},
  track:{height:3,borderRadius:2,overflow:'hidden',backgroundColor:colors.border},fill:{height:3,backgroundColor:colors.primaryAction},
  information:{gap:spacing.sm,paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},informationTitle:{...ui.body,fontWeight:'600'},
});
