import {disputeMessage, RENT_PAGE, rentErrorText, RentLedgerError, type RentAction, type RentLedger, type RentOperation, type RentRow} from '../models/RentLedger';
import type {RentLedgerService} from '../services/rentLedgerService';

/** Sends one chat message into an existing conversation. Supplied by the hook; the workflow never builds a conversation. */
export interface RentChat {send(conversationId: string, messageId: string, body: string): Promise<void>}
export interface RentChatState {dueDate: string; messageId: string; text: string; error: string | null; sending: boolean}
export interface RentContext {actor: string | undefined; tenancyId: string; conversationId: string | null; counterpart: string}

const initial = () => ({
  ledger: null as RentLedger | null, rows: [] as RentRow[], offset: 0, busy: false, saving: false, ready: false,
  error: null as string | null, notice: null as string | null, pending: null as RentOperation | null,
  dispute: null as {dueDate: string} | null, chat: null as RentChatState | null,
});

/**
 * State and actions for one tenancy's rent ledger. Rules this file keeps:
 * - One operation id per intent. A retry of the same unresolved action reuses it (the server replays the stored result); a new tap after a
 *   success gets a new id. Nothing retries by itself.
 * - What a button may do comes from the row's flags (canMarkPaid, canAcknowledge, canDispute), never from the role alone.
 * - "Not received": the dispute is written first and stands even if the chat message fails. The message is sent only afterwards, with an
 *   id that stays the same across retries, into the tenancy's existing conversation; with no conversation it is skipped.
 */
export function createRentLedgerWorkflow(service: RentLedgerService, chat: RentChat, ctx: RentContext, newId: () => string) {
  let state = initial(), disposed = false, generation = 0, controller: AbortController | null = null;
  let disputeMessageId: {dueDate: string; id: string} | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<typeof state>) => { if (!disposed) { state = {...state, ...patch}; listeners.forEach(fn => fn()); } };

  const read = async (offset: number): Promise<boolean> => {
    if (!ctx.actor || disposed) return false;
    controller?.abort();
    const c = controller = new AbortController(), g = ++generation, timer = setTimeout(() => c.abort(), 20000);
    update({busy: true, error: null, notice: null});
    try {
      const page = await service.read(ctx.actor, ctx.tenancyId, offset, c.signal);
      if (disposed || g !== generation) return false;
      if (offset === 0) update({ledger: page, rows: page.rows, offset: 0, busy: false, ready: true});
      else update({ledger: state.ledger ? {...state.ledger, hasMore: page.hasMore} : page, rows: [...state.rows, ...page.rows.filter(r => !state.rows.some(x => x.dueDate === r.dueDate))], offset, busy: false, ready: true});
      return true;
    } catch (e) {
      if (!disposed && g === generation) update({busy: false, error: e instanceof RentLedgerError ? rentErrorText(e).message : "The rent ledger couldn't load. Check your connection and retry."});
      return false;
    } finally { clearTimeout(timer); }
  };

  /** One write. On a definite refusal the pending operation is dropped and a changed ledger is reloaded; on an unknown outcome it is kept for Retry. */
  const perform = async (op: RentOperation): Promise<boolean> => {
    if (!ctx.actor || disposed) return false;
    controller?.abort();
    const c = controller = new AbortController(), g = ++generation, timer = setTimeout(() => c.abort(), 20000);
    update({saving: true, error: null, notice: null, pending: op});
    try {
      await service.write(ctx.actor, op, c.signal);
      if (disposed || g !== generation) return false;
      update({pending: null, saving: false});
      return true;
    } catch (e) {
      if (disposed || g !== generation) return false;
      const m = rentErrorText(e), uncertain = e instanceof RentLedgerError && e.uncertain;
      if (uncertain || !(e instanceof RentLedgerError)) { update({saving: false, pending: op, error: m.message}); return false; }
      update({saving: false, pending: null, ...(m.reload ? {} : {error: m.message})});
      if (m.reload) { await read(0); update({notice: m.message}); }
      return false;
    } finally { clearTimeout(timer); }
  };

  const doneNotice = (action: RentAction) => action === 'mark_paid' ? `Marked as paid. Waiting for ${ctx.counterpart} to confirm.` : 'Marked as received.';
  const runSimple = async (op: RentOperation) => {
    if (!await perform(op)) return false;
    await read(0);
    update({notice: doneNotice(op.action)});
    return true;
  };

  const sendChat = async (dueDate: string, messageId: string) => {
    if (!ctx.conversationId) { update({notice: 'Marked not received. No chat conversation was found, so no message was sent.'}); return; }
    const text = disputeMessage(dueDate);
    update({chat: {dueDate, messageId, text, error: null, sending: true}});
    try {
      await chat.send(ctx.conversationId, messageId, text);
      update({chat: null, notice: 'Marked not received. Message sent.'});
    } catch {
      update({chat: {dueDate, messageId, text, error: `The message to ${ctx.counterpart} wasn't sent.`, sending: false}, notice: 'Marked not received.'});
    }
  };

  const runDispute = async (op: RentOperation) => {
    if (!disputeMessageId || disputeMessageId.dueDate !== op.dueDate) disputeMessageId = {dueDate: op.dueDate, id: newId()};
    if (!await perform(op)) return false;
    // The dispute is recorded from here on, whatever happens to the chat message.
    const messageId = disputeMessageId.id;
    disputeMessageId = null;
    update({dispute: null});
    await read(0);
    await sendChat(op.dueDate, messageId);
    return true;
  };

  const busyNow = () => disposed || !ctx.actor || state.saving || state.busy || !state.ready || !state.ledger;
  const rowFor = (dueDate: string) => state.rows.find(r => r.dueDate === dueDate);

  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getSnapshot: () => state,
    activate() { disposed = false; },
    dispose() { disposed = true; generation++; controller?.abort(); state = initial(); },
    load() { if (state.saving || state.busy) return Promise.resolve(false); return read(0); },
    older() { if (!state.ledger?.hasMore || state.busy || state.saving) return Promise.resolve(false); return read(state.offset + RENT_PAGE); },
    /** "I've paid" and "Mark received". Disputes go through openDispute / confirmDispute. */
    async act(action: 'mark_paid' | 'acknowledge', dueDate: string): Promise<boolean> {
      if (busyNow()) return false;
      if (state.pending && !(state.pending.action === action && state.pending.dueDate === dueDate)) return false;
      const row = rowFor(dueDate);
      if (!row || !(action === 'mark_paid' ? row.canMarkPaid : row.canAcknowledge)) return false;
      const op = state.pending ?? {tenancyId: ctx.tenancyId, operationId: newId(), action, dueDate, revision: row.revision};
      return runSimple(op);
    },
    openDispute(dueDate: string) {
      if (busyNow() || (state.pending && !(state.pending.action === 'dispute' && state.pending.dueDate === dueDate))) return;
      const row = rowFor(dueDate);
      if (!row || !row.canDispute) return;
      update({dispute: {dueDate}, error: null, notice: null});
    },
    closeDispute() { if (!state.saving) update({dispute: null, ...(state.pending?.action === 'dispute' ? {} : {error: null})}); },
    async confirmDispute(): Promise<boolean> {
      const d = state.dispute;
      if (!d || busyNow()) return false;
      const row = rowFor(d.dueDate);
      const reuse = state.pending && state.pending.action === 'dispute' && state.pending.dueDate === d.dueDate ? state.pending : null;
      if (!reuse && (!row || !row.canDispute)) return false;
      return runDispute(reuse ?? {tenancyId: ctx.tenancyId, operationId: newId(), action: 'dispute', dueDate: d.dueDate, revision: row!.revision});
    },
    /** Retries only the unresolved write (same operation id). A dispute that stood but whose chat message failed is retried with retryChat. */
    async retry(): Promise<boolean> {
      const op = state.pending;
      if (!op || state.saving || state.busy || disposed) return false;
      return op.action === 'dispute' ? runDispute(op) : runSimple(op);
    },
    async retryChat(): Promise<void> {
      const c = state.chat;
      if (!c || c.sending || !c.error || !ctx.conversationId || disposed) return;
      update({chat: {...c, error: null, sending: true}});
      try { await chat.send(ctx.conversationId, c.messageId, c.text); update({chat: null, notice: 'Message sent.'}); }
      catch { update({chat: {...c, error: `The message to ${ctx.counterpart} wasn't sent.`, sending: false}}); }
    },
  };
}
export type RentLedgerWorkflow = ReturnType<typeof createRentLedgerWorkflow>;
