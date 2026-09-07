import { useEffect, useMemo, useState } from 'react';

import {
  initialRegistrationDraft,
  previewProfile,
  type AuthProfileScreen,
  type RegistrationDraft,
  type UserProfile,
  type UserRole,
} from '../models/AuthProfile';

type EditableProfileField = 'firstName' | 'lastName' | 'nickname' | 'email' | 'phone' | 'city';

export function useAuthProfilesViewModel(accountRole: UserRole = 'tenant') {
  const [screen, setScreen] = useState<AuthProfileScreen>('welcome');
  const [history, setHistory] = useState<AuthProfileScreen[]>([]);
  const [draft, setDraft] = useState<RegistrationDraft>(initialRegistrationDraft);
  const [profile, setProfile] = useState<UserProfile>({ ...previewProfile, role: accountRole });
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);

  const navigate = (nextScreen: AuthProfileScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1) ?? 'welcome';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const updateDraft = <TField extends keyof RegistrationDraft>(
    field: TField,
    value: RegistrationDraft[TField],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateCodeDigit = (field: 'emailCode' | 'mobileCode', index: number, digit: string) => {
    const nextDigit = digit.replace(/\D/g, '').slice(-1);
    setDraft((current) => {
      const digits = current[field].padEnd(4, ' ').slice(0, 4).split('');
      digits[index] = nextDigit || ' ';
      return { ...current, [field]: digits.join('').trimEnd() };
    });
  };

  useEffect(() => {
    setProfile((current) => ({ ...current, role: accountRole }));
  }, [accountRole]);

  const submitSignIn = () => {
    if (!signInIdentifier.trim() || !signInPassword) {
      setNotice('Enter your email or phone number and password to continue.');
      return false;
    }
    setHistory([]);
    setScreen('profile');
    setNotice(null);
    return true;
  };

  const openProfilePreview = () => navigate('profile');

  const completeRegistrationPreview = () => {
    setProfile({
      firstName: draft.firstName || previewProfile.firstName,
      lastName: draft.lastName || previewProfile.lastName,
      nickname: draft.nickname || draft.firstName || previewProfile.nickname,
      email: draft.email || previewProfile.email,
      phone: draft.phone ? `+63 ${draft.phone}` : previewProfile.phone,
      role: 'tenant',
      city: previewProfile.city,
    });
    navigate('registrationComplete');
  };

  const updateProfile = (field: EditableProfileField, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = () => {
    setHistory([]);
    setScreen('profile');
    setNotice('Profile changes are stored only for this frontend preview.');
  };

  const signOutPreview = () => {
    setShowSignOutConfirmation(false);
    setHistory([]);
    setScreen('welcome');
    setNotice(null);
  };

  const displayName = useMemo(
    () => `${profile.firstName} ${profile.lastName}`.trim(),
    [profile.firstName, profile.lastName],
  );

  return {
    screen,
    draft,
    profile,
    displayName,
    signInIdentifier,
    signInPassword,
    rememberMe,
    notice,
    showSignOutConfirmation,
    navigate,
    goBack,
    updateDraft,
    updateCodeDigit,
    setSignInIdentifier,
    setSignInPassword,
    setRememberMe,
    setNotice,
    submitSignIn,
    openProfilePreview,
    completeRegistrationPreview,
    updateProfile,
    saveProfile,
    setShowSignOutConfirmation,
    signOutPreview,
  };
}

export type AuthProfilesViewModel = ReturnType<typeof useAuthProfilesViewModel>;
