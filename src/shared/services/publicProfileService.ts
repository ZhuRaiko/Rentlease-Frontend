import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { identityUuid } from '../models/PublicIdentity';
import { parsePublicProfile, PublicProfileError, type PublicProfile } from '../models/PublicProfile';

export type ProfileResult = { kind: 'ready'; profile: PublicProfile } | { kind: 'denied' };
export const PROFILE_CACHE_TTL_MS = 60_000;

/**
 * Reads one public profile through get_public_profile. A short per-session cache (by signed-in user and profile id, both answers and refusals) and one shared request per id keep lists
 * from re-reading. A refusal (42501, "Profile unavailable") is a normal answer: it becomes {kind:'denied'}, never a thrown error.
 */
export function createPublicProfileService(getClient: () => SupabaseClient<Database>, now: () => number = Date.now, ttl: number = PROFILE_CACHE_TTL_MS) {
  const cache = new Map<string, { at: number; value: ProfileResult }>();
  const inflight = new Map<string, Promise<ProfileResult>>();
  const key = (actor: string, id: string) => `${actor}:${id}`;
  const fresh = (k: string): ProfileResult | null => { const hit = cache.get(k); if (!hit) return null; if (now() - hit.at > ttl) { cache.delete(k); return null; } return hit.value; };
  async function load(actor: string, id: string): Promise<ProfileResult> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const who = await getClient().auth.getUser();
      if (who.error || who.data.user?.id !== actor) throw new PublicProfileError('Your account changed. Reopen the profile.');
      const r = await getClient().rpc('get_public_profile', { p_user_id: id }).abortSignal(controller.signal);
      const again = await getClient().auth.getUser();
      if (again.error || again.data.user?.id !== actor) throw new PublicProfileError('Your account changed. Reopen the profile.');
      if (r.error) {
        if (r.error.code === '42501') return { kind: 'denied' };
        throw new PublicProfileError(r.error.code === 'PGRST202' ? 'This feature is not available right now. Try again later.' : 'The profile could not load. Retry.');
      }
      return { kind: 'ready', profile: parsePublicProfile(r.data, id) };
    } catch (e) {
      throw e instanceof PublicProfileError ? e : new PublicProfileError('The profile could not load. Retry.');
    } finally { clearTimeout(timer); }
  }
  return {
    /** The cached answer, if any, without a request. */
    peek(actor: string | undefined, id: string | undefined): ProfileResult | null { return actor && id ? fresh(key(actor, id)) : null; },
    async read(actor: string, id: string, signal?: AbortSignal): Promise<ProfileResult> {
      if (!identityUuid(actor) || !identityUuid(id)) return { kind: 'denied' };
      const k = key(actor, id), hit = fresh(k);
      if (hit) return hit;
      let p = inflight.get(k);
      if (!p) {
        p = load(actor, id).then(v => { cache.set(k, { at: now(), value: v }); return v; }).finally(() => { inflight.delete(k); });
        inflight.set(k, p);
      }
      if (!signal) return p;
      return new Promise<ProfileResult>((resolve, reject) => {
        const abort = () => reject(new PublicProfileError('The profile request was cancelled.'));
        if (signal.aborted) return abort();
        signal.addEventListener('abort', abort, { once: true });
        p!.then(v => { signal.removeEventListener('abort', abort); resolve(v); }, e => { signal.removeEventListener('abort', abort); reject(e); });
      });
    },
    clear() { cache.clear(); },
  };
}
