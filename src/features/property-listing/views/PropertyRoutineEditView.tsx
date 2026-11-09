import {PropertyModelAttributeFields} from '../components/PropertyModelAttributeFields';
import type {ReactNode} from 'react';
import {useState} from 'react';
import {Text,View} from 'react-native';
import {ListingWizardScaffold} from '../components/ListingWizardScaffold';
import {ListingField,ChoiceChip} from '../components/ListingControls';
import {ListingButton} from '../components/ListingButton';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {furnishingOptions,propertyFloorConfiguration,propertyTypeOptions,type PropertyValidationIssue} from '../models/DraftProperty';
import {routineIssues,materialFields,type RoutineField} from '../models/PropertyRoutineEdit';
import {usePropertyFormFocus} from '../components/usePropertyFormFocus';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function PropertyRoutineEditView({viewModel:vm,onClose,estimateSection}:{estimateSection?:ReactNode;viewModel:PropertyListingViewModel;onClose:()=>void}){
 const state=vm.propertyRoutineState,flow=vm.propertyRoutine,c=state.context,d=state.draft;
 const [touched,setTouched]=useState<Partial<Record<RoutineField,boolean>>>({}),[target,setTarget]=useState<(PropertyValidationIssue&{requestId:number})|null>(null);
 const focus=usePropertyFormFocus(target);
 const issues=c&&d?routineIssues(c,d):[];
 const error=(field:RoutineField)=>issues.find(i=>i.field===field&&(state.attempted||touched[field]))?.message??null;
 const disabled=state.busy||state.uncertain;
 const change=(field:RoutineField,value:string)=>{setTouched(t=>({...t,[field]:true}));if(field!=='amenityIds'&&field!=='furnishingStatus')flow.update(field,value);};
 const save=()=>{if(issues[0]){const issue=issues[0];setTarget({...issue,field:issue.field as PropertyValidationIssue['field'],requestId:(target?.requestId??0)+1});}void flow.save();};
 return <ListingWizardScaffold title="Edit Property" description="Update details for the same physical rental. Existing agreements remain binding. Changes do not publish or reactivate a listing." onBack={vm.goBack} onClose={onClose} formFocus={focus}
 footer={state.status==='ready'?<View style={{padding:spacing.md,gap:spacing.xs}}><ListingButton label={state.busy?'Saving changes...':'Save Changes'} disabled={!flow.canSave()} onPress={save}/><Text accessibilityLiveRegion="polite" style={ui.supporting}>{state.busy?'Wait for the saved result before leaving.':issues[0]?.message??(!flow.dirty()?'No unsaved property changes.':'Verification and listing status will be preserved.')}</Text></View>:null}>
  <FeedbackNotice tone="error" message={issues.some(issue=>issue.message===state.error)?null:state.error}/><FeedbackNotice message={state.notice}/>
  {state.status==='loading'?<Text accessibilityLiveRegion="polite" style={ui.body}>Loading saved property details...</Text>:null}
  {state.status==='error'?<ListingButton label="Retry loading" onPress={()=>void flow.reload()}/>:null}
  {state.uncertain?<ListingButton label="Check saved property" onPress={()=>void flow.reconcile()} disabled={state.busy}/>:null}
  {state.conflict?<ListingButton label="Discard local edits and reload" tone="outline" onPress={vm.reloadPropertyDetails} disabled={state.busy}/>:null}
  {state.status==='ready'&&c&&d?<>
   {c.model_attributes_version===2?<PropertyModelAttributeFields type={c.property_type} draft={d} error={error} disabled={disabled||c.open_tenancy} onChange={(field,value)=>flow.update(field,value)}/>:<Text style={ui.supporting}>Additional model-compatible property fields are awaiting the backend rollout. Existing details remain editable.</Text>}
   {estimateSection}
   <Text accessibilityRole="header" style={ui.sectionTitle}>Property identity</Text>
   <Text style={ui.body}>{propertyTypeOptions.find(o=>o.value===c.property_type)?.label} in {c.barangay}, {c.city}</Text>
   {c.floor_number!==null?<Text style={ui.supporting}>Rental floor: {c.floor_number}</Text>:null}
   <Text style={ui.supporting}>Property type, address, rental floor, and confirmed location are read-only. Identity corrections require a separate verification workflow.</Text>
   <ListingButton label="Request Identity Correction" tone="outline" disabled={disabled} onPress={vm.openIdentityCorrection}/>
   {c.open_tenancy?<Text accessibilityLiveRegion="polite" style={ui.supporting}>An open tenancy protects bedrooms, bathrooms, floor area, capacity, subtype, lot area, and parking. Other routine details remain editable.</Text>:null}
   <View collapsable={false} ref={focus.section('property')} style={{gap:spacing.md}}>
   {(['bedrooms','bathrooms','floorAreaSqm','maxOccupants'] as const).map(field=><ListingField key={field} inputRef={focus.field(field)} label={{bedrooms:'Bedrooms',bathrooms:'Bathrooms',floorAreaSqm:'Floor area (sqm, optional)',maxOccupants:'Maximum occupants (optional)'}[field]} placeholder={field==='floorAreaSqm'?'Floor area, not land area':field==='maxOccupants'?'Number of people':'0'} keyboardType="numeric" value={d[field]} editable={!disabled&&!(c.open_tenancy&&materialFields.includes(field))} error={error(field)} onChangeText={value=>change(field,value)}/>)}
   </View>
   <View collapsable={false} ref={focus.section('floors')}><ListingField inputRef={focus.field('totalFloors')} label={`${propertyFloorConfiguration(c.property_type).totalLabel} (optional)`} placeholder="Building floors" keyboardType="numeric" value={d.totalFloors} editable={!disabled} error={error('totalFloors')} onChangeText={value=>change('totalFloors',value)}/></View>
   <Text accessibilityRole="header" style={ui.sectionTitle}>Furnishing</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs}}>{furnishingOptions.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.furnishingStatus===o.value} disabled={disabled} onPress={()=>flow.update('furnishingStatus',o.value)}/>)}</View>
   <View collapsable={false} ref={focus.section('amenities')} style={{gap:spacing.sm}}><Text accessibilityRole="header" style={ui.sectionTitle}>Amenities</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs}}>{c.catalog.filter(a=>a.is_active||d.amenityIds.includes(a.id)).map(a=><ChoiceChip key={a.id} label={`${a.name}${a.is_active?'':' (unavailable)'}`} selected={d.amenityIds.includes(a.id)} disabled={disabled} onPress={()=>{setTouched(t=>({...t,amenityIds:true}));flow.update('amenityIds',d.amenityIds.includes(a.id)?d.amenityIds.filter(id=>id!==a.id):[...d.amenityIds,a.id]);}}/>)}</View>{error('amenityIds')?<Text accessibilityRole="alert" style={ui.supporting}>{error('amenityIds')}</Text>:null}</View>
   <ListingField label="Access instructions (private, optional)" placeholder="How to find the entrance" multiline editable={!disabled} value={d.accessInstructions} onChangeText={value=>change('accessInstructions',value)} helper="Shared only through existing authorized private-property access. Do not use this to change the official address."/>
  </>:null}
 </ListingWizardScaffold>;
}
