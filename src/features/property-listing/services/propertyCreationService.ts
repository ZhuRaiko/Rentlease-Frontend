import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid, propertySetupPayload, type PropertyCreationInput } from '../models/DraftProperty';
export interface PropertyCreationJournal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export type PropertyCreationReceipt = { propertyId: string; status: 'created' };
const creating = new Set<string>();
const uncertain = () => Object.assign(new Error('Property creation needs reconciliation.'), { code: 'property_creation_uncertain' });
export function createPropertyCreationService(getClient: () => SupabaseClient<Database>, journal: PropertyCreationJournal) {
  const key = (userId: string) => `rentlease:property-creation:${userId}`;
  const getEligibleUserId = async () => {
    const client = getClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error('Sign in to add a property.');
    const id = data.user.id;
    const { data: profile, error: profileError } = await client.from('profiles').select('account_status,tier1_verified_at').eq('id', id).maybeSingle();
    const { data: roles, error: rolesError } = await client.from('user_roles').select('role').eq('user_id', id);
    if (profileError || rolesError || profile?.account_status !== 'active' || !profile.tier1_verified_at || !roles?.some(row => row.role === 'landlord')) throw new Error('An active Tier 1-verified Landlord account is required.');
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
      const payload = propertySetupPayload(draft);
      if (creating.has(userId)) throw uncertain();
      creating.add(userId);
      let sent = false, journalWritten = false;
      try {
        await assertIdentity(userId);
        const existing = await restore(userId); if (existing) return existing;
        // Persist BEFORE sending; unknown outcomes stay blocked across unmount/restart.
        await journal.setItem(key(userId), JSON.stringify({ state: 'pending' })); journalWritten = true;
        await assertIdentity(userId); sent = true;
        const { data, error } = await getClient().rpc('create_property_setup', payload);
        if (error) {
          // PostgreSQL validation/authorization/constraint failures are rolled back.
          if (/^(22|23|42)/.test(error.code ?? '')) { await journal.removeItem(key(userId)); throw Object.assign(new Error('Property details or account permissions were rejected.'), { code: 'property_creation_rejected' }); }
          throw uncertain();
        }
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.status !== 'created' || !isPropertyUuid(data.property_id)) throw uncertain();
        const receipt = { propertyId: data.property_id, status: 'created' as const };
        await journal.setItem(key(userId), JSON.stringify(receipt));
        await assertIdentity(userId);
        return receipt;
      } catch (error) {
        if (!sent && journalWritten) { try { await journal.removeItem(key(userId)); } catch { /* Keep the marker if cleanup cannot be confirmed. */ } }
        if (sent && (error as { code?: string })?.code !== 'property_creation_rejected' && (error as { code?: string })?.code !== 'property_identity_changed') throw uncertain();
        throw error;
      } finally { creating.delete(userId); }
    },
  };
}
export type PropertyCreationService = ReturnType<typeof createPropertyCreationService>;
