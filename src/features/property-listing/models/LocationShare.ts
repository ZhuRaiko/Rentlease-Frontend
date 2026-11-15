import type {RentalLocationApproval} from '../../../shared/services/rentalLocationApprovalService';

/**
 * Step 1 asks once, with one explicit button, whether the approximate public map point may go to the price model. The button is the only
 * place that consent is recorded. Everything it can do is decided here, so the card only renders it.
 */
export const SHARE_BUTTON_LABEL = 'Confirm location and share it';
export const SHARE_SENTENCE = 'Sharing this approximate point (never your exact address) makes the range more accurate. You can withdraw it anytime.';
export const SHARE_SKIP_LINE = 'Skipping is fine. The range then uses the city only.';

/** What the explicit button does when pressed. */
export type ShareButtonAction =
  | 'openMapShare'   // new property, location not confirmed yet: open the map to confirm it, and mark that sharing is wanted
  | 'recordWish'     // new property, location confirmed: mark that sharing is wanted; it is recorded when the property is saved
  | 'saveConsent';   // saved property: record the consent now (set_rental_location_approval, approve = true)
export type ShareLinkAction = 'openMapOnly' | 'reviewMap' | 'clearWish' | 'withdraw' | 'reload';

export interface ShareCardInput {
  saved: boolean;
  /** The address is complete enough to open the map (city, barangay, street). */
  addressReady: boolean;
  /** A public map point has been confirmed for this new property. */
  confirmed: boolean;
  /** The owner pressed the button for a property that is not saved yet. */
  wanted: boolean;
  /** The saved property's current approval, once loaded. Null while loading or when the feature is unavailable. */
  approval: Pick<RentalLocationApproval, 'approved' | 'eligible'> | null;
  approvalLoading: boolean;
  approvalError: boolean;
  /** An approval request is running. */
  busy: boolean;
}
export interface ShareCardView {
  /** The one explicit button, or null when there is nothing to ask. */
  button: { action: ShareButtonAction; disabled: boolean } | null;
  /** Quiet text links (never styled as buttons). */
  links: ShareLinkAction[];
  /** The plain sentence and the skip line are shown while sharing is still a choice. */
  asking: boolean;
  status: string | null;
  mapPoint: 'draft' | 'approval' | null;
}

export function shareCardView(i: ShareCardInput): ShareCardView {
  if (!i.saved) {
    if (!i.confirmed) {
      return {
        button: { action: 'openMapShare', disabled: !i.addressReady || i.busy },
        links: i.wanted ? ['clearWish'] : ['openMapOnly'],
        asking: !i.wanted,
        status: i.wanted ? 'Sharing is on. Confirm the location on the map to continue.' : null,
        mapPoint: null,
      };
    }
    return i.wanted
      ? { button: null, links: ['clearWish', 'reviewMap'], asking: false, status: 'Sharing this approximate point with the model. It is recorded when you save the property.', mapPoint: 'draft' }
      : { button: { action: 'recordWish', disabled: i.busy }, links: ['reviewMap'], asking: true, status: null, mapPoint: 'draft' };
  }
  if (i.approvalError) return { button: null, links: ['reload'], asking: false, status: 'Sharing status could not load.', mapPoint: null };
  if (!i.approval) return { button: null, links: [], asking: false, status: i.approvalLoading ? 'Checking sharing status...' : null, mapPoint: null };
  if (i.approval.approved) return { button: null, links: ['withdraw'], asking: false, status: 'Shared with the model. You can stop sharing anytime.', mapPoint: 'approval' };
  if (i.approval.eligible) return { button: { action: 'saveConsent', disabled: i.busy }, links: [], asking: true, status: null, mapPoint: 'approval' };
  return { button: null, links: [], asking: false, status: 'A confirmed approximate location is not available yet, so the range uses the city only.', mapPoint: null };
}

/** Minimal service surface the pending-share step needs (the existing approval service, unchanged). */
export interface LocationShareService {
  load(actor: string, propertyId: string, signal: AbortSignal): Promise<RentalLocationApproval | null>;
  save(actor: string, propertyId: string, state: RentalLocationApproval, approve: boolean, signal: AbortSignal): Promise<RentalLocationApproval>;
}
export type PendingShareOutcome = 'shared' | 'already' | 'unavailable' | 'failed';
/**
 * Runs once, right after a new property is saved, when the owner pressed the explicit button before saving. It makes exactly the calls the
 * saved-property button makes: get_rental_location_approval, then set_rental_location_approval with approve = true and the policy and revision
 * the first call returned. It never throws: a failure leaves the saved property untouched and is reported.
 */
export async function applyPendingLocationShare(service: LocationShareService, actor: string, propertyId: string, signal: AbortSignal): Promise<PendingShareOutcome> {
  try {
    const state = await service.load(actor, propertyId, signal);
    if (!state || !state.eligible) return 'unavailable';
    if (state.approved) return 'already';
    await service.save(actor, propertyId, state, true, signal);
    return 'shared';
  } catch { return 'failed'; }
}
export const pendingShareNotice = (outcome: PendingShareOutcome): string | null =>
  outcome === 'shared' ? 'Property saved. Sharing recorded.' : outcome === 'already' ? null
  : outcome === 'unavailable' ? 'Property saved. Sharing is not available yet, so the range uses the city only. You can share it from the Property step later.'
  : 'Property saved. Sharing could not be recorded. You can share it from the Property step.';
