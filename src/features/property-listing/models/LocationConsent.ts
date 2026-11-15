/**
 * Step 1 asks about the map point once, after a pin exists, with two equal buttons. Either button confirms the location; only the first one
 * shares the approximate area with the range. The decision belongs to the exact point and address it was made for, so a moved pin or an edited
 * address asks again. The share wish itself (ShareWish.ts) is unchanged.
 */
import type { DraftProperty } from './DraftProperty';

export const CONFIRM_SHARE_LABEL = 'Confirm and share approximate area';
export const CONFIRM_NO_SHARE_LABEL = "Confirm, don't share";
export const CONSENT_HINT = 'Sharing helps the range. Skipping is fine: the range then uses the city only.';
export const FIND_ON_MAP_LABEL = 'Find it on the map';

export type LocationDecision = { key: string; share: boolean } | null;
/**
 * What a decision is bound to: the confirmed point and the address it came from (and the address revision counter). Changing the property type or
 * rental floor does not undo "Confirm, don't share"; it does clear a share wish (ShareWish.ts), and a share decision stands only while its wish does.
 */
export const decisionKey = (d: Pick<DraftProperty, 'city' | 'barangay' | 'addressLine1' | 'addressLine2' | 'postalCode' | 'exactLatitude' | 'exactLongitude' | 'publicLatitude' | 'publicLongitude'>, revision: number): string =>
  JSON.stringify([d.city, d.barangay.trim(), d.addressLine1.trim(), d.addressLine2.trim(), d.postalCode.trim(), d.exactLatitude, d.exactLongitude, d.publicLatitude, d.publicLongitude, revision]);
export interface DecisionSnapshot { confirmed: boolean; key: string }
/** The decision still stands only for the point and address it was made for. */
export const decisionStands = (decision: LocationDecision, snap: DecisionSnapshot): boolean => !!decision && snap.confirmed && snap.key === decision.key;

export type NewPropertyLocationView =
  | { kind: 'hidden' }                                   // the address is not complete: nothing to ask yet, the footer says what is missing
  | { kind: 'findOnMap' }                                // address complete, no pin yet
  | { kind: 'ask' }                                      // a pin exists, no decision yet: map and the two buttons
  | { kind: 'confirmed'; shared: boolean };              // decided: one collapsed row with Change
export function newPropertyLocationView(i: { addressReady: boolean; pinned: boolean; decided: boolean; shared: boolean }): NewPropertyLocationView {
  if (!i.pinned) return i.addressReady ? { kind: 'findOnMap' } : { kind: 'hidden' };
  return i.decided ? { kind: 'confirmed', shared: i.shared } : { kind: 'ask' };
}
/** "Barangay Anabu I-A, Imus": what the collapsed row names, from the address the owner typed. */
export const confirmedPlace = (barangay: string, cityLabel: string): string => `Barangay ${barangay.trim()}, ${cityLabel}`;
export const confirmedStatus = (shared: boolean): string => (shared ? 'approximate area shared' : 'approximate area not shared');
