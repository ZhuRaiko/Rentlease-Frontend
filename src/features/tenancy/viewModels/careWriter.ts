import {CareError, validateCareOperation, type CareAction, type CareOperation} from '../models/TenancyCare';
import type {TenancyCareService} from '../services/tenancyCareService';
import type {CareJournal} from '../services/tenancyCareJournal';

export interface WriterState {saving: boolean; pending: CareOperation | null; error: string | null}

/**
 * One write at a time with one operation id per intent: the id is saved before sending, reused when the outcome is unknown (Retry),
 * and dropped once the result is known. A definite refusal is reported in plain words; when the screen is stale (40001) or the
 * request was already updated (22023) the caller reloads.
 */
export function createCareWriter(
  service: TenancyCareService, journal: CareJournal, actor: string | undefined, newId: () => string,
  hooks: {changed: () => void; done: (op: CareOperation, result: unknown) => Promise<void> | void; refused: (e: CareError) => Promise<void> | void},
) {
  let state: WriterState = {saving: false, pending: null, error: null}, disposed = false, controller: AbortController | null = null, generation = 0;
  const set = (p: Partial<WriterState>) => {if (disposed) return; state = {...state, ...p}; hooks.changed();};
  const writer = {
    get: () => state,
    dispose() {disposed = true; generation++; controller?.abort();},
    /** Restore an unconfirmed operation saved for this tenancy (after the app was closed). */
    async recover(tenancyId: string, accept: (op: CareOperation) => boolean) {
      if (!actor) return;
      try {const op = await journal.read(actor, tenancyId); if (op && accept(op)) set({pending: op});}
      catch (e) {set({error: e instanceof CareError ? e.message : 'A saved action could not be read.'});}
    },
    async run(tenancyId: string, action: CareAction, payload: Record<string, string>) {
      if (!actor || disposed || state.saving) return;
      let op = state.pending;
      if (!op) {
        op = {operationId: newId(), action, payload: {...payload}, tenancyId};
        try {validateCareOperation(op);} catch (e) {set({error: e instanceof Error ? e.message : 'Check the fields.'}); return;}
      } else if (op.action !== action || JSON.stringify(op.payload) !== JSON.stringify(payload)) {
        set({error: 'An earlier action still needs to be confirmed. Retry it first.'}); return;
      }
      const input = op, c = controller = new AbortController(), g = ++generation, timer = setTimeout(() => c.abort(), 15000);
      let sent = false;
      set({saving: true, error: null, pending: input});
      try {
        await journal.save(actor, input); if (disposed || g !== generation || c.signal.aborted) return;
        sent = true; const result = await service.write(actor, input, c.signal); if (disposed || g !== generation || c.signal.aborted) return;
        await journal.clear(actor, tenancyId); if (disposed || g !== generation) return;
        set({saving: false, pending: null}); await hooks.done(input, result);
      } catch (e) {
        if (disposed || g !== generation) return;
        const uncertain = sent && (!(e instanceof CareError) || e.uncertain);
        if (!uncertain) {try {await journal.clear(actor, tenancyId);} catch {set({saving: false, error: 'Recovery record could not be cleared. Retry.'}); return;}}
        const message = e instanceof CareError ? e.message : sent ? 'Outcome not confirmed. Retry.' : 'Could not save the action to send. Nothing was sent.';
        set({saving: false, pending: uncertain ? input : null, error: message});
        if (e instanceof CareError && !uncertain) await hooks.refused(e);
      } finally {clearTimeout(timer); if (!disposed && g === generation && state.saving) set({saving: false});}
    },
    /** Send the unconfirmed operation again, unchanged (same operation id). */
    retry() {const op = state.pending; return op ? writer.run(op.tenancyId, op.action, op.payload) : Promise.resolve();},
  };
  return writer;
}
