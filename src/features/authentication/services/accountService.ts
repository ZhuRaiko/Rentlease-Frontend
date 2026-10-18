import type { AuthChangeEvent, AuthError } from '@supabase/supabase-js';

import { getSupabaseClient } from '../../../shared/services/supabase/client';
import type { AccountProfile, AccountSnapshot, AppRole } from '../models/AuthProfile';
import { nextAuthBootInstance, traceAuthBoot } from '../../../shared/utils/authBootTrace';

export function subscribeToAccountAuthChanges(
  onChange: (event: AuthChangeEvent, userId: string | null) => void,
): () => void {
  traceAuthBoot('AUTH_SUBSCRIBE');
  const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
    // Keep this callback synchronous; the ViewModel defers account requests.
    onChange(event, session?.user.id ?? null);
  });
  traceAuthBoot('AUTH_SUBSCRIBED');
  return () => {
    traceAuthBoot('AUTH_UNSUBSCRIBE');
    subscription.unsubscribe();
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseProfile(value: unknown): AccountProfile {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('Your profile could not be loaded. Please try again.');
  }
  return {
    id: value.id,
    display_name: nullableString(value.display_name),
    bio: nullableString(value.bio),
    avatar_path: nullableString(value.avatar_path),
    tier1_verified_at: nullableString(value.tier1_verified_at),
    tier2_verified_at: nullableString(value.tier2_verified_at),
    tier3_verified_at: nullableString(value.tier3_verified_at),
    trust_score: typeof value.trust_score === 'number' ? value.trust_score : null,
    account_status: nullableString(value.account_status),
  };
}

function parseRoles(value: unknown): AppRole[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AppRole[] => {
    if (!isRecord(item)) return [];
    return item.role === 'tenant' || item.role === 'landlord' || item.role === 'admin'
      ? [item.role]
      : [];
  });
}

export async function loadAccount(): Promise<AccountSnapshot | null> {
  const instance = nextAuthBootInstance();
  const client = getSupabaseClient();
  traceAuthBoot('SESSION_REQUEST', { instance });
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  traceAuthBoot('SESSION_RESULT', { instance, userPresent: Boolean(sessionData.session), errorPresent: Boolean(sessionError) });
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;
  traceAuthBoot('AUTH_USER_REQUEST', { instance });
  const { data: authData, error: authError } = await client.auth.getUser();
  traceAuthBoot('AUTH_USER_RESULT', { instance, userPresent: Boolean(authData.user), errorPresent: Boolean(authError) });
  if (authError) throw authError;
  if (!authData.user) return null;

  traceAuthBoot('PROFILE_QUERY_START', { instance });
  traceAuthBoot('ROLES_QUERY_START', { instance });
  const [profileResult, rolesResult] = await Promise.all([
    client
      .from('profiles')
      .select('id,display_name,bio,avatar_path,tier1_verified_at,tier2_verified_at,tier3_verified_at,trust_score,account_status')
      .eq('id', authData.user.id)
      .single().then((result) => {
        traceAuthBoot('PROFILE_QUERY_RESULT', { instance, errorPresent: Boolean(result.error) });
        return result;
      }),
    client.from('user_roles').select('role').eq('user_id', authData.user.id).then((result) => {
      traceAuthBoot('ROLES_QUERY_RESULT', { instance, errorPresent: Boolean(result.error) });
      return result;
    }),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (rolesResult.error) throw rolesResult.error;

  return {
    user: authData.user,
    profile: parseProfile(profileResult.data),
    roles: parseRoles(rolesResult.data),
  };
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function resendSignupEmail(email: string) {
  const { error } = await getSupabaseClient().auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function requestPhoneChange(phone: string) {
  const { error } = await getSupabaseClient().auth.updateUser({ phone });
  if (error) throw error;
}

export async function resendPhoneChange(phone: string) {
  const { error } = await getSupabaseClient().auth.resend({ type: 'phone_change', phone });
  if (error) throw error;
}

export async function confirmPhoneChange(phone: string, token: string) {
  const { error } = await getSupabaseClient().auth.verifyOtp({
    type: 'phone_change',
    phone,
    token,
  });
  if (error) throw error;
}

export async function saveUserRoles(requestedRoles: Array<'tenant' | 'landlord'>) {
  const { error } = await getSupabaseClient().rpc('set_user_roles', {
    requested_roles: requestedRoles,
  });
  if (error) throw error;
}

export async function updateOwnProfile(
  userId: string,
  changes: { display_name: string; bio: string },
) {
  const { error } = await getSupabaseClient()
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select('id')
    .single();
  if (error) throw error;
}

export async function signOutAccount() {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export function isUnconfirmedEmailError(error: unknown): boolean {
  const authError = error as AuthError | null;
  return authError?.code === 'email_not_confirmed';
}
