import type { Href } from 'expo-router';

export const postListingRoutes = {
  chatList: '/chat' as Href,
  chatThread: (threadId: string) => `/chat/${threadId}` as Href,
  schedule: (listingId: string, landlordId: string) =>
    `/schedule?listingId=${encodeURIComponent(listingId)}&landlordId=${encodeURIComponent(landlordId)}` as Href,
  maintenance: '/maintenance' as Href,
  maintenanceNew: '/maintenance/new' as Href,
  reminders: '/reminders' as Href,
} as const;
