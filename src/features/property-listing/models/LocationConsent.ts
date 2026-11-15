import type { DraftProperty } from './DraftProperty';
import { FALLBACK_NOTE } from './PinPrecision';

/**
 * Step 1 confirms the location with ONE button and a switch. Pressing Confirm location records whichever way the switch is set: on shares the
 * approximate area with the range, off confirms without sharing. A decision belongs to the exact point and address it was made for, so a moved pin or an
 * edited address asks again. The share wish itself (ShareWish.ts) and LocationShare.ts are unchanged.
 */
export const CONFIRM_LOCATION_LABEL = 'Confirm location';
export const SWITCH_TITLE = 'Use my approximate area for a sharper range';
export const SWITCH_SUBTITLE = 'Only the approximate map area is shared, never your exact address. Turn it off any time.';
export const SWITCH_WAITING = 'Available once the address is complete.';
export const SWITCH_SEARCHING = 'Finding this address on the map.';
export const MAP_PLACEHOLDER = 'The map appears here once the address is complete';
export const MAP_SEARCHING = 'Finding this address on the map…';
export const MAP_UNAVAILABLE = "We couldn't find this address on the map.";
export const MAP_PLACE_PIN_LABEL = 'Place the pin on the map';
export const MAP_CAPTION = 'approximate area only';
export const LOCATION_TAG = 'Also sharpens your range';
/** The map box has this height in every state, so nothing moves while the person types. */
export const MAP_BOX_HEIGHT = 150;
/** The saved-property card keeps its own single consent button. */
export const CONFIRM_SHARE_LABEL = 'Confirm and share approximate area';
export const CONSENT_HINT = 'Sharing helps the range. Skipping is fine: the range then uses the city only.';
export const FIND_ON_MAP_LABEL = 'Find it on the map';

export type LocationDecision = { key: string; share: boolean } | null;
/**
 * What a decision is bound to: the confirmed point and the address it came from (and the address revision counter). Changing the property type or
 * rental floor does not undo a "not shared" confirmation; it does clear a share wish (ShareWish.ts), and a share decision stands only while its wish does.
 */
export const decisionKey = (d: Pick<DraftProperty, 'city' | 'barangay' | 'addressLine1' | 'addressLine2' | 'postalCode' | 'exactLatitude' | 'exactLongitude' | 'publicLatitude' | 'publicLongitude'>, revision: number): string =>
  JSON.stringify([d.city, d.barangay.trim(), d.addressLine1.trim(), d.addressLine2.trim(), d.postalCode.trim(), d.exactLatitude, d.exactLongitude, d.publicLatitude, d.publicLongitude, revision]);
export interface DecisionSnapshot { confirmed: boolean; key: string }
/** The decision still stands only for the point and address it was made for. */
export const decisionStands = (decision: LocationDecision, snap: DecisionSnapshot): boolean => !!decision && snap.confirmed && snap.key === decision.key;

export type MapBox =
  | { kind: 'placeholder' }                              // the address is not complete
  | { kind: 'searching' }                                // complete, the match is being looked up
  | { kind: 'map'; source: 'draft' | 'preview' }         // a point to show (the approximate area only)
  | { kind: 'unavailable' };                             // nothing was found, or the lookup failed
export type LocationCardView =
  | { mode: 'confirmed'; shared: boolean }
  | { mode: 'form'; box: MapBox; switchEnabled: boolean; switchNote: string; confirmEnabled: boolean };
export interface LocationCardInput {
  addressReady: boolean; decided: boolean; shared: boolean;
  /** A pin is already in the draft (confirmed through the map tool). */
  pinInDraft: boolean; pinPrecise: boolean;
  preview: { status: 'idle' | 'searching' | 'ready' | 'none' | 'failed'; precise: boolean | null };
}
/**
 * What the card shows. The form and the map box are always the same size. The switch is only available for a pin derived from the address:
 * a fallback centre (a place the geocoder matched instead of the address) cannot be shared, and Confirm location then records "not shared".
 */
export function locationCardView(i: LocationCardInput): LocationCardView {
  if (i.decided) return { mode: 'confirmed', shared: i.shared };
  const box: MapBox = i.pinInDraft ? { kind: 'map', source: 'draft' }
    : !i.addressReady ? { kind: 'placeholder' }
    : i.preview.status === 'ready' ? { kind: 'map', source: 'preview' }
    : i.preview.status === 'none' || i.preview.status === 'failed' ? { kind: 'unavailable' }
    : { kind: 'searching' };
  const precise = box.kind === 'map' && (box.source === 'draft' ? i.pinPrecise : i.preview.precise === true);
  const switchNote = box.kind === 'placeholder' ? SWITCH_WAITING : box.kind === 'searching' ? SWITCH_SEARCHING : precise ? SWITCH_SUBTITLE : FALLBACK_NOTE;
  return { mode: 'form', box, switchEnabled: precise, switchNote, confirmEnabled: box.kind === 'map' };
}
/** "Anabu I-A, Imus": what the collapsed row names, from the address the owner typed. */
export const confirmedPlace = (barangay: string, cityLabel: string): string => `${barangay.trim()}, ${cityLabel}`;
export const confirmedStatus = (shared: boolean): string => (shared ? 'approximate area shared' : 'approximate area not shared');
