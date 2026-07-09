import type { Href } from 'expo-router';

export const recommendationRoutes = {
  intro: '/recommendations/intro' as Href,
  survey: '/recommendations/survey' as Href,
  results: '/recommendations/results' as Href,
} as const;
