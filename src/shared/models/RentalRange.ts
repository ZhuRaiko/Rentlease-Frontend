/**
 * Range-only pricing. The model's single point value never reaches a screen; people see the typical range for similar places.
 * The band, its rounding and the slider step each live in one named constant.
 */
/** The upstream range is the model's point plus and minus this share. The parse layer re-checks that band, then drops the point. */
export const RANGE_HALF_WIDTH = 0.3;
/** Range ends round outward to this many pesos, so the shown range always contains the model's band. */
export const RANGE_ROUNDING = 500;
/** The slider moves in steps of this many pesos. */
export const SLIDER_STEP = 500;
export const RANGE_DISCLAIMER = 'Illustrative range from a model, not an appraisal.';

export interface RentalRange { minimum: number; maximum: number }

export function roundRangeOutward(minimum: number, maximum: number): RentalRange {
  return { minimum: Math.floor(minimum / RANGE_ROUNDING) * RANGE_ROUNDING, maximum: Math.ceil(maximum / RANGE_ROUNDING) * RANGE_ROUNDING };
}

export type RangeRelation = 'within' | 'above' | 'below';
const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
/** Compares a rent only with the ends of the range as shown. Null without a usable rent. */
export function rangeRelation(rent: number | null | undefined, range: RentalRange | null | undefined): RangeRelation | null {
  if (!usable(rent) || !range) return null;
  return rent < range.minimum ? 'below' : rent > range.maximum ? 'above' : 'within';
}
export const RELATION_TEXT: Record<RangeRelation, string> = { within: 'Within the typical range', above: 'Above the typical range', below: 'Below the typical range' };
export const RELATION_HELP: Record<RangeRelation, string | null> = { within: null, above: 'You can ask for more. Listings above the range may take longer to rent.', below: 'You can ask for less. Your price stays your choice.' };
export const rangeRelationText = (rent: number | null | undefined, range: RentalRange | null | undefined) => { const r = rangeRelation(rent, range); return r ? RELATION_TEXT[r] : null; };
/** "This listing is within the typical range", for the tenant view. */
export const listingRelationSentence = (rent: number | null | undefined, range: RentalRange | null | undefined) => {
  const r = rangeRelation(rent, range); return r ? `This listing is ${RELATION_TEXT[r].toLowerCase()}` : null;
};

// ---- Slider math (pure, so the gesture code stays thin)
/** The ball shows the owner's trial value; with none, it follows the rent already typed, and with neither it stays hidden. */
export const ballValue = (picked: number | null, rent: number | null | undefined): number | null => picked ?? (usable(rent) ? rent : null);
/** Typing a different rent hands the ball back to the field: a trial value only lasts while it is the one being tried. */
export const pickedAfterRentChange = (picked: number | null, rent: number | null | undefined): number | null => (picked !== null && rent !== picked ? null : picked);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Where a value sits on the track, 0 to 1, clamped. A value outside the range sits at the nearer end. */
export const fractionOfValue = (value: number, range: RentalRange) => range.maximum === range.minimum ? 0 : clamp((value - range.minimum) / (range.maximum - range.minimum), 0, 1);
/** Snaps to the step, measured from the low end, and keeps the result inside the range. */
export const snapToStep = (value: number, range: RentalRange, step: number = SLIDER_STEP) =>
  clamp(range.minimum + Math.round((clamp(value, range.minimum, range.maximum) - range.minimum) / step) * step, range.minimum, range.maximum);
/** The rent under a touch: fraction of the track (clamped), snapped to the step. */
export const valueAtFraction = (fraction: number, range: RentalRange, step: number = SLIDER_STEP) =>
  snapToStep(range.minimum + clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1) * (range.maximum - range.minimum), range, step);
/**
 * One step up or down. From an unset slider the first step goes to a range end, never to the middle, so the start cannot hint at the
 * model's value: up lands on the low end, down on the high end.
 */
export function stepSliderValue(current: number | null, direction: 1 | -1, range: RentalRange, step: number = SLIDER_STEP): number {
  if (current === null || !Number.isFinite(current)) return direction === 1 ? range.minimum : range.maximum;
  return snapToStep(snapToStep(current, range, step) + direction * step, range, step);
}
