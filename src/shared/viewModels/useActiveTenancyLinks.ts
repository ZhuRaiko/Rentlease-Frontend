import {useCallback, useEffect, useMemo, useState} from 'react';
import {AppState} from 'react-native';
import {tenancyLinkService} from '../services/tenancyLinkDependencies';
import {indexByConversation, type ActiveTenancyLink} from '../models/TenancyLink';
import {createAccountCache} from '../utils/accountCache';

/** The last active-tenancy links per signed-in user (memory only); emptied with the other caches on sign-out and after every write. */
const linkCache = createAccountCache<ActiveTenancyLink[]>();
const none: ActiveTenancyLink[] = [];

/**
 * Active tenancies of the signed-in user, indexed by conversation id. The cached result is there at once; one quiet read refreshes it when
 * the screen opens and when the app returns to the foreground. A failed read leaves the last result (or nothing): the tags just do not show.
 */
export function useActiveTenancyLinks(owner: string | undefined) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{owner: string; rows: ActiveTenancyLink[]} | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', status => { if (status === 'active') setRevision(v => v + 1); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController(), token = linkCache.begin();
    let active = true;
    void tenancyLinkService.activeLinks(owner, controller.signal).then(rows => {
      linkCache.set(owner, rows, token);
      if (active) setState({owner, rows});
    }).catch(() => undefined);
    return () => { active = false; controller.abort(); };
  }, [owner, revision]);
  const rows = (state && state.owner === owner ? state.rows : linkCache.peek(owner)) ?? none;
  const byConversation = useMemo(() => indexByConversation(rows), [rows]);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  return {byConversation, refresh};
}
