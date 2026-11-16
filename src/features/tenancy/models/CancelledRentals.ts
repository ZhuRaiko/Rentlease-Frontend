import {effectiveReservationStatus, type RentalReservation} from '../../messaging-viewing/models/RentalReservation';
import type {RentalRelationship} from './TenancyWorkspace';

/**
 * A cancelled setup shows once, under Past. Its approved reservation is still held (cancelling a setup never cancels the reservation), which is
 * what blocks "request again". Releasing it is the existing respond_rental_reservation(..., 'cancel'); these helpers only decide what to show.
 */
export type Role = 'tenant' | 'landlord';
export const START_NEW_REQUEST_LABEL = 'Start a new request';
export const RELEASE_IT_LABEL = 'Release it';
export const FIND_SIMILAR_LABEL = 'Find similar';
export const MESSAGE_LABEL = 'Message';
export const RELEASE_ERROR_LINE = 'Couldn’t release the reservation';
export const RELEASE_RETRY_LABEL = 'Retry';
export const KEEP_IT_LABEL = 'Keep it for now';

/** Tenancies this person took part in that were cancelled. */
export function cancelledRentals(actor: string, tenancies: readonly RentalRelationship[]): RentalRelationship[] {
  return tenancies.filter(t => t.status === 'cancelled' && (t.tenant_id === actor || t.landlord_id === actor));
}

export interface ReleaseTarget {
  /** The approved reservation behind the cancelled setup, when it is still held. Null when it is already cancelled, expired or unknown. */
  reservation: RentalReservation | null;
  conversationId: string | null;
  /** True when the reservation is still held, so a new request would be blocked until it is released. */
  needsRelease: boolean;
}
export function releaseTarget(
  tenancy: RentalRelationship,
  links: readonly {reservation_id: string; tenancy_id: string}[] | null,
  reservations: readonly RentalReservation[],
  now: number,
): ReleaseTarget {
  const link = links?.find(l => l.tenancy_id === tenancy.id);
  const found = link ? reservations.find(r => r.id === link.reservation_id) ?? null : null;
  const held = !!found && effectiveReservationStatus(found, now) === 'approved';
  return {reservation: held ? found : null, conversationId: tenancy.conversation_id || found?.conversationId || null, needsRelease: held};
}

/** The one line under a cancelled card. */
export function cancelledLine(role: Role, held: boolean, range: string): string {
  if (!held) return 'Setup was cancelled.';
  return role === 'tenant' ? 'Setup was cancelled. The reservation is still held, so a new request is blocked.' : `The reservation is still held for ${range}.`;
}

export interface ReleaseSheetView { title: string; body: string; note: string; confirmLabel: string; keepLabel: string }
/** Plain words for why a new request was blocked, and what releasing does. */
export function releaseSheetView(role: Role, input: {listing: string; range: string; other: string}): ReleaseSheetView {
  return role === 'tenant'
    ? {
        title: 'Release the old reservation?',
        body: `Your approved reservation for ${input.listing} (${input.range}) is still held, even though the setup was cancelled. To ask again, we release it first.`,
        note: `After this, a new request opens to ${input.other}. Nothing is deleted. Your chat history stays.`,
        confirmLabel: 'Release and request again', keepLabel: KEEP_IT_LABEL,
      }
    : {
        title: `Release the reservation held for ${input.other}?`,
        body: `The approved reservation for ${input.listing} (${input.range}) is still held, even though the setup was cancelled. Releasing it frees the unit.`,
        note: 'Nothing is deleted. Your chat history stays.',
        confirmLabel: 'Release it', keepLabel: KEEP_IT_LABEL,
      };
}
