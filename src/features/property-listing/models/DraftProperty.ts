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
export function draftPropertyError(draft: DraftProperty, requireLocation = true): string | null {
  if (!propertyTypeOptions.some(o => o.value === draft.propertyType)) return 'Choose a supported property type.';
  if (!propertyCityOptions.some(o => o.value === draft.city)) return 'Choose a supported city.';
  if (!draft.barangay.trim() || !draft.addressLine1.trim()) return 'Enter the barangay and address line 1.';
  if (requireLocation && !hasConfirmedPropertyLocation(draft)) return propertyLocationNotice;
  for (const [label, value, integer, positive] of [['Bedrooms', draft.bedrooms, true, false], ['Bathrooms', draft.bathrooms, false, false], ['Floor area', draft.floorAreaSqm, false, true], ['Floor number', draft.floorNumber, true, false], ['Total floors', draft.totalFloors, true, true], ['Maximum occupants', draft.maxOccupants, true, true]] as const) {
    if (value === '' && !['Bedrooms', 'Bathrooms'].includes(label)) continue;
    const n = Number(value);
    if (!value.trim() || !Number.isFinite(n) || n < 0 || (positive && n === 0) || (integer && (!Number.isInteger(n) || n > 32767))) return `Enter a valid ${label.toLowerCase()}.`;
  }
  if (!furnishingOptions.some(o => o.value === draft.furnishingStatus)) return 'Choose a supported furnishing status.';
  if (draft.amenityIds.length) return 'Amenities are not connected in this phase.';
  return null;
}
export function propertySetupPayload(draft: PropertyCreationInput): PropertySetupArgs {
  const error = draftPropertyError(draft); if (error) throw new Error(error);
  // Validation narrows the required domain fields; no preview labels/land area are mapped.
  if (!draft.propertyType || !draft.city) throw new Error('Property details are incomplete.');
  return {
    p_property_type: draft.propertyType, p_city: draft.city, p_barangay: draft.barangay.trim(), p_address_line_1: draft.addressLine1.trim(),
    p_exact_lat: draft.exactLatitude, p_exact_lng: draft.exactLongitude,
    p_public_lat: draft.publicLatitude, p_public_lng: draft.publicLongitude,
    p_amenity_ids: [], p_bedrooms: Number(draft.bedrooms), p_bathrooms: Number(draft.bathrooms), p_furnishing_status: draft.furnishingStatus,
    ...(draft.addressLine2.trim() ? { p_address_line_2: draft.addressLine2.trim() } : {}),
    ...(draft.postalCode.trim() ? { p_postal_code: draft.postalCode.trim() } : {}),
    ...(draft.accessInstructions.trim() ? { p_access_instructions: draft.accessInstructions.trim() } : {}),
    ...(draft.floorAreaSqm ? { p_floor_area_sqm: Number(draft.floorAreaSqm) } : {}),
    ...(draft.floorNumber ? { p_floor_number: Number(draft.floorNumber) } : {}),
    ...(draft.totalFloors ? { p_total_floors: Number(draft.totalFloors) } : {}),
    ...(draft.maxOccupants ? { p_max_occupants: Number(draft.maxOccupants) } : {}),
  };
}
export const isPropertyUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
