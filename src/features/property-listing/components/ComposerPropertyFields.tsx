import {useState,type ReactNode} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {PropertyModelAttributeFields} from './PropertyModelAttributeFields';
import {PropertyFloorFields} from './PropertyFloorFields';
import {CompletenessHint} from './CompletenessHint';
import {FieldLabel} from './FieldLabel';
import {PostingChoices} from './PostingChoices';
import {PostingSection} from './PostingSection';
import type {PostingGroup} from '../models/PostingPresentation';
import type {PropertyFormFocus} from './usePropertyFormFocus';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {propertyTypeOptions,propertyCityOptions,furnishingOptions,hasConfirmedPropertyLocation} from '../models/DraftProperty';
import {ChoiceChip,ListingField} from './ListingControls';
import {ListingButton} from './ListingButton';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

interface Props {viewModel:PropertyListingViewModel;children?:ReactNode;focus?:PropertyFormFocus;renderGroup?:((key:PostingGroup,body:ReactNode)=>ReactNode)|undefined;afterLocation?:ReactNode}
export function ComposerPropertyFields({viewModel:vm,children,focus,renderGroup,afterLocation}:Props) {
  const [allTypes,setAllTypes]=useState(false);
  const state=vm.propertyState,flow=vm.propertyCreation,d=state.draft,summary=vm.propertySummary;
  const saved=!!vm.workspacePropertyId,editable=!saved&&!state.busy&&!state.uncertain&&!vm.composerPhase,posting=!!renderGroup;
  const issue=vm.propertyValidationIssue;
  const feedback=(field:string)=>(vm.propertyVisibleValidationIssues??vm.propertyValidationIssues)?.find(item=>item.field===field)?.message??(issue?.field===field?issue.message:null);
  const group=(key:PostingGroup,body:ReactNode)=>renderGroup?renderGroup(key,body):body;
  const common=['apartment','house','condominium','boarding_house'];
  const expandedTypes=allTypes;
  const types=posting?[...common.map(value=>propertyTypeOptions.find(o=>o.value===value)!),...propertyTypeOptions.filter(o=>!common.includes(o.value)&&(expandedTypes||o.value===d.propertyType))]:propertyTypeOptions;
  if(saved)return <>
    {group('about',<View style={styles.section}><Text style={ui.body}>{summary.type}</Text><Text style={ui.body}>{summary.bedrooms} bedrooms / {summary.bathrooms} bathrooms</Text><Text style={ui.supporting}>{summary.furnishing}</Text><Text style={ui.supporting}>Details are saved. Use Edit Property to make changes.</Text></View>)}
    {group('location',<Text style={ui.body}>{summary.location||'Loading saved property details...'}</Text>)}
    {afterLocation}
    {group('details',<View style={styles.section}><Text style={ui.body}>Floor area: {summary.floorAreaSqm?`${summary.floorAreaSqm} sqm`:'Unknown'}</Text><Text style={ui.body}>Rental floor: {summary.floorNumber||'Not specified'}</Text><Text style={ui.body}>Building floors: {summary.totalFloors||'Not specified'}</Text><Text style={ui.body}>Maximum occupants: {summary.maxOccupants||'Not specified'}</Text></View>)}
    {group('amenities',children)}
  </>;
  const about=<View style={styles.section}>
    <View collapsable={false} ref={focus?.section('property')}/>
    {!posting?<Text accessibilityRole="header" style={ui.sectionTitle}>Property</Text>:null}
    <FieldLabel label="Property type" required/>
    {feedback('propertyType')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('propertyType')}</Text>:null}
    {posting?<><PostingChoices label="Property type" options={types} value={d.propertyType} disabled={!editable} onChange={v=>flow.updateField('propertyType',v)}/><Pressable accessibilityRole="button" accessibilityLabel={expandedTypes?'Show common property types':'Show all property types'} accessibilityState={{expanded:expandedTypes}} onPress={()=>setAllTypes(!expandedTypes)} style={styles.linkAction}><Text style={styles.link}>{expandedTypes?'Show common types':'More property types'}</Text></Pressable></>:<View style={styles.chips}>{types.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.propertyType===o.value} disabled={!editable} onPress={()=>flow.updateField('propertyType',o.value)}/>)}</View>}
    <View style={styles.columns}>{([['bedrooms','Bedrooms'],['bathrooms','Bathrooms']] as const).map(([field,label])=><View key={field} style={styles.cell}><ListingField inputRef={focus?.field(field)} label={label} required error={feedback(field)} placeholder="Enter count" keyboardType="numeric" editable={editable} value={d[field]} onChangeText={v=>flow.updateField(field,v)}/></View>)}</View>
    <FieldLabel label="Furnishing"/>{feedback('furnishingStatus')?<Text style={styles.error}>{feedback('furnishingStatus')}</Text>:null}
    {posting?<PostingChoices label="Furnishing" options={furnishingOptions} value={d.furnishingStatus} disabled={!editable} onChange={v=>flow.updateField('furnishingStatus',v)}/>:<View style={styles.chips}>{furnishingOptions.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.furnishingStatus===o.value} disabled={!editable} onPress={()=>flow.updateField('furnishingStatus',o.value)}/>)}</View>}
  </View>;
  const details=<View collapsable={false} ref={posting?focus?.section('details'):undefined} style={styles.section}>
    <View style={styles.columns}>{([['floorAreaSqm','Floor area (sqm, optional)','Unknown'],['maxOccupants','Maximum occupants (optional)','Unknown']] as const).map(([field,label,placeholder])=><View key={field} style={styles.cell}><ListingField inputRef={focus?.field(field)} label={label} helper={!posting?<CompletenessHint value={vm.completeness} factor={field==='floorAreaSqm'?'floorArea':'maxOccupants'}/>:null} error={feedback(field)} placeholder={placeholder} keyboardType="numeric" editable={editable} value={d[field]} onChangeText={v=>flow.updateField(field,v)}/></View>)}</View>
    <PropertyFloorFields propertyType={d.propertyType} focus={focus} floorNumber={d.floorNumber} totalFloors={d.totalFloors} editable={editable} errors={vm.propertyFloorIssues} onChange={(field,value)=>flow.updateField(field,value)}/>
    <PropertyModelAttributeFields type={d.propertyType} draft={d} focus={focus} compact={posting} error={feedback} disabled={!editable} onChange={(field,value)=>flow.updateField(field,value)}/>
  </View>;
  const extraFields=<>{([['addressLine2','Building or subdivision (optional)','Building or subdivision'],['postalCode','Postal code (optional)','Postal code'],['accessInstructions','Entrance instructions (private, optional)','How to find the entrance']] as const).map(([field,label,placeholder])=><ListingField inputRef={focus?.field(field)} key={field} label={label} error={feedback(field)} placeholder={placeholder} value={d[field]} editable={editable} multiline={field==='accessInstructions'} onChangeText={v=>flow.updateField(field,v)}/>)}</>;
  const extraTarget=vm.propertyValidationTarget&&['addressLine2','postalCode','accessInstructions'].includes(vm.propertyValidationTarget.field)?vm.propertyValidationTarget.requestId:undefined;
  const location=<View style={styles.section}>
    <View collapsable={false} ref={focus?.section('address')}/>
    {!posting?<Text accessibilityRole="header" style={ui.sectionTitle}>Location</Text>:null}
    <FieldLabel label="City" required/>{feedback('city')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('city')}</Text>:null}
    {posting?<PostingChoices label="City" options={propertyCityOptions} value={d.city} disabled={!editable} onChange={v=>flow.updateField('city',v)}/>:<View style={styles.chips}>{propertyCityOptions.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.city===o.value} disabled={!editable} onPress={()=>flow.updateField('city',o.value)}/>)}</View>}
    {([['barangay','Barangay','Enter barangay'],['addressLine1','Street address','House/unit number and street']] as const).map(([field,label,placeholder])=><ListingField inputRef={focus?.field(field)} key={field} label={label} required error={feedback(field)} placeholder={placeholder} value={d[field]} editable={editable} onChangeText={v=>flow.updateField(field,v)}/>)}
    {posting?<PostingSection title="More address details" summary="Optional" revealId={extraTarget} plain>{extraFields}</PostingSection>:extraFields}
    <View collapsable={false} ref={focus?.section('location')} style={styles.section}>
      <Text accessibilityLiveRegion="polite" style={ui.supporting}>{hasConfirmedPropertyLocation(d)?'Location confirmed':'Confirm your address on the map to continue.'}</Text>
      {feedback('location')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('location')}</Text>:null}
      {!posting?<CompletenessHint value={vm.completeness} factor="location"/>:null}
      <ListingButton label={hasConfirmedPropertyLocation(d)?'Review location on map':'Confirm location on map'} tone="outline" disabled={!editable||!state.loaded||!d.city||!d.barangay.trim()||!d.addressLine1.trim()} onPress={vm.openPropertyLocation}/>
      <Text style={ui.supporting}>Your exact pin stays private. Renters see an approximate location.</Text>
    </View>
  </View>;
  return posting?<>{group('about',about)}{group('location',location)}{afterLocation}{group('details',details)}{group('amenities',children)}</>:<>{about}{details}{children}{location}</>;
}
const styles=StyleSheet.create({section:{gap:12},error:{...ui.supporting,color:colors.restricted},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},columns:{flexDirection:'row',flexWrap:'wrap',gap:12},cell:{flexBasis:130,flexGrow:1,minWidth:0},linkAction:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},link:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'}});
