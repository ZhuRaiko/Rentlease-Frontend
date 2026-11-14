import { formatEstimatePeso, formatPeso, roundEstimate } from '../../../shared/models/Currency';

/** An estimate is kept with the property details it was made for and is only current while those are unchanged. */
export const currentEstimate = <T,>(held: { result: T; basis: string } | null, basis: string): T | null => (held && held.basis === basis ? held.result : null);

/** True when the asking rent is the estimate, to the same whole peso the estimate is shown in. */
export const matchesEstimate = (rent: number, estimate: number) => Math.round(rent) === roundEstimate(estimate);

const rentNumber = (askingRent: string) => { const t = askingRent.replace(/,/g, '').trim(); return t === '' ? NaN : Number(t); };
/** "\u20b112,000" or "Not entered". */
export const askingRentLabel = (askingRent: string) => { const n = rentNumber(askingRent); return Number.isFinite(n) ? formatPeso(n) : 'Not entered'; };
/** Review's Price line: "\u20b112,227 \u00b7 Matches the estimate", "\u20b111,000 \u00b7 Estimate \u20b112,227", or just the rent without a usable estimate. */
export function reviewPriceDetail(askingRent: string, estimate: number | null | undefined): string {
  const head = askingRentLabel(askingRent), rent = rentNumber(askingRent);
  if (!Number.isFinite(rent) || typeof estimate !== 'number' || !Number.isFinite(estimate) || estimate <= 0) return head;
  return `${head} \u00b7 ${matchesEstimate(rent, estimate) ? 'Matches the estimate' : `Estimate ${formatEstimatePeso(estimate)}`}`;
}
