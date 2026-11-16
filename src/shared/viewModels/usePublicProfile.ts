import { useCallback, useEffect, useState } from 'react';
import { publicProfileService } from '../services/publicProfileClient';
import { PublicProfileError, type PublicProfile } from '../models/PublicProfile';

export type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; profile: PublicProfile }
  | { status: 'denied' }
  | { status: 'error'; message: string };

/**
 * One public profile read for one user (cached for a short time by the service). A refusal is the state "denied", which small surfaces treat as
 * "no check, no rating" (never an error banner) and the profile screen shows as "Profile unavailable".
 */
export function usePublicProfile(accountId: string | undefined, userId: string | undefined): ProfileState & { retry: () => void } {
  const initial = (): ProfileState => {
    const hit = publicProfileService.peek(accountId, userId);
    return hit ? (hit.kind === 'ready' ? { status: 'ready', profile: hit.profile } : { status: 'denied' }) : accountId && userId ? { status: 'loading' } : { status: 'idle' };
  };
  const [state, setState] = useState<ProfileState>(initial), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!accountId || !userId) { setState({ status: 'idle' }); return; }
    const hit = publicProfileService.peek(accountId, userId);
    if (hit) { setState(hit.kind === 'ready' ? { status: 'ready', profile: hit.profile } : { status: 'denied' }); return; }
    const controller = new AbortController();
    let live = true;
    setState({ status: 'loading' });
    publicProfileService.read(accountId, userId, controller.signal).then(
      r => { if (live) setState(r.kind === 'ready' ? { status: 'ready', profile: r.profile } : { status: 'denied' }); },
      e => { if (live) setState({ status: 'error', message: e instanceof PublicProfileError ? e.message : 'The profile could not load. Retry.' }); });
    return () => { live = false; controller.abort(); };
  }, [accountId, userId, attempt]);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { ...state, retry };
}
