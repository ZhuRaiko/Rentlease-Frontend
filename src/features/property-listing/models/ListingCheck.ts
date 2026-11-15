/** The saved-listing check runs in the background. It never blocks typing; it only holds the actions that write. */
export type ListingCheckState = 'ok' | 'checking' | 'failed';
export const CHECKING_MESSAGE = 'Checking this listing\u2026';
export const CHECK_FAILED_MESSAGE = "Couldn't check this listing";
/** How long "Checking" may run before the line offers Retry as if it had failed. */
export const CHECK_STALL_MS = 8000;
export interface ListingCheckLineView { kind: 'checking' | 'failed'; text: string; retry: boolean }
/** The slim line above the fields: nothing when the check is fine; amber with Retry when it failed or has run too long. */
export function listingCheckLine(state: ListingCheckState, stalled: boolean): ListingCheckLineView | null {
  if (state === 'ok') return null;
  return state === 'failed' || stalled ? { kind: 'failed', text: CHECK_FAILED_MESSAGE, retry: true } : { kind: 'checking', text: CHECKING_MESSAGE, retry: false };
}
