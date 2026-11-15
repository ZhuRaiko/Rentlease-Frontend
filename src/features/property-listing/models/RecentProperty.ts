import { propertyCityOptions, propertyTypeOptions } from './DraftProperty';

/** What the recovery card shows for a property the landlord already owns: plain words, newest first, never a raw id. */
export interface RecentPropertyRow { id: string; property_type: string; city: string; barangay: string; created_at: string }

/** "anabu i-a" becomes "Anabu I-A". Letters after a space or hyphen are capitalized; nothing else is lowercased. */
export const titleCase = (value: string): string => value.trim().replace(/(^|[\s-])([a-z])/g, (_all, lead: string, letter: string) => lead + letter.toUpperCase());

const time = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : -Infinity; };
/** Newest first by creation time, then by id so the order never flips. A row without a valid date goes last. */
export const newestFirst = <T extends { created_at: string; id: string }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => time(b.created_at) - time(a.created_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

export function createdOn(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}
/** "Apartment in Anabu I-A, Imus (created Nov 15, 2026)". */
export function recentPropertyLabel(row: RecentPropertyRow): string {
  const type = propertyTypeOptions.find(o => o.value === row.property_type)?.label ?? titleCase(row.property_type.replace(/_/g, ' '));
  const city = propertyCityOptions.find(o => o.value === row.city)?.label ?? titleCase(row.city.replace(/_/g, ' '));
  const barangay = titleCase(row.barangay);
  const place = [barangay, city].filter(Boolean).join(', ');
  const date = createdOn(row.created_at);
  return `${type}${place ? ` in ${place}` : ''}${date ? ` (created ${date})` : ''}`;
}

export interface RecoveryView { recent: readonly unknown[]; uncertainSince: number | null; recentChecked: boolean; /** a young marker and nothing found yet */ confirming?: boolean }
/**
 * The one message above the recovery choices. It says what happened and what the person can do, without codes or blame.
 * `uncertainSince` is the time on the marker (null when an older version left it, so the properties cannot be narrowed to this save).
 */
export function recoveryMessage(v: RecoveryView): string {
  if (v.confirming && !v.recent.length) return 'Still confirming your last save. This can take a minute or two. Check again in a moment.';
  if (v.recent.length) return v.uncertainSince === null
    ? 'These are your most recent properties. If one of them is the one you were saving, select it. Otherwise start fresh.'
    : 'These properties were created around your last save. Select the one you were saving, or start fresh.';
  if (v.recentChecked) return 'No recent property was found. If you are sure your last save did not go through, start fresh.';
  return v.uncertainSince === null
    ? 'We could not confirm an earlier save, so a property may already exist. Check your recent properties before starting fresh.'
    : 'We could not confirm your last save, so a property may already exist. Check your recent properties before saving again.';
}
