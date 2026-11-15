import {useState} from 'react';
import {Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {PublicLocationMap} from '../../../shared/components/PublicLocationMap';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {useRentalLocationApproval} from '../../../shared/viewModels/useRentalLocationApproval';
import {SWITCH_TITLE,savedNotice,savedSwitchView} from '../models/LocationConsent';
import {LocationConfirmCard} from './LocationConfirmCard';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

/**
 * The location card for both modes. A new property gets the map box, one switch and one Confirm location button (LocationConfirmCard). A saved
 * property has the same switch, and it records straight away through the existing approval call: on shares, off withdraws. The map shows the
 * approximate point only; no coordinates are written out.
 */
export function LocationShareCard({viewModel:vm,accountId,editable}:{viewModel:PropertyListingViewModel;accountId:string|undefined;editable:boolean}){
  const propertyId=vm.workspacePropertyId??undefined,saved=!!propertyId;
  const model=useRentalLocationApproval(accountId,propertyId,vm.estimationProperty?.edit_version);
  const [intent,setIntent]=useState<'share'|'withdraw'|null>(null);
  if(!saved)return <LocationConfirmCard viewModel={vm} editable={editable}/>;
  const view=savedSwitchView({approval:model.state,loading:model.busy&&!model.state,error:!!model.error,busy:model.busy});
  const point=view.showMap&&model.state?.point?model.state.point:null;
  const notice=savedNotice(intent,model.state?model.state.approved:null,model.busy,!!model.error);
  const toggle=(next:boolean)=>{setIntent(next?'share':'withdraw');void model.save(next);};
  return <View style={styles.card}>
    {point?<PublicLocationMap latitude={point.latitude} longitude={point.longitude} compact/>:null}
    <View style={[styles.row,!view.enabled&&styles.dim]}>
      <View style={styles.copy}><Text style={ui.body}>{SWITCH_TITLE}</Text><Text accessibilityLiveRegion="polite" style={styles.note}>{view.note}</Text></View>
      <Switch accessibilityLabel={SWITCH_TITLE} value={view.on} disabled={!view.enabled||!editable} onValueChange={toggle} trackColor={{false:colors.border,true:colors.primaryAction}} thumbColor={colors.white}/>
    </View>
    {notice?<Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>:null}
    {view.reload?<Pressable accessibilityRole="button" disabled={model.busy} onPress={model.reload} style={styles.link}><Text style={styles.linkText}>Reload sharing status</Text></Pressable>:null}
  </View>;
}
const styles=StyleSheet.create({
  card:{gap:spacing.sm},row:{flexDirection:'row',alignItems:'center',gap:spacing.sm,minHeight:56},dim:{opacity:0.55},copy:{flex:1,minWidth:0,gap:2},note:{...ui.supporting,color:colors.textSecondary},
  notice:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
  link:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},linkText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600',textDecorationLine:'underline'},
});
