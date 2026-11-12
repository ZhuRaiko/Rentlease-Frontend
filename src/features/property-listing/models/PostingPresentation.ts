import type {PropertyValidationIssue} from './DraftProperty';

export type PostingGroup = 'about' | 'location' | 'photos' | 'details' | 'amenities';
export function postingValidationGroup(issue:Pick<PropertyValidationIssue,'field'>|null|undefined):PostingGroup|null {
  if(!issue)return null;
  if(['floorAreaSqm','maxOccupants','floorNumber','totalFloors','propertySubtype','lotAreaSqm','parkingSpaces'].includes(issue.field))return 'details';
  if(['city','barangay','addressLine1','addressLine2','postalCode','accessInstructions','location'].includes(issue.field))return 'location';
  return issue.field==='amenityIds'?'amenities':'about';
}
export const postingColumnCount=(width:number,fontScale:number)=>width/Math.max(1,fontScale)<340?1:2;
