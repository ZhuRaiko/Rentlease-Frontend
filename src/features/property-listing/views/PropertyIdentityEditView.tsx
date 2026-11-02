import {Text,View} from 'react-native';
import {ListingWizardScaffold} from '../components/ListingWizardScaffold';
import {ListingButton} from '../components/ListingButton';
import {ChoiceChip,ListingField} from '../components/ListingControls';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {identityDisplayFields} from '../../../shared/models/PropertyIdentity';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {propertyTypeOptions,propertyCityOptions,propertyFloorConfiguration} from '../models/DraftProperty';
import {PropertyLocationTool} from './PropertyLocationToolView';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function PropertyIdentityEditView({viewModel:vm,onClose}:{viewModel:PropertyListingViewModel;onClose:()=>void}){
 const flow=vm.propertyIdentity,s=vm.propertyIdentityState,c=s.context,d=s.draft;
 // The tool subscribes to its own map state; this subscription is owned by the composed VM.
 const map=vm.identityLocationState;
 if(['searching','candidates','map'].includes(map.stage))return <PropertyLocationTool locationFlow={flow.location} onClose={()=>flow.location.cancel()}/>;
 const pending=!!c?.correction&&['draft','submitted'].includes(c.correction.status);
 const disabled=s.busy||s.uncertain||s.conflict||pending||!!c?.requires_repair||!!c?.open_tenancy;
 return <ListingWizardScaffold title="Property Identity Correction" description="Correct the same physical rental. Moving, splitting, merging, or replacing a unit requires a new property." onBack={vm.goBack} onClose={onClose}
 footer={s.status==='ready'&&!pending&&!c?.requires_repair?<View style={{padding:spacing.md,gap:spacing.xs}}><ListingButton label={s.busy?'Saving correction...':'Save Identity Correction'} disabled={!flow.canSave()} onPress={()=>void flow.save()}/><Text accessibilityLiveRegion="polite" style={ui.supporting}>{flow.issues()[0]?.message??'The current approved identity stays unchanged until Admin approves the correction.'}</Text></View>:null}>
 <FeedbackNotice tone="error" message={s.error}/><FeedbackNotice message={s.notice}/>
 {s.status==='loading'?<Text accessibilityLiveRegion="polite" style={ui.body}>Loading private property identity...</Text>:null}
 {s.status==='error'?<ListingButton label="Retry loading" onPress={()=>void flow.reload()}/>:null}
 {s.uncertain?<ListingButton label="Check correction status" disabled={s.busy} onPress={()=>void flow.reconcile()}/>:null}
 {s.conflict?<ListingButton label="Discard edits and reload" disabled={s.busy} onPress={vm.reloadIdentityCorrection}/>:null}
 {c?.requires_repair?<Text style={ui.body}>This property's trusted identity data needs repair. Historical approval is preserved, but cannot authorize an identity correction.</Text>:null}
 {c?.current?<><Text accessibilityRole="header" style={ui.sectionTitle}>Current saved identity{c.verified?' (verified)':' (not verified)'}</Text>{identityDisplayFields.map(([key,label])=><Text key={key} style={ui.supporting}>{label}: {String(c.current![key]??'Not specified').replace(/_/g,' ')}</Text>)}</>:null}
 {c?.open_tenancy?<Text style={ui.body}>An open tenancy protects the current identity. A correction cannot be applied until that tenancy is resolved.</Text>:null}
 {c?.correction?<><Text accessibilityRole="header" style={ui.sectionTitle}>Correction: {c.correction.status}</Text>{identityDisplayFields.filter(([key])=>c.correction!.proposed[key]!==c.current?.[key]).map(([key,label])=><Text key={key} style={ui.body}>{label}: {String(c.correction!.proposed[key]??'Not specified').replace(/_/g,' ')}</Text>)}
 {['draft','submitted','rejected'].includes(c.correction.status)?<ListingButton label={c.correction.status==='draft'?'Submit Verification Proof':c.correction.status==='rejected'?'Review Verification Feedback':'View Verification Status'} disabled={s.busy||s.uncertain} onPress={vm.openIdentityVerification}/>:null}
 {c.correction.status==='submitted'?<Text style={ui.supporting}>Proof submitted for Admin review. Current property identity remains unchanged.</Text>:null}
 {['rejected','cancelled'].includes(c.correction.status)?<ListingButton label="Revise and Resubmit Correction" tone="outline" disabled={disabled} onPress={flow.reviseRejected}/>:null}
 {c.correction.rejection_reason?<FeedbackNotice tone="error" message={`Review feedback: ${c.correction.rejection_reason}`}/>:null}
 {c.correction.submission_status==='under_review'?<Text style={ui.supporting}>Admin is reviewing this correction. It cannot be cancelled during review.</Text>:null}
 {pending?<ListingButton label="Cancel Correction" tone="outline" disabled={s.busy||s.uncertain||c.correction.submission_status==='under_review'} onPress={()=>void flow.cancel()}/>:null}
 <ListingButton label="Refresh correction status" tone="outline" disabled={s.busy||s.uncertain} onPress={vm.reloadIdentityCorrection}/></>:null}
 {s.status==='ready'&&d&&!pending&&!c?.requires_repair?<>
 <Text accessibilityRole="header" style={ui.sectionTitle}>Proposed corrected identity</Text>
 <Text style={ui.supporting}>{c?.verified?'Submit fresh ownership or authorization proof after saving. Old approval does not verify the proposed identity.':'An eligible unverified property can be corrected directly. This does not grant Tier 3 approval.'}</Text>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs}}>{propertyTypeOptions.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.propertyType===o.value} disabled={disabled} onPress={()=>flow.update('propertyType',o.value)}/>)}</View>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs}}>{propertyCityOptions.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.city===o.value} disabled={disabled} onPress={()=>flow.update('city',o.value)}/>)}</View>
 {(['barangay','addressLine1','addressLine2','postalCode'] as const).map(field=><ListingField key={field} label={{barangay:'Barangay',addressLine1:'Official address line 1',addressLine2:'Address line 2 / unit (optional)',postalCode:'Postal code (optional)'}[field]} placeholder="Enter corrected details" value={d[field]} editable={!disabled} onChangeText={value=>flow.update(field,value)}/>)}
 {propertyFloorConfiguration(d.propertyType).showFloor?<ListingField label="Rental floor (optional)" placeholder="Leave blank if not applicable" keyboardType="numeric" value={d.floorNumber} editable={!disabled} onChangeText={value=>flow.update('floorNumber',value)}/>:null}
 <ListingButton label={s.locationConfirmed?'Location confirmed. Adjust map':'Confirm Corrected Location'} tone="outline" disabled={disabled} onPress={()=>void flow.openMap()}/>
 <Text style={ui.supporting}>Exact coordinates remain private. A generalized public point follows the existing location policy.</Text>
 <ChoiceChip label="These details correct the same physical property, not another rental" selected={s.attested} disabled={disabled} onPress={()=>flow.attest(!s.attested)}/>
 </>:null}
 </ListingWizardScaffold>;
}
