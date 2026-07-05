import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type SignupDraft = {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phone: string;
  password: string;
};

export type AuthResult = {
  user: User | null;
  session: Session | null;
};

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data;
}

export async function requestPhoneOtp(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw error;
  }
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function completeVerifiedPhoneSignup(draft: SignupDraft): Promise<AuthResult> {
  const { data, error } = await supabase.auth.updateUser({
    email: draft.email,
    password: draft.password,
    data: {
      first_name: draft.firstName,
      last_name: draft.lastName,
      nickname: draft.nickname,
      phone: draft.phone,
      tier_1_phone_verified: true,
    },
  });

  if (error) {
    throw error;
  }

  return {
    user: data.user,
    session: null,
  };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
