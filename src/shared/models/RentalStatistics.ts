import {RANGE_HALF_WIDTH} from './RentalRange';

/**
 * The "Statistical analysis" sheet for the price estimate (docs/design/price-statistics). Pure: the fixed accuracy figures, how they are written, which group a
 * property belongs to, where the asking price sits in the exact band, and what each tab says. The rounded range on the estimate cards is untouched; the exact
 * estimate and the exact band appear ONLY in this sheet and are never computed here, only passed through from the model service.
 */
export const STATS_SOURCE = 'held-out test of 991 listings, RentLease thesis, Chapter 5';
export type StatsGroup = 'apartment_condominium' | 'house';

/** Fixed values from the thesis held-out test. One model file, one source. */
export interface AccuracyFigures {
  group: StatsGroup;
  /** How the group is named in a sentence. */
  label: string;
  /** Test listings in this group. */
  n: number;
  /** Share of test listings within 30% of the real asking rent, in percent. */
  within30: number;
  /** Average error in pesos. */
  mae: number;
  /** Average percent error, in percent. */
  mape: number;
  r2: number;
  /** Share within 30% for a simple median of the group, in percent. */
  simpleMedianWithin30: number;
}
export const ACCURACY: Record<StatsGroup, AccuracyFigures> = {
  apartment_condominium: { group: 'apartment_condominium', label: 'apartments and condominiums', n: 501, within30: 78.44, mae: 7017.80, mape: 21.12, r2: 0.6253, simpleMedianWithin30: 48.50 },
  house: { group: 'house', label: 'houses', n: 490, within30: 76.73, mae: 10382.78, mape: 22.68, r2: 0.3743, simpleMedianWithin30: 67.14 },
};

/** The group from the listing's property type: house, or apartment / condominium. Anything else has no group (and so no Statistics entry). */
export function statsGroupFor(propertyType: unknown): StatsGroup | null {
  if (typeof propertyType !== 'string') return null;
  const t = propertyType.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (t === 'house') return 'house';
  return t === 'apartment' || t === 'condominium' || t === 'apartment_condominium' ? 'apartment_condominium' : null;
}
const TYPE_LABEL: Record<string, string> = { house: 'House', apartment: 'Apartment', condominium: 'Condominium', apartment_condominium: 'Condominium' };
const CITY_LABEL: Record<string, string> = { imus: 'Imus', dasmarinas: 'Dasmariñas', tagaytay: 'Tagaytay' };
export const typeLabelFor = (propertyType: unknown): string | null => (typeof propertyType === 'string' ? TYPE_LABEL[propertyType.trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? null : null);
export const cityLabelFor = (city: unknown): string | null => (typeof city === 'string' ? CITY_LABEL[city.trim().toLowerCase()] ?? null : null);

// ---- number formatting
const grouped = (n: number, digits: number) => n.toLocaleString('en-PH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** "78.4%" */
export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;
/** "₱7,018": money to the whole peso. */
export const formatWholePeso = (value: number): string => `₱${grouped(Math.round(value), 0)}`;
/** "₱35,512.40": the exact estimate and band, with centavos. */
export const formatExactPeso = (value: number): string => `₱${grouped(value, 2)}`;
/** "0.63" */
export const formatR2 = (value: number): string => value.toFixed(2);

// ---- the exact estimate and band, as the model service returned them
export interface ExactEstimate { estimate: number; minimum: number; maximum: number }
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** Only a complete, ordered set of exact values is usable. Never invented or recomputed from the rounded range. */
export function usableExact(exact: ExactEstimate | null | undefined): ExactEstimate | null {
  if (!exact || !finite(exact.estimate) || !finite(exact.minimum) || !finite(exact.maximum)) return null;
  return exact.minimum > 0 && exact.minimum < exact.maximum && exact.minimum <= exact.estimate && exact.estimate <= exact.maximum ? exact : null;
}

export interface BandPosition {
  /** 0 to 1 along the band. Outside the band the dot sits at the nearer edge. */
  fraction: number;
  side: 'inside' | 'below' | 'above';
}
/** Where the asking price sits within the EXACT band. Null without a usable asking price or band. */
export function bandPosition(asking: number | null | undefined, exact: ExactEstimate | null | undefined): BandPosition | null {
  const band = usableExact(exact);
  if (!band || !finite(asking) || asking <= 0) return null;
  if (asking < band.minimum) return { fraction: 0, side: 'below' };
  if (asking > band.maximum) return { fraction: 1, side: 'above' };
  return { fraction: (asking - band.minimum) / (band.maximum - band.minimum), side: 'inside' };
}
/** Where the estimate itself sits on the band (the middle, for the model's symmetrical band). */
export const estimateFraction = (exact: ExactEstimate): number => (exact.estimate - exact.minimum) / (exact.maximum - exact.minimum);

export interface AskingMarker { fraction: number; label: string; side: BandPosition['side']; align: 'start' | 'center' | 'end' }
/** The asking-price dot and its label. Outside the band the label says so and the dot is clamped to the edge. */
export function askingMarker(asking: number | null | undefined, exact: ExactEstimate | null | undefined): AskingMarker | null {
  const position = bandPosition(asking, exact);
  if (!position || !finite(asking)) return null;
  const base = `Asking ${formatWholePeso(asking)}`;
  const label = position.side === 'inside' ? base : `${base} · ${position.side} the band`;
  return { fraction: position.fraction, label, side: position.side, align: position.fraction < 0.25 ? 'start' : position.fraction > 0.75 ? 'end' : 'center' };
}

// ---- what each tab says
export const SHEET_COPY = {
  title: 'Statistical analysis', subtitle: 'How well the model estimated rent on listings it had never seen', close: 'Close', tabs: { works: 'How it works', stats: 'Statistics' },
  entryButton: 'Statistical analysis', entryChip: 'Statistics',
  exactTitle: 'This estimate, exact', bandTitle: `The ±${Math.round(RANGE_HALF_WIDTH * 100)}% accuracy band`,
  bandNote: 'The first screen shows this band rounded to the nearest ₱500. Here it is exact.',
  bandLow: `${Math.round((1 - RANGE_HALF_WIDTH) * 100)}% of estimate`, bandMid: 'estimate', bandHigh: `${Math.round((1 + RANGE_HALF_WIDTH) * 100)}% of estimate`,
  accuracyTitle: 'How accurate it has been', mae: 'Average error (MAE)', mape: 'Average % error (MAPE)', r2: 'How much of the price spread it explains (R²)',
  compareTitle: 'Compared with a simple average', compareSub: 'Share of test listings within 30%', compareMedian: 'Group median', compareModel: 'XGBoost model',
  houseNote: 'Estimates for houses are less accurate than for condominiums.',
  keepTitle: 'What to keep in mind',
  keep: ['Based on advertised rents, not signed leases.', 'Trained on rents from ₱3,000 to ₱75,000.', 'Houses, apartments and condominiums in Imus, Dasmariñas and Tagaytay only.', 'The range is illustrative, not a statistical guarantee.'],
  source: `Source: ${STATS_SOURCE}.`,
  steps: [
    { title: 'Reads the saved details', text: 'The model uses the property details you saved, such as type, location and floor area.' },
    { title: 'Compares with similar listings', text: 'It looks at what similar places in the same area were advertised for.' },
    { title: 'Returns a typical range', text: 'You see a range of typical rents for places like this one, rounded to the nearest ₱500.' },
  ],
  worksNote: 'It is a guide, not an appraisal. The Statistics tab shows how accurate it has been.',
} as const;

export interface StatisticsInput {
  /** The listing's property type (house, apartment or condominium). */
  propertyType: unknown;
  /** The model's exact estimate and band, when the app has them. */
  exact?: ExactEstimate | null | undefined;
  /** The listing's asking rent, for the dot on the band. */
  asking?: number | null | undefined;
  /** The raw city value (imus, dasmarinas, tagaytay), for the one line under "This estimate, exact". */
  city?: unknown;
}
export interface StatisticsView {
  group: AccuracyFigures;
  exact: { intro: string; estimate: string; suffix: string } | null;
  band: { low: string; mid: string; high: string; estimateFraction: number; marker: AskingMarker | null; label: string } | null;
  accuracy: { percent: string; sentence: string; tiles: { value: string; label: string }[]; note: string | null };
  compare: { medianPercent: string; modelPercent: string; medianFraction: number; modelFraction: number };
}
/** Everything the Statistics tab shows. Null when the property has no group (so there is nothing to show and no entry to open it). */
export function statisticsView(input: StatisticsInput): StatisticsView | null {
  const key = statsGroupFor(input.propertyType);
  if (!key) return null;
  const group = ACCURACY[key], exact = usableExact(input.exact), type = typeLabelFor(input.propertyType), city = cityLabelFor(input.city);
  const marker = askingMarker(input.asking, exact);
  return {
    group,
    exact: exact ? { intro: `${[type, city].filter(Boolean).join(' in ')}${type || city ? '. ' : ''}The model’s exact estimate is `, estimate: formatExactPeso(exact.estimate), suffix: ' a month.' } : null,
    band: exact ? { low: formatExactPeso(exact.minimum), mid: formatExactPeso(exact.estimate), high: formatExactPeso(exact.maximum), estimateFraction: estimateFraction(exact), marker,
      label: `Exact band from ${formatExactPeso(exact.minimum)} to ${formatExactPeso(exact.maximum)} around an estimate of ${formatExactPeso(exact.estimate)}${marker ? `. ${marker.label}` : ''}.` } : null,
    accuracy: { percent: formatPercent(group.within30), sentence: `of ${group.n} test listings were within 30% of the real asking rent (${group.label})`,
      tiles: [{ value: formatWholePeso(group.mae), label: SHEET_COPY.mae }, { value: formatPercent(group.mape), label: SHEET_COPY.mape }, { value: formatR2(group.r2), label: SHEET_COPY.r2 }],
      note: group.group === 'house' ? SHEET_COPY.houseNote : null },
    compare: { medianPercent: formatPercent(group.simpleMedianWithin30), modelPercent: formatPercent(group.within30), medianFraction: group.simpleMedianWithin30 / 100, modelFraction: group.within30 / 100 },
  };
}
