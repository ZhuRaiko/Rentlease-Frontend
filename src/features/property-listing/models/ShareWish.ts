import type {DraftProperty} from './DraftProperty';

/**
 * A new property is not saved yet when the owner presses "Confirm location and share it", so the press is kept as a wish and applied right
 * after the first save. A wish belongs to the exact point and identity that were on screen when the owner pressed. If any of them changes
 * before the save, the wish is cleared, never carried over to a different point.
 */
export type ShareWish = { phase: 'awaiting' } | { phase: 'bound'; key: string } | null;
export const LOCATION_CHANGED_NOTICE = 'Location changed. Confirm sharing again.';

export type BindingDraft = Pick<DraftProperty, 'propertyType' | 'city' | 'barangay' | 'addressLine1' | 'addressLine2' | 'postalCode' | 'floorNumber' | 'exactLatitude' | 'exactLongitude' | 'publicLatitude' | 'publicLongitude'>;
/**
 * The binding is compared by VALUE: the confirmed public point and the exact pin it came from, every identity input the server's approval
 * revision depends on (type, city, barangay, street, building, postal code, rental floor), and the address revision counter. The counter means
 * that re-entering an address and confirming a pin at the same coordinates is still a change.
 */
export const shareBindingKey = (d: BindingDraft, locationRevision: number): string => JSON.stringify([
  d.propertyType, d.city, d.barangay.trim(), d.addressLine1.trim(), d.addressLine2.trim(), d.postalCode.trim(), d.floorNumber.trim(),
  d.exactLatitude, d.exactLongitude, d.publicLatitude, d.publicLongitude, locationRevision,
]);

export interface WishSnapshot {
  /** The owner is on Step 1 of a property that is not saved yet. Anywhere else, there is nothing to wish for. */
  inStep1: boolean;
  /** A public map point is confirmed. */
  confirmed: boolean;
  key: string;
}
/** The owner pressed the explicit button. With a confirmed point on screen the wish binds to it now; otherwise it waits for the map. */
export const wishAfterPress = (snap: WishSnapshot): ShareWish => (snap.inStep1 && snap.confirmed ? { phase: 'bound', key: snap.key } : { phase: 'awaiting' });

/** Run whenever the owner's screen, the point or the identity inputs change. Returns the same object when nothing needs to change. */
export function reconcileWish(wish: ShareWish, snap: WishSnapshot): { wish: ShareWish; notice: string | null } {
  if (!wish) return { wish, notice: null };
  if (!snap.inStep1) return { wish: null, notice: null };                       // left the wizard, or the property was saved
  if (wish.phase === 'awaiting') return snap.confirmed ? { wish: { phase: 'bound', key: snap.key }, notice: null } : { wish, notice: null };
  return snap.confirmed && snap.key === wish.key ? { wish, notice: null } : { wish: null, notice: LOCATION_CHANGED_NOTICE };
}
/** True only for a wish bound to exactly the point and identity that are about to be saved. */
export const wishApplies = (wish: ShareWish, snap: WishSnapshot): boolean => wish?.phase === 'bound' && snap.confirmed && snap.key === wish.key;
