import {CareError, type CareOperation} from '../models/TenancyCare';
import {careActionsFor, defaultNote, type InboxCounts, type InboxRow} from '../models/Maintenance';
import {countRows, forProperty} from '../models/MaintenanceInbox';
import type {TenancyCareService} from '../services/tenancyCareService';
import type {CareJournal} from '../services/tenancyCareJournal';
import {createCareWriter} from './careWriter';

const PAGE = 20, MAX_PAGES = 25;
const initial = () => ({rows: [] as InboxRow[], counts: null as InboxCounts | null, busy: false, error: null as string | null, saving: false, pending: null as CareOperation | null, ready: false, savingId: null as string | null});
export type MaintenanceInboxState = ReturnType<typeof initial>;

/** The landlord's inbox. It covers every tenancy, so pages are read until done and then filtered to a property when one is given. */
export function createMaintenanceInboxWorkflow(service: TenancyCareService, journal: CareJournal, actor: string | undefined, propertyId: string | null, newId: () => string) {
  let state = initial(), disposed = false, generation = 0, controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const update = (p: Partial<MaintenanceInboxState>) => {if (!disposed) {state = {...state, ...p}; listeners.forEach(f => f());}};
  const load = async (message?: string) => {
    if (!actor || disposed) return;
    controller?.abort();
    const c = controller = new AbortController(), g = ++generation, timer = setTimeout(() => c.abort(), 20000);
    update({busy: true, error: null, ready: false});
    try {
      let rows: InboxRow[] = [], serverCounts: InboxCounts | null = null, offset = 0;
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await service.inbox(actor, offset, c.signal);
        if (disposed || g !== generation || c.signal.aborted) return;
        serverCounts = serverCounts ?? page.counts;
        const seen = new Set(rows.map(r => r.id));
        rows = [...rows, ...page.rows.filter(r => !seen.has(r.id))];
        if (!page.hasMore) break;
        offset += PAGE;
      }
      const shown = forProperty(rows, propertyId);
      update({rows: shown, counts: propertyId ? countRows(shown) : serverCounts, busy: false, ready: true, error: message ?? null});
    } catch (e) {
      if (!disposed && g === generation) update({busy: false, error: e instanceof CareError ? e.message : 'Maintenance requests could not load. Retry.'});
    } finally {clearTimeout(timer);}
  };
  const writer = createCareWriter(service, journal, actor, newId, {
    changed: () => {const w = writer.get(); update({saving: w.saving, pending: w.pending, ...(w.error ? {error: w.error} : {})});},
    done: async () => {update({savingId: null}); await load();},
    refused: async e => {update({savingId: null}); if (e.reload) await load(e.message);},
  });
  return {
    subscribe(fn: () => void) {listeners.add(fn); return () => {listeners.delete(fn);};},
    getSnapshot: () => state,
    activate() {disposed = false;},
    dispose() {disposed = true; generation++; controller?.abort(); writer.dispose(); state = initial();},
    load: () => load(),
    /** The small landlord actions on a card: "Seen" (acknowledge) and "Mark in progress", each with its default note. */
    act(row: InboxRow, target: 'acknowledged' | 'in_progress') {
      if (state.saving || !state.ready) return Promise.resolve();
      const a = careActionsFor({role: 'landlord', tenancy: row.tenancyEnded ? 'ended' : 'active', status: row.status, confirmed: row.tenantConfirmedAt !== null});
      if (!((target === 'acknowledged' && a.seen) || (target === 'in_progress' && a.start))) return Promise.resolve();
      update({savingId: row.id});
      return writer.run(row.tenancyId, 'respond', {requestId: row.id, revision: row.revision, status: target, note: defaultNote(target)});
    },
    retry: () => (state.pending ? writer.retry() : load()),
  };
}
export type MaintenanceInboxWorkflow = ReturnType<typeof createMaintenanceInboxWorkflow>;
