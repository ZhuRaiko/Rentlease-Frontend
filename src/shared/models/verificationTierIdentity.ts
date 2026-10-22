import { colors } from '../theme/colors';

/** Tier identity is independent of status, role and property approval. */
export const verificationTierIdentities = {
  1: { name: 'Account', number: '01', surface: colors.background, ink: colors.primaryAction },
  2: { name: 'Identity', number: '02', surface: colors.background, ink: colors.primaryAction },
  3: { name: 'Property', number: '03', surface: colors.background, ink: colors.primaryAction },
} as const;
export type VerificationTierNumber = keyof typeof verificationTierIdentities;
