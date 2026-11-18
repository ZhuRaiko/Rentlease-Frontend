import {useCallback, useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {reviewsOverviewService} from '../../../shared/services/reviewsOverviewDependencies';
import type {ReviewsOverview} from '../../../shared/models/ReviewsOverview';
import {createAccountCache} from '../../../shared/utils/accountCache';

/** The last result per signed-in user (memory only); emptied on sign-out and after every write, so a review just sent shows at once on return. */
const overviewCache = createAccountCache<ReviewsOverview>();

/**
 * The Reviews screen's data: the cached result is on screen at once, one quiet read refreshes it when the screen opens, on pull to refresh and when
 * the app returns to the foreground. A result for another account, or one that arrives after the screen closed, is dropped. A failed refresh keeps
 * what is shown and says so; the screen never goes blank because a read failed.
 */
export function useReviewsOverview(accountId: string | undefined) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{owner: string; data: ReviewsOverview | null; busy: boolean; error: string | null}>({owner: '', data: null, busy: false, error: null});
  useEffect(() => {
    const sub = AppState.addEventListener('change', status => { if (status === 'active') setRevision(v => v + 1); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController(), token = overviewCache.begin(), timer = setTimeout(() => controller.abort(), 20000);
    let live = true;
    setState(s => ({owner: accountId, data: s.owner === accountId ? s.data : overviewCache.peek(accountId), busy: true, error: null}));
    void reviewsOverviewService.overview(accountId, controller.signal).then(data => {
      overviewCache.set(accountId, data, token);
      if (live) setState({owner: accountId, data, busy: false, error: null});
    }).catch(error => {
      if (live) setState(s => ({...s, busy: false, error: error instanceof Error && error.message ? error.message : 'Reviews could not load. Retry.'}));
    }).finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [accountId, revision]);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const mine = state.owner === accountId;
  return {data: mine ? state.data ?? (accountId ? overviewCache.peek(accountId) : null) : null, busy: mine ? state.busy : false, error: mine ? state.error : null, refresh};
}
