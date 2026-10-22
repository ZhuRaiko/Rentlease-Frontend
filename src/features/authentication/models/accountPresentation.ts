import type { AccountProfile, AppRole } from './AuthProfile';
import type { StatusPresentation } from '../../../shared/models/verificationPresentation';

export const roleLabel = (role: AppRole) => ({ tenant: 'Tenant', landlord: 'Landlord', admin: 'Admin' })[role];
export function accountVerificationSummary(profile: Pick<AccountProfile, 'tier1_verified_at' | 'tier2_verified_at' | 'tier3_verified_at'> | null, roles: AppRole[]) {
  const status = (timestamp: string | null | undefined, applicable: boolean): StatusPresentation => timestamp
    ? { label: 'Verified', tone: 'success' }
    : applicable ? { label: 'Not Verified', tone: 'info' } : { label: 'Not Applicable', tone: 'info' };
  return [
    { tier: 1 as const, label: 'Tier 1 · Account', status: status(profile?.tier1_verified_at, !roles.includes('admin')), detail: roles.includes('admin') ? 'Admin access bypasses ordinary onboarding.' : 'Email and mobile verification.' },
    { tier: 2 as const, label: 'Tier 2 · Identity', status: status(profile?.tier2_verified_at, true), detail: 'Open Verification for current submission details.' },
    { tier: 3 as const, label: 'Tier 3 · Property', status: status(profile?.tier3_verified_at, roles.includes('landlord')), detail: 'Account-level indication. Check each individual property in Verification.' },
  ];
}

export const accountStatusLabel = (status: AccountProfile['account_status']) => status ? ({ active: 'Active', restricted: 'Restricted', suspended: 'Suspended', deleted: 'Deleted' })[status] : 'Unknown';

export { verificationIndicatorKind as profileVerificationIndicator } from '../../../shared/models/verificationPresentation';

/** Keep a circular initials/photo frame while reserving space for accessibility text. */
export const profileAvatarDiameter = (fontScale: number) => Math.max(64, Math.ceil(32 * fontScale + 24));
