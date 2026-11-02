import { PropertyCreationError, propertyCreationBackendError } from '../models/PropertyCreationError';
import { propertyCreationDiagnostic, tracePropertyCreationDiagnostic, type PropertyCreationDiagnostic } from './propertyCreationDiagnostics';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid, propertySetupPayload, type PropertyCreationInput } from '../models/DraftProperty';
export interface PropertyCreationJournal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export type PropertyCreationReceipt = { propertyId: string; status: 'created' };
const creating = new Set<string>();
const uncertain = () => Object.assign(new Error('Property creation needs reconciliation.'), { code: 'property_creation_uncertain' });
export function createPropertyCreationService(getClient: () => SupabaseClient<Database>, journal: PropertyCreationJournal, diagnose: (event:PropertyCreationDiagnostic)=>void = tracePropertyCreationDiagnostic) {
  const key = (userId: string) => `rentlease:property-creation:${userId}`;
  const getEligibleUserId = async () => {
    const client = getClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) { diagnose(propertyCreationDiagnostic('eligibility',error,false,'authentication')); throw new PropertyCreationError('Sign in to add a property.','property_creation_preflight'); }
    const id = data.user.id;
    const { data: profile, error: profileError } = await client.from('profiles').select('account_status,tier1_verified_at').eq('id', id).maybeSingle();
    if (profileError) { const error=profileError; diagnose(propertyCreationDiagnostic('eligibility',error,false,error?.code==='42501'?'backend_permission':'read_failed')); throw new PropertyCreationError('Could not verify your account access. Check your connection and try again.','property_creation_preflight'); }
    const eligibility = profile?.account_status !== 'active' ? ['account','An active account is required to add a property.'] : !profile.tier1_verified_at ? ['tier1','Complete Tier 1 account verification before adding a property.'] : null;
    if (eligibility) { diagnose(propertyCreationDiagnostic('eligibility',null,false,eligibility[0] as 'account'|'tier1'|'role')); throw new PropertyCreationError(eligibility[1]!, 'property_creation_preflight'); }
    const { data: current, error: currentError } = await client.auth.getUser();
    if (currentError || current.user?.id !== id) throw Object.assign(new Error('Account changed.'), { code: 'property_identity_changed' });
    return id;
  };
  const assertIdentity = async (userId: string) => {
    if (await getEligibleUserId() !== userId) throw Object.assign(new Error('Account changed.'), { code: 'property_identity_changed' });
  };
  const restore = async (userId: string): Promise<PropertyCreationReceipt | null> => {
    await assertIdentity(userId);
    const stored = await journal.getItem(key(userId));
    if (!stored) return null;
    let value: unknown;
    try { value = JSON.parse(stored); } catch { throw uncertain(); }
    if (!value || typeof value !== 'object' || !('propertyId' in value) || !isPropertyUuid(value.propertyId)) throw uncertain();
    const { data, error } = await getClient().from('properties').select('id,landlord_id').eq('id', value.propertyId).eq('landlord_id', userId).maybeSingle();
    await assertIdentity(userId);
    if (error || !data || data.landlord_id !== userId || data.id !== value.propertyId) throw uncertain();
    return { propertyId: data.id, status: 'created' };
  };
  return {
    getEligibleUserId, assertIdentity, restore,
    async recentOwned(userId: string) {
      await assertIdentity(userId);
      const { data, error } = await getClient().from('properties').select('id,landlord_id,property_type,city,barangay,created_at').eq('landlord_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10);
      await assertIdentity(userId); if (error) throw new Error('Could not check owned properties.');
      return (data ?? []).filter(row => row.landlord_id === userId);
    },
    async confirmOwned(userId: string, propertyId: string): Promise<PropertyCreationReceipt> {
      await assertIdentity(userId);
      if (!isPropertyUuid(propertyId)) throw new Error('Invalid property.');
      const { data, error } = await getClient().from('properties').select('id,landlord_id').eq('id', propertyId).eq('landlord_id', userId).maybeSingle();
      await assertIdentity(userId);
      if (error || !data || data.landlord_id !== userId || data.id !== propertyId) throw new Error('Property ownership could not be confirmed.');
      const receipt = { propertyId: data.id, status: 'created' as const };
      await journal.setItem(key(userId), JSON.stringify(receipt)); return receipt;
    },
    async beginNew(userId: string) {
      if (creating.has(userId)) throw uncertain();
      if (await restore(userId)) await journal.removeItem(key(userId));
      await assertIdentity(userId);
    },
    async create(userId: string, draft: PropertyCreationInput): Promise<PropertyCreationReceipt> {
      let payload: ReturnType<typeof propertySetupPayload>;
      try { payload = propertySetupPayload(draft); } catch(error) { diagnose(propertyCreationDiagnostic('validation',null,false,'validation')); throw new PropertyCreationError(error instanceof Error ? error.message : 'Check the required property fields.','property_creation_preflight'); }
      if (creating.has(userId)) throw uncertain();
      creating.add(userId);
      let sent = false, journalWritten = false;
      let stage:PropertyCreationDiagnostic['stage']='eligibility';
      try {
        await assertIdentity(userId);
        const existing = await restore(userId); if (existing) return existing;
        // Persist BEFORE sending; unknown outcomes stay blocked across unmount/restart.
        stage='journal'; await journal.setItem(key(userId), JSON.stringify({ state: 'pending' })); journalWritten = true;
        stage='eligibility'; await assertIdentity(userId); stage='rpc'; sent = true;
        const { data, error } = await getClient().rpc('create_property_setup', payload);
        if (error) {
          // PostgreSQL validation/authorization/constraint failures are rolled back.
          if (/^(22|23|42|P0001$)/.test(error.code ?? '')) {
            diagnose(propertyCreationDiagnostic('rpc',error,true,error.code==='42501'?'backend_permission':'rejected'));
            // A known database rejection rolled back; retain a marker if local cleanup fails.
            try { await journal.removeItem(key(userId)); } catch { diagnose(propertyCreationDiagnostic('journal',null,true,'local_storage')); }
            throw propertyCreationBackendError(error);
          }
          diagnose(propertyCreationDiagnostic('rpc',error,true,'transport_unknown')); throw uncertain();
        }
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.status !== 'created' || !isPropertyUuid(data.property_id)) { diagnose(propertyCreationDiagnostic('receipt',null,true,'receipt_invalid')); throw uncertain(); }
        stage='receipt'; const receipt = { propertyId: data.property_id, status: 'created' as const };
        stage='journal'; await journal.setItem(key(userId), JSON.stringify(receipt));
        stage='eligibility'; await assertIdentity(userId);
        return receipt;
      } catch (error) {
        if (!sent && journalWritten) { try { await journal.removeItem(key(userId)); } catch { /* Keep the marker if cleanup cannot be confirmed. */ } }
        if (sent && (error as { code?: string })?.code !== 'property_creation_rejected' && (error as { code?: string })?.code !== 'property_identity_changed') { if ((error as {code?:string})?.code !== 'property_creation_uncertain') diagnose(propertyCreationDiagnostic(stage,error,true,stage==='journal'?'local_storage':'transport_unknown')); throw uncertain(); }
        if (!(error instanceof PropertyCreationError) && !sent && (error as {code?:string})?.code !== 'property_creation_uncertain' && (error as {code?:string})?.code !== 'property_identity_changed') { diagnose(propertyCreationDiagnostic(stage,error,false,stage==='journal'?'local_storage':'read_failed')); throw new PropertyCreationError('Could not verify your account or device storage. Check your connection and try again.','property_creation_preflight'); }
        throw error;
      } finally { creating.delete(userId); }
    },
  };
}
export type PropertyCreationService = ReturnType<typeof createPropertyCreationService>;
