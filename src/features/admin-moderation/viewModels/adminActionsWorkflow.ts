import { adminErrorText, classifyAdminError } from '../../../shared/models/AdminOperationError';
import {
  actionNotice, endsAtFor, validateActionReason,
  type AdminActionKind, type AdminAuditEntry, type AdminRestriction, type AuditKind, type EndPresetId,
} from '../models/AdminActions';
import type { AdminActionsService } from '../services/adminActionsService';

type Load = 'idle' | 'loading' | 'success' | 'error';

/** What the confirmation sheet edits. Nothing here is sent until confirm(); the reason is trimmed and the end date computed at the first attempt. */
export interface ActionDraft {
  action: AdminActionKind; targetUserId: string | null; targetListingId: string | null; reportId: string | null;
  targetLabel: string; reason: string; endsPreset: EndPresetId;
}
/** One logical attempt. Kept across an uncertain failure so a retry sends the identical operation id and end date (the server replays it). */
interface Attempt { operationId: string; endsAt: string | null }

export interface ActionsState {
  restrictions: { status: Load; rows: AdminRestriction[]; count: number; error: string | null };
  /** rows grows as pages are appended ("Load more"); moreStatus/moreError belong to the append only, so a failed append never hides what is already shown. */
  audit: { status: Load; kind: AuditKind; offset: number; rows: AdminAuditEntry[]; count: number; error: string | null; moreStatus: 'idle' | 'loading' | 'error'; moreError: string | null };
  recent: { status: Load; rows: AdminAuditEntry[]; error: string | null };
  draft: ActionDraft | null;
  submit: { busy: boolean; error: string | null; notice: string | null; attempt: Attempt | null };
}

const initial = (): ActionsState => ({
  restrictions: { status: 'idle', rows: [], count: 0, error: null },
  audit: { status: 'idle', kind: 'all', offset: 0, rows: [], count: 0, error: null, moreStatus: 'idle', moreError: null },
  recent: { status: 'idle', rows: [], error: null },
  draft: null,
  submit: { busy: false, error: null, notice: null, attempt: null },
});
const failure = (error: unknown, decision = false) => adminErrorText(classifyAdminError(error, { decision }));

/**
 * Framework-free state for the Actions tab, the Audit tab, the dashboard's recent decisions and the take-action / restore sheet.
 * Generation guards drop stale loads. One decision at a time: while busy, nothing else can start or edit the draft.
 */
export function createAdminActionsWorkflow(service: AdminActionsService, newId: () => string, now: () => number = Date.now) {
  let state = initial();
  let disposed = false, restrictionsGen = 0, auditGen = 0, recentGen = 0;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ActionsState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); } };

  const loadRestrictions = async () => {
    const gen = ++restrictionsGen;
    update({ restrictions: { ...state.restrictions, status: 'loading', error: null } });
    try {
      const page = await service.fetchRestrictions();
      if (gen === restrictionsGen) update({ restrictions: { status: 'success', rows: page.rows, count: page.count, error: null } });
    } catch (error) {
      if (gen === restrictionsGen) update({ restrictions: { status: 'error', rows: [], count: 0, error: failure(error) } });
    }
  };
  const loadAudit = async (kind: AuditKind = state.audit.kind, offset = 0) => {
    const gen = ++auditGen;
    update({ audit: { ...state.audit, kind, offset, status: 'loading', error: null, moreStatus: 'idle', moreError: null } });
    try {
      const page = await service.fetchAuditLog(kind, offset);
      if (gen === auditGen) update({ audit: { status: 'success', kind, offset, rows: page.rows, count: page.count, error: null, moreStatus: 'idle', moreError: null } });
    } catch (error) {
      if (gen === auditGen) update({ audit: { status: 'error', kind, offset, rows: [], count: 0, error: failure(error), moreStatus: 'idle', moreError: null } });
    }
  };
  /** Appends the next page (offset = rows already shown). Rows are de-duplicated by id because new entries shift older ones down between requests. */
  const loadMoreAudit = async () => {
    const current = state.audit;
    if (current.status !== 'success' || current.moreStatus === 'loading' || current.rows.length >= current.count) return;
    const gen = auditGen, kind = current.kind, offset = current.rows.length;
    update({ audit: { ...current, moreStatus: 'loading', moreError: null } });
    try {
      const page = await service.fetchAuditLog(kind, offset);
      if (gen !== auditGen || state.audit.kind !== kind) return;
      const seen = new Set(state.audit.rows.map((row) => row.id));
      update({ audit: { ...state.audit, rows: [...state.audit.rows, ...page.rows.filter((row) => !seen.has(row.id))], count: page.count, moreStatus: 'idle', moreError: null } });
    } catch (error) {
      if (gen === auditGen) update({ audit: { ...state.audit, moreStatus: 'error', moreError: failure(error) } });
    }
  };
  const loadRecent = async () => {
    const gen = ++recentGen;
    update({ recent: { ...state.recent, status: 'loading', error: null } });
    try {
      const page = await service.fetchAuditLog('all', 0);
      if (gen === recentGen) update({ recent: { status: 'success', rows: page.rows.slice(0, 3), error: null } });
    } catch (error) {
      if (gen === recentGen) update({ recent: { status: 'error', rows: [], error: failure(error) } });
    }
  };

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { disposed = false; },
    dispose() { disposed = true; restrictionsGen++; auditGen++; recentGen++; listeners.clear(); state = initial(); },
    loadRestrictions, loadAudit, loadMoreAudit, loadRecent,
    /** Open the sheet. Ignored while a decision is being saved. */
    openAction(init: Pick<ActionDraft, 'action' | 'targetUserId' | 'targetListingId' | 'reportId' | 'targetLabel'>) {
      if (state.submit.busy) return;
      update({ draft: { ...init, reason: '', endsPreset: 'none' }, submit: { busy: false, error: null, notice: null, attempt: null } });
    },
    /** Any edit starts a new logical attempt: a changed input must never reuse an earlier operation id. */
    updateDraft(patch: Partial<Pick<ActionDraft, 'action' | 'targetUserId' | 'targetListingId' | 'reason' | 'endsPreset'>>) {
      if (!state.draft || state.submit.busy) return;
      update({ draft: { ...state.draft, ...patch }, submit: { ...state.submit, error: null, attempt: null } });
    },
    cancelAction() { if (!state.submit.busy && state.draft) update({ draft: null, submit: { ...state.submit, error: null, attempt: null } }); },
    dismissNotice() { if (state.submit.notice) update({ submit: { ...state.submit, notice: null } }); },
    async confirmAction(): Promise<boolean> {
      const draft = state.draft;
      if (!draft || state.submit.busy || disposed) return false;
      if (draft.action !== 'restore_account' && !draft.reportId) { update({ submit: { ...state.submit, error: 'Open this from an upheld report to take this action.' } }); return false; }
      const invalid = validateActionReason(draft.reason);
      if (invalid) { update({ submit: { ...state.submit, error: invalid } }); return false; }
      const attempt: Attempt = state.submit.attempt ?? { operationId: newId(), endsAt: draft.action === 'suspend_account' ? endsAtFor(draft.endsPreset, now()) : null };
      update({ submit: { busy: true, error: null, notice: null, attempt } });
      try {
        await service.applyAction({ operationId: attempt.operationId, action: draft.action, targetUserId: draft.targetUserId, targetListingId: draft.targetListingId, reportId: draft.reportId, reason: draft.reason.trim(), endsAt: attempt.endsAt });
      } catch (error) {
        const info = classifyAdminError(error, { decision: true }), message = adminErrorText(info);
        if (info.code === 'network' || info.code === 'timeout' || info.code === 'unknown') {
          // The outcome is not known: keep the sheet and the attempt, so retrying replays the same operation instead of acting twice.
          update({ submit: { busy: false, error: message, notice: null, attempt } });
        } else if (info.reload) {
          // The target changed under the Admin: close the sheet, show why, and refresh what the list shows.
          update({ draft: null, submit: { busy: false, error: message, notice: null, attempt: null } });
          void loadRestrictions();
        } else {
          // Fixable in place (reason, end date): keep the sheet.
          update({ submit: { busy: false, error: message, notice: null, attempt: null } });
        }
        return false;
      }
      update({
        draft: null, submit: { busy: false, error: null, notice: actionNotice(draft.action), attempt: null },
        audit: { ...state.audit, status: 'idle' }, recent: { ...state.recent, status: 'idle' },
      });
      await loadRestrictions();
      return true;
    },
  };
}
export type AdminActionsWorkflow = ReturnType<typeof createAdminActionsWorkflow>;
