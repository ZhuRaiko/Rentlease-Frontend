import { readSessionUser } from '../../../shared/services/supabase/sessionUser';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {parseRentLedger, parseRentWrite, RentLedgerError, validateRentOperation, type RentLedger, type RentOperation, type RentWriteResult} from '../models/RentLedger';

/** SQLSTATEs the ledger functions raise on purpose. Anything else is treated as "may or may not have happened". */
const DEFINITE = ['42501', '22023', '40001', '25001', 'PGRST202'];
type Failure = {code?: string | null; message?: string | null} | null;

/**
 * get_rent_ledger and write_rent_ledger, nothing else. Identity is rechecked around every call. Reads fail with a plain error; a write
 * that fails without a definite server answer is reported as uncertain so the caller retries the SAME operation id (the server replays it).
 */
export function createRentLedgerService(client: () => SupabaseClient<Database>) {
  // `read` = a get_ read: the local session is enough. Every write keeps the network check.
  const identity = async (actor: string, signal: AbortSignal, read = false) => {
    const {data, error} = await (read ? readSessionUser(client()) : client().auth.getUser());
    if (error || data.user?.id !== actor || signal.aborted) throw new RentLedgerError('Your account changed or the request was canceled. Reopen the rent ledger.', null, false);
  };
  const definite = (e: Failure) => new RentLedgerError(e?.message ?? '', e?.code ?? null, false);
  return {
    async read(actor: string, tenancyId: string, offset: number, signal: AbortSignal): Promise<RentLedger> {
      await identity(actor, signal, true);
      let result;
      try { result = await client().rpc('get_rent_ledger', {p_tenancy_id: tenancyId, p_offset: offset}).abortSignal(signal); }
      catch { throw new RentLedgerError('The rent ledger could not load. Check your connection and retry.'); }
      await identity(actor, signal, true);
      if (result.error) {
        if (result.error.code === 'PGRST202') throw definite(result.error);
        if (DEFINITE.includes(result.error.code)) throw new RentLedgerError(result.error.code === '42501' ? "This isn't available right now." : 'The rent ledger could not load. Retry.', result.error.code);
        throw new RentLedgerError('The rent ledger could not load. Check your connection and retry.');
      }
      return parseRentLedger(result.data, actor, tenancyId);
    },
    async write(actor: string, op: RentOperation, signal: AbortSignal): Promise<RentWriteResult> {
      validateRentOperation(op);
      await identity(actor, signal);
      let result;
      try {
        result = await client().rpc('write_rent_ledger', {p_tenancy_id: op.tenancyId, p_operation_id: op.operationId, p_action: op.action, p_due_date: op.dueDate, ...(op.revision ? {p_revision: op.revision} : {})}).abortSignal(signal);
      } catch { throw new RentLedgerError('Outcome not confirmed. Retry the same action.', null, true); }
      if (signal.aborted) throw new RentLedgerError('Outcome not confirmed. Retry the same action.', null, true);
      if (result.error) {
        if (DEFINITE.includes(result.error.code)) throw definite(result.error);
        throw new RentLedgerError('Outcome not confirmed. Retry the same action.', null, true);
      }
      try { await identity(actor, signal); } catch { throw new RentLedgerError('Outcome not confirmed for this account. Reopen the rent ledger.', null, true); }
      return parseRentWrite(result.data, op);
    },
  };
}
export type RentLedgerService = ReturnType<typeof createRentLedgerService>;
