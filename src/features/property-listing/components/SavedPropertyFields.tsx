import type {PropertyFormFocus} from './usePropertyFormFocus';
import {rangeInfoLine} from '../models/PostingEstimate';
import {PostingCard} from './PostingCard';
import {propertyCityOptions,propertyTypeOptions} from '../models/DraftProperty';
import type {PropertyValidationIssue} from '../models/DraftProperty';
import type {ReactNode} from 'react';
import {Text,View} from 'react-native';
import {PostingChoices} from './PostingChoices';
import {PostingSection} from './PostingSection';
import {RangeDetailsCard} from './RangeDetailsCard';
import {FieldLabel} from './FieldLabel';
import {PropertyModelAttributeFields} from './PropertyModelAttributeFields';
import {ListingField,ChoiceChip} from './ListingControls';
import {ListingButton} from './ListingButton';
import {LocationShareCard} from './LocationShareCard';
import {AmenityChoices} from './AmenityChoices';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {ui} from '../../../shared/theme/ui';
import {furnishingOptions} from '../models/DraftProperty';
import {routineIssues,materialFields,type RoutineField} from '../models/PropertyRoutineEdit';
import type {PostingGroup} from '../models/PostingPresentation';
import {MORE_DETAILS_HELPER,isHouse,rangeCardView} from '../models/RangeCard';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
/** Existing versioned routine editor, presented inside the shared posting sections. */
export function SavedPropertyFields({viewModel:vm,group,focus,accountId}:{accountId?:string|undefined;focus:PropertyFormFocus;viewModel:PropertyListingViewModel;group:(key:PostingGroup,body:ReactNode)=>ReactNode}){
 const state=vm.propertyRoutineState,flow=vm.propertyRoutine,c=state.context,d=state.draft;
 if(state.status!=='ready'||!c||!d)return <><Text style={ui.body}>{state.status==='error'?'Saved property could not load.':'Loading saved property...'}</Text><FeedbackNotice tone="error" message={state.error}/>{state.status==='error'?<ListingButton label="Retry property loading" onPress={()=>void flow.reload()}/>:null}</>;
 const support=vm.rangeSupport??'range',issues=routineIssues(c,d),disabled=state.busy||state.uncertain||state.conflict;
 const error=(field:string)=>issues.find(i=>i.field===field)?.message??null;
 const locked=(field:RoutineField)=>disabled||c.open_tenancy&&materialFields.includes(field);
 const field=(key:RoutineField,label:string,required=false,helper?:ReactNode)=><View key={key} collapsable={false} ref={focus.section(`detail:${key}`)}><ListingField inputRef={focus.field(key as PropertyValidationIssue['field'])} placeholder="Unknown" label={label} required={required} helper={helper} value={String(d[key]??'')} error={error(key)} editable={!locked(key)} keyboardType="numeric" onChangeText={value=>flow.update(key,value)}/></View>;
 const furnishing=<View collapsable={false} ref={focus.section('detail:furnishingStatus')} style={{gap:8}}><FieldLabel label="Furnishing"/><PostingChoices label="Furnishing" options={furnishingOptions} value={d.furnishingStatus} disabled={disabled} onChange={v=>flow.update('furnishingStatus',v)}/></View>;
 const amenities=<View collapsable={false} ref={focus.section('detail:amenityIds')} style={{gap:12}}><AmenityChoices catalog={c.catalog.filter(a=>a.is_active||d.amenityIds.includes(a.id))} selectedIds={d.amenityIds} disabled={disabled} onToggle={id=>flow.update('amenityIds',d.amenityIds.includes(id)?d.amenityIds.filter(x=>x!==id):[...d.amenityIds,id])}/>{error('amenityIds')?<Text accessibilityRole="alert" style={ui.supporting}>{error('amenityIds')}</Text>:null}</View>;
 return <>
 <FeedbackNotice message={state.notice}/><FeedbackNotice tone="error" message={state.error}/>
 {state.uncertain?<ListingButton label="Check saved property" onPress={()=>void flow.reconcile()} disabled={state.busy}/>:null}
 {state.conflict?<ListingButton label="Discard property edits and reload" onPress={vm.reloadPropertyDetails}/>:null}
 {group('about',<View collapsable={false} ref={focus.section('property')} style={{gap:12}}><Text style={ui.body}>{vm.propertySummary.type}</Text>{c.open_tenancy?<Text style={ui.supporting}>An open tenancy protects material rental details. Other permitted details remain editable.</Text>:null}</View>)}
 {group('location',<View collapsable={false} ref={focus.section('address')} style={{gap:12}}><Text style={ui.body}>{vm.propertySummary.location}</Text><Text style={ui.supporting}>Your confirmed address, property type and rental floor remain protected. A location or identity change requires the existing correction and verification workflow.</Text><ListingButton label="Request Identity Correction" tone="outline" disabled={disabled} onPress={vm.openIdentityCorrection}/><LocationShareCard viewModel={vm} accountId={accountId} editable={!disabled}/></View>)}
 {group('details',support==='none'?null:support!=='range'?<View collapsable={false} ref={focus.section('details')}><PostingCard title="Details">
   <Text style={ui.supporting}>{rangeInfoLine(support,propertyTypeOptions.find(o=>o.value===c.property_type)?.label??null,propertyCityOptions.find(o=>o.value===c.city)?.label??null)}</Text>
   {field('floorAreaSqm','Floor area (sqm, optional)')}{field('bedrooms','Bedrooms')}{field('bathrooms','Bathrooms')}{furnishing}{amenities}
 </PostingCard></View>:<View collapsable={false} ref={focus.section('details')}><RangeDetailsCard
   view={rangeCardView(vm.estimateInputs)} onFocus={(f,label)=>vm.focusRangeDetail(f,label)}
   size={<View style={{gap:12}}>{field('floorAreaSqm','Floor area (sqm)',vm.floorAreaRequired,vm.floorAreaRequired?undefined:<Text style={ui.supporting}>A range is not available for this property, so floor area is optional.</Text>)}{field('bedrooms','Bedrooms')}{field('bathrooms','Bathrooms')}</View>}
   unit={<View style={{gap:12}}>
     {isHouse(c.property_type)?null:<View collapsable={false} ref={focus.section('detail:floorNumber')}><Text style={ui.body}>Unit floor: {c.floor_number??'Not specified'}</Text></View>}
     {c.model_attributes_version===2?<PropertyModelAttributeFields focus={focus} compact type={c.property_type} draft={d} error={error} disabled={disabled||c.open_tenancy} onChange={(key,value)=>flow.update(key,value)}/>:<Text style={ui.supporting}>This feature is not available right now. Try again later.</Text>}
   </View>}
   comfort={<View style={{gap:12}}>{furnishing}{amenities}</View>}
 /></View>)}
 {group('more',<View collapsable={false} ref={focus.section('more')} style={{gap:12}}><Text style={ui.supporting}>{MORE_DETAILS_HELPER}</Text>{field('totalFloors',isHouse(c.property_type)?'Stories':'Floors in building')}{field('maxOccupants','Max occupants')}<ListingField placeholder="e.g. Gate code, nearest landmark" label="Entrance instructions (private)" value={d.accessInstructions} editable={!disabled} multiline onChangeText={v=>flow.update('accessInstructions',v)}/></View>)}
 </>;
}
