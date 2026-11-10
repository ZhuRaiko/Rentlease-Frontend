import type { User } from '@supabase/supabase-js';

export type UserRole = 'tenant' | 'landlord';
export type AppRole = UserRole | 'admin';
export type ExperiencePreference = 'rent' | 'list' | 'both' | null;
export const experiencePreferenceOptions = [
  { value: null, label: 'No preference' },
  { value: 'rent', label: 'Looking to rent' },
  { value: 'list', label: 'Listing properties' },
  { value: 'both', label: 'Both' },
] as const;
export function parseExperiencePreference(value: unknown): ExperiencePreference {
  return value === 'rent' || value === 'list' || value === 'both' ? value : null;
}

export type AuthProfileScreen =
  | 'bootstrap'
  | 'welcome'
  | 'signIn'
  | 'registrationName'
  | 'registrationNickname'
  | 'registrationEmail'
  | 'emailConfirmation'
  | 'registrationPhone'
  | 'mobileConfirmation'
  | 'verificationPending'
  | 'registrationPassword'
  | 'profile'
  | 'editProfile'
  | 'settings'
  | 'restricted';

export interface RegistrationDraft {
  firstName: string;
  lastName: string;
  nickname: string;
  publicNameAcknowledged: boolean;
  email: string;
  phone: string;
  mobileCode: string;
  password: string;
  confirmPassword: string;
}

export interface AccountProfile {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  tier1_verified_at: string | null;
  tier2_verified_at: string | null;
  tier3_verified_at: string | null;
  trust_score: number | null;
  account_status: string | null;
  experience_preference?: ExperiencePreference;
}

export interface AccountSnapshot {
  user: User;
  profile: AccountProfile;
  roles: AppRole[];
  // Undefined means the optional ownership indication could not be established.
  ownsProperty?: boolean | undefined;
}

export const initialRegistrationDraft: RegistrationDraft = {
  firstName: '',
  lastName: '',
  nickname: '',
  publicNameAcknowledged: false,
  email: '',
  phone: '',
  mobileCode: '',
  password: '',
  confirmPassword: '',
};

export interface RegistrationIdentityInput {firstName:string;lastName:string;publicNameAcknowledged:boolean}
