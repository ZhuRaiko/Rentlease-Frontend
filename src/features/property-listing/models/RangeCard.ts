import type { PropertyValidationField } from './DraftProperty';
import { estimateDetailCount, missingEstimateDetails, type EstimateInputs } from './PostingEstimate';
import { offeredSubtypeOptions } from './PropertyModelAttributes';

/** The eight details the typical-rent range reads, in the order the card shows them. The count and the names come from PostingEstimate: nothing is recounted here. */
export type RangeDetail = 'floorArea' | 'bedrooms' | 'bathrooms' | 'unit' | 'parking' | 'subtype' | 'furnishing' | 'amenities';
export const RANGE_ORDER: readonly RangeDetail[] = ['floorArea', 'bedrooms', 'bathrooms', 'unit', 'parking', 'subtype', 'furnishing', 'amenities'];
const FROM_NAME: Record<string, RangeDetail> = {
  'floor area': 'floorArea', bedrooms: 'bedrooms', bathrooms: 'bathrooms', 'floor number or lot area': 'unit',
  'parking spaces': 'parking', subtype: 'subtype', furnishing: 'furnishing', amenities: 'amenities',
};
export const isHouse = (type: string | null | undefined) => type === 'house';
export const RANGE_TITLE = 'Details that set your range';
export const RANGE_SUBTITLE = 'Every field here moves the typical-rent range';
export const allFilledText = (total: number) => `✓ All ${total} filled. Your range is as sharp as it gets.`;
export const MORE_DETAILS_SUMMARY = "Optional · doesn't change your range";
export const MORE_DETAILS_HELPER = 'Nothing here changes your range.';

export const rangeDetailLabel = (detail: RangeDetail, type: string | null | undefined): string => ({
  floorArea: 'Floor area', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', unit: isHouse(type) ? 'Lot area' : 'Unit floor',
  parking: 'Parking', subtype: 'Subtype', furnishing: 'Furnishing', amenities: 'Amenities',
})[detail];
/** The field a chip takes the person to (its own scroll target, and the input when it has one). */
export const rangeDetailField = (detail: RangeDetail, type: string | null | undefined): PropertyValidationField => ({
  floorArea: 'floorAreaSqm', bedrooms: 'bedrooms', bathrooms: 'bathrooms', unit: isHouse(type) ? 'lotAreaSqm' : 'floorNumber',
  parking: 'parkingSpaces', subtype: 'propertySubtype', furnishing: 'furnishingStatus', amenities: 'amenityIds',
} as Record<RangeDetail, PropertyValidationField>)[detail];

export interface RangeCardView {
  filled: number; total: number; allFilled: boolean;
  pips: { key: RangeDetail; filled: boolean }[];
  /** Only details still missing, in card order. A subtype is only offered for a type that has any, so it only gets a chip there. */
  missing: { key: RangeDetail; label: string; field: PropertyValidationField }[];
  /** "The unit" for an apartment or condominium, "The lot" for a house. */
  unitGroupLabel: string;
}
export function rangeCardView(inputs: EstimateInputs): RangeCardView {
  const { filled, total } = estimateDetailCount(inputs), names = new Set(missingEstimateDetails(inputs).map(name => FROM_NAME[name]).filter((k): k is RangeDetail => !!k));
  const type = inputs.propertyType;
  return {
    filled, total, allFilled: filled === total,
    // The meter fills left to right by the count, so the pips and the "N of 8" pill always agree.
    pips: RANGE_ORDER.map((key, index) => ({ key, filled: index < filled })),
    missing: RANGE_ORDER.filter(key => names.has(key) && (key !== 'subtype' || offeredSubtypeOptions(type).length > 0))
      .map(key => ({ key, label: rangeDetailLabel(key, type), field: rangeDetailField(key, type) })),
    unitGroupLabel: isHouse(type) ? 'The lot' : 'The unit',
  };
}
