import type {PropertyValidationIssue} from './DraftProperty';

export type PostingGroup = 'about' | 'location' | 'details' | 'more';
export function postingValidationGroup(issue:Pick<PropertyValidationIssue,'field'>|null|undefined):PostingGroup|null {
  if(!issue)return null;
  // Property type = type; the range card = the eight details the range reads (floor area, bedrooms, bathrooms, unit floor, lot area, parking, subtype,
  // furnishing, amenities); More details = what does not change the range (floors in building, occupants, entrance instructions); the rest is the address.
  if(['floorAreaSqm','bedrooms','bathrooms','furnishingStatus','floorNumber','lotAreaSqm','parkingSpaces','propertySubtype','amenityIds'].includes(issue.field))return 'details';
  if(['maxOccupants','totalFloors','accessInstructions'].includes(issue.field))return 'more';
  if(['city','barangay','addressLine1','addressLine2','postalCode','location'].includes(issue.field))return 'location';
  return 'about';
}
export const postingColumnCount=(width:number,fontScale:number)=>width/Math.max(1,fontScale)<340?1:2;
