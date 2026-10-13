import type { AccountSnapshot, AuthProfileScreen } from './AuthProfile';

export function getAccountDestination(account: AccountSnapshot): AuthProfileScreen {
  if (account.profile.account_status !== 'active') return 'restricted';
  if (account.roles.includes('admin')) return 'profile';
  if (!account.user.email_confirmed_at) return 'emailConfirmation';
  if (!account.profile.tier1_verified_at) {
    return account.user.phone && account.user.phone_confirmed_at
      ? 'verificationPending'
      : 'registrationPhone';
  }
  if (!account.roles.some((role) => role === 'tenant' || role === 'landlord')) {
    return 'roleSelection';
  }
  return 'profile';
}

export function getWorkspaceDestination(account: AccountSnapshot): 'adminModeration' | 'discovery' | null {
  if (getAccountDestination(account) !== 'profile') return null;
  return account.roles.includes('admin') ? 'adminModeration' : 'discovery';
}
