import {useEffect} from 'react';
import {ActivityIndicator,Alert,Text,TextInput,View} from 'react-native';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {AppButton} from '../../../shared/components/AppButton';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {useTenancyEstablishmentViewModel} from '../viewModels/useTenancyEstablishmentViewModel';
import type {SetupAction} from '../models/TenancyEstablishment';
const labels:Record<SetupAction,string>={create:'Propose tenancy',confirm:'Confirm rental terms',activate:'Start confirmed tenancy',review:'Review updated property',cancel:'Cancel tenancy setup'};
export function TenancySetupView({accountId,reservationId,onBack,onChanged,registerBackAction}:{accountId:string|undefined;reservationId:string;onBack:()=>void;onChanged:()=>void;registerBackAction?:((action:(()=>void)|null)=>void)|undefined}){
 const vm=useTenancyEstablishmentViewModel(accountId,reservationId),ctx=vm.context,locked=vm.busy||vm.saving||vm.uncertain;
 const back=()=>{if(vm.saving)return;if(vm.uncertain){Alert.alert('Tenancy outcome not confirmed','Retry the same operation or reload its saved status. You can also leave and reopen this reservation to reconcile.',[{text:'Keep reviewing',style:'cancel'},{text:'Leave setup',onPress:onBack}]);}else onBack();};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 const act=(action:SetupAction)=>{const send=async()=>{await vm.workflow.submit(action);if(vm.workflow.getSnapshot().notice)onChanged();};Alert.alert(labels[action],action==='cancel'?'Cancel only this pending tenancy setup. Its reservation remains unchanged. A new setup after cancellation requires a new approved reservation.':'Confirm the displayed property, rental period, agreed monthly rent and rent day. No payment is collected. The tenancy becomes active only after both parties confirm and its start date arrives.',[{text:'Keep reviewing',style:'cancel'},{text:labels[action],onPress:()=>void send()}]);};
 return <View style={{flex:1,backgroundColor:colors.background}}><ScreenHeader title="Tenancy setup" onBack={back} disabled={vm.saving}/><KeyboardAwareScrollView contentContainerStyle={{padding:16,gap:14}} keyboardShouldPersistTaps="handled">
 {vm.busy?<ActivityIndicator accessibilityLabel="Loading tenancy setup" color={colors.primaryAction}/>:null}
 {vm.error?<Text accessibilityRole="alert" style={[ui.body,{color:colors.restricted}]}>{vm.error}</Text>:null}{vm.notice?<Text accessibilityLiveRegion="polite" style={ui.body}>{vm.notice}</Text>:null}
 {ctx?<><Text style={ui.sectionTitle}>{ctx.listingTitle}</Text><Text style={ui.body}>{ctx.propertySummary}</Text><Text style={ui.body}>Rental period: {ctx.startDate} through {ctx.endDate}</Text><Text style={ui.supporting}>A reservation is not a tenancy. The owner proposes terms and the renter explicitly confirms them. Both parties review the current saved property. Future confirmed stays require an explicit start action on or after the start date.</Text>
 {ctx.tenancy?<><Text style={ui.body}>Monthly agreed rent: PHP {ctx.tenancy.rent.toLocaleString('en-US',{minimumFractionDigits:2})}</Text><Text style={ui.body}>Monthly rent day: {ctx.tenancy.dueDay}</Text><Text style={ui.body}>Status: {ctx.tenancy.status.replace(/_/g,' ')}</Text><Text style={ui.supporting}>Owner: {ctx.tenancy.ownerConfirmed?'confirmed':'not confirmed'}. Renter: {ctx.tenancy.tenantConfirmed?'confirmed':'not confirmed'}.</Text></>:accountId===ctx.landlordId?<><Text style={ui.body}>Agreed monthly rent (PHP)</Text><TextInput accessibilityLabel="Agreed monthly rent" keyboardType="decimal-pad" editable={!locked} value={vm.draft.rent} onChangeText={rent=>vm.workflow.setDraft({rent})} style={[ui.control,ui.body,{paddingHorizontal:12}]}/><Text style={ui.body}>Monthly rent day (1-28)</Text><TextInput accessibilityLabel="Monthly rent due day" keyboardType="number-pad" maxLength={2} editable={!locked} value={vm.draft.dueDay} onChangeText={dueDay=>vm.workflow.setDraft({dueDay})} style={[ui.control,ui.body,{paddingHorizontal:12}]}/></>:<Text style={ui.supporting}>The owner has not proposed tenancy terms yet. Contact them in the existing conversation.</Text>}
 {!ctx.eligible&&ctx.reason?<Text style={ui.supporting}>{ctx.reason}</Text>:null}
 {!vm.uncertain&&vm.actions.filter(a=>a!=='cancel').map(action=><AppButton key={action} label={labels[action]} disabled={locked} onPress={()=>act(action)}/>)}
 {!vm.uncertain&&vm.actions.includes('cancel')?<AppButton label="Cancel tenancy setup" variant="secondary" disabled={locked} onPress={()=>act('cancel')}/>:null}</>:null}
 {ctx&&!vm.error?<AppButton label="Refresh setup status" variant="secondary" disabled={vm.busy||vm.saving} onPress={()=>void vm.workflow.load()}/>:null}
 {vm.error?<AppButton label={vm.uncertain?'Retry same operation':'Reload tenancy setup'} disabled={vm.busy||vm.saving} variant="secondary" onPress={()=>void vm.workflow.retry()}/>:null}
 {vm.uncertain?<AppButton label="Reload saved status" variant="secondary" disabled={vm.saving} onPress={()=>void vm.workflow.load()}/>:null}
 <Text style={ui.supporting}>No payment processing, billing ledger, or automatic reservation conversion is included.</Text>
 </KeyboardAwareScrollView></View>;
}
