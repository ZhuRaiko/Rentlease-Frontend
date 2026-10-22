export type MarketplaceMode = 'tenant' | 'landlord';
export interface MarketplaceAccess { marketplace: boolean; admin: boolean; tenant: boolean; landlord: boolean }
export type AppWorkspace =
  | { type: 'discovery'; initialScreen: 'home' | 'matchingPreferences'; introduction?: boolean }
  | { type: 'properties'; initialScreen: 'dashboard' | 'postingType' }
  | { type: 'priceEstimate'; actor: MarketplaceMode; returnTo: 'discovery' | 'properties' }
  | { type: 'messages'; initialScreen: 'inbox' | 'newInquiry' }
  | { type: 'maintenance' | 'ratingsReports' | 'adminModeration' | 'notifications' | 'verification' }
  | null;

// Presentation routing only; backend authorization remains independent.
export function propertiesWorkspace(access: MarketplaceAccess, initialScreen: 'dashboard' | 'postingType'): AppWorkspace {
  return access.marketplace && !access.admin && access.landlord ? { type: 'properties', initialScreen } : null;
}
export function initialMarketplaceWorkspace(access: MarketplaceAccess, mode: MarketplaceMode): AppWorkspace {
  if (access.admin) return { type: 'adminModeration' };
  if (!access.marketplace) return null;
  return mode === 'landlord' && access.landlord ? propertiesWorkspace(access, 'dashboard') : { type: 'discovery', initialScreen: 'home' };
}
export function switchMarketplaceMode(access: MarketplaceAccess, mode: MarketplaceMode) {
  if (!access.marketplace || access.admin || !access[mode]) return null;
  return { mode, workspace: initialMarketplaceWorkspace(access, mode) };
}
