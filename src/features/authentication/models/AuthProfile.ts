export type UserRole = 'tenant' | 'landlord';

export type AuthProfileScreen =
  | 'welcome'
  | 'signIn'
  | 'registrationName'
  | 'registrationNickname'
  | 'registrationEmail'
  | 'emailConfirmation'
  | 'registrationPhone'
  | 'mobileConfirmation'
  | 'registrationPassword'
  | 'registrationComplete'
  | 'profile'
  | 'editProfile'
  | 'settings'
  | 'restricted';

export interface RegistrationDraft {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  emailCode: string;
  phone: string;
  mobileCode: string;
  password: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phone: string;
  role: UserRole;
  city: string;
}

export const initialRegistrationDraft: RegistrationDraft = {
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  emailCode: '',
  phone: '',
  mobileCode: '',
  password: '',
};

export const previewProfile: UserProfile = {
  firstName: 'Samuel',
  lastName: 'Feliciano',
  nickname: 'Sam',
  email: 'samuel.feliciano@example.com',
  phone: '+63 917 123 4567',
  role: 'tenant',
  city: 'Imus, Cavite',
};
