import {useState} from 'react';
import {Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {PublicLocationMap} from '../../../shared/components/PublicLocationMap';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {hasConfirmedPropertyLocation,propertyCityOptions} from '../models/DraftProperty';
import {CONFIRM_LOCATION_LABEL,MAP_BOX_HEIGHT,MAP_CAPTION,MAP_PLACE_PIN_LABEL,MAP_PLACEHOLDER,MAP_SEARCHING,MAP_UNAVAILABLE,SWITCH_TITLE,confirmedPlace,confirmedStatus,locationCardView} from '../models/LocationConsent';
import {previewPublicPoint} from '../models/PinPrecision';
import {ListingButton} from './ListingButton';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

const STRIPES=Array.from({length:10},(_,i)=>i);
/** A quiet striped box: the place the map will fill, so nothing moves when it arrives. */
function Stripes(){return <View accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>{STRIPES.map(i=><View key={i} style={{flex:1,backgroundColor:i%2?colors.surface:colors.background}}/>)}</View>;}
/**
 * The new property's location card: a map box with a fixed height from the first frame, one switch, and ONE Confirm location button.
 * The switch is off until the person turns it on, and is only available for a pin derived from the address. After confirming, the card is
 * one row: where, whether the approximate area is shared, and Change. The map shows the approximate area only.
 */
export function LocationConfirmCard({viewModel:vm,editable}:{viewModel:PropertyListingViewModel;editable:boolean}){
  const [on,setOn]=useState(false);
  const d=vm.propertyState.draft,pinInDraft=hasConfirmedPropertyLocation(d);
  const addressReady=editable&&vm.propertyState.loaded&&!!d.city&&!!d.barangay.trim()&&!!d.addressLine1.trim();
  const view=locationCardView({addressReady,decided:vm.locationDecided,shared:vm.locationShared,pinInDraft,pinPrecise:vm.locationPinPrecise,preview:vm.locationPreview});
  if(view.mode==='confirmed'){
    const city=propertyCityOptions.find(o=>o.value===d.city)?.label??d.city??'';
    return <View accessibilityLiveRegion="polite" style={styles.row}>
      <View style={styles.rowCopy}><Text style={styles.check}>✓ Location confirmed</Text><Text style={styles.rowText}>{confirmedPlace(d.barangay,city)} · {confirmedStatus(view.shared)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Change the location" disabled={!editable} onPress={()=>{vm.changeLocationChoice();vm.openPropertyLocation();}} style={styles.change}><Text style={styles.linkText}>Change</Text></Pressable>
    </View>;
  }
  const {box}=view,point=box.kind==='map'?(box.source==='draft'?{latitude:d.publicLatitude as number,longitude:d.publicLongitude as number}:vm.locationPreview.candidate?previewPublicPoint(vm.locationPreview.candidate):null):null;
  const switchOn=on&&view.switchEnabled;
  return <View style={styles.card}>
    <View style={styles.box}>
      {box.kind==='map'&&point?<>
        <PublicLocationMap latitude={point.latitude} longitude={point.longitude} compact/>
        <Text style={styles.caption}>{MAP_CAPTION}</Text>
      </>:<>
        <Stripes/>
        <View style={styles.boxCopy}>
          <Text style={styles.boxText}>{box.kind==='searching'?MAP_SEARCHING:box.kind==='unavailable'?MAP_UNAVAILABLE:MAP_PLACEHOLDER}</Text>
          {box.kind==='unavailable'?<Pressable accessibilityRole="button" disabled={!addressReady} onPress={vm.openPropertyLocation} style={styles.link}><Text style={styles.linkText}>{MAP_PLACE_PIN_LABEL}</Text></Pressable>:null}
        </View>
      </>}
    </View>
    {vm.shareLocationNotice?<Text accessibilityLiveRegion="polite" style={ui.body}>{vm.shareLocationNotice}</Text>:null}
    <View style={[styles.switchRow,!view.switchEnabled&&styles.dim]}>
      <View style={styles.switchCopy}><Text style={ui.body}>{SWITCH_TITLE}</Text><Text accessibilityLiveRegion="polite" style={styles.note}>{view.switchNote}</Text></View>
      <Switch accessibilityLabel={SWITCH_TITLE} value={switchOn} disabled={!view.switchEnabled||!editable} onValueChange={setOn} trackColor={{false:colors.border,true:colors.primaryAction}} thumbColor={colors.white}/>
    </View>
    <ListingButton tone="brand" label={CONFIRM_LOCATION_LABEL} disabled={!view.confirmEnabled||!editable} onPress={()=>{vm.confirmLocation(switchOn);}}/>
  </View>;
}
const styles=StyleSheet.create({
  card:{gap:spacing.sm},
  box:{height:MAP_BOX_HEIGHT,borderRadius:radius.panel,overflow:'hidden',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.outline},
  boxCopy:{position:'absolute',top:0,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center',paddingHorizontal:spacing.md,gap:spacing.xs},boxText:{...ui.supporting,textAlign:'center',color:colors.textSecondary,backgroundColor:colors.background,paddingVertical:4,paddingHorizontal:spacing.sm,borderRadius:radius.pill,overflow:'hidden'},
  caption:{position:'absolute',left:spacing.xs,bottom:spacing.xs,...ui.supporting,color:colors.textSecondary,backgroundColor:colors.background,paddingVertical:2,paddingHorizontal:spacing.xs,borderRadius:radius.pill,overflow:'hidden'},
  switchRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm,minHeight:56},dim:{opacity:0.55},switchCopy:{flex:1,minWidth:0,gap:2},note:{...ui.supporting,color:colors.textSecondary},
  row:{flexDirection:'row',alignItems:'center',gap:spacing.sm},rowCopy:{flex:1,minWidth:0},rowText:{...ui.supporting,color:colors.textSecondary},check:{...ui.body,color:colors.primaryAction,fontWeight:'700'},
  change:{minHeight:48,minWidth:48,justifyContent:'center',alignItems:'flex-end'},link:{minHeight:48,justifyContent:'center',alignSelf:'center'},linkText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600',textDecorationLine:'underline'},
});
