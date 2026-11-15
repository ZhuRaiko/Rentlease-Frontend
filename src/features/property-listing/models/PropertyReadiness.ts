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

/** The optional fields "More details" offers for a type. Lot area is for a house only; unit floor never for a house. */
export type MoreField = 'propertySubtype' | 'lotAreaSqm' | 'parkingSpaces' | 'floorNumber' | 'totalFloors' | 'maxOccupants';
export function moreDetailsFields(type: string | null): MoreField[] {
  const house = type === 'house';
  return [
    ...(offeredSubtypeOptions(type).length ? ['propertySubtype' as const] : []),
    ...(house ? ['lotAreaSqm' as const] : []),
    'parkingSpaces',
    ...(house ? [] : ['floorNumber' as const]),
    'totalFloors',
    'maxOccupants',
  ];
}
/** The fields the price model reads (a dot on the label). Floors in building, stories and maximum occupants are not model inputs. */
export const MORE_FIELD_FEEDS_RANGE: Record<MoreField, boolean> = { propertySubtype: true, lotAreaSqm: true, parkingSpaces: true, floorNumber: true, totalFloors: false, maxOccupants: false };
export const MORE_LABELS = (type: string | null): Record<MoreField, string> => ({
  propertySubtype: 'Subtype', lotAreaSqm: 'Lot area (sqm)', parkingSpaces: 'Parking spaces', floorNumber: 'Unit floor',
  totalFloors: type === 'house' ? 'Stories' : 'Floors in building', maxOccupants: 'Max occupants',
});
/** "Optional · none added" until something is entered, then "Optional · 2 added". Only fields the type offers are counted. */
export function moreDetailsSummary(type: string | null, d: Partial<Record<MoreField, string | undefined>>): string {
  const n = moreDetailsFields(type).filter(f => (d[f] ?? '').trim() !== '').length;
  return `Optional · ${n ? `${n} added` : 'none added'}`;
}
