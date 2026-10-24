import type { Database, Enums } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid } from './DraftProperty';
import { propertyRules, type ListingDraft } from './PropertyListing';
export type SavedListingDraft = Database['public']['Tables']['listings']['Row'];
export type SaveListingDraftArgs = Database['public']['Functions']['save_listing_draft']['Args'];
export type ListingDraftFields = Pick<ListingDraft, 'title' | 'description' | 'askingRent' | 'houseRules' | 'rentalTerm' | 'securityDepositMonths' | 'advanceRentMonths' | 'minimumStayMonths' | 'availableDate'>;
export const rentalTermOptions: { value: Enums<'rental_term_type'>; label: string }[] = [{ value: 'short_term', label: 'Short term' }, { value: 'long_term', label: 'Long term' }, { value: 'either', label: 'Either' }];
export function listingNumber(value: string): number {
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim()) ? Number(value.replace(/,/g, '')) : NaN;
}
export function hasListingMinimum(propertyId: string | null, form: ListingDraftFields) {
  return isPropertyUuid(propertyId) && !!form.title.trim() && !!form.description.trim() && Number.isFinite(listingNumber(form.askingRent)) && listingNumber(form.askingRent) > 0;
}
export function listingDraftValidation(propertyId: string | null, form: ListingDraftFields): string | null {
  if (!isPropertyUuid(propertyId)) return 'Save a physical property before saving a listing to your account.';
  if (!form.title.trim()) return 'Enter a listing title.';
  if (!form.description.trim()) return 'Enter a listing description.';
  if (!Number.isFinite(listingNumber(form.askingRent)) || listingNumber(form.askingRent) <= 0) return 'Enter monthly asking rent greater than zero.';
  if (!rentalTermOptions.some(o => o.value === form.rentalTerm)) return 'Choose a supported rental term.';
  for (const [label, value] of [['Security deposit', form.securityDepositMonths], ['Advance rent', form.advanceRentMonths]]) {
    if (!Number.isFinite(listingNumber(value!)) || listingNumber(value!) < 0) return `${label} months must be zero or greater.`;
  }
  if (form.minimumStayMonths !== '') { const n = listingNumber(form.minimumStayMonths); if (!Number.isInteger(n) || n <= 0 || n > 32767) return 'Minimum stay must be a whole number of months from 1 to 32767.'; }
  if (form.availableDate) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(form.availableDate) ? new Date(`${form.availableDate}T00:00:00Z`) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== form.availableDate) return 'Use a valid availability date in YYYY-MM-DD format, or leave it blank.';
  }
  return null;
}
export function listingDraftPayload(propertyId: string, form: ListingDraftFields): SaveListingDraftArgs {
  const error = listingDraftValidation(propertyId, form); if (error) throw new ListingDraftError(error);
  return { p_property_id: propertyId, p_title: form.title.trim(), p_description: form.description.trim(), p_asking_rent_monthly: listingNumber(form.askingRent), p_rental_term: form.rentalTerm, p_security_deposit_months: listingNumber(form.securityDepositMonths), p_advance_rent_months: listingNumber(form.advanceRentMonths), ...(form.minimumStayMonths ? { p_minimum_stay_months: listingNumber(form.minimumStayMonths) } : {}), ...(form.availableDate ? { p_available_from: form.availableDate } : {}), ...(form.houseRules.trim() ? { p_house_rules: form.houseRules.trim() } : {}) };
}
export function applySavedListing(draft: ListingDraft, row: SavedListingDraft): ListingDraft {
  return { ...draft, title: row.title, description: row.description, askingRent: String(row.asking_rent_monthly), houseRules: row.house_rules ?? '', rules: (row.house_rules ?? '').split('\n').filter((value): value is typeof propertyRules[number] => propertyRules.includes(value as typeof propertyRules[number])), rentalTerm: row.rental_term, securityDepositMonths: String(row.security_deposit_months), advanceRentMonths: String(row.advance_rent_months), minimumStayMonths: row.minimum_stay_months === null ? '' : String(row.minimum_stay_months), availableDate: row.available_from ?? '' };
}
export class ListingDraftError extends Error {
  constructor(message: string, public readonly kind: 'rejected' | 'uncertain' | 'identity' = 'rejected') { super(message); }
}
export const listingDraftMessage = (error: unknown) => error instanceof ListingDraftError ? error.message : 'Could not save or load the listing draft. Check your connection and try again.';
