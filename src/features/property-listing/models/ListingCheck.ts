/** The saved-listing check runs in the background. It never blocks typing; it only holds the actions that write. */
export type ListingCheckState = 'ok' | 'checking' | 'failed';
export const CHECKING_MESSAGE = 'Checking this listing\u2026';
export const CHECK_FAILED_MESSAGE = "Couldn't check this listing";
/** The saved draft could not be read after an automatic try: one amber line with Retry, never a stack of messages. */
export const DRAFT_LOAD_FAILED_MESSAGE = "Couldn't load your draft";
/** How long "Checking" may run before the line offers Retry as if it had failed. */
export const CHECK_STALL_MS = 8000;
export interface ListingCheckLineView { kind: 'checking' | 'failed'; text: string; retry: boolean }
/** The slim line above the fields: nothing when the check is fine; amber with Retry when it failed or has run too long. */
export function listingCheckLine(state: ListingCheckState, stalled: boolean, failedMessage: string = CHECK_FAILED_MESSAGE): ListingCheckLineView | null {
  if (state === 'ok') return null;
  return state === 'failed' || stalled ? { kind: 'failed', text: failedMessage, retry: true } : { kind: 'checking', text: CHECKING_MESSAGE, retry: false };
}

/** The slim "Property saved" line on the Listing step: shown for the plain saved status, not for a warning from a failed save. */
export const savedLineText = (notice: string | null): string | null =>
  notice === 'Property saved' ? 'Property saved ✓' : notice && /^Property saved\. Sharing /.test(notice) ? notice : null;

/** While the check has not succeeded, only the actions that write wait. The button says so, and one hint line says typing is fine. */
export const WAITING_SUFFIX = ' · waiting for check';
export const TYPING_HINT = 'You can keep typing. Only saving waits.';
export const RETRY_HINT = 'Retry the check above to continue. You can keep typing.';
export const DRAFT_RETRY_HINT = 'Retry loading your draft above to continue. You can keep typing.';
export function waitingView(reason: string | null, label: string): { label: string; hint: string | null } {
  if (!reason) return { label, hint: null };
  if (reason === CHECKING_MESSAGE) return { label: label + WAITING_SUFFIX, hint: TYPING_HINT };
  if (reason === CHECK_FAILED_MESSAGE) return { label: label + WAITING_SUFFIX, hint: RETRY_HINT };
  if (reason === DRAFT_LOAD_FAILED_MESSAGE) return { label: label + WAITING_SUFFIX, hint: DRAFT_RETRY_HINT };
  return { label, hint: `${reason} ${TYPING_HINT}` };   // an unresolved status or access problem keeps its own reason
}
