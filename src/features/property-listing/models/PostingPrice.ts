import { formatPeso } from '../../../shared/models/Currency';
import { rangeRelationText, type RentalRange } from '../../../shared/models/RentalRange';

/** An estimate is kept with the property details it was made for and is only current while those are unchanged. */
export const currentEstimate = <T,>(held: { result: T; basis: string } | null, basis: string): T | null => (held && held.basis === basis ? held.result : null);

export const rentNumber = (askingRent: string) => { const t = askingRent.replace(/,/g, '').trim(); return t === '' ? NaN : Number(t); };
/** "₱12,000" or "Not entered". */
export const askingRentLabel = (askingRent: string) => { const n = rentNumber(askingRent); return Number.isFinite(n) ? formatPeso(n) : 'Not entered'; };
/** Review's Price line: "₱13,000 per month · Within the typical range". Without a range it is just the rent. No estimate figure. */
export function reviewPriceDetail(askingRent: string, range: RentalRange | null | undefined): string {
  const rent = rentNumber(askingRent);
  if (!Number.isFinite(rent)) return 'Not entered';
  const relation = rangeRelationText(rent, range);
  return `${formatPeso(rent)} per month${relation ? ` · ${relation}` : ''}`;
}

// ---- "Use rent" feedback: when the applied state shows and when it clears
/** How long the "Applied" chip and the primary border stay. */
export const APPLIED_FLASH_MS = 2000;
/** The asking-rent field as a number; null when empty or not a number. */
export const fieldRent = (askingRent: string): number | null => { const n = rentNumber(askingRent); return Number.isFinite(n) ? n : null; };
/** The flash shows only while its timer runs AND the field still holds exactly the rent that was applied, so any edit ends it at once. */
export const appliedFlashVisible = (applied: number | null, flashOn: boolean, askingRent: string) => flashOn && applied !== null && fieldRent(askingRent) === applied;
/** An applied rent is forgotten the moment the field holds something else. */
export const appliedAfterFieldChange = (applied: number | null, askingRent: string): number | null => (applied !== null && fieldRent(askingRent) !== applied ? null : applied);
export const appliedAnnouncement = (rent: number) => `Asking rent set to ${formatPeso(rent)}`;
/**
 * Where to scroll so the asking-rent card is fully visible. Null when it already is (or when it is taller than the view and its top is
 * showing), so nothing jumps. Otherwise its top goes just under the top edge. Coordinates: window space for the card and the view,
 * content space for `contentY`.
 */
export function rentCardScrollTarget(m: { cardTop: number; cardHeight: number; viewTop: number; viewHeight: number; contentY: number; margin: number }): number | null {
  const bottom = m.cardTop + m.cardHeight, viewBottom = m.viewTop + m.viewHeight;
  const visible = m.cardHeight <= m.viewHeight ? m.cardTop >= m.viewTop && bottom <= viewBottom : m.cardTop >= m.viewTop && m.cardTop < viewBottom;
  return visible ? null : Math.max(0, m.contentY - m.margin);
}
