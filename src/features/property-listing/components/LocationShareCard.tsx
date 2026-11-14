import {Pressable,StyleSheet,Text,View} from 'react-native';
import {PublicLocationMap} from '../../../shared/components/PublicLocationMap';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {useRentalLocationApproval} from '../../../shared/viewModels/useRentalLocationApproval';
import {hasConfirmedPropertyLocation} from '../models/DraftProperty';
import {SHARE_BUTTON_LABEL,SHARE_SENTENCE,SHARE_SKIP_LINE,shareCardView,type ShareButtonAction,type ShareLinkAction} from '../models/LocationShare';
import {ListingButton} from './ListingButton';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

const LINK_LABELS:Record<ShareLinkAction,string>={
  openMapOnly:'Confirm the location without sharing it',reviewMap:'Review location on the map',clearWish:'Do not share',withdraw:'Stop sharing',reload:'Reload sharing status',
};
/**
 * Where the owner decides whether the approximate public map point may go to the price model: one plain sentence, one explicit button, and a
 * quiet way to skip. For a saved property the button records the consent straight away (the existing approval call). For a new property it
 * confirms the location on the map and notes the choice; the same call is made once, right after the property is saved. The map shows the
 * approximate point only; no coordinates are written out.
 */
export function LocationShareCard({viewModel:vm,accountId,editable,error}:{viewModel:PropertyListingViewModel;accountId:string|undefined;editable:boolean;error?:string|null|undefined}){
  const propertyId=vm.workspacePropertyId??undefined,saved=!!propertyId;
  const model=useRentalLocationApproval(accountId,propertyId,vm.estimationProperty?.edit_version);
  const d=vm.propertyState.draft,confirmed=hasConfirmedPropertyLocation(d);
  const addressReady=editable&&vm.propertyState.loaded&&!!d.city&&!!d.barangay.trim()&&!!d.addressLine1.trim();
  const view=shareCardView({saved,addressReady,confirmed,wanted:vm.shareLocationWanted,approval:model.state,approvalLoading:model.busy&&!model.state,approvalError:!!model.error,busy:model.busy});
  const point=view.mapPoint==='draft'&&confirmed?{latitude:d.publicLatitude,longitude:d.publicLongitude}:view.mapPoint==='approval'&&model.state?.point?model.state.point:null;
  const press:Record<ShareButtonAction,()=>void>={
    openMapShare:()=>{vm.setShareLocationWanted(true);vm.openPropertyLocation();},
    recordWish:()=>vm.setShareLocationWanted(true),
    saveConsent:()=>void model.save(true),
  };
  const link:Record<ShareLinkAction,()=>void>={
    openMapOnly:()=>{vm.setShareLocationWanted(false);vm.openPropertyLocation();},reviewMap:()=>vm.openPropertyLocation(),clearWish:()=>vm.setShareLocationWanted(false),
    withdraw:()=>void model.save(false),reload:model.reload,
  };
  const linkDisabled=(action:ShareLinkAction)=>action==='openMapOnly'||action==='reviewMap'?!addressReady:model.busy;
  return <View style={styles.card}>
    {point?<PublicLocationMap latitude={point.latitude} longitude={point.longitude} compact/>:null}
    {error?<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>:null}
    {vm.shareLocationNotice?<Text accessibilityLiveRegion="polite" style={ui.body}>{vm.shareLocationNotice}</Text>:null}
    {view.status?<Text accessibilityLiveRegion="polite" style={ui.body}>{view.status}</Text>:null}
    {view.asking?<Text style={ui.supporting}>{SHARE_SENTENCE}</Text>:null}
    {view.button?<ListingButton tone="brand" label={model.busy&&saved?'Updating...':SHARE_BUTTON_LABEL} disabled={view.button.disabled||!editable&&!saved} onPress={press[view.button.action]}/>:null}
    {view.asking?<Text style={styles.quiet}>{SHARE_SKIP_LINE}</Text>:null}
    {view.links.map(action=><Pressable key={action} accessibilityRole="button" accessibilityState={{disabled:linkDisabled(action)}} disabled={linkDisabled(action)} onPress={link[action]} style={styles.link}><Text style={styles.linkText}>{LINK_LABELS[action]}</Text></Pressable>)}
    <Text style={styles.quiet}>Your exact pin stays private. Renters see an approximate location.</Text>
  </View>;
}
const styles=StyleSheet.create({
  card:{gap:spacing.sm},error:{...ui.supporting,color:colors.restricted},quiet:{...ui.supporting,color:colors.textSecondary},
  link:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},linkText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600',textDecorationLine:'underline'},
});
