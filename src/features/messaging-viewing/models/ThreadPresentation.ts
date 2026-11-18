const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const manila = (ms: number) => new Date(ms + 8 * 3600000);
const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

/** "1:10 AM" in Philippine time: the day is on the separator chip, so a bubble shows only the time. */
export function bubbleTime(iso: string): string {
  const d = manila(Date.parse(iso)), h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Today", "Yesterday" or "Nov 17", in Philippine time. */
export function dayLabel(iso: string, now: number): string {
  const d = manila(Date.parse(iso));
  if (dayKey(d) === dayKey(manila(now))) return 'Today';
  if (dayKey(d) === dayKey(manila(now - 86400000))) return 'Yesterday';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** The chip to draw above message `index`: the first message, or one sent on a different day than the message before it. */
export function dayChipBefore(messages: readonly {createdAt: string}[], index: number, now: number): string | null {
  const current = messages[index];
  if (!current) return null;
  const previous = messages[index - 1];
  if (previous && dayKey(manila(Date.parse(previous.createdAt))) === dayKey(manila(Date.parse(current.createdAt)))) return null;
  return dayLabel(current.createdAt, now);
}

/** The green banner, only while a tenancy is active. The owner sees who rents; the renter sees who the landlord is. */
export function rentingBanner(iAmOwner: boolean, otherName: string): string {
  return iAmOwner ? `${otherName} is renting this property now` : `You are renting this property. ${otherName} is your landlord.`;
}
