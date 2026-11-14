import { formatPeso } from '../../../shared/models/Currency';
import { rangeRelationText, type RentalRange } from '../../../shared/models/RentalRange';

/** An estimate is kept with the property details it was made for and is only current while those are unchanged. */
export const currentEstimate = <T,>(held: { result: T; basis: string } | null, basis: string): T | null => (held && held.basis === basis ? held.result : null);

const rentNumber = (askingRent: string) => { const t = askingRent.replace(/,/g, '').trim(); return t === '' ? NaN : Number(t); };
/** "₱12,000" or "Not entered". */
export const askingRentLabel = (askingRent: string) => { const n = rentNumber(askingRent); return Number.isFinite(n) ? formatPeso(n) : 'Not entered'; };
/** Review's Price line: "₱13,000 per month · Within the typical range". Without a range it is just the rent. No estimate figure. */
export function reviewPriceDetail(askingRent: string, range: RentalRange | null | undefined): string {
  const rent = rentNumber(askingRent);
  if (!Number.isFinite(rent)) return 'Not entered';
  const relation = rangeRelationText(rent, range);
  return `${formatPeso(rent)} per month${relation ? ` · ${relation}` : ''}`;
}
