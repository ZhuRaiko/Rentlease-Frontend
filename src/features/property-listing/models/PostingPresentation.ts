import type {PropertyValidationIssue} from './DraftProperty';

export type PostingGroup = 'about' | 'location' | 'photos' | 'details' | 'amenities' | 'more';
export function postingValidationGroup(issue:Pick<PropertyValidationIssue,'field'>|null|undefined):PostingGroup|null {
  if(!issue)return null;
  // Basics = type; Size and rooms = floor area, bedrooms, bathrooms, furnishing; More details = everything optional that is not an address.
  if(['floorAreaSqm','bedrooms','bathrooms','furnishingStatus'].includes(issue.field))return 'details';
  if(['maxOccupants','floorNumber','totalFloors','propertySubtype','lotAreaSqm','parkingSpaces','accessInstructions'].includes(issue.field))return 'more';
  if(['city','barangay','addressLine1','addressLine2','postalCode','location'].includes(issue.field))return 'location';
  return issue.field==='amenityIds'?'amenities':'about';
}
export const postingColumnCount=(width:number,fontScale:number)=>width/Math.max(1,fontScale)<340?1:2;
