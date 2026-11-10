import { isPropertyUuid } from './DraftProperty';
import {listingFieldsEqual,type ListingDraftFields,type SavedListingDraft} from './PersistedListingDraft';
export type PublicationListing = SavedListingDraft;
export class PublicationError extends Error {
  constructor(message: string, public readonly kind: 'rejected' | 'uncertain' | 'identity' | 'read' = 'rejected') { super(message); }
}
export function confirmedListingFields(row: PublicationListing): ListingDraftFields {
  return { title: row.title, description: row.description, askingRent: String(row.asking_rent_monthly), houseRules: row.house_rules ?? '', rentalTerm: row.rental_term, securityDepositMonths: String(row.security_deposit_months), advanceRentMonths: String(row.advance_rent_months), minimumStayMonths: row.minimum_stay_months === null ? '' : String(row.minimum_stay_months), availableDate: row.available_from ?? '' };
}
export function listingFieldsUnchanged(form: ListingDraftFields, row: PublicationListing): boolean {
  return listingFieldsEqual(form,confirmedListingFields(row));
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
  if (message === 'Authentication required') return new PublicationError('Sign in again before publishing.');
  if (message === 'Tier 1 verified active account required') return new PublicationError('Publication requires an active Tier 1-verified account.');
  if (message === 'Landlord role required') return new PublicationError('The Landlord role is required to publish a listing.');
  if (message === 'Owned listing required') return new PublicationError('You can publish only your own listing. Reopen My Rentals.');
  if (message === 'Owned active property required') return new PublicationError('Publication requires an active property that you own.');
  if (message === 'Only a draft listing can be published') return new PublicationError('Only a draft listing can be published. Check current status.');
  if (/Approved Tier 3 verification for this property/i.test(message)) return new PublicationError('This property must have approved Tier 3 ownership verification before it can be published.');
  if (/80%+ completeness/i.test(message)) return new PublicationError('This listing does not yet meet the publication requirements. Publication requires at least 80% completeness. Add missing property or listing details, save the draft, then try again.');
  if (/already has a live listing/i.test(message)) return new PublicationError('This property already has a live listing. Another listing cannot be published for it.');
  if (error.code === '42501') return new PublicationError('Publication is unavailable. Check listing access and try again.');
  return new PublicationError('The listing could not be published. Check its current status and try again.');
}
export const publicationMessage = (error: unknown) => error instanceof PublicationError ? error.message : 'Publication could not be confirmed. Check the listing status before trying again.';

// Presentation guidance only: the RPC remains authoritative for all eligibility checks.
export function publicationReviewSummary(propertyId:string|null,row:PublicationListing|null,form:ListingDraftFields,uncertainSave:boolean) {
  const visible=!!row && row.property_id===propertyId && row.status==='draft';
  const blocker=publicationEligibility(propertyId,row,form,uncertainSave);
  const belowThreshold=!!row && (!Number.isFinite(row.completeness_score) || row.completeness_score<0.80);
  return {
    visible,
    state:row?.status==='active'?'Active':!blocker && !belowThreshold?'Ready for publication review':'Draft',
    message:blocker ?? (belowThreshold?'The saved draft is below 80% completeness. Add details and save again before publishing.':'Review the saved draft. Property-specific Tier 3 approval and all other publication requirements are checked when you publish.'),
  };
}
