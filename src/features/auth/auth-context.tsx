import type { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { SignupDraft } from '@/features/auth/auth-service';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoadingSession: boolean;
  signupDraft: SignupDraft;
  updateSignupDraft: (values: Partial<SignupDraft>) => void;
  resetSignupDraft: () => void;
};

const emptySignupDraft: SignupDraft = {
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  phone: '',
  password: '',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [signupDraft, setSignupDraft] = useState<SignupDraft>(emptySignupDraft);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoadingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoadingSession,
      signupDraft,
      updateSignupDraft: (values) => {
        setSignupDraft((current) => ({ ...current, ...values }));
      },
      resetSignupDraft: () => {
        setSignupDraft(emptySignupDraft);
      },
    }),
    [isLoadingSession, session, signupDraft]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
