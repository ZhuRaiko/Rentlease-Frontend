import type { AuthChangeEvent } from '@supabase/supabase-js';

export type AccountRefreshSource = 'explicit' | 'background';

interface AccountSynchronizationOptions<TAccount> {
  load: () => Promise<TAccount | null>;
  apply: (account: TAccount | null, source: AccountRefreshSource) => void;
  clear: () => void;
  onError: (error: unknown) => void;
}

// Request coordination only. The root ViewModel remains the sole account-state owner.
export function createAccountSynchronization<TAccount>(options: AccountSynchronizationOptions<TAccount>) {
  let disposed = false;
  let generation = 0;
  let mutations = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let loadingGeneration: number | undefined;
  let lastEventUserId: string | null = null;

  const invalidate = () => {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const refresh = async (source: AccountRefreshSource): Promise<TAccount | null> => {
    if (disposed) return null;
    invalidate();
    const requestGeneration = generation;
    loadingGeneration = requestGeneration;
    try {
      const account = await options.load();
      if (disposed || generation !== requestGeneration) return null;
      options.apply(account, source);
      return account;
    } catch (error) {
      if (disposed || generation !== requestGeneration) return null;
      throw error;
    } finally {
      if (loadingGeneration === requestGeneration) loadingGeneration = undefined;
    }
  };

  return {
    refresh,
    async mutate<T>(action: () => Promise<T>): Promise<T> {
      invalidate();
      mutations++;
      try {
        return await action();
      } finally {
        mutations--;
      }
    },
    handleEvent(event: AuthChangeEvent, userId: string | null) {
      if (disposed) return;
      if (event === 'SIGNED_OUT') {
        invalidate();
        lastEventUserId = null;
        options.clear();
        return;
      }
      // Bootstrap owns INITIAL_SESSION. Explicit mutations perform their own refresh.
      if (event === 'INITIAL_SESSION') {
        lastEventUserId = userId;
        return;
      }
      if (!userId) return;
      if (mutations > 0) {
        lastEventUserId = userId;
        return;
      }
      if (!['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED', 'MFA_CHALLENGE_VERIFIED'].includes(event)) return;
      const changedUser = lastEventUserId !== userId;
      lastEventUserId = userId;
      // Auth reads may emit TOKEN_REFRESHED/SIGNED_IN themselves. Never feed them back.
      if (loadingGeneration === generation && (event === 'TOKEN_REFRESHED' || (!changedUser && event !== 'USER_UPDATED'))) return;
      invalidate();
      // Do not await another Supabase operation inside the Auth callback/lock.
      timer = setTimeout(() => {
        timer = undefined;
        void refresh('background').catch(options.onError);
      }, 0);
    },
    dispose() {
      disposed = true;
      invalidate();
    },
  };
}
