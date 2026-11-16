import {isOpen, isUrgent, type InboxCounts, type InboxRow} from './Maintenance';

type Counted = Pick<InboxRow, 'status' | 'priority' | 'tenantConfirmedAt'>;

/** Counts over the rows given. Used when the inbox is filtered to one property; the server counts cover all of the landlord's tenancies. */
export function countRows(rows: readonly Counted[]): InboxCounts {
  const confirmed = (r: Counted) => r.tenantConfirmedAt !== null;
  return {
    open: rows.filter(r => isOpen(r.status, confirmed(r))).length,
    inProgress: rows.filter(r => r.status === 'in_progress' || r.status === 'scheduled').length,
    awaitingConfirmation: rows.filter(r => r.status === 'resolved' && !confirmed(r)).length,
    resolved: rows.filter(r => r.status === 'resolved' && confirmed(r)).length,
    urgentOpen: rows.filter(r => isOpen(r.status, confirmed(r)) && isUrgent(r.priority)).length,
  };
}

/** Filter the inbox to one property; the server order (urgent open first, then newest) is kept. */
export const forProperty = <T extends {propertyId: string}>(rows: readonly T[], propertyId: string | null | undefined): T[] =>
  (propertyId ? rows.filter(r => r.propertyId === propertyId) : [...rows]);
