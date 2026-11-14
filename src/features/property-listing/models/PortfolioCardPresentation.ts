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

export type PortfolioActionKey = 'open' | 'editProperty' | 'editRental' | 'verification' | 'reviewPublication' | 'createListing';
export interface PortfolioAction { key: PortfolioActionKey; label: string }

/**
 * One primary action, at most one secondary beside it, the rest for the overflow menu. Labels and eligibility rules are the
 * ones the card already used; only their grouping changed. Manage Requests is composed by the root, not here.
 */
export function portfolioCardActions(item: LandlordPortfolioItem): { primary: PortfolioAction; secondary: PortfolioAction | null; menu: PortfolioAction[] } {
  const listing = item.currentListing, status = listing?.status, active = item.property.is_active;
  // An ended (archived) listing cannot be reactivated, so the owner starts a new one for the same property. Only an active property can take it.
  const relist = !!listing && status === 'archived' && active;
  const primary: PortfolioAction = relist ? { key: 'createListing', label: 'Create a new listing' } : { key: 'open', label: !listing ? 'Create listing' : status === 'draft' ? 'Continue Editing' : status === 'active' || status === 'paused' ? 'Manage Status' : status === 'removed' ? 'View status' : 'View listing' };
  const verificationLabel = item.tier3.requiresRepair ? null : propertyVerificationActionLabel(item.tier3.status);
  const verification: PortfolioAction | null = verificationLabel ? { key: 'verification', label: verificationLabel } : null;
  const editProperty: PortfolioAction | null = active && (!listing || !['draft', 'active', 'paused'].includes(status!)) ? { key: 'editProperty', label: 'Edit Property' } : null;
  const editRental: PortfolioAction | null = listing && active && ['active', 'paused'].includes(status!) ? { key: 'editRental', label: 'Edit Rental' } : null;
  const review: PortfolioAction | null = canReviewPortfolioPublication(item) ? { key: 'reviewPublication', label: 'Review Publication' } : null;
  const order = !listing || status === 'draft' ? [review, verification, editProperty, editRental]
    : status === 'active' || status === 'paused' ? [editRental, verification, editProperty, review]
    : [editProperty, verification, editRental, review];
  const available = order.filter((action): action is PortfolioAction => action !== null);
  return { primary, secondary: available[0] ?? null, menu: [...(relist ? [{ key: 'open', label: 'View listing' } as PortfolioAction] : []), ...available.slice(1)] };
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

/** Which actions render as a button, which as the verification row, which in the overflow menu. */
export const SECONDARY_BUTTON_MAX_LABEL = 18;
export function portfolioCardLayout(item: LandlordPortfolioItem): { primary: PortfolioAction; secondary: PortfolioAction | null; menu: PortfolioAction[] } {
  const { primary, secondary, menu } = portfolioCardActions(item);
  const rest = [secondary, ...menu].filter((a): a is PortfolioAction => a !== null && a.key !== 'verification');
  const short = rest[0] && rest[0].label.length <= SECONDARY_BUTTON_MAX_LABEL ? rest[0] : null;
  return { primary, secondary: short, menu: short ? rest.slice(1) : rest };
}

/** Today's date in Philippine time (UTC+8) as YYYY-MM-DD, the same rule the rest of the app uses. */
export function philippineToday(now = Date.now()): string { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }

/** "Available from <date>" only while the listing's available_from is strictly after today (Philippine time). Past, today and no date show nothing. */
export function portfolioAvailability(item: LandlordPortfolioItem, now = Date.now()): string | null {
  const date = item.currentListing?.available_from;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= philippineToday(now)) return null;
  return `Available from ${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`))}`;
}

export const ARCHIVED_LISTING_NOTE = 'This listing has ended. Create a new one to rent this place again.';
/** The one-line explanation on an archived card, only where "Create a new listing" is actually offered. */
export const portfolioArchivedNote = (item: LandlordPortfolioItem): string | null => portfolioCardActions(item).primary.key === 'createListing' ? ARCHIVED_LISTING_NOTE : null;

/**
 * Where "Create a new listing" opens: the SAME property, no listing id (so nothing tries to update the archived row), compose mode, at the
 * Listing step with the Property step behind it. Null unless the current listing is archived on an active property.
 */
export function newListingTarget(item: LandlordPortfolioItem | null | undefined) {
  if (!item || item.currentListing?.status !== 'archived' || !item.property.is_active) return null;
  return { item: { ...item, currentListing: null }, listingId: null as string | null, mode: 'compose' as const, screen: 'listingDetails' as const, history: ['dashboard', 'listingComposer'] as string[] };
}
