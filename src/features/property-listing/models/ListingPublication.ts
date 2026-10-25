import { isPropertyUuid } from './DraftProperty';
import type { ListingDraftFields, SavedListingDraft } from './PersistedListingDraft';
export type PublicationListing = SavedListingDraft;
export class PublicationError extends Error {
  constructor(message: string, public readonly kind: 'rejected' | 'uncertain' | 'identity' = 'rejected') { super(message); }
}
const fields: (keyof ListingDraftFields)[] = ['title', 'description', 'askingRent', 'houseRules', 'rentalTerm', 'securityDepositMonths', 'advanceRentMonths', 'minimumStayMonths', 'availableDate'];
export function confirmedListingFields(row: PublicationListing): ListingDraftFields {
  return { title: row.title, description: row.description, askingRent: String(row.asking_rent_monthly), houseRules: row.house_rules ?? '', rentalTerm: row.rental_term, securityDepositMonths: String(row.security_deposit_months), advanceRentMonths: String(row.advance_rent_months), minimumStayMonths: row.minimum_stay_months === null ? '' : String(row.minimum_stay_months), availableDate: row.available_from ?? '' };
}
export function listingFieldsUnchanged(form: ListingDraftFields, row: PublicationListing): boolean {
  const expected = confirmedListingFields(row); return fields.every(field => form[field] === expected[field]);
}
export function publicationEligibility(propertyId: string | null, row: PublicationListing | null, form: ListingDraftFields, uncertainSave: boolean): string | null {
  if (!isPropertyUuid(propertyId) || !row || !isPropertyUuid(row.id) || row.property_id !== propertyId) return 'Save a listing draft for your saved property before publishing.';
  if (row.status !== 'draft') return 'Only a confirmed backend draft can be published.';
  if (uncertainSave) return 'Check the uncertain draft save before publishing.';
  if (!listingFieldsUnchanged(form, row)) return 'Save your listing changes before publishing.';
  return null;
}
export function isPublishedListing(row: PublicationListing): boolean {
  return row.status === 'active' && isPropertyUuid(row.id) && Number.isFinite(row.completeness_score) && row.completeness_score >= 0.80 && typeof row.published_at === 'string' && Number.isFinite(Date.parse(row.published_at));
}
export const publicationStatusLabel = (status: PublicationListing['status'] | null) => status === 'active' ? 'Published' : status === 'draft' ? 'Draft' : status ?? 'Not confirmed';
export function publicationBackendError(error: { code?: string; message?: string }): PublicationError {
  const message = error.message ?? '';
  if (/Approved Tier 3 verification for this property/i.test(message)) return new PublicationError('This property must have approved Tier 3 ownership verification before it can be published.');
  if (/80%+ completeness/i.test(message)) return new PublicationError('This listing does not yet meet the publication requirements. Review the property and listing details, then try again.');
  if (/already has a live listing/i.test(message)) return new PublicationError('This property already has a live listing. Another listing cannot be published for it.');
  if (error.code === '42501') return new PublicationError('Publication is unavailable. Check your account eligibility and ownership of this active property.');
  return new PublicationError('The listing could not be published. Check its current status and try again.');
}
export const publicationMessage = (error: unknown) => error instanceof PublicationError ? error.message : 'Publication could not be confirmed. Check the listing status before trying again.';
