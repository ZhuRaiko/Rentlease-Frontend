import type { Href } from 'expo-router';

export const trustRoutes = {
  rate: (listingId: string, rateeId: string, rateeName: string) =>
    `/trust/rate?listingId=${encodeURIComponent(listingId)}&rateeId=${encodeURIComponent(
      rateeId
    )}&rateeName=${encodeURIComponent(rateeName)}` as Href,
  reportListing: (listingId: string) =>
    `/trust/report?subjectType=listing&subjectId=${encodeURIComponent(listingId)}` as Href,
  reportUser: (userId: string) =>
    `/trust/report?subjectType=user&subjectId=${encodeURIComponent(userId)}` as Href,
  listingReviews: (listingId: string) => `/listing/${listingId}/reviews` as Href,
  adminReports: '/admin/reports' as Href,
} as const;
