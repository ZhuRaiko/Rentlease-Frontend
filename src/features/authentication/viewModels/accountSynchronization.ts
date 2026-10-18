import type { AuthChangeEvent } from '@supabase/supabase-js';
import { nextAuthBootInstance, traceAuthBoot } from '../../../shared/utils/authBootTrace';

export type AccountRefreshSource = 'explicit' | 'background';

interface AccountSynchronizationOptions<TAccount> {
  load: () => Promise<TAccount | null>;
  apply: (account: TAccount | null, source: AccountRefreshSource) => void;
  clear: () => void;
  onError: (error: unknown) => void;
  timeoutMs?: number;
}

// A recovery deadline, not a startup delay. Successful loads apply immediately.
const ACCOUNT_LOAD_TIMEOUT_MS = 15_000;

class AccountLoadTimeoutError extends Error {
  readonly code = 'account_timeout';

  constructor() {
    super('Account loading timed out. Check your connection and retry.');
  }
}

// Request coordination only. The root ViewModel remains the sole account-state owner.
export function createAccountSynchronization<TAccount>(options: AccountSynchronizationOptions<TAccount>) {
  const instance = nextAuthBootInstance();
  let disposed = false;
  let generation = 0;
  let mutations = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let loadingGeneration: number | undefined;
  let lastEventUserId: string | null = null;
  let bootstrapTimer: ReturnType<typeof setTimeout> | undefined;
  const requestTimers = new Set<ReturnType<typeof setTimeout>>();
  const timeoutMs = options.timeoutMs ?? ACCOUNT_LOAD_TIMEOUT_MS;

  const finishBootstrap = () => {
    if (bootstrapTimer !== undefined) {
      traceAuthBoot('STARTUP_DEADLINE_CLEARED', { instance, generation });
      clearTimeout(bootstrapTimer);
    }
    bootstrapTimer = undefined;
  };

  const invalidate = () => {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const refresh = async (source: AccountRefreshSource): Promise<TAccount | null> => {
    if (disposed) return null;
    invalidate();
    const requestGeneration = generation;
    traceAuthBoot('ACCOUNT_LOAD_START', { instance, generation: requestGeneration, source });
    loadingGeneration = requestGeneration;
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        requestTimer = setTimeout(() => {
          traceAuthBoot('REQUEST_DEADLINE_FIRED', { instance, generation: requestGeneration, source });
          reject(new AccountLoadTimeoutError());
        }, timeoutMs);
        requestTimers.add(requestTimer);
      });
      const account = await Promise.race([options.load(), deadline]);
      if (disposed || generation !== requestGeneration) {
        traceAuthBoot('ACCOUNT_LOAD_STALE', { instance, generation: requestGeneration, reason: disposed ? 'disposed' : 'superseded' });
        return null;
      }
      traceAuthBoot('ACCOUNT_LOAD_SUCCESS', { instance, generation: requestGeneration, source, accountPresent: account !== null });
      finishBootstrap();
      options.apply(account, source);
      return account;
    } catch (error) {
      if (disposed || generation !== requestGeneration) {
        traceAuthBoot('ACCOUNT_LOAD_STALE', { instance, generation: requestGeneration, reason: 'stale-error' });
        return null;
      }
      traceAuthBoot('ACCOUNT_LOAD_ERROR', { instance, generation: requestGeneration, source });
      finishBootstrap();
      options.onError(error);
      throw error;
    } finally {
      if (requestTimer !== undefined) {
        clearTimeout(requestTimer);
        requestTimers.delete(requestTimer);
      }
      if (loadingGeneration === requestGeneration) loadingGeneration = undefined;
    }
  };

  return {
    refresh,
    bootstrap() {
      if (disposed) return;
      traceAuthBoot('BOOTSTRAP_START', { instance, generation });
      finishBootstrap();
      // This deadline belongs to the entire startup attempt. Auth events may
      // replace its read, but cannot extend its completion budget indefinitely.
      bootstrapTimer = setTimeout(() => {
        if (disposed) return;
        traceAuthBoot('STARTUP_DEADLINE_FIRED', { instance, generation });
        bootstrapTimer = undefined;
        invalidate();
        options.onError(new AccountLoadTimeoutError());
      }, timeoutMs);
      traceAuthBoot('STARTUP_DEADLINE_CREATED', { instance, generation, timeoutMs });
      // Only current apply/onError callbacks own UI completion, never the tail
      // of a superseded bootstrap promise. refresh already reports active errors.
      void refresh('explicit').catch(() => {});
    },
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
      traceAuthBoot('AUTH_EVENT', { instance, generation, eventName: event, userPresent: userId !== null });
      if (disposed) return;
      if (event === 'SIGNED_OUT') {
        invalidate();
        finishBootstrap();
        lastEventUserId = null;
        options.clear();
        return;
      }
      // Bootstrap owns INITIAL_SESSION. Explicit mutations perform their own refresh.
      if (event === 'INITIAL_SESSION') {
        traceAuthBoot('REFRESH_SUPPRESSED', { instance, generation, reason: 'bootstrap-owns-initial-session' });
        lastEventUserId = userId;
        return;
      }
      if (!userId) return;
      if (mutations > 0) {
        traceAuthBoot('REFRESH_SUPPRESSED', { instance, generation, reason: 'explicit-operation' });
        lastEventUserId = userId;
        return;
      }
      if (!['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED', 'MFA_CHALLENGE_VERIFIED'].includes(event)) return;
      const changedUser = lastEventUserId !== userId;
      lastEventUserId = userId;
      // Auth reads may emit TOKEN_REFRESHED/SIGNED_IN themselves. Never feed them back.
      if (loadingGeneration === generation && (event === 'TOKEN_REFRESHED' || (!changedUser && event !== 'USER_UPDATED'))) {
        traceAuthBoot('REFRESH_SUPPRESSED', { instance, generation, reason: 'active-read-feedback' });
        return;
      }
      invalidate();
      traceAuthBoot('REFRESH_QUEUED', { instance, generation });
      // Do not await another Supabase operation inside the Auth callback/lock.
      timer = setTimeout(() => {
        timer = undefined;
        void refresh('background').catch(() => {});
      }, 0);
    },
    dispose() {
      traceAuthBoot('COORDINATOR_DISPOSE', { instance, generation });
      disposed = true;
      invalidate();
      finishBootstrap();
      for (const requestTimer of requestTimers) clearTimeout(requestTimer);
      requestTimers.clear();
    },
  };
}
