import type { Coordinates, RadiusKm } from '@rentlease/gps-local';
import type { RpcNearbyListing } from '@rentlease/gps-local/rpc';
export type { Coordinates, RadiusKm, RpcNearbyListing };
export type NearbyListing = RpcNearbyListing & { thumbnailUrl?: string | null };
export type GpsErrorKind = 'denied' | 'blocked' | 'services_disabled' | 'position_failed' | 'identity' | 'eligibility' | 'backend_permission' | 'network' | 'response' | 'parameters';
export class GpsError extends Error {
  constructor(readonly kind: GpsErrorKind, message: string) { super(message); this.name = 'GpsError'; }
}
export const gpsErrorMessages: Record<GpsErrorKind, string> = {
  denied: 'Location access is off. You can try again or search by city.',
  blocked: 'Location permission is off in Android settings. Enable it there, then try again.',
  services_disabled: 'Turn on device location services, then try again.',
  position_failed: 'Could not obtain your current location. Check device location services and try again.',
  identity: 'Your account changed or your session ended. Sign in and start a new location search.',
  eligibility: 'Nearby search requires an active Tier 1-verified account.',
  backend_permission: 'Nearby rentals could not be loaded. Please try again.',
  network: 'Could not load nearby rentals. Check your connection and try again.',
  response: 'Nearby results could not be read safely. Please try again later.',
  parameters: 'The server rejected these search parameters. Adjust the distance and try again.',
};
export interface GpsProximityState {
  presentation: 'map'|'list';
  selectedListingId: string|null;
  approximateOrigin: Coordinates|null;
  phase: 'idle' | 'locating' | 'searching' | 'success' | 'error';
  radiusKm: RadiusKm;
  rows: readonly NearbyListing[];
  photoError: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  error: { kind: GpsErrorKind; message: string } | null;
}
