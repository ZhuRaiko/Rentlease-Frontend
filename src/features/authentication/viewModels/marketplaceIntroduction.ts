import type { AccountSnapshot } from '../models/AuthProfile';
import { getWorkspaceDestination } from '../models/accountRouting';
import type { MarketplaceIntroductionService } from '../services/marketplaceIntroductionService';

type State = { userId: string | null; status: 'idle' | 'checking' | 'required' | 'complete' | 'notRequired' | 'error'; busy: boolean; error: string | null };
const initial: State = { userId: null, status: 'idle', busy: false, error: null };
// Local onboarding orchestration only. No credentials or second account/session snapshot.
export function createMarketplaceIntroduction(service: MarketplaceIntroductionService) {
  let state: State = initial; let epoch = 0; let disposed = false;
  let pendingSignupId: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); } };
  const current = (attempt: number) => !disposed && attempt === epoch;
  const check = async (account: AccountSnapshot, force = false) => {
    if (disposed) return;
    const userId = account.user.id;
    if (getWorkspaceDestination(account) !== 'discovery') {
      epoch++; update({ ...initial, userId }); return;
    }
    if (!force && state.userId === userId && !['idle', 'error'].includes(state.status)) return;
    const attempt = ++epoch; update({ userId, status: 'checking', busy: true, error: null });
    try {
      if (pendingSignupId === userId) { await service.markPending(userId); if (current(attempt)) pendingSignupId = null; }
      const status = await service.read(userId);
      if (current(attempt)) update({ status: status === 'pending' ? 'required' : status === 'done' ? 'complete' : 'notRequired', busy: false });
    } catch { if (current(attempt)) update({ status: 'error', busy: false, error: 'Could not check optional setup on this device. Retry to continue.' }); }
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    check,
    async markCreated(userId: string) {
      epoch++; update({ ...initial, userId });
      pendingSignupId = userId;
      try { await service.markPending(userId); if (pendingSignupId === userId) pendingSignupId = null; return true; }
      catch { return false; } // Signup remains successful; check retries only this local marker.
    },
    async complete(userId: string) {
      if (disposed || state.userId !== userId || state.status !== 'required' || state.busy) return false;
      const attempt = epoch; update({ busy: true, error: null });
      try {
        await service.complete(userId);
        if (!current(attempt)) return false;
        update({ status: 'complete', busy: false }); return true;
      } catch { if (current(attempt)) update({ busy: false, error: 'Could not remember your choice on this device. Please try Save or Skip again.' }); return false; }
    },
    clear() { epoch++; pendingSignupId = null; update(initial); },
    activate() { disposed = false; },
    dispose() { epoch++; disposed = true; state = initial; pendingSignupId = null; },
  };
}
