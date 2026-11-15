import {type ReactNode} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {PropertyModelAttributeFields} from './PropertyModelAttributeFields';
import {PropertyFloorFields} from './PropertyFloorFields';
import {RangeDetailsCard} from './RangeDetailsCard';
import {UnitDetailFields} from './UnitDetailFields';
import {PropertyTypeGroups} from './PropertyTypeGroups';
import {PostingCard} from './PostingCard';
import {rangeInfoLine} from '../models/PostingEstimate';
import {RANGE_PROPERTY_TYPES} from '../../../shared/models/RentalEstimateEligibility';
import {rangeCardView} from '../models/RangeCard';
import {CompletenessHint} from './CompletenessHint';
import {FieldLabel} from './FieldLabel';
import {MoreDetailsFields} from './MoreDetailsFields';
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
import {LocationShareCard} from './LocationShareCard';
import {offeredSubtypeOptions} from '../models/PropertyModelAttributes';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

interface Props {accountId?:string|undefined;viewModel:PropertyListingViewModel;children?:ReactNode;focus?:PropertyFormFocus;renderGroup?:((key:PostingGroup,body:ReactNode)=>ReactNode)|undefined}
export function ComposerPropertyFields({accountId,viewModel:vm,children,focus,renderGroup}:Props) {
  const state=vm.propertyState,flow=vm.propertyCreation,d=state.draft,summary=vm.propertySummary;
  const saved=!!vm.workspacePropertyId,editable=!saved&&!state.busy&&!state.uncertain&&!vm.composerPhase,posting=!!renderGroup;
  const issue=vm.propertyValidationIssue;
  const feedback=(field:string)=>(vm.propertyVisibleValidationIssues??vm.propertyValidationIssues)?.find(item=>item.field===field)?.message??(issue?.field===field?issue.message:null);
  const group=(key:PostingGroup,body:ReactNode)=>renderGroup?renderGroup(key,body):body;
  // A subtype that does not fit the new type is dropped when the new type has a range (the chips then offer different values). For a type without a range
  // the range-only values are only hidden, so switching back loses nothing; they are left out when the property is saved.
  const setType=(v:string)=>{flow.updateField('propertyType',v as typeof d.propertyType);if(RANGE_PROPERTY_TYPES.includes(v)&&d.propertySubtype&&!offeredSubtypeOptions(v).includes(d.propertySubtype))flow.updateField('propertySubtype','');};
  const types=propertyTypeOptions;
  const support=vm.rangeSupport??'range';
  if(saved)return <>
    {group('about',<View style={styles.section}><Text style={ui.body}>{summary.type}</Text><Text style={ui.body}>{summary.bedrooms} bedrooms / {summary.bathrooms} bathrooms</Text><Text style={ui.supporting}>{summary.furnishing}</Text><Text style={ui.supporting}>Details are saved. Use Edit Property to make changes.</Text></View>)}
    {group('location',<Text style={ui.body}>{summary.location||'Loading saved property details...'}</Text>)}
    {group('details',<View style={styles.section}><Text style={ui.body}>Floor area: {summary.floorAreaSqm?`${summary.floorAreaSqm} sqm`:'Unknown'}</Text><Text style={ui.body}>Rental floor: {summary.floorNumber||'Not specified'}</Text>{children}</View>)}
    {group('more',<View style={styles.section}><Text style={ui.body}>Building floors: {summary.totalFloors||'Not specified'}</Text><Text style={ui.body}>Maximum occupants: {summary.maxOccupants||'Not specified'}</Text></View>)}
  </>;
  const bedsAndBaths=<View style={styles.columns}>{([['bedrooms','Bedrooms'],['bathrooms','Bathrooms']] as const).map(([field,label])=><View key={field} collapsable={false} ref={focus?.section(`detail:${field}`)} style={styles.cell}><ListingField inputRef={focus?.field(field)} label={label} required error={feedback(field)} placeholder="Enter count" keyboardType="numeric" editable={editable} value={d[field]} onChangeText={v=>flow.updateField(field,v)} onBlur={()=>vm.markPropertyFieldTouched(field)}/></View>)}</View>;
  const furnishing=<View collapsable={false} ref={focus?.section('detail:furnishingStatus')} style={styles.section}>
    <FieldLabel label="Furnishing"/>{feedback('furnishingStatus')?<Text style={styles.error}>{feedback('furnishingStatus')}</Text>:null}
    {posting?<PostingChoices label="Furnishing" options={furnishingOptions} value={d.furnishingStatus} disabled={!editable} onChange={v=>flow.updateField('furnishingStatus',v)}/>:<View style={styles.chips}>{furnishingOptions.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.furnishingStatus===o.value} disabled={!editable} onPress={()=>flow.updateField('furnishingStatus',o.value)}/>)}</View>}
  </View>;
  const rooms=<>{bedsAndBaths}{furnishing}</>;
  const about=<View style={styles.section}>
    <View collapsable={false} ref={focus?.section('property')}/>
    {!posting?<Text accessibilityRole="header" style={ui.sectionTitle}>Property</Text>:null}
    <FieldLabel label="Property type" required/>
    {feedback('propertyType')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('propertyType')}</Text>:null}
    {posting?<PropertyTypeGroups value={d.propertyType} disabled={!editable} onChange={setType}/>:<View style={styles.chips}>{types.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.propertyType===o.value} disabled={!editable} onPress={()=>setType(o.value)}/>)}</View>}
    {!posting?rooms:null}
  </View>;
  const plainDetails=<View collapsable={false} style={styles.section}>
    <View style={styles.columns}>{([['floorAreaSqm','Floor area (sqm, optional)','Unknown'],['maxOccupants','Maximum occupants (optional)','Unknown']] as const).map(([field,label,placeholder])=><View key={field} style={styles.cell}><ListingField inputRef={focus?.field(field)} label={label} helper={!posting?<CompletenessHint value={vm.completeness} factor={field==='floorAreaSqm'?'floorArea':'maxOccupants'}/>:null} error={feedback(field)} placeholder={placeholder} keyboardType="numeric" editable={editable} value={d[field]} onChangeText={v=>flow.updateField(field,v)}/></View>)}</View>
    <PropertyFloorFields propertyType={d.propertyType} focus={focus} floorNumber={d.floorNumber} totalFloors={d.totalFloors} editable={editable} errors={vm.propertyFloorIssues} onChange={(field,value)=>flow.updateField(field,value)}/>
    <PropertyModelAttributeFields type={d.propertyType} draft={d} focus={focus} compact={posting} error={feedback} disabled={!editable} onChange={(field,value)=>flow.updateField(field,value)}/>
  </View>;
  // Posting wizard: ONE card holds the eight details the range reads (floor area, bedrooms, bathrooms, unit floor or lot area, parking, subtype, furnishing,
  // amenities). Everything that does not change the range sits in the collapsed More details.
  // No type yet: nothing. A type or city without a range: a plain Details card. Otherwise the range card.
  const cityLabel=propertyCityOptions.find(o=>o.value===d.city)?.label??null,typeLabel=propertyTypeOptions.find(o=>o.value===d.propertyType)?.label??null;
  const wizardPlain=!posting||support==='range'||support==='none'?null:<View collapsable={false} ref={focus?.section('details')}><PostingCard title="Details">
    <Text style={ui.supporting}>{rangeInfoLine(support,typeLabel,cityLabel)}</Text>
    <View collapsable={false} ref={focus?.section('detail:floorAreaSqm')}><ListingField inputRef={focus?.field('floorAreaSqm')} label="Floor area (sqm, optional)" error={feedback('floorAreaSqm')} placeholder="e.g. 12" keyboardType="numeric" editable={editable} value={d.floorAreaSqm} onChangeText={v=>flow.updateField('floorAreaSqm',v)} onBlur={()=>vm.markPropertyFieldTouched('floorAreaSqm')}/></View>
    {bedsAndBaths}{furnishing}
    <View collapsable={false} ref={focus?.section('detail:amenityIds')}>{children}</View>
  </PostingCard></View>;
  const wizardRange=!posting||support!=='range'?null:<View collapsable={false} ref={focus?.section('details')}><RangeDetailsCard
    view={rangeCardView(vm.estimateInputs)} onFocus={(field,label)=>vm.focusRangeDetail(field,label)}
    size={<View style={styles.section}>
      <View collapsable={false} ref={focus?.section('detail:floorAreaSqm')}><ListingField inputRef={focus?.field('floorAreaSqm')} label="Floor area (sqm)" required={vm.floorAreaRequired} helper={vm.floorAreaRequired?undefined:<Text style={ui.supporting}>A range is not available for this property, so floor area is optional.</Text>} error={feedback('floorAreaSqm')} placeholder="e.g. 85" keyboardType="numeric" editable={editable} value={d.floorAreaSqm} onChangeText={v=>flow.updateField('floorAreaSqm',v)} onBlur={()=>vm.markPropertyFieldTouched('floorAreaSqm')}/></View>
      {bedsAndBaths}
    </View>}
    unit={<UnitDetailFields draft={d} focus={focus} error={feedback} disabled={!editable} onChange={(field,value)=>flow.updateField(field,value)} onBlur={field=>vm.markPropertyFieldTouched(field)}/>}
    comfort={<View style={styles.section}>{furnishing}<View collapsable={false} ref={focus?.section('detail:amenityIds')}>{children}</View></View>}
  /></View>;
  const wizardMore=<View collapsable={false} ref={focus?.section('more')} style={styles.section}>
    <MoreDetailsFields draft={d} focus={focus} error={feedback} disabled={!editable} onChange={(field,value)=>flow.updateField(field,value)} onBlur={field=>vm.markPropertyFieldTouched(field)}/>
  </View>;
  const details=plainDetails;
  const extraFields=<>{([['addressLine2','Building or subdivision (optional)','Building or subdivision'],['postalCode','Postal code (optional)','Postal code'],['accessInstructions','Entrance instructions (private, optional)','How to find the entrance']] as const).filter(([field])=>!posting||field!=='accessInstructions').map(([field,label,placeholder])=><ListingField inputRef={focus?.field(field)} key={field} label={label} error={feedback(field)} placeholder={placeholder} value={d[field]} editable={editable} multiline={field==='accessInstructions'} onChangeText={v=>flow.updateField(field,v)}/>)}</>;
  const extraTarget=vm.propertyValidationTarget&&['addressLine2','postalCode',...(posting?[]:['accessInstructions'])].includes(vm.propertyValidationTarget.field)?vm.propertyValidationTarget.requestId:undefined;
  // A confirmed new property folds the form into one row ("Location confirmed ... Change"); Change brings the address, the map and the switch back.
  const folded=posting&&!saved&&vm.locationDecided;
  const location=<View style={styles.section}>
    <View collapsable={false} ref={focus?.section('address')}/>
    {!posting?<Text accessibilityRole="header" style={ui.sectionTitle}>Location</Text>:null}
    {folded?null:<>
    <FieldLabel label="City" required/>{feedback('city')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('city')}</Text>:null}
    {posting?<PostingChoices label="City" options={propertyCityOptions} value={d.city} disabled={!editable} onChange={v=>flow.updateField('city',v)}/>:<View style={styles.chips}>{propertyCityOptions.map(o=><ChoiceChip key={o.value} label={o.label} selected={d.city===o.value} disabled={!editable} onPress={()=>flow.updateField('city',o.value)}/>)}</View>}
    {([['barangay','Barangay','Enter barangay'],['addressLine1','Street address','House/unit number and street']] as const).map(([field,label,placeholder])=><ListingField inputRef={focus?.field(field)} key={field} label={label} required error={feedback(field)} placeholder={placeholder} value={d[field]} editable={editable} onChangeText={v=>flow.updateField(field,v)} onBlur={()=>vm.markPropertyFieldTouched(field)}/>)}
    {posting?<PostingSection title="More address details" summary="Optional" revealId={extraTarget} plain>{extraFields}</PostingSection>:extraFields}
    </>}
    {posting?<View collapsable={false} ref={focus?.section('location')} style={styles.section}><LocationShareCard viewModel={vm} accountId={accountId} editable={editable}/></View>:    <View collapsable={false} ref={focus?.section('location')} style={styles.section}>
      <Text accessibilityLiveRegion="polite" style={ui.supporting}>{hasConfirmedPropertyLocation(d)?'Location confirmed':'Confirm your address on the map to continue.'}</Text>
      {feedback('location')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('location')}</Text>:null}
      {!posting?<CompletenessHint value={vm.completeness} factor="location"/>:null}
      <ListingButton label={hasConfirmedPropertyLocation(d)?'Review location on map':'Confirm location on map'} tone="outline" disabled={!editable||!state.loaded||!d.city||!d.barangay.trim()||!d.addressLine1.trim()} onPress={vm.openPropertyLocation}/>
      <Text style={ui.supporting}>Your exact pin stays private. Renters see an approximate location.</Text>
    </View>}
  </View>;
  return posting?<>{group('about',about)}{group('location',location)}{group('details',wizardRange??wizardPlain)}{group('more',wizardMore)}</>:<>{about}{details}{children}{location}</>;
}
const styles=StyleSheet.create({section:{gap:12},error:{...ui.supporting,color:colors.restricted},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},columns:{flexDirection:'row',flexWrap:'wrap',gap:12},cell:{flexBasis:130,flexGrow:1,minWidth:0},linkAction:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},link:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'}});
