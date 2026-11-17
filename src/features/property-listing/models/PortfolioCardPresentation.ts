import { estimateNeedsFloorArea } from './PostingEstimate';
import type { LandlordPortfolioItem } from './LandlordPortfolio';
import { portfolioListingLabels, portfolioTierLabels } from './LandlordPortfolio';
import { canReviewPortfolioPublication, propertyVerificationActionLabel } from './PropertyVerificationPresentation';

/** Presentation decisions for one My Rentals card. Derived only from existing backend-derived fields; nothing is inferred. */
export type PortfolioChipTone = 'neutral' | 'positive' | 'attention';
export interface PortfolioChip { label: string; tone: PortfolioChipTone }

export function portfolioStatusChip(item: LandlordPortfolioItem): PortfolioChip {
  const status = item.currentListing?.status;
  return { label: status ? portfolioListingLabels[status] : 'Not Listed', tone: status === 'active' ? 'positive' : 'neutral' };
}

export function portfolioVerificationChip(item: LandlordPortfolioItem): PortfolioChip {
  const { tier3 } = item;
  if (tier3.requiresRepair) return { label: 'Identity data repair required', tone: 'attention' };
  switch (tier3.status) {
    case 'approved': return tier3.identityBindingAvailable === false ? { label: 'Approval history (identity check pending)', tone: 'attention' } : { label: 'Property verified', tone: 'positive' };
    case 'not_submitted': return { label: 'Ownership not verified', tone: 'attention' };
    case 'pending': case 'under_review': return { label: portfolioTierLabels[tier3.status], tone: 'neutral' };
    default: return { label: portfolioTierLabels[tier3.status], tone: 'attention' };
  }
}

export type PortfolioActionKey = 'continuePosting' | 'continueEditing' | 'editListing' | 'createListing' | 'open' | 'editPropertyDetails' | 'manageStatus' | 'verification' | 'reviewPublication';
export interface PortfolioAction { key: PortfolioActionKey; label: string }

/**
 * One button per card, named for the state; everything else is in the overflow menu. Every state that can be edited opens the same four-step
 * wizard (the button decides where it starts); there is no separate property-only editor.
 *   no listing -> Continue posting (resumes at the first incomplete step)    draft -> Continue editing
 *   active or paused -> Edit listing                                           archived -> List again
 * Menu: Edit property details (the wizard at Step 1), Manage status (pause, reactivate, archive), verification, review publication.
 * Manage Requests is composed by the root, not here.
 */
export function portfolioCardActions(item: LandlordPortfolioItem): { primary: PortfolioAction; secondary: null; menu: PortfolioAction[] } {
  const listing = item.currentListing, status = listing?.status, active = item.property.is_active;
  // An ended (archived) listing cannot be reactivated, so the owner starts a new one for the same property. Only an active property can take it.
  const relist = !!listing && status === 'archived' && active;
  const live = status === 'active' || status === 'paused';
  const primary: PortfolioAction = relist ? { key: 'createListing', label: 'List again' }
    : !listing ? { key: 'continuePosting', label: 'Create listing' }
    : status === 'draft' ? { key: 'continueEditing', label: 'Continue editing' }
    : status === 'rented' || live || status === 'removed' ? { key: 'open', label: 'Manage' }
    : { key: 'open', label: 'View listing' };
  const verificationLabel = item.tier3.requiresRepair ? null : propertyVerificationActionLabel(item.tier3.status);
  const verification: PortfolioAction | null = verificationLabel ? { key: 'verification', label: verificationLabel } : null;
  const editDetails: PortfolioAction | null = editPropertyDetailsPlan(item) ? { key: 'editPropertyDetails', label: 'Edit property details' } : null;
  const edit: PortfolioAction | null = live && active ? { key: 'editListing', label: 'Edit listing' } : null;
  const review: PortfolioAction | null = canReviewPortfolioPublication(item) ? { key: 'reviewPublication', label: 'Review Publication' } : null;
  const menu = [...(relist ? [{ key: 'open', label: 'View listing' } as PortfolioAction] : []), edit, editDetails, verification, review].filter((a): a is PortfolioAction => a !== null);
  return { primary, secondary: null, menu };
}

/** How "Edit property details" opens the wizard at Step 1, or null when the property cannot be edited from its card (inactive, or the listing was removed). */
export type EditDetailsPlan = 'compose' | 'published' | 'fresh';
export function editPropertyDetailsPlan(item: LandlordPortfolioItem | null | undefined): EditDetailsPlan | null {
  if (!item || !item.property.is_active) return null;
  const status = item.currentListing?.status;
  return !item.currentListing || status === 'draft' ? 'compose' : status === 'active' || status === 'paused' ? 'published' : status === 'archived' ? 'fresh' : null;
}

/** Request activity for one card, supplied by the root so this feature never imports messaging code. */
export interface PortfolioRequestActivity { text: string | null; pending: boolean; error: string | null; onManage: () => void }

/** Pill on the cover photo. Labels are the chip labels; tones add the wireframe colors (paused amber, rented blue, removed red). */
export type PortfolioPillTone = 'neutral' | 'positive' | 'attention' | 'info' | 'danger';
export function portfolioStatusPill(item: LandlordPortfolioItem): { label: string; tone: PortfolioPillTone } {
  const status = item.currentListing?.status, { label } = portfolioStatusChip(item);
  return { label, tone: status === 'active' ? 'positive' : status === 'paused' ? 'attention' : status === 'rented' ? 'info' : status === 'removed' ? 'danger' : 'neutral' };
}

/** Verification row: the status chip plus, when the owner can act, the existing action label (never a second button). */
export function portfolioVerificationRow(item: LandlordPortfolioItem): PortfolioChip & { actionLabel: string | null } {
  return { ...portfolioVerificationChip(item), actionLabel: item.tier3.requiresRepair ? null : propertyVerificationActionLabel(item.tier3.status) };
}

/** The card shows its one button; every other action, including verification, is in the overflow menu. */
export function portfolioCardLayout(item: LandlordPortfolioItem): { primary: PortfolioAction; secondary: null; menu: PortfolioAction[] } {
  const { primary, menu } = portfolioCardActions(item);
  return { primary, secondary: null, menu };
}

/** Today's date in Philippine time (UTC+8) as YYYY-MM-DD, the same rule the rest of the app uses. */
export function philippineToday(now = Date.now()): string { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }

/** "Available from <date>" only while the listing's available_from is strictly after today (Philippine time). Past, today and no date show nothing. */
export function portfolioAvailability(item: LandlordPortfolioItem, now = Date.now()): string | null {
  const date = item.currentListing?.available_from;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= philippineToday(now)) return null;
  return `Available from ${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`))}`;
}

export const ARCHIVED_LISTING_NOTE = 'This listing has ended. Its reviews and rating stay with this property.';
/** The one-line explanation on an archived card, only where "List again" is actually offered. */
export const portfolioArchivedNote = (item: LandlordPortfolioItem): string | null => portfolioCardActions(item).primary.key === 'createListing' ? ARCHIVED_LISTING_NOTE : null;

/** The first wizard step that still needs the owner: the Property step while a size the range needs is missing, otherwise the Listing step. */
export function firstIncompleteStep(item: LandlordPortfolioItem): 'property' | 'listing' {
  const p = item.property;
  const needsArea = estimateNeedsFloorArea({ propertyType: p.property_type, city: p.city, furnishingStatus: p.furnishing_status, propertySubtype: '' });
  return needsArea && !(typeof p.floor_area_sqm === 'number' && p.floor_area_sqm > 0) ? 'property' : 'listing';
}
export type NewListingStart = 'details' | 'property' | 'resume';
/**
 * Where a listing started from a card opens: the SAME property, no listing id (so nothing tries to update an archived row), compose mode.
 * 'details' = the Listing step with the Property step behind it (List again), 'property' = Step 1, 'resume' = the first incomplete
 * step (Continue posting). Null unless the property is active and has no listing or an archived one.
 */
export function newListingTarget(item: LandlordPortfolioItem | null | undefined, start: NewListingStart = 'details') {
  if (!item || !item.property.is_active || (item.currentListing && item.currentListing.status !== 'archived')) return null;
  const at = start === 'resume' ? (firstIncompleteStep(item) === 'property' ? 'property' : 'details') : start;
  return { item: { ...item, currentListing: null }, listingId: null as string | null, mode: 'compose' as const, screen: at === 'property' ? 'listingComposer' as const : 'listingDetails' as const, history: (at === 'property' ? ['dashboard'] : ['dashboard', 'listingComposer']) as string[] };
}
