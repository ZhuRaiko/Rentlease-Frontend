import type { Href } from 'expo-router';

export const profileRoutes = {
  profile: '/profile' as Href,
  verification: '/verification' as Href,
  tier2: '/verification/tier2' as Href,
  tier3: '/verification/tier3' as Href,
  adminQueue: '/admin/verifications' as Href,
} as const;
