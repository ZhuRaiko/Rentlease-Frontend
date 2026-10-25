import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid } from '../models/DraftProperty';
import { isLifecycleStatus, lifecycleActions, lifecycleBackendError, LifecycleError, lifecycleOperations, lifecycleReceiptFromRow, lifecycleRpc, validLifecycleReceipt, validTimestamp, type LifecycleListing, type LifecycleOperation } from '../models/ListingLifecycle';
interface Journal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export interface LifecycleContext { userId: string; propertyId: string; listingId: string }
const running = new Set<string>();
const uncertain = () => new LifecycleError('The listing change is uncertain. Check listing status before trying again.', 'uncertain');
export function createListingLifecycleService(getClient: () => SupabaseClient<Database>, journal: Journal) {
  const scope = (c: LifecycleContext) => `${c.userId}:${c.propertyId}:${c.listingId}`;
  const key = (c: LifecycleContext, op: LifecycleOperation) => `rentlease:listing-lifecycle:${scope(c)}:${op}`;
  const user = async () => {
    const { data, error } = await getClient().auth.getUser();
    if (error || !data.user) throw new LifecycleError('Sign in again to manage this listing.', 'identity');
    return data.user.id;
  };
  const context = async (propertyId: string, listingId: string): Promise<LifecycleContext> => {
    if (!isPropertyUuid(propertyId) || !isPropertyUuid(listingId)) throw new LifecycleError('A saved property and listing are required.');
    return { userId: await user(), propertyId, listingId };
  };
  const assertContext = async (c: LifecycleContext) => { if (await user() !== c.userId) throw new LifecycleError('Your account changed. Reopen the listing.', 'identity'); };
  const read = async (c: LifecycleContext): Promise<LifecycleListing> => {
    await assertContext(c);
    const { data, error } = await getClient().from('listings').select('*').eq('id', c.listingId).eq('property_id', c.propertyId).eq('landlord_id', c.userId).maybeSingle();
    await assertContext(c);
    if (error) throw uncertain();
    if (!data || data.id !== c.listingId || data.property_id !== c.propertyId || data.landlord_id !== c.userId) throw new LifecycleError('The owned listing is no longer available. Reopen the workspace.', 'identity');
    if (!isLifecycleStatus(data.status) || !Number.isFinite(data.completeness_score) || !validTimestamp(data.updated_at)) throw uncertain();
    return data;
  };
  const pending = async (c: LifecycleContext) => {
    const values = await Promise.all(lifecycleOperations.map(op => journal.getItem(key(c, op))));
    return lifecycleOperations.filter((_, index) => !!values[index]);
  };
  const otherUncertain = async (c: LifecycleContext) => !!(await journal.getItem(`rentlease:publish-pending:${c.userId}:${c.listingId}`) || await journal.getItem(`rentlease:listing-draft-save:${c.userId}:${c.propertyId}`));
  return {
    context, assertContext, read,
    async inspect(c: LifecycleContext) { const row = await read(c); const operations = await pending(c); await assertContext(c); return { row, operations }; },
    async reconcile(c: LifecycleContext) {
      if (running.has(scope(c))) throw uncertain();
      const row = await read(c); await assertContext(c);
      // Confirms current state only. Never replays a mutation or infers who changed it.
      for (const op of lifecycleOperations) await journal.removeItem(key(c, op));
      return row;
    },
    async mutate(c: LifecycleContext, operation: LifecycleOperation, expectedStatus: LifecycleListing['status']): Promise<LifecycleListing> {
      const lock = scope(c); if (running.has(lock)) throw uncertain(); running.add(lock);
      let sent = false, wrote = false, rejected = false;
      try {
        await assertContext(c);
        if ((await pending(c)).length || await otherUncertain(c)) throw uncertain();
        const before = await read(c);
        if (before.status !== expectedStatus || !lifecycleActions(before.status).includes(operation)) throw new LifecycleError('The listing status changed. Check listing status before confirming another action.');
        await journal.setItem(key(c, operation), 'pending'); wrote = true;
        await assertContext(c); sent = true;
        const { data, error } = await getClient().rpc(lifecycleRpc[operation], { p_listing_id: c.listingId });
        if (error) {
          if (/^(22|23|42|P0001)/.test(error.code ?? '')) { await journal.removeItem(key(c, operation)); rejected = true; throw lifecycleBackendError(error); }
          throw uncertain();
        }
        const receipt = Array.isArray(data) && data.length === 1 ? data[0] : null;
        if (!receipt || !validLifecycleReceipt(receipt, before, operation)) throw uncertain();
        const row = await read(c);
        if (!validLifecycleReceipt(lifecycleReceiptFromRow(row), before, operation)) throw uncertain();
        await journal.removeItem(key(c, operation)); return row;
      } catch (error) {
        if (!sent && wrote) { try { await journal.removeItem(key(c, operation)); } catch { /* Preserve unknown marker. */ } }
        if ((error as { kind?: string })?.kind === 'identity') throw error;
        if (sent && !rejected) throw uncertain();
        if (error instanceof LifecycleError) throw error;
        throw new LifecycleError('The change could not start safely. Check listing status before retrying.', 'uncertain');
      } finally { running.delete(lock); }
    },
  };
}
export type ListingLifecycleService = ReturnType<typeof createListingLifecycleService>;
