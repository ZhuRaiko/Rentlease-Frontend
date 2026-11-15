import {hasModelAttributes,propertyModelAttributes} from '../models/PropertyModelAttributes';
import { PropertyCreationError, propertyCreationBackendError } from '../models/PropertyCreationError';
import { propertyCreationDiagnostic, tracePropertyCreationDiagnostic, type PropertyCreationDiagnostic } from './propertyCreationDiagnostics';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { isPropertyUuid, propertySetupPayload, type PropertyCreationInput } from '../models/DraftProperty';
export interface PropertyCreationJournal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export type PropertyCreationReceipt = { propertyId: string; status: 'created' };
// One create per account at a time. A second call while one runs shares it: it never starts another and never reports an unknown outcome by itself.
const inflight = new Map<string, Promise<PropertyCreationReceipt>>();
/** Device and server clocks differ: a property created this long before the marker time still counts as possibly this save. */
export const CLOCK_SLACK_MS = 5 * 60_000;
/** A marker younger than this is not cleared on "nothing found": the save may still be landing. The person waits and checks again. */
export const YOUNG_MARKER_MS = 2 * 60_000;
export type OwnedProperty = { id: string; landlord_id: string; property_type: string; city: string; barangay: string; created_at: string };
/** `since` is the time on the pending marker (null for an older marker without one); `recent` holds the properties found for it. */
export type UncertainDetail = { since?: number | null; recent?: OwnedProperty[]; /** a young marker and nothing found yet: still confirming, not a failure */ confirming?: boolean };
const uncertain = (detail: UncertainDetail = {}) => Object.assign(new Error('Property creation needs reconciliation.'), { code: 'property_creation_uncertain' }, detail);
export function createPropertyCreationService(getClient: () => SupabaseClient<Database>, journal: PropertyCreationJournal, diagnose: (event:PropertyCreationDiagnostic)=>void = tracePropertyCreationDiagnostic, now: () => number = Date.now) {
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
  /** True while a marker time is recent enough that an empty result proves nothing yet. A time in the future (a clock that moved) is not young. */
  const markerIsYoung = (since: number | null | undefined): boolean => { if (typeof since !== 'number' || !Number.isFinite(since)) return false; const age = now() - since; return age >= 0 && age < YOUNG_MARKER_MS; };
  /** The properties this landlord owns, newest first. With `since` (a marker time) only those created after it, minus the clock slack. Existing read access only. */
  const recentOwned = async (userId: string, since?: number | null): Promise<OwnedProperty[]> => {
    await assertIdentity(userId);
    let query = getClient().from('properties').select('id,landlord_id,property_type,city,barangay,created_at').eq('landlord_id', userId);
    if (typeof since === 'number' && Number.isFinite(since)) query = query.gte('created_at', new Date(since - CLOCK_SLACK_MS).toISOString());
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10);
    await assertIdentity(userId); if (error) throw new Error('Could not check owned properties.');
    return (data ?? []).filter(row => row.landlord_id === userId) as OwnedProperty[];
  };
  // Reads the marker. A receipt is verified on the server. A pending marker with a time is checked against the properties created since: none means
  // the interrupted save never reached the server (the marker is cleared); some means the person must say which one is theirs. A marker without a
  // time (written by an older version) cannot be checked, so it stays a recovery state the person resolves. Nothing here ever creates.
  const readMarker = async (userId: string): Promise<PropertyCreationReceipt | null> => {
    await assertIdentity(userId);
    const stored = await journal.getItem(key(userId));
    if (!stored) return null;
    let value: unknown;
    try { value = JSON.parse(stored); } catch { throw uncertain({ since: null }); }
    if (!value || typeof value !== 'object') throw uncertain({ since: null });
    if (!('propertyId' in value) || !isPropertyUuid(value.propertyId)) {
      const at = (value as { at?: unknown }).at;
      if (typeof at !== 'number' || !Number.isFinite(at)) throw uncertain({ since: null });
      const recent = await recentOwned(userId, at);
      if (!recent.length) {
        if (markerIsYoung(at)) throw uncertain({ since: at, recent: [], confirming: true });
        await journal.removeItem(key(userId)); return null;
      }
      throw uncertain({ since: at, recent });
    }
    const { data, error } = await getClient().from('properties').select('id,landlord_id').eq('id', value.propertyId).eq('landlord_id', userId).maybeSingle();
    await assertIdentity(userId);
    if (error || !data || data.landlord_id !== userId || data.id !== value.propertyId) throw uncertain();
    return { propertyId: data.id, status: 'created' };
  };
  // Public: never reads a marker this process is still writing. It waits for the running create, then reads what that left behind.
  const restore = async (userId: string): Promise<PropertyCreationReceipt | null> => {
    const running = inflight.get(userId);
    if (running) { try { await running; } catch { /* whatever it left is read below */ } }
    return readMarker(userId);
  };
  const createOnce = async (userId: string, draft: PropertyCreationInput, payload: ReturnType<typeof propertySetupPayload>): Promise<PropertyCreationReceipt> => {
    let sent = false, journalWritten = false, markerAt: number | null = null;
    let stage:PropertyCreationDiagnostic['stage']='eligibility';
    try {
      await assertIdentity(userId);
      const existing = await readMarker(userId); if (existing) return existing;
      // Persist BEFORE sending, with the time; unknown outcomes stay blocked across unmount/restart until checked against the server.
      markerAt = now();
      stage='journal'; await journal.setItem(key(userId), JSON.stringify({ state: 'pending', at: markerAt })); journalWritten = true;
      stage='eligibility'; await assertIdentity(userId); stage='rpc'; sent = true;
      const { data, error } = hasModelAttributes(draft)?await getClient().rpc('create_property_setup_v2',{...payload,...propertyModelAttributes(draft.propertyType,draft)}):await getClient().rpc('create_property_setup', payload);
      if(error?.code==='PGRST202'){try{await journal.removeItem(key(userId));}catch{/* Preserve uncertainty if cleanup fails. */}
        throw new PropertyCreationError('This feature is not available right now. Try again later. Your property has not been created.','property_creation_rejected');}
      if (error) {
        // PostgreSQL validation/authorization/constraint failures are rolled back.
        if (/^(22|23|42|P0001$)/.test(error.code ?? '')) {
          diagnose(propertyCreationDiagnostic('rpc',error,true,error.code==='42501'?'backend_permission':'rejected'));
          // A known database rejection rolled back; retain a marker if local cleanup fails.
          try { await journal.removeItem(key(userId)); } catch { diagnose(propertyCreationDiagnostic('journal',null,true,'local_storage')); }
          throw propertyCreationBackendError(error);
        }
        diagnose(propertyCreationDiagnostic('rpc',error,true,'transport_unknown')); throw uncertain({ since: markerAt });
      }
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.status !== 'created' || !isPropertyUuid(data.property_id)) { diagnose(propertyCreationDiagnostic('receipt',null,true,'receipt_invalid')); throw uncertain({ since: markerAt }); }
      stage='receipt'; const receipt = { propertyId: data.property_id, status: 'created' as const };
      stage='journal'; await journal.setItem(key(userId), JSON.stringify(receipt));
      stage='eligibility'; await assertIdentity(userId);
      return receipt;
    } catch (error) {
      if (!sent && journalWritten) { try { await journal.removeItem(key(userId)); } catch { /* Keep the marker if cleanup cannot be confirmed. */ } }
      if (sent && (error as { code?: string })?.code !== 'property_creation_rejected' && (error as { code?: string })?.code !== 'property_identity_changed') { if ((error as {code?:string})?.code !== 'property_creation_uncertain') diagnose(propertyCreationDiagnostic(stage,error,true,stage==='journal'?'local_storage':'transport_unknown')); throw uncertain({ since: markerAt }); }
      if (!(error instanceof PropertyCreationError) && !sent && (error as {code?:string})?.code !== 'property_creation_uncertain' && (error as {code?:string})?.code !== 'property_identity_changed') { diagnose(propertyCreationDiagnostic(stage,error,false,stage==='journal'?'local_storage':'read_failed')); throw new PropertyCreationError('Could not verify your account or device storage. Check your connection and try again.','property_creation_preflight'); }
      throw error;
    }
  };
  return {
    getEligibleUserId, assertIdentity, restore, recentOwned, markerIsYoung,
    /** The person chose "None of these, start fresh": forget the unconfirmed save. Properties already on the server are not touched. */
    async discardMarker(userId: string) { await assertIdentity(userId); await journal.removeItem(key(userId)); },
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
      if (inflight.has(userId)) throw new PropertyCreationError('A property is still being saved. Try again in a moment.', 'property_creation_preflight');
      if (await readMarker(userId)) await journal.removeItem(key(userId));
      await assertIdentity(userId);
    },
    async create(userId: string, draft: PropertyCreationInput): Promise<PropertyCreationReceipt> {
      let payload: ReturnType<typeof propertySetupPayload>;
      try { payload = propertySetupPayload(draft); } catch(error) { diagnose(propertyCreationDiagnostic('validation',null,false,'validation')); throw new PropertyCreationError(error instanceof Error ? error.message : 'Check the required property fields.','property_creation_preflight'); }
      // A duplicate press shares the running call: one save, one result, never an unknown outcome made up by the second press.
      const running = inflight.get(userId); if (running) return running;
      const run = createOnce(userId, draft, payload);
      inflight.set(userId, run);
      try { return await run; } finally { inflight.delete(userId); }
    },
  };
}
export type PropertyCreationService = ReturnType<typeof createPropertyCreationService>;
