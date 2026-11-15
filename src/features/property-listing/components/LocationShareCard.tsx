import {Pressable,StyleSheet,Text,View} from 'react-native';
import {PublicLocationMap} from '../../../shared/components/PublicLocationMap';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {useRentalLocationApproval} from '../../../shared/viewModels/useRentalLocationApproval';
import {hasConfirmedPropertyLocation} from '../models/DraftProperty';
import {shareCardView,type ShareButtonAction,type ShareLinkAction} from '../models/LocationShare';
import {CONFIRM_SHARE_LABEL,CONSENT_HINT} from '../models/LocationConsent';
import {ListingButton} from './ListingButton';
import {LocationConfirmCard} from './LocationConfirmCard';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

const SAVED_LINK_LABELS:Partial<Record<ShareLinkAction,string>>={withdraw:'Stop sharing',reload:'Reload sharing status'};
/**
 * The location card for both modes. A new property gets the map box, one switch and one Confirm location button (LocationConfirmCard). A saved
 * property keeps its own single consent button, which records the approval straight away (the existing approval call). The map shows the
 * approximate point only; no coordinates are written out.
 */
export function LocationShareCard({viewModel:vm,accountId,editable}:{viewModel:PropertyListingViewModel;accountId:string|undefined;editable:boolean}){
  const propertyId=vm.workspacePropertyId??undefined,saved=!!propertyId;
  const model=useRentalLocationApproval(accountId,propertyId,vm.estimationProperty?.edit_version);
  if(!saved)return <LocationConfirmCard viewModel={vm} editable={editable}/>;
  const d=vm.propertyState.draft,pinned=hasConfirmedPropertyLocation(d);
  const addressReady=editable&&vm.propertyState.loaded&&!!d.city&&!!d.barangay.trim()&&!!d.addressLine1.trim();
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
  link:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},linkText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600',textDecorationLine:'underline'},
});
