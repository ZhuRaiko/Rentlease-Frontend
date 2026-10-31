import type { Database, Enums } from '../../../shared/services/supabase/database.types';
export type PropertySetupArgs = Database['public']['Functions']['create_property_setup']['Args'];
export interface PropertyLocationInput {
  exactLatitude: number; exactLongitude: number; publicLatitude: number; publicLongitude: number;
}
export const propertyTypeOptions: { value: Enums<'property_type'>; label: string }[] = [
  { value: 'apartment', label: 'Apartment' }, { value: 'boarding_house', label: 'Boarding house' },
  { value: 'bedspace', label: 'Bedspace' }, { value: 'room', label: 'Room' }, { value: 'studio', label: 'Studio' },
  { value: 'condominium', label: 'Condominium' }, { value: 'house', label: 'House' }, { value: 'dormitory', label: 'Dormitory' }, { value: 'other', label: 'Other' },
];
export const propertyCityOptions: { value: Enums<'cavite_city'>; label: string }[] = [
  { value: 'imus', label: 'Imus' }, { value: 'dasmarinas', label: 'Dasmarinas' }, { value: 'tagaytay', label: 'Tagaytay' },
];
export const furnishingOptions: { value: Enums<'furnishing_status'>; label: string }[] = [
  { value: 'unfurnished', label: 'Unfurnished' }, { value: 'semi_furnished', label: 'Semi-furnished' }, { value: 'furnished', label: 'Furnished' },
];
export interface DraftProperty {
  propertyType: Enums<'property_type'> | null; city: Enums<'cavite_city'> | null;
  barangay: string; addressLine1: string; addressLine2: string; postalCode: string; accessInstructions: string;
  exactLatitude: number | null; exactLongitude: number | null; publicLatitude: number | null; publicLongitude: number | null;
  bedrooms: string; bathrooms: string; floorAreaSqm: string; floorNumber: string; totalFloors: string;
  furnishingStatus: Enums<'furnishing_status'>; maxOccupants: string; amenityIds: number[];
}
export const emptyDraftProperty = (): DraftProperty => ({ propertyType: null, city: null, barangay: '', addressLine1: '', addressLine2: '', postalCode: '', accessInstructions: '', exactLatitude: null, exactLongitude: null, publicLatitude: null, publicLongitude: null, bedrooms: '0', bathrooms: '0', floorAreaSqm: '', floorNumber: '', totalFloors: '', furnishingStatus: 'unfurnished', maxOccupants: '', amenityIds: [] });
export type PropertyCreationInput = Omit<DraftProperty, keyof PropertyLocationInput> & PropertyLocationInput;
export const hasConfirmedPropertyLocation = (draft: DraftProperty): draft is PropertyCreationInput =>
  [draft.exactLatitude, draft.exactLongitude, draft.publicLatitude, draft.publicLongitude].every(value => typeof value === 'number' && Number.isFinite(value))
  && Math.abs(draft.exactLatitude!) <= 90 && Math.abs(draft.publicLatitude!) <= 90
  && Math.abs(draft.exactLongitude!) <= 180 && Math.abs(draft.publicLongitude!) <= 180;
export const propertyLocationNotice = 'Confirm the property location before saving.';
export function propertyCreationInput(draft: DraftProperty): PropertyCreationInput {
  if (!hasConfirmedPropertyLocation(draft)) throw new Error(propertyLocationNotice);
  return draft;
}
export function propertyFloorConfiguration(type: DraftProperty['propertyType']) {
  const house=type==='house';
  const floorLabel=type==='room'?"Room's floor":type==='bedspace'?"Space's floor":type==='studio'?"Studio's floor":type==='apartment'||type==='condominium'?"Unit's floor":'Rental floor';
  return {showFloor:!house,floorLabel,totalLabel:house?'Number of stories':'Floors in building',
    example:house?'For a two-story house, enter 2. Unit numbers belong in the address.':"For a rental on the 2nd floor of a 5-story building, enter 2 and 5. Leave the rental floor blank if it does not apply. Unit numbers belong in the address."};
}
export const propertyFloorRelationshipMessage = "The property floor cannot be higher than the building's total floors.";
export function propertyFloorIssues(draft: Pick<DraftProperty, 'floorNumber'|'totalFloors'> & Partial<Pick<DraftProperty,'propertyType'>>) {
  const floor = draft.propertyType==='house'?'':draft.floorNumber.trim(), total = draft.totalFloors.trim();
  const validInteger = (value: string, minimum: number) => Number.isInteger(Number(value)) && Number(value) >= minimum && Number(value) <= 32767;
  const issues = {
    floorNumber: floor && !validInteger(floor,0) ? 'Enter a valid rental floor.' : null as string|null,
    totalFloors: total && !validInteger(total,1) ? (draft.propertyType==='house'?'Enter a valid number of stories.':'Enter a valid number of floors in the building.') : null as string|null,
  };
  if(floor && total && !issues.floorNumber && !issues.totalFloors && Number(floor)>Number(total)) {
    issues.floorNumber=propertyFloorRelationshipMessage; issues.totalFloors=propertyFloorRelationshipMessage;
  }
  return issues;
}
export type PropertyValidationSection='property'|'floors'|'address'|'location'|'amenities';
export type PropertyValidationField=keyof DraftProperty|'location';
export interface PropertyValidationIssue {field:PropertyValidationField;section:PropertyValidationSection;kind:'required'|'invalid';message:string}
export const propertySectionLabels:Record<PropertyValidationSection,string>={property:'Property details',floors:'Property floor information',address:'Address',location:'Confirmed location',amenities:'Amenities'};
export function propertyValidationIssues(draft:DraftProperty,requireLocation=true):PropertyValidationIssue[] {
  const issues:PropertyValidationIssue[]=[];
  const add=(field:PropertyValidationField,section:PropertyValidationSection,message:string,kind:PropertyValidationIssue['kind']='invalid')=>issues.push({field,section,message,kind});
  if(!propertyTypeOptions.some(o=>o.value===draft.propertyType))add('propertyType','property','Choose a supported property type.',draft.propertyType?'invalid':'required');
  if(!propertyCityOptions.some(o=>o.value===draft.city))add('city','address','Choose a supported city.',draft.city?'invalid':'required');
  if(!draft.barangay.trim())add('barangay','address','Enter the property barangay.','required');
  if(!draft.addressLine1.trim())add('addressLine1','address','Enter address line 1 for the property.','required');
  if(requireLocation&&!hasConfirmedPropertyLocation(draft))add('location','location',propertyLocationNotice,'required');
  const floors=propertyFloorIssues(draft);
  if(floors.floorNumber)add('floorNumber','floors',floors.floorNumber);
  if(floors.totalFloors&&floors.totalFloors!==floors.floorNumber)add('totalFloors','floors',floors.totalFloors);
  for(const [field,label,integer,positive] of [['bedrooms','Bedrooms',true,false],['bathrooms','Bathrooms',false,false],['floorAreaSqm','Floor area',false,true],['maxOccupants','Maximum occupants',true,true]] as const){
    const value=draft[field],required=field==='bedrooms'||field==='bathrooms';
    if(!value.trim()&&!required)continue;
    const n=Number(value);
    if(!value.trim()||!Number.isFinite(n)||n<0||(positive&&n===0)||(integer&&(!Number.isInteger(n)||n>32767)))add(field,'property',`Enter a valid ${label.toLowerCase()}.`,!value.trim()&&required?'required':'invalid');
  }
  if(Number.isFinite(Number(draft.bathrooms))&&Math.round(Number(draft.bathrooms)*10)>=10000)add('bathrooms','property','Enter a smaller bathroom count.');
  if(draft.floorAreaSqm.trim()&&Number.isFinite(Number(draft.floorAreaSqm))&&Number(draft.floorAreaSqm)>0){
    const area=Math.round(Number(draft.floorAreaSqm)*100);
    if(area<=0)add('floorAreaSqm','property','Enter a floor area that remains greater than zero when saved.');
    if(area>=10000000000)add('floorAreaSqm','property','Enter a smaller floor area.');
  }
  if(!furnishingOptions.some(o=>o.value===draft.furnishingStatus))add('furnishingStatus','property','Choose a supported furnishing status.');
  if(draft.amenityIds.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(draft.amenityIds).size!==draft.amenityIds.length)add('amenityIds','amenities','Choose valid, distinct amenities from the catalog.');
  const order:PropertyValidationSection[]=['property','floors','amenities','address','location'];
  return issues.sort((a,b)=>order.indexOf(a.section)-order.indexOf(b.section));
}
export function draftPropertyError(draft:DraftProperty,requireLocation=true):string|null {return propertyValidationIssues(draft,requireLocation)[0]?.message??null;}
export function propertySetupPayload(draft: PropertyCreationInput): PropertySetupArgs {
  const error = draftPropertyError(draft); if (error) throw new Error(error);
  // Validation narrows the required domain fields; no preview labels/land area are mapped.
  if (!draft.propertyType || !draft.city) throw new Error('Property details are incomplete.');
  return {
    p_property_type: draft.propertyType, p_city: draft.city, p_barangay: draft.barangay.trim(), p_address_line_1: draft.addressLine1.trim(),
    p_exact_lat: draft.exactLatitude, p_exact_lng: draft.exactLongitude,
    p_public_lat: draft.publicLatitude, p_public_lng: draft.publicLongitude,
    p_amenity_ids: [...draft.amenityIds], p_bedrooms: Number(draft.bedrooms), p_bathrooms: Number(draft.bathrooms), p_furnishing_status: draft.furnishingStatus,
    ...(draft.addressLine2.trim() ? { p_address_line_2: draft.addressLine2.trim() } : {}),
    ...(draft.postalCode.trim() ? { p_postal_code: draft.postalCode.trim() } : {}),
    ...(draft.accessInstructions.trim() ? { p_access_instructions: draft.accessInstructions.trim() } : {}),
    ...(draft.floorAreaSqm.trim() ? { p_floor_area_sqm: Number(draft.floorAreaSqm) } : {}),
    ...(draft.propertyType!=='house' && draft.floorNumber.trim() ? { p_floor_number: Number(draft.floorNumber) } : {}),
    ...(draft.totalFloors.trim() ? { p_total_floors: Number(draft.totalFloors) } : {}),
    ...(draft.maxOccupants.trim() ? { p_max_occupants: Number(draft.maxOccupants) } : {}),
  };
}
export const isPropertyUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function draftPropertyIssue(draft:DraftProperty) {
  const issue=propertyValidationIssues(draft)[0];return issue?{field:issue.field,message:issue.message}:null;
}
