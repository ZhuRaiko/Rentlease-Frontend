const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const manila = (ms: number) => new Date(ms + 8 * 3600000);
const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

/** "7:12 AM" in Philippine time. */
export function timeOfDay(iso: string): string {
  const d = manila(Date.parse(iso)), h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "Today 7:12 AM", "Yesterday 7:12 AM" or "Nov 9, 7:12 AM", in Philippine time. */
export function formatWhen(iso: string, now: number): string {
  const d = manila(Date.parse(iso));
  if (dayKey(d) === dayKey(manila(now))) return `Today ${timeOfDay(iso)}`;
  if (dayKey(d) === dayKey(manila(now - 86400000))) return `Yesterday ${timeOfDay(iso)}`;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${timeOfDay(iso)}`;
}
/** "Nov 9" in Philippine time. */
export function shortDate(iso: string): string {
  const d = manila(Date.parse(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
