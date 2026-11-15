import {Pressable,StyleSheet,Text,View} from 'react-native';
import {PublicLocationMap} from '../../../shared/components/PublicLocationMap';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {useRentalLocationApproval} from '../../../shared/viewModels/useRentalLocationApproval';
import {hasConfirmedPropertyLocation,propertyCityOptions} from '../models/DraftProperty';
import {shareCardView,type ShareButtonAction,type ShareLinkAction} from '../models/LocationShare';
import {CONFIRM_NO_SHARE_LABEL,CONFIRM_SHARE_LABEL,CONSENT_HINT,FIND_ON_MAP_LABEL,confirmedPlace,confirmedStatus,newPropertyLocationView} from '../models/LocationConsent';
import {ListingButton} from './ListingButton';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

const SAVED_LINK_LABELS:Partial<Record<ShareLinkAction,string>>={withdraw:'Stop sharing',reload:'Reload sharing status'};
/**
 * Where the owner decides whether the approximate public map point may go to the price model. Nothing is asked until a pin exists. Then two
 * equal buttons confirm the location, one sharing the approximate area and one not, with a single hint line. After either, the card shrinks
 * to one row with Change. The map shows the approximate point only; no coordinates are written out. A saved property keeps its own consent
 * button, which records the approval straight away (the existing approval call).
 */
export function LocationShareCard({viewModel:vm,accountId,editable}:{viewModel:PropertyListingViewModel;accountId:string|undefined;editable:boolean}){
  const propertyId=vm.workspacePropertyId??undefined,saved=!!propertyId;
  const model=useRentalLocationApproval(accountId,propertyId,vm.estimationProperty?.edit_version);
  const d=vm.propertyState.draft,pinned=hasConfirmedPropertyLocation(d);
  const addressReady=editable&&vm.propertyState.loaded&&!!d.city&&!!d.barangay.trim()&&!!d.addressLine1.trim();
  if(!saved){
    const view=newPropertyLocationView({addressReady,pinned,decided:vm.locationDecided,shared:vm.locationShared});
    if(view.kind==='hidden')return null;
    if(view.kind==='findOnMap')return <View style={styles.card}><ListingButton tone="outline" label={FIND_ON_MAP_LABEL} onPress={vm.openPropertyLocation}/></View>;
    if(view.kind==='confirmed'){
      const city=propertyCityOptions.find(o=>o.value===d.city)?.label??d.city??'';
      return <View accessibilityLiveRegion="polite" style={styles.row}>
        <View style={styles.rowCopy}><Text style={styles.check}>✓ Location confirmed</Text><Text style={styles.rowText}>{confirmedPlace(d.barangay,city)} · {confirmedStatus(view.shared)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Change the location" disabled={!editable} onPress={()=>{vm.changeLocationChoice();vm.openPropertyLocation();}} style={styles.change}><Text style={styles.linkText}>Change</Text></Pressable>
      </View>;
    }
    return <View style={styles.card}>
      <PublicLocationMap latitude={d.publicLatitude as number} longitude={d.publicLongitude as number} compact/>
      {vm.shareLocationNotice?<Text accessibilityLiveRegion="polite" style={ui.body}>{vm.shareLocationNotice}</Text>:null}
      <ListingButton tone="outline" label={CONFIRM_SHARE_LABEL} disabled={!editable} onPress={()=>vm.setShareLocationWanted(true)}/>
      <ListingButton tone="outline" label={CONFIRM_NO_SHARE_LABEL} disabled={!editable} onPress={()=>vm.setShareLocationWanted(false)}/>
      <Text style={styles.quiet}>{CONSENT_HINT}</Text>
    </View>;
  }
  const view=shareCardView({saved,addressReady,confirmed:pinned,wanted:false,approval:model.state,approvalLoading:model.busy&&!model.state,approvalError:!!model.error,busy:model.busy});
  const point=view.mapPoint==='approval'&&model.state?.point?model.state.point:null;
  const press:Partial<Record<ShareButtonAction,()=>void>>={saveConsent:()=>void model.save(true)};
  const link:Partial<Record<ShareLinkAction,()=>void>>={withdraw:()=>void model.save(false),reload:model.reload};
  return <View style={styles.card}>
    {point?<PublicLocationMap latitude={point.latitude} longitude={point.longitude} compact/>:null}
    {view.status?<Text accessibilityLiveRegion="polite" style={ui.body}>{view.status}</Text>:null}
    {view.button?<ListingButton tone="outline" label={model.busy?'Updating...':CONFIRM_SHARE_LABEL} disabled={view.button.disabled} onPress={press[view.button.action]!}/>:null}
    {view.asking?<Text style={styles.quiet}>{CONSENT_HINT}</Text>:null}
    {view.links.map(action=><Pressable key={action} accessibilityRole="button" accessibilityState={{disabled:model.busy}} disabled={model.busy} onPress={link[action]!} style={styles.link}><Text style={styles.linkText}>{SAVED_LINK_LABELS[action]}</Text></Pressable>)}
  </View>;
}
const styles=StyleSheet.create({
  card:{gap:spacing.sm},quiet:{...ui.supporting,color:colors.textSecondary},
  row:{flexDirection:'row',alignItems:'center',gap:spacing.sm},rowCopy:{flex:1,minWidth:0},rowText:{...ui.supporting,color:colors.textSecondary},check:{...ui.body,color:colors.primaryAction,fontWeight:'700'},
  change:{minHeight:48,minWidth:48,justifyContent:'center',alignItems:'flex-end'},
  link:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},linkText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600',textDecorationLine:'underline'},
});
