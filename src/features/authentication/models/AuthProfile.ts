import type { User } from '@supabase/supabase-js';

export type UserRole = 'tenant' | 'landlord';
export type AppRole = UserRole | 'admin';

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
  | 'roleSelection'
  | 'profile'
  | 'editProfile'
  | 'settings'
  | 'restricted';

export interface RegistrationDraft {
  firstName: string;
  lastName: string;
  nickname: string;
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
}

export interface AccountSnapshot {
  user: User;
  profile: AccountProfile;
  roles: AppRole[];
}

export const initialRegistrationDraft: RegistrationDraft = {
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  phone: '',
  mobileCode: '',
  password: '',
  confirmPassword: '',
};
