import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from './supabase/database.types';
import {readSessionUser} from './supabase/sessionUser';
import {parseReviewContext, ReviewError} from '../models/RentalReview';
import {buildOverview, OVERVIEW_LIMIT, type ReviewsOverview} from '../models/ReviewsOverview';

/**
 * The Reviews screen's data, from reads that already exist: my most recent ended stays as the renter (one query), then the review context of each
 * (get_tenancy_reviews, the same read the review panel uses). It writes nothing. A stay whose read fails is skipped; if every read fails the screen
 * shows the error and a retry.
 */
export function createReviewsOverviewService(client: () => SupabaseClient<Database>) {
  const identity = async (actor: string, signal: AbortSignal) => {
    const r = await readSessionUser(client());
    if (signal.aborted || r.error || r.data.user?.id !== actor) throw new ReviewError('Your account changed or the request timed out. Reopen reviews.');
  };
  const failed = () => new ReviewError('Reviews could not load. Retry.');
  return {
    async overview(actor: string, signal: AbortSignal): Promise<ReviewsOverview> {
      await identity(actor, signal);
      const r = await client().from('tenancies').select('id,tenant_id,landlord_id,status,actual_end_date,ended_at,listings(title)', {count: 'exact'})
        .eq('tenant_id', actor).eq('status', 'ended').order('ended_at', {ascending: false}).order('id').range(0, OVERVIEW_LIMIT - 1).abortSignal(signal);
      await identity(actor, signal);
      if (r.error) throw failed();
      if (!r.data || r.data.some(t => t.tenant_id !== actor || t.status !== 'ended' || !t.actual_end_date || !t.ended_at)) throw new ReviewError('Completed rental access could not be verified.');
      const stays = r.data.map(t => ({id: t.id, title: t.listings?.title ?? 'Completed rental', ended: t.actual_end_date!}));
      const reads = await Promise.allSettled(stays.map(async t => {
        const x = await client().rpc('get_tenancy_reviews', {p_tenancy_id: t.id}).abortSignal(signal);
        if (x.error) throw failed();
        return parseReviewContext(x.data, actor, t.id);
      }));
      await identity(actor, signal);
      if (stays.length && reads.every(x => x.status === 'rejected')) throw failed();
      return buildOverview(stays, reads.map(x => (x.status === 'fulfilled' ? x.value : null)), actor, r.count ?? stays.length);
    },
  };
}
export type ReviewsOverviewService = ReturnType<typeof createReviewsOverviewService>;
