import type { AccountSnapshot } from '../models/AuthProfile';
import { getWorkspaceDestination } from '../models/accountRouting';

// Process-local signup provenance, never inferred from account age or a role-button press.
// No credentials, account snapshot, persistence or second session owner.
export function createMarketplaceIntroduction() {
  let createdUserId: string | null = null;
  return {
    markCreated(userId: string) { createdUserId = userId; },
    clear() { createdUserId = null; },
    consume(account: AccountSnapshot) {
      if (!createdUserId) return false;
      if (account.user.id !== createdUserId || account.roles.includes('admin') || account.profile.account_status !== 'active') { createdUserId = null; return false; }
      if (getWorkspaceDestination(account) !== 'discovery') return false;
      createdUserId = null;
      return true;
    },
  };
}
