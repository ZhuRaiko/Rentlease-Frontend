import { measureHydration } from './draftHydrationDiagnostics';
import { publicationDiagnostic, tracePublicationDiagnostic, type PublicationDiagnostic } from './publicationDiagnostics';
import { isLifecycleStatus } from '../models/ListingLifecycle';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid } from '../models/DraftProperty';
import type { ListingDraftFields } from '../models/PersistedListingDraft';
import { createListingDraftService, type ListingDraftContext } from './listingDraftService';
import { isPublishedListing, listingFieldsUnchanged, PublicationError, publicationBackendError, type PublicationListing } from '../models/ListingPublication';
interface Journal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export interface PublicationContext extends ListingDraftContext { listingId: string }
const publishing = new Set<string>();
const uncertain = () => new PublicationError('Publication outcome is uncertain. Check publication status before trying again.', 'uncertain');
export function createListingPublicationService(getClient: () => SupabaseClient<Database>, journal: Journal, diagnose: (event: PublicationDiagnostic) => void = tracePublicationDiagnostic) {
  const access = createListingDraftService(getClient, journal);
  const pendingKey = (c: PublicationContext) => `rentlease:publish-pending:${c.userId}:${c.listingId}`;
  const pointerKey = (c: ListingDraftContext) => `rentlease:published-property:${c.userId}:${c.propertyId}`;
  const context = async (propertyId: string, listingId: string): Promise<PublicationContext> => {
    if (!isPropertyUuid(propertyId) || !isPropertyUuid(listingId)) throw new PublicationError('A saved property and listing draft are required.');
    const c = await access.context(propertyId); return { ...c, listingId };
  };
  const assertContext = async (c: PublicationContext) => {
    try { await access.assertContext(c); } catch (error) {
      if ((error as { kind?: string })?.kind === 'identity') throw new PublicationError('Your account or property access changed. Reopen the listing.', 'identity');
      throw new PublicationError('Could not check property access. Try checking status again.');
    }
  };
  const read = async (c: PublicationContext, stage: 'preflight-read' | 'post-rpc-read' | 'status-read' = 'status-read', rpcSent = false, accessAlreadyChecked = false): Promise<PublicationListing> => {
    try {
    if(!accessAlreadyChecked)await assertContext(c);
    const { data, error } = await measureHydration('listing',()=>getClient().from('listings').select('*').eq('id', c.listingId).eq('landlord_id', c.userId).eq('property_id', c.propertyId).maybeSingle());
    await assertContext(c);
    if (error) { diagnose(publicationDiagnostic(stage,error,rpcSent)); throw new PublicationError(stage === 'preflight-read' ? 'Could not verify the listing before publication. Check your connection or listing access and try again.' : 'Could not read publication status. Check your connection or listing access and try checking status again.', 'read'); }
    if (!data || data.id !== c.listingId || data.property_id !== c.propertyId || data.landlord_id !== c.userId) throw new PublicationError('The owned listing could not be found. Check your access.', 'identity');
    return data;
    } catch(error) { if(error instanceof PublicationError) throw error; diagnose(publicationDiagnostic(stage,error,rpcSent)); throw new PublicationError(stage === 'preflight-read' ? 'Could not verify the listing before publication. Check your connection or listing access and try again.' : 'Could not read publication status. Check listing access and try checking status again.','read'); }
  };
  const reconcile = async (c: PublicationContext) => {
    if (publishing.has(pendingKey(c))) throw uncertain();
    const row = await read(c);
    if (row.status === 'active' && !isPublishedListing(row)) throw uncertain();
    if (!isLifecycleStatus(row.status)) throw new PublicationError('The listing has a different backend status. Further changes are unavailable in this phase.', 'uncertain');
    await journal.setItem(pointerKey(c), c.listingId); await journal.removeItem(pendingKey(c)); return row;
  };
  return {
    context, assertContext, read, reconcile,
    async restore(propertyId: string, selectedListingId?: string) {
      const base = await access.context(propertyId);
      const pointer = await journal.getItem(pointerKey(base));
      if (pointer && !isPropertyUuid(pointer)) throw uncertain();
      if (selectedListingId && !isPropertyUuid(selectedListingId)) throw uncertain();
      let id = selectedListingId ?? pointer;
      if (!id) {
        // Narrow property/owner read also recovers active state if local receipts were lost.
        const { data, error } = await getClient().from('listings').select('id').eq('property_id', propertyId).eq('landlord_id', base.userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
        await access.assertContext(base); if (error) { diagnose(publicationDiagnostic('status-read',error,false)); throw new PublicationError('Could not read publication status. Check listing access and try again.','read'); } id = data?.id ?? null;
      }
      if (!id) return null;
      const c = { ...base, listingId: id }; const row = await read(c,'status-read',false,true);
      const pending = !!await journal.getItem(pendingKey(c));
      return { row, pending };
    },
    async publish(c: PublicationContext, form: ListingDraftFields): Promise<PublicationListing> {
      const key = pendingKey(c); if (publishing.has(key)) throw uncertain(); publishing.add(key);
      let sent = false, wrote = false, knownRejection = false;
      try {
        await assertContext(c); if (await journal.getItem(key)) throw uncertain();
        const before = await read(c, 'preflight-read', false);
        if (before.status !== 'draft') throw new PublicationError('Only a draft listing can be published. Check current status.');
        if (!listingFieldsUnchanged(form, before)) throw new PublicationError('Save your listing changes before publishing. The backend draft may have changed.');
        await journal.setItem(pointerKey(c), c.listingId);
        await journal.setItem(key, 'pending'); wrote = true;
        await assertContext(c); sent = true;
        const { data, error } = await getClient().rpc('publish_listing', { p_listing_id: c.listingId });
        if (error) {
          if (/^(22|23|42|P0001)/.test(error.code ?? '')) { diagnose(publicationDiagnostic('rpc',error,true,'rejected')); await journal.removeItem(key); knownRejection = true; throw publicationBackendError(error); }
          diagnose(publicationDiagnostic('rpc',error,true,'transport_unknown')); throw uncertain();
        }
        const receipt = Array.isArray(data) && data.length === 1 ? data[0] : null;
        if (!receipt || receipt.listing_id !== c.listingId || receipt.listing_status !== 'active' || !Number.isFinite(receipt.completeness_score) || receipt.completeness_score < 0.80 || !receipt.published_at || !Number.isFinite(Date.parse(receipt.published_at)) || !Number.isFinite(Date.parse(receipt.updated_at))) { diagnose(publicationDiagnostic('rpc',null,true,'verification_failed')); throw uncertain(); }
        const row = await read(c, 'post-rpc-read', true); if (!isPublishedListing(row)) { diagnose(publicationDiagnostic('post-rpc-read',null,true,'verification_failed')); throw uncertain(); }
        await journal.removeItem(key); return row;
      } catch (error) {
        if (!sent && wrote) { try { await journal.removeItem(key); } catch { /* Keep marker if cleanup is unknown. */ } }
        if (error instanceof PublicationError && error.kind === 'identity') throw error;
        if (sent && !knownRejection) { if (!(error instanceof PublicationError)) diagnose(publicationDiagnostic('rpc',error,true,'transport_unknown')); if (error instanceof PublicationError && error.kind === 'read') throw new PublicationError('Publication may have succeeded, but its status could not be read. Check publication status before trying again.','uncertain'); throw uncertain(); }
        if (error instanceof PublicationError) throw error;
        diagnose(publicationDiagnostic('journal',error,false,'local_storage')); throw new PublicationError('Publication could not start safely. Check your connection or device storage and try again.');
      } finally { publishing.delete(key); }
    },
  };
}
export type ListingPublicationService = ReturnType<typeof createListingPublicationService>;
