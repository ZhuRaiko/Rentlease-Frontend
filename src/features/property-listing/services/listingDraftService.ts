import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid } from '../models/DraftProperty';
import { ListingDraftError, listingDraftPayload, type ListingDraftFields, type SavedListingDraft } from '../models/PersistedListingDraft';
interface Journal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export interface ListingDraftContext { userId: string; propertyId: string }
const saves = new Set<string>();
const columns = 'id,property_id,landlord_id,title,description,house_rules,rental_term,asking_rent_monthly,security_deposit_months,advance_rent_months,minimum_stay_months,available_from,status,completeness_score,created_at,updated_at,archived_at,paused_at,published_at,removed_at,removal_reason';
const uncertain = () => new ListingDraftError('The save outcome is unknown. Check the current backend draft before saving again.', 'uncertain');
export function createListingDraftService(getClient: () => SupabaseClient<Database>, journal: Journal) {
  const key = (c: ListingDraftContext) => `rentlease:listing-draft-save:${c.userId}:${c.propertyId}`;
  const context = async (propertyId: string): Promise<ListingDraftContext> => {
    if (!isPropertyUuid(propertyId)) throw new ListingDraftError('A saved physical property is required.');
    const client = getClient(); const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new ListingDraftError('Sign in to manage a listing draft.', 'identity');
    const userId = data.user.id;
    const { data: property, error: propertyError } = await client.from('properties').select('id,landlord_id,is_active').eq('id', propertyId).eq('landlord_id', userId).eq('is_active', true).maybeSingle();
    if (propertyError) throw new ListingDraftError('Could not check the property. Try loading again.');
    if (!property || property.landlord_id !== userId || !property.is_active) throw new ListingDraftError('An active property owned by your account is required.', 'identity');
    const { data: current, error: currentError } = await client.auth.getUser();
    if (currentError || current.user?.id !== userId) throw new ListingDraftError('Your account changed. Reopen the listing.', 'identity');
    return { userId, propertyId };
  };
  const assertContext = async (c: ListingDraftContext) => {
    const current = await context(c.propertyId);
    if (current.userId !== c.userId) throw new ListingDraftError('Your account changed. Reopen the listing.', 'identity');
  };
  const read = async (c: ListingDraftContext): Promise<SavedListingDraft | null> => {
    await assertContext(c);
    const { data, error } = await getClient().from('listings').select(columns).eq('property_id', c.propertyId).eq('landlord_id', c.userId).eq('status', 'draft').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    await assertContext(c);
    if (error) throw new ListingDraftError('Could not load the current listing draft. Check your connection.');
    if (data && (!isPropertyUuid(data.id) || data.property_id !== c.propertyId || data.landlord_id !== c.userId || data.status !== 'draft')) throw new ListingDraftError('The returned listing draft could not be verified.');
    return data;
  };
  return {
    context, assertContext, read,
    hasPending: async (c: ListingDraftContext) => !!await journal.getItem(key(c)),
    async save(c: ListingDraftContext, form: ListingDraftFields): Promise<SavedListingDraft> {
      const payload = listingDraftPayload(c.propertyId, form), k = key(c);
      if (saves.has(k)) throw uncertain(); saves.add(k);
      let sent = false, pendingWritten = false, knownRejection = false;
      try {
        await assertContext(c); if (await journal.getItem(k)) throw uncertain();
        // Only an operation marker is persisted, not title/description or credentials.
        await journal.setItem(k, 'pending'); pendingWritten = true;
        await assertContext(c); sent = true;
        const { data, error } = await getClient().rpc('save_listing_draft', payload);
        if (error) {
          if (/^(22|23|42)/.test(error.code ?? '')) { await journal.removeItem(k); knownRejection = true; throw new ListingDraftError('The draft was rejected. Check property access and listing fields.'); }
          throw uncertain();
        }
        const receipt = Array.isArray(data) && data.length === 1 ? data[0] : null;
        if (!receipt || !isPropertyUuid(receipt.listing_id) || receipt.listing_status !== 'draft' || !Number.isFinite(receipt.completeness_score) || !Number.isFinite(Date.parse(receipt.created_at)) || !Number.isFinite(Date.parse(receipt.updated_at))) throw uncertain();
        const row = await read(c); if (!row || row.id !== receipt.listing_id) throw uncertain();
        await assertContext(c); await journal.removeItem(k); return row;
      } catch (error) {
        if (!sent && pendingWritten) { try { await journal.removeItem(k); } catch { /* Keep pending if cleanup cannot be confirmed. */ } }
        if (error instanceof ListingDraftError && error.kind === 'identity') throw error;
        if (sent && !knownRejection) throw uncertain();
        if (error instanceof ListingDraftError) throw error;
        throw new ListingDraftError('The save could not start safely. Try again after checking your connection.');
      } finally { saves.delete(k); }
    },
    async reconcile(c: ListingDraftContext): Promise<SavedListingDraft> {
      if (saves.has(key(c))) throw uncertain();
      const row = await read(c); if (!row) throw uncertain();
      // This confirms CURRENT backend state, not that the timed-out payload was applied.
      await assertContext(c); await journal.removeItem(key(c)); return row;
    },
  };
}
export type ListingDraftService = ReturnType<typeof createListingDraftService>;
