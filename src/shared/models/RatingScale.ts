export type RatingScaleState = 'selected' | 'lower' | 'higher';
export const ratingLabels: Record<number, string> = { 1: 'Very poor', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Excellent' };

/** How one number looks next to the chosen one: the chosen is solid, lower numbers are tinted, higher numbers are outlined. */
export function ratingScaleState(n: number, selected: number | null): RatingScaleState {
  return selected === null ? 'higher' : n === selected ? 'selected' : n < selected ? 'lower' : 'higher';
}

/** The text under the scale, so the meaning never rests on color alone. */
export function ratingScaleLabel(selected: number | null): string {
  return selected === null || !ratingLabels[selected] ? 'Choose a rating from 1 to 5' : `${selected} · ${ratingLabels[selected]}`;
}
