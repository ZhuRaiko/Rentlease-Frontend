import { useEffect, useMemo, useRef, useState } from 'react';

import { isSupabaseConfigured } from '../../../config/env';
import { traceAuthBoot } from '../../../shared/utils/authBootTrace';
import {
  initialRegistrationDraft,
  type AccountSnapshot,
  type AuthProfileScreen,
  type RegistrationDraft,
  type UserRole,
} from '../models/AuthProfile';
import { getAccountDestination, getWorkspaceDestination } from '../models/accountRouting';
import { createAccountSynchronization } from './accountSynchronization';
import { advanceRegistration, createRegistrationSubmission, getRegistrationBackTarget, getRegistrationProgress, validateRegistrationStep } from './registrationFlow';
import {
  confirmPhoneChange,
  isUnconfirmedEmailError,
  loadAccount,
  requestPhoneChange,
  resendPhoneChange,
  resendSignupEmail,
  saveUserRoles,
  signIn,
  signOutAccount,
  signUp,
  subscribeToAccountAuthChanges,
  updateOwnProfile,
} from '../services/accountService';

type AsyncState = 'idle' | 'loading' | 'success' | 'error';

function friendlyError(error: unknown): string {
  const value = error as { code?: string; message?: string; status?: number } | null;
  const code = value?.code ?? '';
  const message = value?.message?.toLowerCase() ?? '';
  if (code === 'account_timeout') return 'Account loading timed out. Check your connection and retry.';
  if (code === 'invalid_credentials') return 'Incorrect email or password.';
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in.';
  if (code === 'weak_password') return 'Choose a stronger password and try again.';
  if (code === 'otp_expired' || message.includes('expired')) return 'This code has expired. Request a new code.';
  if (message.includes('invalid') && message.includes('token')) return 'That code is incorrect. Check it and try again.';
  if (code.includes('rate') || value?.status === 429) return 'Too many attempts. Please wait before trying again.';
  if (value?.status === 401) return 'Your session expired. Please sign in again.';
  if (value?.status === 403 || code === '42501') return 'This action is not permitted for your account.';
  if (message.includes('network') || message.includes('fetch')) return 'Network unavailable. Check your connection and retry.';
  if (message.includes('phone') || message.includes('sms')) return 'We could not send or verify the SMS. Please retry shortly.';
  if (message.includes('already registered')) return 'This email already has an account. Please sign in.';
  return 'Something went wrong. Please try again.';
}

function normalizePhilippinePhone(localNumber: string): string | null {
  const digits = localNumber.replace(/\D/g, '');
  return /^9\d{9}$/.test(digits) ? `+63${digits}` : null;
}

export function useAuthProfilesViewModel() {
  const [screen, setScreen] = useState<AuthProfileScreen>('bootstrap');
  const [history, setHistory] = useState<AuthProfileScreen[]>([]);
  const [draft, setDraft] = useState<RegistrationDraft>(initialRegistrationDraft);
  const [registrationSubmission] = useState(() => createRegistrationSubmission(signUp));
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [asyncState, setAsyncState] = useState<AsyncState>('idle');
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [entryVersion, setEntryVersion] = useState(0);
  const [signedOutVersion, setSignedOutVersion] = useState(0);
  const accountRef = useRef(account);
  const screenRef = useRef(screen);
  const mountedRef = useRef(false);
  const syncRef = useRef<ReturnType<typeof createAccountSynchronization<AccountSnapshot>> | null>(null);
  accountRef.current = account;
  screenRef.current = screen;

  useEffect(() => {
    traceAuthBoot('VM_STATE', { screen, asyncState, accountPresent: account !== null,
      destination: account ? getAccountDestination(account) : null,
      retryVisible: screen === 'bootstrap' && asyncState === 'error' });
  }, [screen, asyncState, account]);

  useEffect(() => {
    if (resendAvailableAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  const clearAccount = (destination: 'welcome' | 'signIn' = 'welcome') => {
    traceAuthBoot('STARTUP_RESOLVED', { destination: 'signed-out' });
    accountRef.current = null;
    setAccount(null);
    setDraft(initialRegistrationDraft);
    registrationSubmission.reset();
    setSignInIdentifier('');
    setSignInPassword('');
    setProfileName('');
    setProfileBio('');
    setResendAvailableAt(0);
    setSelectedRoles([]);
    setHistory([]);
    setScreen(destination);
    setShowSignOutConfirmation(false);
    setSignedOutVersion((current) => current + 1);
    setAsyncState('success');
    setNotice(null);
  };

  const routeAccount = (snapshot: AccountSnapshot, preservePhoneCode = false, background = false) => {
    const destination = getAccountDestination(snapshot);
    traceAuthBoot('STARTUP_RESOLVED', { destination, accountPresent: true });
    const previous = accountRef.current;
    const sameAccount = previous?.user.id === snapshot.user.id;
    const sameDestination = sameAccount && getAccountDestination(previous) === destination;
    const enteringWorkspace = getWorkspaceDestination(snapshot) !== null &&
      (!sameAccount || !previous || getWorkspaceDestination(previous) !== getWorkspaceDestination(snapshot));
    accountRef.current = snapshot;
    setAccount(snapshot);
    if (!background || !sameDestination || screenRef.current !== 'editProfile') {
      setProfileName(snapshot.profile.display_name ?? '');
      setProfileBio(snapshot.profile.bio ?? '');
    }
    if (destination !== 'emailConfirmation') {
      setDraft((current) => ({ ...current, password: '', confirmPassword: '' }));
      setSignInPassword('');
    }
    if (!background || !sameDestination || screenRef.current === 'bootstrap') {
      setScreen(preservePhoneCode && destination === 'registrationPhone' ? 'mobileConfirmation' : destination);
      setHistory([]);
    }
    if (enteringWorkspace) {
      setEntryVersion((current) => current + 1);
    }
  };

  const refreshAccount = async (preservePhoneCode = false) => {
    preservePhoneCodeRef.current = preservePhoneCode;
    return syncRef.current?.refresh('explicit') ?? null;
  };
  const preservePhoneCodeRef = useRef(false);
  const mutateAccount = <T,>(action: () => Promise<T>) => {
    const sync = syncRef.current;
    if (!sync) throw new Error('Account synchronization is not ready.');
    return sync.mutate(action);
  };

  const bootstrap = () => {
    if (!isSupabaseConfigured()) {
      setScreen('welcome');
      setNotice('Supabase is not configured. Add the public project URL and anon/publishable key to .env, then restart Expo.');
      return;
    }
    setScreen('bootstrap');
    setAsyncState('loading');
    setNotice(null);
    preservePhoneCodeRef.current = false;
    const sync = syncRef.current;
    if (!sync) {
      setAsyncState('error');
      setNotice('Account loading is unavailable. Please retry.');
      return;
    }
    sync.bootstrap();
  };

  useEffect(() => {
    traceAuthBoot('VM_MOUNT');
    mountedRef.current = true;
    const sync = createAccountSynchronization<AccountSnapshot>({
      load: loadAccount,
      apply: (snapshot, source) => {
        if (snapshot) routeAccount(snapshot, source === 'explicit' && preservePhoneCodeRef.current, source === 'background');
        else clearAccount();
        setAsyncState('success');
        setNotice(null);
      },
      clear: () => clearAccount(),
      onError: (error) => {
        traceAuthBoot('STARTUP_RESOLVED', { destination: 'error' });
        setAsyncState('error');
        setNotice(friendlyError(error));
      },
    });
    syncRef.current = sync;
    const unsubscribe = isSupabaseConfigured() ? subscribeToAccountAuthChanges((event, userId) => {
      if (event === 'SIGNED_IN' && accountRef.current && userId !== accountRef.current.user.id) {
        // Hide the prior account immediately while loading the new identity.
        accountRef.current = null;
        setAccount(null);
        setDraft(initialRegistrationDraft);
        setProfileName('');
        setProfileBio('');
        setSelectedRoles([]);
        setScreen('bootstrap');
      }
      sync.handleEvent(event, userId);
    }) : () => {};
    void bootstrap();
    return () => {
      traceAuthBoot('VM_UNMOUNT');
      mountedRef.current = false;
      unsubscribe();
      sync.dispose();
      syncRef.current = null;
    };
  }, []);

  const navigate = (nextScreen: AuthProfileScreen) => {
    if (registrationSubmission.phase() === 'submitting') return;
    if (['registrationName', 'registrationNickname', 'registrationEmail', 'registrationPassword'].includes(nextScreen) && ['created', 'uncertain'].includes(registrationSubmission.phase())) {
      setScreen('emailConfirmation'); setNotice('Check your confirmation email or sign in before starting another signup.'); return;
    }
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    if (registrationSubmission.phase() === 'submitting') return;
    setHistory((current) => {
      const previous = getRegistrationBackTarget(current, registrationSubmission.phase(), screenRef.current);
      setScreen(previous.screen);
      return previous.history;
    });
    setNotice(null);
  };

  const updateDraft = <TField extends keyof RegistrationDraft>(
    field: TField,
    value: RegistrationDraft[TField],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const continueRegistration = (skipNickname = false) => {
    if (registrationSubmission.phase() !== 'ready') return;
    const next = advanceRegistration(screen, draft, skipNickname);
    if (next.error) { setNotice(next.error); return; }
    setDraft(next.draft);
    if (next.screen !== screen) navigate(next.screen);
  };

  const submitSignIn = async () => {
    const email = signInIdentifier.trim().toLowerCase();
    if (!email.includes('@') || !signInPassword) {
      setNotice('Enter your email address and password to continue.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setNotice('Add your public Supabase URL and key to .env, then restart Expo.');
      return;
    }
    setAsyncState('loading');
    setNotice(null);
    try {
      await mutateAccount(() => signIn(email, signInPassword));
      await refreshAccount();
      setAsyncState('success');
    } catch (error) {
      if (isUnconfirmedEmailError(error)) {
        setDraft((current) => ({ ...current, email, password: signInPassword }));
        setScreen('emailConfirmation');
      }
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const register = async () => {
    if (screenRef.current !== 'registrationPassword' || accountRef.current || registrationSubmission.phase() !== 'ready') return;
    const email = draft.email.trim().toLowerCase();
    for (const step of ['registrationName', 'registrationEmail', 'registrationPassword'] as const) {
      const error = validateRegistrationStep(step, draft);
      if (error) { setNotice(error); return; }
    }
    if (!isSupabaseConfigured()) {
      setNotice('Add your public Supabase URL and key to .env, then restart Expo.');
      return;
    }
    setAsyncState('loading');
    setNotice(null);
    try {
      const outcome = await mutateAccount(() => registrationSubmission.submit(draft));
      if (!mountedRef.current || outcome.kind === 'blocked') return;
      if (outcome.kind === 'invalid') { setAsyncState('error'); setNotice(outcome.message); return; }
      if (outcome.kind === 'error') throw outcome.error;
      if (outcome.kind === 'uncertain') {
        setAsyncState('error'); setNotice('Account creation could not be confirmed. Check your inbox or sign in before trying to create another account.'); return;
      }
      const result = outcome.result;
      setDraft((current) => ({ ...current, email, confirmPassword: '' }));
      setHistory([]);
      setScreen('emailConfirmation');
      if (result.session) await refreshAccount();
      setAsyncState('success');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const resendEmail = async () => {
    if (resendAvailableAt > Date.now()) return;
    const email = draft.email || account?.user.email;
    if (!email) {
      setNotice('Enter your email address on the sign-in screen first.');
      return;
    }
    setAsyncState('loading');
    try {
      await resendSignupEmail(email);
      setResendAvailableAt(Date.now() + 60_000);
      setNow(Date.now());
      setNotice('A new confirmation email was requested. Check your inbox.');
      setAsyncState('success');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const continueAfterEmailConfirmation = async () => {
    if (!draft.password) {
      if (account) {
        await refreshVerificationState();
        return;
      }
      setScreen('signIn');
      setNotice('After confirming your email, sign in to continue.');
      return;
    }
    setAsyncState('loading');
    try {
      await mutateAccount(() => signIn(draft.email, draft.password));
      await refreshAccount();
      setAsyncState('success');
      setNotice(null);
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const requestPhoneOtp = async () => {
    const phone = normalizePhilippinePhone(draft.phone);
    if (!phone) {
      setNotice('Enter a 10-digit Philippine mobile number starting with 9.');
      return;
    }
    setAsyncState('loading');
    setNotice(null);
    try {
      await mutateAccount(() => requestPhoneChange(phone));
      const snapshot = await refreshAccount(true);
      setResendAvailableAt(Date.now() + 60_000);
      setNow(Date.now());
      if (snapshot && getAccountDestination(snapshot) === 'registrationPhone') setScreen('mobileConfirmation');
      setAsyncState('success');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const resendPhoneOtp = async () => {
    if (resendAvailableAt > Date.now()) return;
    const phone = normalizePhilippinePhone(draft.phone);
    if (!phone) return;
    setAsyncState('loading');
    try {
      await resendPhoneChange(phone);
      setResendAvailableAt(Date.now() + 60_000);
      setNow(Date.now());
      setNotice('A new SMS code was requested.');
      setAsyncState('success');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const verifyPhoneOtp = async () => {
    const phone = normalizePhilippinePhone(draft.phone);
    if (!phone || !/^\d{6}$/.test(draft.mobileCode)) {
      setNotice('Enter the six-digit code sent to your phone.');
      return;
    }
    setAsyncState('loading');
    setNotice(null);
    try {
      await mutateAccount(() => confirmPhoneChange(phone, draft.mobileCode));
      await refreshAccount();
      setDraft((current) => ({ ...current, mobileCode: '' }));
      setAsyncState('success');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const refreshVerificationState = async () => {
    setAsyncState('loading');
    setNotice(null);
    try {
      const snapshot = await refreshAccount(screen === 'mobileConfirmation');
      if (snapshot && !snapshot.profile.tier1_verified_at) {
        setNotice(snapshot.user.phone && snapshot.user.phone_confirmed_at
          ? 'Your phone is confirmed, but your account verification is still pending. If this continues, contact RENTLEASE support.'
          : 'This account still needs phone verification. You can verify it or sign out to use another account.');
      }
      setAsyncState('success');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role],
    );
  };

  const submitRoles = async () => {
    if (selectedRoles.length === 0) {
      setNotice('Choose at least one role to continue.');
      return;
    }
    setAsyncState('loading');
    setNotice(null);
    try {
      await mutateAccount(() => saveUserRoles(selectedRoles));
      await refreshAccount();
      setAsyncState('success');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const saveProfile = async () => {
    if (!account) return;
    if (!profileName.trim()) {
      setNotice('Display name cannot be empty.');
      return;
    }
    setAsyncState('loading');
    setNotice(null);
    try {
      await mutateAccount(() => updateOwnProfile(account.user.id, {
        display_name: profileName.trim(),
        bio: profileBio.trim(),
      }));
      const snapshot = await refreshAccount();
      if (!snapshot) throw new Error('Session ended during profile update.');
      setAsyncState('success');
      setNotice('Profile updated.');
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const signOut = async (destination: 'welcome' | 'signIn' = 'welcome') => {
    setAsyncState('loading');
    try {
      await mutateAccount(signOutAccount);
      if (mountedRef.current) clearAccount(destination);
    } catch (error) {
      setAsyncState('error');
      setNotice(friendlyError(error));
    }
  };

  const displayName = useMemo(
    () => account?.profile.display_name || account?.user.email?.split('@')[0] || 'RENTLEASE user',
    [account],
  );
  const roles = account?.roles ?? [];
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  return {
    screen,
    draft,
    account,
    roles,
    hasTenantRole: roles.includes('tenant'),
    hasLandlordRole: roles.includes('landlord'),
    isAdmin: roles.includes('admin'),
    displayName,
    profileName,
    profileBio,
    selectedRoles,
    signInIdentifier,
    signInPassword,
    notice,
    asyncState,
    showSignOutConfirmation,
    resendSeconds,
    entryVersion,
    signedOutVersion,
    bootstrap,
    navigate,
    goBack,
    updateDraft,
    continueRegistration,
    registrationProgress: getRegistrationProgress(screen),
    registrationError: validateRegistrationStep(screen, draft),
    signupNeedsRecovery: registrationSubmission.phase() === 'uncertain',
    setProfileName,
    setProfileBio,
    setSignInIdentifier,
    setSignInPassword,
    setNotice,
    submitSignIn,
    register,
    resendEmail,
    continueAfterEmailConfirmation,
    requestPhoneOtp,
    resendPhoneOtp,
    verifyPhoneOtp,
    refreshVerificationState,
    toggleRole,
    submitRoles,
    saveProfile,
    setShowSignOutConfirmation,
    signOut,
    switchAccount: () => signOut('signIn'),
  };
}

export type AuthProfilesViewModel = ReturnType<typeof useAuthProfilesViewModel>;
