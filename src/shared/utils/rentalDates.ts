// Manila calendar-day helpers and short display formats shared by the tenancy and property management screens.
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
export const pesos = (amount: number | null | undefined): string => amount === null || amount === undefined ? '—' : `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
/** "2h ago" / "3d ago" from an ISO timestamp. */
export function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  return minutes < 60 ? `${Math.max(1, minutes)}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
