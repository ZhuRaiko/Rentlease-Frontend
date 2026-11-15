import type { PropertyValidationIssue } from './DraftProperty';
import { offeredSubtypeOptions } from './PropertyModelAttributes';

/** Footer words for the fields the form can name, in the order the page shows them. */
const MISSING_WORDS: Partial<Record<PropertyValidationIssue['field'], string>> = {
  propertyType: 'property type', floorAreaSqm: 'floor area', bedrooms: 'bedrooms', bathrooms: 'bathrooms', city: 'city', barangay: 'barangay', addressLine1: 'street',
};
const MISSING_ORDER: PropertyValidationIssue['field'][] = ['propertyType', 'floorAreaSqm', 'bedrooms', 'bathrooms', 'city', 'barangay', 'addressLine1'];
const joinWords = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0] ?? '');

/**
 * The ONE line that says why Continue is disabled: what is missing, in plain words. Required gaps first ("Add floor area, city, barangay and
 * street"), then a pin that is not confirmed yet, then a value that does not fit ("Check ..."). Null when nothing is in the way.
 */
export function missingLine(issues: PropertyValidationIssue[], floorAreaMissing: boolean, locationUndecided: boolean): string | null {
  const names = new Set<string>(issues.filter(i => i.kind === 'required').map(i => i.field));
  if (floorAreaMissing) names.add('floorAreaSqm');
  const words = MISSING_ORDER.filter(f => names.has(f)).map(f => MISSING_WORDS[f]!);
  if (words.length) return `Add ${joinWords(words)}`;
  if (locationUndecided) return 'Confirm the location to continue';
  const invalid = issues.find(i => i.kind !== 'required' && i.field !== 'location');
  return invalid ? invalid.message : null;
}

export type MoreField = 'propertySubtype' | 'lotAreaSqm' | 'parkingSpaces' | 'floorNumber' | 'totalFloors' | 'maxOccupants';
/** The fields that are NOT range details: floors in building (stories for a house) and maximum occupants, under More details. */
export const moreDetailsFields = (_type: string | null): MoreField[] => ['totalFloors', 'maxOccupants'];
/**
 * The unit (or lot) group of the range card, in the order it shows: unit floor for an apartment or condominium, lot area for a house (never the other
 * way round), then parking, then the subtype chips where the type has any.
 */
export function unitFields(type: string | null): MoreField[] {
  return [type === 'house' ? 'lotAreaSqm' : 'floorNumber', 'parkingSpaces', ...(offeredSubtypeOptions(type).length ? ['propertySubtype' as const] : [])];
}
export const MORE_LABELS = (type: string | null): Record<MoreField, string> => ({
  propertySubtype: 'Subtype', lotAreaSqm: 'Lot area (sqm)', parkingSpaces: 'Parking spaces', floorNumber: 'Unit floor',
  totalFloors: type === 'house' ? 'Stories' : 'Floors in building', maxOccupants: 'Max occupants',
});
