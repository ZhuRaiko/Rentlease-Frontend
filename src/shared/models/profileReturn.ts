import { initialMarketplaceWorkspace, type AppWorkspace, type MarketplaceAccess, type MarketplaceMode } from './marketplaceNavigation';

export interface ProfileReturnTarget {
  userId: string;
  workspace: NonNullable<AppWorkspace>;
  mode: MarketplaceMode;
}

/** A single presentation return target, not a persisted navigation stack. */
export function resolveProfileReturn(target: ProfileReturnTarget | null, userId: string | null, access: MarketplaceAccess): ProfileReturnTarget | null {
  if (!target || !userId || target.userId !== userId) return null;
  const workspace = profilePredecessor(target.workspace);
  if (!workspace) return null;
  target = { ...target, workspace };
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

/** Only top-level workspaces are Profile predecessors; dismissed tools are not history. */
function profilePredecessor(workspace: NonNullable<AppWorkspace>): AppWorkspace {
  switch (workspace.type) {
    case 'discovery': return workspace.initialScreen === 'home' ? { type: 'discovery', initialScreen: 'home' } : null;
    case 'properties': return { type: 'properties', initialScreen: 'dashboard' };
    case 'messages': return { type: 'messages', initialScreen: 'inbox' };
    case 'maintenance': case 'adminModeration': return workspace;
    default: return null;
  }
}

export function profileBackTarget(target: ProfileReturnTarget | null, userId: string | null, mode: MarketplaceMode, access: MarketplaceAccess) {
  return resolveProfileReturn(target, userId, access) ?? captureProfileReturn(userId, initialMarketplaceWorkspace(access, mode), mode, access);
}

export function profileAfterDismissal(target: ProfileReturnTarget | null, userId: string | null, workspace: AppWorkspace, mode: MarketplaceMode, access: MarketplaceAccess) {
  return captureProfileReturn(userId, workspace, mode, access) ?? resolveProfileReturn(target, userId, access);
}
