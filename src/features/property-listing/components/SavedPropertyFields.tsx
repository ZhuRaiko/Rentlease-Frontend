import type {PropertyFormFocus} from './usePropertyFormFocus';
import type {PropertyValidationIssue} from '../models/DraftProperty';
import type {ReactNode} from 'react';
import {Text,View} from 'react-native';
import {PostingChoices} from './PostingChoices';
import {PropertyModelAttributeFields} from './PropertyModelAttributeFields';
import {ListingField,ChoiceChip} from './ListingControls';
import {ListingButton} from './ListingButton';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {ui} from '../../../shared/theme/ui';
import {furnishingOptions} from '../models/DraftProperty';
import {routineIssues,materialFields,type RoutineField} from '../models/PropertyRoutineEdit';
import type {PostingGroup} from '../models/PostingPresentation';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
/** Existing versioned routine editor, presented inside the shared posting sections. */
export function SavedPropertyFields({viewModel:vm,group,photos,focus}:{focus:PropertyFormFocus;viewModel:PropertyListingViewModel;group:(key:PostingGroup,body:ReactNode)=>ReactNode;photos:ReactNode}){
 const state=vm.propertyRoutineState,flow=vm.propertyRoutine,c=state.context,d=state.draft;
 if(state.status!=='ready'||!c||!d)return <><Text style={ui.body}>{state.status==='error'?'Saved property could not load.':'Loading saved property...'}</Text><FeedbackNotice tone="error" message={state.error}/>{state.status==='error'?<ListingButton label="Retry property loading" onPress={()=>void flow.reload()}/>:null}</>;
 const issues=routineIssues(c,d),disabled=state.busy||state.uncertain||state.conflict;
 const error=(field:string)=>issues.find(i=>i.field===field)?.message??null;
 const locked=(field:RoutineField)=>disabled||c.open_tenancy&&materialFields.includes(field);
 const field=(key:RoutineField,label:string)=><ListingField inputRef={focus.field(key as PropertyValidationIssue['field'])} key={key} placeholder="Unknown" label={label} value={String(d[key]??'')} error={error(key)} editable={!locked(key)} keyboardType="numeric" onChangeText={value=>flow.update(key,value)}/>;
 return <>
 <FeedbackNotice message={state.notice}/><FeedbackNotice tone="error" message={state.error}/>
 {state.uncertain?<ListingButton label="Check saved property" onPress={()=>void flow.reconcile()} disabled={state.busy}/>:null}
 {state.conflict?<ListingButton label="Discard property edits and reload" onPress={vm.reloadPropertyDetails}/>:null}
 {group('about',<View collapsable={false} ref={focus.section('property')} style={{gap:12}}><Text style={ui.body}>{vm.propertySummary.type}</Text>{field('bedrooms','Bedrooms')}{field('bathrooms','Bathrooms')}<PostingChoices label="Furnishing" options={furnishingOptions} value={d.furnishingStatus} disabled={disabled} onChange={v=>flow.update('furnishingStatus',v)}/>{c.open_tenancy?<Text style={ui.supporting}>An open tenancy protects material rental details. Other permitted details remain editable.</Text>:null}</View>)}
 {group('location',<View collapsable={false} ref={focus.section('address')} style={{gap:12}}><Text style={ui.body}>{vm.propertySummary.location}</Text><Text style={ui.supporting}>Your confirmed address, property type and rental floor remain protected. A location or identity change requires the existing correction and verification workflow.</Text><ListingButton label="Request Identity Correction" tone="outline" disabled={disabled} onPress={vm.openIdentityCorrection}/><ListingField placeholder="How to find the entrance" label="Entrance instructions (private, optional)" value={d.accessInstructions} editable={!disabled} multiline onChangeText={v=>flow.update('accessInstructions',v)}/></View>)}
 {photos}
 {group('details',<View collapsable={false} ref={focus.section('details')} style={{gap:12}}>{field('floorAreaSqm','Floor area (sqm, optional)')}{field('maxOccupants','Maximum occupants (optional)')}<Text style={ui.supporting}>Rental floor: {c.floor_number??'Not specified'}</Text>{field('totalFloors','Floors in building (optional)')}{c.model_attributes_version===2?<PropertyModelAttributeFields focus={focus} compact type={c.property_type} draft={d} error={error} disabled={disabled||c.open_tenancy} onChange={(key,value)=>flow.update(key,value)}/>:<Text style={ui.supporting}>Additional model fields are unavailable for this backend revision.</Text>}</View>)}
 {group('amenities',<View collapsable={false} ref={focus.section('amenities')} style={{gap:12}}><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{c.catalog.filter(a=>a.is_active||d.amenityIds.includes(a.id)).map(a=><ChoiceChip comfortable key={a.id} label={a.name} selected={d.amenityIds.includes(a.id)} disabled={disabled} onPress={()=>flow.update('amenityIds',d.amenityIds.includes(a.id)?d.amenityIds.filter(x=>x!==a.id):[...d.amenityIds,a.id])}/>)}</View><Text style={ui.supporting}>{c.catalog.filter(a=>d.amenityIds.includes(a.id)).map(a=>a.name).join(', ')||'No amenities selected'}</Text>{error('amenityIds')?<Text accessibilityRole="alert" style={ui.supporting}>{error('amenityIds')}</Text>:null}</View>)}
 </>;
}
