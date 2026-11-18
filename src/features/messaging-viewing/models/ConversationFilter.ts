import type {Conversation} from './PersistentMessaging';

export type ConversationFilter = 'all' | 'mine' | 'others';
export const conversationFilters: {id: ConversationFilter; label: string}[] = [
  {id: 'all', label: 'All'},
  {id: 'mine', label: 'My listings'},
  {id: 'others', label: 'Others’'},
];

/** The pills cover the rows already loaded (20 per page); no extra query. "My listings" = the signed-in user is the owner side of the row. */
export function filterConversations(rows: readonly Conversation[], filter: ConversationFilter, me: string | null | undefined): Conversation[] {
  if (filter === 'all') return [...rows];
  return rows.filter(row => (row.landlordId === me) === (filter === 'mine'));
}

/** The designed placeholder rows show only on the first open: nothing cached yet and a read is running. Cached rows are never replaced. */
export const showInboxSkeleton = (busy: boolean, loaded: number, failed: boolean): boolean => busy && loaded === 0 && !failed;

/** "Nov 18": the day only, like the designed card. */
export const messageDay = (value: string): string => new Date(value).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
