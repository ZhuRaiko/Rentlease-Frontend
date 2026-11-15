import type { Database, Enums } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid } from './DraftProperty';
import { propertyRules, type ListingDraft } from './PropertyListing';
// Read snapshots may predate the prepared version-column migration. Writes still require a real token.
export type SavedListingDraft = Omit<Database['public']['Tables']['listings']['Row'], 'edit_version'> & { edit_version?: string };
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
  return listingFieldValidation(form);
}
function listingFieldValidation(form:ListingDraftFields):string|null {
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
export function listingFieldIssue(form:ListingDraftFields) {
  const message=listingFieldValidation(form);if(!message)return null;
  const field=message.includes('title')?'title':message.includes('description')?'description':message.includes('rent greater')?'askingRent':message.includes('rental term')?'rentalTerm':message.includes('Security deposit')?'securityDepositMonths':message.includes('Advance rent')?'advanceRentMonths':message.includes('Minimum stay')?'minimumStayMonths':'availableDate';
  return {field,message};
}
/** Listing-step validation: every listing rule except the monthly rent, which the Price step checks with listingFieldIssue itself. */
export const listingDetailsIssue=(form:ListingDraftFields)=>listingFieldIssue({...form,askingRent:'1'});
export function listingDraftPayload(propertyId: string, form: ListingDraftFields): SaveListingDraftArgs {
  const error = listingDraftValidation(propertyId, form); if (error) throw new ListingDraftError(error);
  return { p_property_id: propertyId, p_title: form.title.trim(), p_description: form.description.trim(), p_asking_rent_monthly: listingNumber(form.askingRent), p_rental_term: form.rentalTerm, p_security_deposit_months: listingNumber(form.securityDepositMonths), p_advance_rent_months: listingNumber(form.advanceRentMonths), ...(form.minimumStayMonths ? { p_minimum_stay_months: listingNumber(form.minimumStayMonths) } : {}), ...(form.availableDate ? { p_available_from: form.availableDate } : {}), ...(form.houseRules.trim() ? { p_house_rules: form.houseRules.trim() } : {}) };
}
export function applySavedListing(draft: ListingDraft, row: SavedListingDraft): ListingDraft {
  return { ...draft, title: row.title, description: row.description, askingRent: String(row.asking_rent_monthly), houseRules: row.house_rules ?? '', rules: (row.house_rules ?? '').split('\n').filter((value): value is typeof propertyRules[number] => propertyRules.includes(value as typeof propertyRules[number])), rentalTerm: row.rental_term, securityDepositMonths: String(row.security_deposit_months), advanceRentMonths: String(row.advance_rent_months), minimumStayMonths: row.minimum_stay_months === null ? '' : String(row.minimum_stay_months), availableDate: row.available_from ?? '' };
}
export class ListingDraftError extends Error {
  constructor(message: string, public readonly kind: 'rejected' | 'uncertain' | 'identity' | 'conflict' = 'rejected', options?: ErrorOptions) { super(message, options); }
}
export const listingDraftMessage = (error: unknown) => error instanceof ListingDraftError ? error.message : 'Could not save or load the listing draft. Check your connection and try again.';

export interface DraftEditTarget { listingId:string; editVersion:string }

// Same normalization as listing payloads; blank optional values remain distinct from zero.
export function listingFieldsEqual(a:ListingDraftFields,b:ListingDraftFields):boolean {
 const numeric=(v:string)=>Number.isFinite(listingNumber(v))?listingNumber(v):['invalid',v];
 const normalized=(d:ListingDraftFields)=>[d.title.trim(),d.description.trim(),numeric(d.askingRent),d.houseRules.trim()||null,d.rentalTerm,numeric(d.securityDepositMonths),numeric(d.advanceRentMonths),d.minimumStayMonths===''?null:numeric(d.minimumStayMonths),d.availableDate||null];
 return JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
}
