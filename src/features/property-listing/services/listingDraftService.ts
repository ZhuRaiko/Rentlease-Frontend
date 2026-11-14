import { measureHydration } from './draftHydrationDiagnostics';
import { draftSaveDiagnostic, traceDraftSaveDiagnostic, type DraftSaveDiagnostic } from './listingDraftDiagnostics';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid } from '../models/DraftProperty';
import { isRemovedPropertyMessage, REMOVED_PROPERTY_OWNER_MESSAGE } from '../models/ListingPublication';
import { ListingDraftError, listingDraftPayload, type DraftEditTarget, type ListingDraftFields, type SavedListingDraft } from '../models/PersistedListingDraft';
interface Journal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export interface ListingDraftContext { userId: string; propertyId: string }
const saves = new Set<string>();
const columns = 'edit_version,id,property_id,landlord_id,title,description,house_rules,rental_term,asking_rent_monthly,security_deposit_months,advance_rent_months,minimum_stay_months,available_from,status,completeness_score,created_at,updated_at,archived_at,paused_at,published_at,removed_at,removal_reason';
const uncertain = (cause?:unknown) => new ListingDraftError('The save outcome is unknown. Check the current backend draft before saving again.', 'uncertain', {cause});
export function createListingDraftService(getClient: () => SupabaseClient<Database>, journal: Journal, diagnose: (event:DraftSaveDiagnostic)=>void = traceDraftSaveDiagnostic) {
  const key = (c: ListingDraftContext) => `rentlease:listing-draft-save:${c.userId}:${c.propertyId}`;
  const context = async (propertyId: string): Promise<ListingDraftContext> => {
    if (!isPropertyUuid(propertyId)) throw new ListingDraftError('A saved physical property is required.');
    const client = getClient(); const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new ListingDraftError('Sign in to manage a listing draft.', 'identity');
    const userId = data.user.id;
    const { data: property, error: propertyError } = await measureHydration('property',()=>client.from('properties').select('id,landlord_id,is_active').eq('id', propertyId).eq('landlord_id', userId).eq('is_active', true).maybeSingle());
    if (propertyError) throw new ListingDraftError('Could not check the property. Try loading again.', 'rejected', {cause:propertyError});
    if (!property || property.landlord_id !== userId || !property.is_active) throw new ListingDraftError('An active property owned by your account is required.', 'identity');
    const { data: current, error: currentError } = await client.auth.getUser();
    if (currentError || current.user?.id !== userId) throw new ListingDraftError('Your account changed. Reopen the listing.', 'identity');
    return { userId, propertyId };
  };
  const assertContext = async (c: ListingDraftContext) => {
    const current = await context(c.propertyId);
    if (current.userId !== c.userId) throw new ListingDraftError('Your account changed. Reopen the listing.', 'identity');
  };
  const read = async (c: ListingDraftContext, selectedListingId?: string, allowNonDraft=false): Promise<SavedListingDraft | null> => {
    await assertContext(c);
    let query = getClient().from('listings').select(columns).eq('property_id', c.propertyId).eq('landlord_id', c.userId);
    if(!allowNonDraft)query=query.eq('status','draft');
    if (selectedListingId) { if (!isPropertyUuid(selectedListingId)) throw new ListingDraftError('Invalid listing selection.'); query = query.eq('id', selectedListingId); }
    const { data, error } = await measureHydration('listing',()=>query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle());
    await assertContext(c);
    if(error && (error.code==='42703'||error.code==='PGRST204'))throw new ListingDraftError('This feature is not available right now. Try again later.','rejected',{cause:error});
    if (error) throw new ListingDraftError('Could not load the current listing draft. Check your connection.', 'rejected', {cause:error});
    if (selectedListingId && (!data || data.id !== selectedListingId)) throw new ListingDraftError('The selected draft is no longer available. Refresh My Rentals before continuing.');
    if (data && (!isPropertyUuid(data.id) || data.property_id !== c.propertyId || data.landlord_id !== c.userId || (!allowNonDraft && data.status !== 'draft'))) throw new ListingDraftError('The returned listing draft could not be verified.');
    return data;
  };
  return {
    context, assertContext, read,
    hasPending: async (c: ListingDraftContext) => !!await journal.getItem(key(c)),
    async save(c: ListingDraftContext, form: ListingDraftFields, target?:DraftEditTarget): Promise<SavedListingDraft> {
      const payload = listingDraftPayload(c.propertyId, form), k = key(c);
      if(target && (!isPropertyUuid(target.listingId)||!isPropertyUuid(target.editVersion)))throw new ListingDraftError('This feature is not available right now. Try again later. No replacement draft was created.');
      if (saves.has(k)) throw uncertain(); saves.add(k);
      let sent = false, pendingWritten = false, knownRejection = false;
      let stage:DraftSaveDiagnostic['stage']='preflight';
      let backendError:unknown;
      try {
        await assertContext(c); if (await journal.getItem(k)) throw uncertain();
        if(target){const before=await read(c,target.listingId,true);if(before?.status!=='draft'||before.edit_version!==target.editVersion)throw new ListingDraftError('This draft changed or was published elsewhere. Your edits are kept. Load the latest saved version before saving again.','conflict');}
        // Only an operation marker is persisted, not title/description or credentials.
        await journal.setItem(k, JSON.stringify(target?{listingId:target.listingId,mode:'update'}:{mode:'create'})); pendingWritten = true;
        await assertContext(c); stage='rpc'; sent = true;
        const {p_property_id: _propertyId,...content}=payload;
        const { data, error } = target
          ? await getClient().rpc('update_listing_draft',{...content,p_listing_id:target.listingId,p_expected_edit_version:target.editVersion})
          : await getClient().rpc('save_listing_draft', payload);
        if (error) {
          backendError=error;
          if(target && error.code==='40001'){await journal.removeItem(k);knownRejection=true;throw new ListingDraftError('This draft changed or was published elsewhere. Your edits are kept. Load the latest saved version before saving again.','conflict',{cause:error});}
          if(error.code==='PGRST202'){await journal.removeItem(k);knownRejection=true;throw new ListingDraftError('This feature is not available right now. Try again later. No replacement draft was created.','rejected',{cause:error});}
          if (isRemovedPropertyMessage(error.message)) { await journal.removeItem(k); knownRejection = true; throw new ListingDraftError(REMOVED_PROPERTY_OWNER_MESSAGE, 'rejected', {cause:error}); }
          if (/^(22|23|42|25|40)/.test(error.code ?? '')) { await journal.removeItem(k); knownRejection = true; throw new ListingDraftError('The draft was rejected. Check property access and listing fields.', 'rejected', {cause:error}); }
          throw uncertain();
        }
        stage='receipt';
        const receipt = Array.isArray(data) && data.length === 1 ? data[0] : null;
        if (!receipt || (target && (receipt.listing_id!==target.listingId || !('edit_version' in receipt) || !isPropertyUuid(receipt.edit_version))) || !isPropertyUuid(receipt.listing_id) || receipt.listing_status !== 'draft' || !Number.isFinite(receipt.completeness_score) || !Number.isFinite(Date.parse(receipt.created_at)) || !Number.isFinite(Date.parse(receipt.updated_at))) throw uncertain();
        stage='reload';
        const row = await read(c,receipt.listing_id); if (!row || row.id !== receipt.listing_id || (target && row.edit_version!==('edit_version' in receipt?receipt.edit_version:null))) throw uncertain();
        await assertContext(c); await journal.removeItem(k); return row;
      } catch (error) {
        const cause=backendError??(error instanceof Error && error.cause ? error.cause : error);
        try { diagnose(draftSaveDiagnostic(stage,cause,sent,knownRejection,target?'update_listing_draft':'save_listing_draft')); } catch { /* Diagnostics cannot affect saving. */ }
        if (!sent && pendingWritten) { try { await journal.removeItem(k); } catch { /* Keep pending if cleanup cannot be confirmed. */ } }
        if (error instanceof ListingDraftError && error.kind === 'identity') throw error;
        if (sent && !knownRejection) throw uncertain(cause);
        if (error instanceof ListingDraftError) throw error;
        throw new ListingDraftError('The save could not start safely. Try again after checking your connection.');
      } finally { saves.delete(k); }
    },
    async reconcile(c: ListingDraftContext, selectedListingId?:string): Promise<SavedListingDraft> {
      if (saves.has(key(c))) throw uncertain();
      const marker=await journal.getItem(key(c));
      let pendingId:string|undefined;
      if(marker && marker!=='pending'){try{const parsed=JSON.parse(marker);if(parsed.mode==='update'){if(!isPropertyUuid(parsed.listingId))throw Error();pendingId=parsed.listingId;}else if(parsed.mode!=='create')throw Error();}catch{throw uncertain();}}
      if(pendingId&&selectedListingId&&pendingId!==selectedListingId)throw new ListingDraftError('Another draft for this property has an unresolved save. Reopen that draft to check its status.','uncertain');
      const row = await read(c,pendingId??selectedListingId,true); if (!row) throw uncertain();
      // This confirms CURRENT backend state, not that the timed-out payload was applied.
      await assertContext(c); await journal.removeItem(key(c)); return row;
    },
  };
}
export type ListingDraftService = ReturnType<typeof createListingDraftService>;
