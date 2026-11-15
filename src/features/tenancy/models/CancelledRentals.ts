import type { RentalReservation } from '../../messaging-viewing/models/RentalReservation';
import type { RentalRelationship } from './TenancyWorkspace';

/** Cancelled rentals, from data the Tenancy tab already loads (tenancies, reservations and their links). No new queries. */
export const RENTAL_CANCELLED_LINE = 'This rental was cancelled';
export const REQUEST_AGAIN_LABEL = 'Request again';
export const OPEN_CONVERSATION_LABEL = 'Open conversation';

export interface CancelledRentalNotice {
  line: string;
  /** The tenant is sent back to the conversation, where the existing request flow lives; the owner can reopen it too. Null when there is no conversation to open. */
  actionLabel: string | null;
  conversationId: string | null;
}

export function cancelledRentalNotice(actor: string, tenantId: string, landlordId: string, conversationId: string | null | undefined): CancelledRentalNotice {
  const tenant = actor === tenantId && actor !== landlordId;
  const id = conversationId || null;
  return { line: RENTAL_CANCELLED_LINE, actionLabel: id ? (tenant ? REQUEST_AGAIN_LABEL : OPEN_CONVERSATION_LABEL) : null, conversationId: id };
}

export interface CancelledRental { tenancy: RentalRelationship; notice: CancelledRentalNotice }
/** Tenancies this person took part in that were cancelled. They appear in no other section. */
export function cancelledRentals(actor: string, tenancies: readonly RentalRelationship[]): CancelledRental[] {
  return tenancies
    .filter(t => t.status === 'cancelled' && (t.tenant_id === actor || t.landlord_id === actor))
    .map(t => ({ tenancy: t, notice: cancelledRentalNotice(actor, t.tenant_id, t.landlord_id, t.conversation_id) }));
}

/**
 * Approved reservations whose tenancy setup was cancelled. They still count as approved, but setup for them cannot be started again, so
 * instead of an "Establish tenancy" button they carry the cancelled notice. Keyed by reservation id.
 */
export function cancelledSetupNotices(
  actor: string,
  tenancies: readonly RentalRelationship[],
  reservations: readonly RentalReservation[],
  links: readonly { reservation_id: string; tenancy_id: string }[] | null,
): Record<string, CancelledRentalNotice> {
  const out: Record<string, CancelledRentalNotice> = {};
  if (!links) return out;
  for (const r of reservations) {
    if (r.tenantId !== actor && r.landlordId !== actor) continue;
    const cancelled = links.some(l => l.reservation_id === r.id && tenancies.some(t => t.id === l.tenancy_id && t.status === 'cancelled'));
    const live = links.some(l => l.reservation_id === r.id && tenancies.some(t => t.id === l.tenancy_id && t.status !== 'cancelled'));
    if (cancelled && !live) out[r.id] = cancelledRentalNotice(actor, r.tenantId, r.landlordId, r.conversationId);
  }
  return out;
}
