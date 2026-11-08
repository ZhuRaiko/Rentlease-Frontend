export type MarketplaceMode = 'tenant' | 'landlord';
// Legacy snapshot fields may be present; eligibility and Admin alone govern navigation.
export interface MarketplaceAccess { marketplace: boolean; admin: boolean; tenant?: boolean; landlord?: boolean }
export const defaultMarketplaceMode = (preference: unknown): MarketplaceMode => preference === 'list' ? 'landlord' : 'tenant';
// Compatibility for unfinished Chat/Tenancy previews only; never an access check.
export const defaultPreviewActor = (legacyRoles: readonly string[]): MarketplaceMode => legacyRoles.includes('landlord') && !legacyRoles.includes('tenant') ? 'landlord' : 'tenant';
export type AppWorkspace =
  | { type: 'discovery'; initialScreen: 'home' | 'matchingPreferences'; introduction?: boolean }
  | { type: 'properties'; initialScreen: 'dashboard' | 'postingType' }
  | { type: 'priceEstimate'; actor: MarketplaceMode; returnTo: 'discovery' | 'properties' }
  | { type: 'messages'; initialScreen: 'inbox' | 'newInquiry' }
  | { type: 'tenancy' | 'maintenance' | 'ratingsReports' | 'adminModeration' | 'notifications' | 'verification' }
  | null;

// Presentation routing only; backend authorization remains independent.
export function propertiesWorkspace(access: MarketplaceAccess, initialScreen: 'dashboard' | 'postingType'): AppWorkspace {
  return access.marketplace && !access.admin ? { type: 'properties', initialScreen } : null;
}
export function initialMarketplaceWorkspace(access: MarketplaceAccess, mode: MarketplaceMode): AppWorkspace {
  if (access.admin) return { type: 'adminModeration' };
  if (!access.marketplace) return null;
  return mode === 'landlord' ? propertiesWorkspace(access, 'dashboard') : { type: 'discovery', initialScreen: 'home' };
}
export function switchMarketplaceMode(access: MarketplaceAccess, mode: MarketplaceMode) {
  if (!access.marketplace || access.admin) return null;
  return { mode, workspace: initialMarketplaceWorkspace(access, mode) };
}
