import type { AppWorkspace, MarketplaceAccess, MarketplaceMode } from './marketplaceNavigation';

export interface ProfileReturnTarget {
  userId: string;
  workspace: NonNullable<AppWorkspace>;
  mode: MarketplaceMode;
}

/** A single presentation return target, not a persisted navigation stack. */
export function resolveProfileReturn(target: ProfileReturnTarget | null, userId: string | null, access: MarketplaceAccess): ProfileReturnTarget | null {
  if (!target || !userId || target.userId !== userId) return null;
  if (access.admin) return target.workspace.type === 'adminModeration' ? target : null;
  if (!access.marketplace || target.workspace.type === 'adminModeration') return null;
  if (target.mode === 'tenant' && !access.tenant) return null;
  if (target.mode === 'landlord' && !access.landlord) return null;
  if (target.workspace.type === 'properties' && !access.landlord) return null;
  if (target.workspace.type === 'priceEstimate' && (target.workspace.actor === 'landlord' || target.workspace.returnTo === 'properties') && !access.landlord) return null;
  return target;
}

export function captureProfileReturn(userId: string | null, workspace: AppWorkspace, mode: MarketplaceMode, access: MarketplaceAccess) {
  return resolveProfileReturn(userId && workspace ? { userId, workspace, mode } : null, userId, access);
}
