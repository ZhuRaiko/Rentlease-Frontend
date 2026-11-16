import type {Chip} from '../../../shared/models/StatusChip';
import {daysBetween, manilaToday} from '../../../shared/utils/rentalDates';
import type {RentalRelationship} from './TenancyWorkspace';

/** Status as a chip, never grey text. Tone colors live in shared/theme/statusColors. */
export const CHIP = {
  active: {label: 'Active', tone: 'positive'},
  upcoming: {label: 'Upcoming', tone: 'info'},
  needsOk: {label: 'Needs your OK', tone: 'warning'},
  ended: {label: 'Ended', tone: 'neutral'},
  cancelled: {label: 'Cancelled', tone: 'restricted'},
} as const satisfies Record<string, Chip>;

/** The three summary tiles: Upcoming, Active, Past. Their colors are in components/tileColors. */
export type TileKind = 'upcoming' | 'active' | 'past';
export const TILE_LABELS: Record<TileKind, string> = {upcoming: 'Upcoming', active: 'Active', past: 'Past'};

/** A pending setup the person must still confirm (the tenant has not confirmed, the owner has). */
export function tenantNeedsOk(t: Pick<RentalRelationship, 'status' | 'tenant_id' | 'tenant_confirmed_at' | 'landlord_confirmed_at'>, actor: string): boolean {
  return actor === t.tenant_id && ['proposed', 'pending_confirmation'].includes(t.status) && !!t.landlord_confirmed_at && !t.tenant_confirmed_at;
}
export function tenancyChip(t: Pick<RentalRelationship, 'status' | 'tenant_id' | 'tenant_confirmed_at' | 'landlord_confirmed_at'>, actor: string): Chip {
  switch (t.status) {
    case 'active': return CHIP.active;
    case 'ended': return CHIP.ended;
    case 'cancelled': return CHIP.cancelled;
    default: return tenantNeedsOk(t, actor) ? CHIP.needsOk : CHIP.upcoming;
  }
}

// ---- Dates: the Manila calendar helpers and short formats live in shared/utils/rentalDates
/** "Day 5 of 365", with the filled fraction of the bar. Null without a recorded end date. */
export function stayProgress(start: string, end: string | null | undefined, now: number): {day: number; total: number; fraction: number} | null {
  if (!end) return null;
  const total = daysBetween(start, end) + 1, day = Math.min(total, Math.max(1, daysBetween(start, manilaToday(now)) + 1));
  return total > 0 ? {day, total, fraction: day / total} : null;
}
/** "1 open" for the maintenance card. */
export const openCountLabel = (n: number): string => `${n} open`;
