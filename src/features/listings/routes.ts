import type { Href } from 'expo-router';

export const listingRoutes = {
  home: '/home' as Href,
  map: '/listings/map' as Href,
  filters: '/listings/filters' as Href,
  newStart: '/listings/new' as Href,
  newMedia: '/listings/new/media' as Href,
  newDetails: '/listings/new/details' as Href,
  newSpecs: '/listings/new/specs' as Href,
  newLocation: '/listings/new/location' as Href,
  newPricing: '/listings/new/pricing' as Href,
  detail: (id: string) => `/listing/${id}` as Href,
} as const;
