import {colors} from '../../../shared/theme/colors';
import type {RentalRelationship} from './TenancyWorkspace';

/** Status as a chip, never grey text. Tones map onto existing theme tokens only (see CHIP_COLORS). */
export type ChipTone = 'positive' | 'warning' | 'restricted' | 'info' | 'neutral' | 'urgent';
export interface Chip { label: string; tone: ChipTone }
export const CHIP = {
  active: {label: 'Active', tone: 'positive'},
  upcoming: {label: 'Upcoming', tone: 'info'},
  needsOk: {label: 'Needs your OK', tone: 'warning'},
  ended: {label: 'Ended', tone: 'neutral'},
  cancelled: {label: 'Cancelled', tone: 'restricted'},
} as const satisfies Record<string, Chip>;
export const CHIP_COLORS: Record<ChipTone, {backgroundColor: string; color: string; borderColor: string}> = {
  positive: {backgroundColor: colors.primaryPale, color: colors.primaryAction, borderColor: colors.primaryAction},
  warning: {backgroundColor: colors.warningSurface, color: colors.warning, borderColor: colors.warning},
  restricted: {backgroundColor: colors.restrictedSurface, color: colors.restricted, borderColor: colors.restricted},
  info: {backgroundColor: colors.identitySurface, color: colors.identityInk, borderColor: colors.identityInk},
  neutral: {backgroundColor: colors.surface, color: colors.textSecondary, borderColor: colors.border},
  urgent: {backgroundColor: colors.restricted, color: colors.white, borderColor: colors.restricted},
};

/** The three summary tiles: Upcoming blue (identity tokens), Active filled with the action green, Past neutral. */
export type TileKind = 'upcoming' | 'active' | 'past';
export const TILE_LABELS: Record<TileKind, string> = {upcoming: 'Upcoming', active: 'Active', past: 'Past'};
export const TILE_COLORS: Record<TileKind, {backgroundColor: string; color: string; labelColor: string}> = {
  upcoming: {backgroundColor: colors.identitySurface, color: colors.identityInk, labelColor: colors.identityInk},
  active: {backgroundColor: colors.primaryAction, color: colors.white, labelColor: colors.white},
  past: {backgroundColor: colors.surface, color: colors.textSecondary, labelColor: colors.textSecondary},
};

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

// ---- Dates (Manila calendar days, the same convention as the rent schedule)
const DAY = 86400000;
export const manilaToday = (now: number): string => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 25" */
export const shortDate = (date: string): string => { const [, m, d] = date.split('-').map(Number); return `${MONTHS[(m ?? 1) - 1]} ${d}`; };
/** "Nov 14 – Dec 14" (the year is added only when the two dates are in different years). */
export function dateRange(start: string, end: string | null | undefined): string {
  if (!end) return `From ${shortDate(start)}`;
  return start.slice(0, 4) === end.slice(0, 4) ? `${shortDate(start)} – ${shortDate(end)}` : `${shortDate(start)}, ${start.slice(0, 4)} – ${shortDate(end)}, ${end.slice(0, 4)}`;
}
export function inDays(date: string, now: number): string {
  const n = daysBetween(manilaToday(now), date);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 ? `in ${n} days` : `${-n} days ago`;
}
/** "Dec 2 · in 16 days" */
export const dueLabel = (date: string, now: number): string => `${shortDate(date)} · ${inDays(date, now)}`;
export const pesos = (amount: number | null | undefined): string => amount === null || amount === undefined ? '—' : `₱${amount.toLocaleString('en-PH', {maximumFractionDigits: 2})}`;
/** "Day 5 of 365", with the filled fraction of the bar. Null without a recorded end date. */
export function stayProgress(start: string, end: string | null | undefined, now: number): {day: number; total: number; fraction: number} | null {
  if (!end) return null;
  const total = daysBetween(start, end) + 1, day = Math.min(total, Math.max(1, daysBetween(start, manilaToday(now)) + 1));
  return total > 0 ? {day, total, fraction: day / total} : null;
}
/** "1 open" for the maintenance card. */
export const openCountLabel = (n: number): string => `${n} open`;
/** "2h ago" / "3d ago" from an ISO timestamp. */
export function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  return minutes < 60 ? `${Math.max(1, minutes)}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
