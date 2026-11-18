import { readSessionUser } from '../../../shared/services/supabase/sessionUser';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {parseReviewContext, type ReviewContext} from '../../../shared/models/RentalReview';
import {parseCare, type CareContext} from '../models/TenancyCare';
import {parseLifecycle, type LifecycleContext} from '../models/TenancyLifecycle';
import {parseRentLedger, type RentLedger} from '../models/RentLedger';
import type {RentalRelationship} from '../models/TenancyWorkspace';
import type {PendingExtension} from '../models/TenancyExtension';
import {createTenancyExtensionService} from './tenancyExtensionService';

/** What the Tenancy tab needs beyond the list itself: open maintenance, pending end requests and review state. Existing RPCs only, read-only. */
export interface TenancyActivity {
  care: Record<string, CareContext | null>;
  lifecycle: Record<string, LifecycleContext | null>;
  reviews: Record<string, ReviewContext | null>;
  /** First page of the rent ledger per active rental; null when that read failed (the rent item is then simply not shown). */
  rent: Record<string, RentLedger | null>;
  /** The owner's pending extension requests (get_pending_tenancy_extensions); empty for a tenant, or when that read failed or the function is not deployed. */
  extensions?: PendingExtension[];
}
export const emptyActivity = (): TenancyActivity => ({care: {}, lifecycle: {}, reviews: {}, rent: {}});
/** Bounds: the most recent rentals only. A failed read leaves that entry null, so the tab shows nothing for it instead of an error. */
export const ACTIVITY_LIMIT = 12;

export function createTenancyActivityService(client: () => SupabaseClient<Database>) {
  const identity = async (actor: string, signal: AbortSignal) => {
    const {data, error} = await readSessionUser(client());
    if (error || data.user?.id !== actor || signal.aborted) throw new Error('Your account changed. Reopen Tenancy.');
  };
  const read = async <T>(actor: string, name: 'get_tenancy_care' | 'get_tenancy_lifecycle' | 'get_tenancy_reviews' | 'get_rent_ledger', id: string, parse: (value: unknown, actor: string, id: string) => T, signal: AbortSignal): Promise<T | null> => {
    try {
      const args = name === 'get_tenancy_reviews' ? {p_tenancy_id: id} : {p_tenancy_id: id, p_offset: 0};
      const {data, error} = await client().rpc(name as 'get_tenancy_care', args as {p_tenancy_id: string; p_offset: number}).abortSignal(signal);
      if (error) return null;
      return parse(data, actor, id);
    } catch { return null; }
  };
  const extensions = createTenancyExtensionService(client);
  return {
    async read(actor: string, tenancies: readonly RentalRelationship[], signal: AbortSignal): Promise<TenancyActivity> {
      await identity(actor, signal);
      const active = tenancies.filter(t => t.status === 'active').slice(0, ACTIVITY_LIMIT);
      const ended = tenancies.filter(t => t.status === 'ended').slice(0, ACTIVITY_LIMIT);
      const out = emptyActivity();
      await Promise.all([
        ...active.map(async t => { out.care[t.id] = await read(actor, 'get_tenancy_care', t.id, parseCare, signal); }),
        ...active.map(async t => { out.lifecycle[t.id] = await read(actor, 'get_tenancy_lifecycle', t.id, parseLifecycle, signal); }),
        ...active.map(async t => { out.rent[t.id] = await read(actor, 'get_rent_ledger', t.id, parseRentLedger, signal); }),
        ...ended.map(async t => { out.reviews[t.id] = await read(actor, 'get_tenancy_reviews', t.id, parseReviewContext, signal); }),
        ...(active.some(t => t.landlord_id === actor) ? [extensions.pending(actor, signal).then(rows => { out.extensions = rows; }).catch(() => { out.extensions = []; })] : []),
      ]);
      await identity(actor, signal);
      return out;
    },
  };
}
export type TenancyActivityService = ReturnType<typeof createTenancyActivityService>;
