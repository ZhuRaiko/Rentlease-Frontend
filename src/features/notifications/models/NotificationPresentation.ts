import type {GlyphKind} from '../../../shared/components/GlyphIcon';
import type {InAppNotification} from './InAppNotification';

export type NotificationTone = 'amber' | 'blue' | 'green' | 'grey' | 'red';
export interface NotificationLook {icon: GlyphKind; tone: NotificationTone}

/**
 * Icon and color per server event type. The server emits exactly these seven (plus the unused review_request); a type this app does not know falls
 * back to a neutral grey flag, so a new server type never breaks the list. Maintenance is amber, messages and viewings blue (both live in a conversation),
 * tenancy and rent green, verification and report results grey.
 */
const LOOKS: Record<string, NotificationLook> = {
  new_message: {icon: 'chat', tone: 'blue'},
  viewing_update: {icon: 'chat', tone: 'blue'},
  maintenance_update: {icon: 'wrench', tone: 'amber'},
  tenancy_update: {icon: 'house', tone: 'green'},
  rent_due: {icon: 'house', tone: 'green'},
  report_update: {icon: 'flag', tone: 'grey'},
  verification_update: {icon: 'shield', tone: 'grey'},
  review_request: {icon: 'star', tone: 'grey'},
};
export const notificationLook = (type: string): NotificationLook => LOOKS[type] ?? {icon: 'flag', tone: 'grey'};

/**
 * Red "Urgent maintenance request" and the Urgent chip appear ONLY when the notification itself says it is urgent (a boolean `urgent` on the row).
 * The server's list does not send one today, so a maintenance notification reads as the server wrote it ("Maintenance update"). Nothing is guessed.
 */
export interface NotificationRowView {id: string; title: string; text: string; icon: GlyphKind; tone: NotificationTone; urgent: boolean; unread: boolean; when: string}
export function notificationRowView(n: InAppNotification, now: number): NotificationRowView {
  const look = notificationLook(n.type), urgent = n.urgent === true && n.type === 'maintenance_update';
  return {id: n.id, title: urgent ? 'Urgent maintenance request' : n.title, text: n.body, icon: urgent ? 'warning' : look.icon, tone: urgent ? 'red' : look.tone, urgent, unread: n.readAt === null, when: whenLabel(n.createdAt, now)};
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const manila = (ms: number) => new Date(ms + 8 * 3600000);
const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
/** Today: the time ("1:11 AM"). Earlier: the day ("Nov 17"). Philippine time. */
export function whenLabel(iso: string, now: number): string {
  const d = manila(Date.parse(iso));
  if (dayKey(d) !== dayKey(manila(now))) return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export interface NotificationGroup {label: 'Today' | 'Earlier'; rows: NotificationRowView[]}
/** Today first, then Earlier; the server's order (newest first) is kept inside each group. An empty group is left out. */
export function groupNotifications(rows: readonly InAppNotification[], now: number): NotificationGroup[] {
  const today: NotificationRowView[] = [], earlier: NotificationRowView[] = [], key = dayKey(manila(now));
  for (const n of rows) (dayKey(manila(Date.parse(n.createdAt))) === key ? today : earlier).push(notificationRowView(n, now));
  return [...(today.length ? [{label: 'Today' as const, rows: today}] : []), ...(earlier.length ? [{label: 'Earlier' as const, rows: earlier}] : [])];
}
