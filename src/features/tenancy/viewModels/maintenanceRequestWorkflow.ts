import {CareError, type CareAction, type CareOperation} from '../models/TenancyCare';
import {careActionsFor, defaultNote, statusNote, type RequestRead, type Role} from '../models/Maintenance';
import type {TenancyCareService} from '../services/tenancyCareService';
import type {CareJournal} from '../services/tenancyCareJournal';
import {createCareWriter} from './careWriter';

const MAX_OFFSET = 180;
const initial = () => ({data: null as RequestRead | null, busy: false, error: null as string | null, saving: false, pending: null as CareOperation | null, ready: false});
export type MaintenanceRequestState = ReturnType<typeof initial>;

/** One request and its whole thread (pages are read until done), plus the actions of the person looking at it. */
export function createMaintenanceRequestWorkflow(service: TenancyCareService, journal: CareJournal, actor: string | undefined, requestId: string, newId: () => string) {
  let state = initial(), disposed = false, generation = 0, controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const update = (p: Partial<MaintenanceRequestState>) => {if (!disposed) {state = {...state, ...p}; listeners.forEach(f => f());}};
  const load = async (message?: string) => {
    if (!actor || disposed) return;
    controller?.abort();
    const c = controller = new AbortController(), g = ++generation, timer = setTimeout(() => c.abort(), 15000);
    update({busy: true, error: null, ready: false});
    try {
      let read = await service.request(actor, requestId, 0, c.signal), thread = read.thread, offset = 0;
      while (read.hasMore && offset < MAX_OFFSET) {
        offset += 20;
        const next = await service.request(actor, requestId, offset, c.signal);
        thread = [...thread, ...next.thread]; read = next;
      }
      if (disposed || g !== generation || c.signal.aborted) return;
      const data: RequestRead = {request: read.request, thread, hasMore: false};
      update({data, busy: false, ready: true, error: message ?? null});
      await writer.recover(data.request.tenancyId, op => op.payload.requestId === requestId);
    } catch (e) {
      if (!disposed && g === generation) update({busy: false, error: e instanceof CareError ? e.message : 'This request could not load. Retry.'});
    } finally {clearTimeout(timer);}
  };
  const writer = createCareWriter(service, journal, actor, newId, {
    changed: () => {const w = writer.get(); update({saving: w.saving, pending: w.pending, ...(w.error ? {error: w.error} : {})});},
    done: async () => {await load();},
    refused: async e => {if (e.reload) await load(e.message);},
  });
  /** What this person may do now, from the loaded request. */
  const actions = () => {
    const d = state.data;
    return d ? careActionsFor({role: d.request.role, tenancy: d.request.tenancyEnded ? 'ended' : 'active', status: d.request.status, confirmed: d.request.tenantConfirmedAt !== null}) : null;
  };
  const send = (action: CareAction, payload: Record<string, string>) => {
    const d = state.data;
    if (!d || !state.ready || state.saving) return Promise.resolve();
    return writer.run(d.request.tenancyId, action, {requestId: d.request.id, revision: d.request.revision, ...payload});
  };
  return {
    subscribe(fn: () => void) {listeners.add(fn); return () => {listeners.delete(fn);};},
    getSnapshot: () => state,
    activate() {disposed = false;},
    dispose() {disposed = true; generation++; controller?.abort(); writer.dispose(); state = initial();},
    load: () => load(), actions, role: (): Role | null => state.data?.request.role ?? null,
    reply: (note: string) => (actions()?.reply ? send('reply', {note: note.trim()}) : Promise.resolve()),
    /** The landlord's status control: respond with the typed note, or the default one ("Seen", "Work started", "Marked as fixed"). */
    setStatus: (target: 'acknowledged' | 'in_progress' | 'resolved', typed: string) => {
      const a = actions();
      const ok = !!a && ((target === 'acknowledged' && a.seen) || (target === 'in_progress' && a.start) || (target === 'resolved' && a.resolve));
      return ok ? send('respond', {status: target, note: statusNote(typed, target)}) : Promise.resolve();
    },
    confirmFixed: (note = '') => (actions()?.confirm ? send('confirm_resolved', note.trim() ? {note: note.trim()} : {}) : Promise.resolve()),
    /** "Not fixed": reopen, with a note that is required. */
    notFixed: (note: string) => (actions()?.notFixed ? send('reopen', {note: note.trim()}) : Promise.resolve()),
    cancel: () => (actions()?.cancel ? send('cancel', {}) : Promise.resolve()),
    retry: () => (state.pending ? writer.retry() : load()),
    defaultNote,
  };
}
export type MaintenanceRequestWorkflow = ReturnType<typeof createMaintenanceRequestWorkflow>;
