import {RELEASE_ERROR_LINE, type Role} from '../models/CancelledRentals';

/**
 * "Start a new request" / "Release it" on a cancelled rental. The held reservation is released with the existing reservation cancel; the
 * operation id is kept across retries, so a retry repeats the same operation. Nothing retries by itself: only the person's tap runs it.
 */
export interface ReleaseRequest {
  tenancyId: string; role: Role; reservationId: string; revision: number; conversationId: string | null;
  listing: string; range: string; other: string;
}
export interface ReleaseService { cancelReservation(actor: string, op: {id: string; reservationId: string; revision: number}): Promise<unknown> }
export interface ReleaseState { request: ReleaseRequest | null; saving: boolean; error: string | null }
const initial = (): ReleaseState => ({request: null, saving: false, error: null});

export function createTenancyReleaseWorkflow(service: ReleaseService, actor: string | undefined, newId: () => string, onReleased: (request: ReleaseRequest) => void) {
  let state = initial(), operationId: string | null = null, disposed = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ReleaseState>) => { if (!disposed) { state = {...state, ...patch}; listeners.forEach(fn => fn()); } };
  const run = async () => {
    const request = state.request;
    if (!actor || !request || state.saving || disposed) return;
    operationId ??= newId();
    update({saving: true, error: null});
    try {
      await service.cancelReservation(actor, {id: operationId, reservationId: request.reservationId, revision: request.revision});
      operationId = null;
      update({request: null, saving: false, error: null});
      onReleased(request);
    } catch {
      update({saving: false, error: RELEASE_ERROR_LINE}); // one amber line with Retry; no automatic second try
    }
  };
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getSnapshot: () => state,
    ask(request: ReleaseRequest) { if (state.saving) return; operationId = null; update({request, error: null}); },
    keep() { if (state.saving) return; operationId = null; update({request: null, error: null}); },
    confirm: run,
    retry: run,
    dispose() { disposed = true; },
  };
}
export type TenancyReleaseWorkflow = ReturnType<typeof createTenancyReleaseWorkflow>;
