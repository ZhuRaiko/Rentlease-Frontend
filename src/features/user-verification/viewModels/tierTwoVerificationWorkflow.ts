import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import type { uploadVerificationDocument } from '../../../shared/services/supabase/storage/verificationDocumentStorageService';
import { getTierTwoDocumentType, type TierTwoScreen, type TierTwoSubmission } from '../models/TierTwoVerification';
import type { TierTwoVerificationService } from '../services/tierTwoVerificationService';
import { tierTwoUriDiagnostics, traceTierTwoDiagnostic } from '../../../shared/utils/tierTwoDiagnostics';

interface TierTwoState {
  screen: TierTwoScreen;
  submission: TierTwoSubmission | null;
  selectedIdLabel: string | null;
  selectedDocument: SelectedDocument | null;
  loaded: boolean;
  isLoading: boolean;
  isSelectingDocument: boolean;
  isSubmitting: boolean;
  requiresRefresh: boolean;
  error: string | null;
}

interface Dependencies {
  service: TierTwoVerificationService;
  selectDocument: () => Promise<SelectedDocument | null>;
  uploadDocument: typeof uploadVerificationDocument;
}

// Feature workflow state only; no second Auth/account snapshot or native client.
export function createTierTwoVerificationWorkflow({ service, selectDocument, uploadDocument }: Dependencies) {
  let state: TierTwoState = {
    screen: 'overview', submission: null, selectedIdLabel: null, selectedDocument: null,
    loaded: false, isLoading: false, isSelectingDocument: false, isSubmitting: false,
    requiresRefresh: false, error: null,
  };
  let disposed = false;
  let epoch = 0;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<TierTwoState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const busy = () => state.isLoading || state.isSelectingDocument || state.isSubmitting;
  const canEdit = () => !disposed && state.loaded && !state.submission && !state.requiresRefresh && !busy();
  const canSubmit = () => canEdit() && !!state.selectedDocument && getTierTwoDocumentType(state.selectedIdLabel ?? '') !== null;
  const current = (attempt: number) => !disposed && epoch === attempt;
  const alive = (attempt: number) => { if (!current(attempt)) throw new Error('Verification closed.'); };

  const refresh = async () => {
    if (disposed || busy()) return;
    const attempt = epoch;
    update({ isLoading: true, error: null });
    try {
      const userId = await service.getCurrentUserId(); alive(attempt);
      const submission = await service.fetchLatest(userId); alive(attempt);
      update({ submission, loaded: true, requiresRefresh: false,
        ...(submission && state.screen !== 'overview' ? { screen: 'tier2Status' as const } : {}),
        ...(submission ? { selectedDocument: null, selectedIdLabel: null } : {}),
      });
    } catch {
      if (current(attempt)) update({ error: 'Could not load your Tier 2 verification. Check your connection and sign-in, then refresh.', requiresRefresh: true });
    } finally { if (current(attempt)) update({ isLoading: false }); }
  };

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    canSubmit,
    // React development effect cleanup/setup may reuse the same hook instance.
    activate() {
      if (!disposed) return;
      disposed = false;
      update({ isLoading: false, isSelectingDocument: false, isSubmitting: false });
    },
    refresh,
    navigate(screen: TierTwoScreen) {
      if (disposed || busy()) return;
      if (screen === 'overview') { update({ screen }); return; }
      if (!state.loaded || state.requiresRefresh) return;
      update({ screen: state.submission ? 'tier2Status' : screen, error: null });
    },
    chooseId(label: string) {
      if (!canEdit()) return;
      if (!getTierTwoDocumentType(label)) { update({ error: 'Choose a supported government ID type.' }); return; }
      update({ selectedIdLabel: label, selectedDocument: null, screen: 'tier2Upload', error: null });
    },
    async pickDocument() {
      if (!canEdit() || !getTierTwoDocumentType(state.selectedIdLabel ?? '')) return;
      const attempt = epoch;
      update({ isSelectingDocument: true, error: null });
      try {
        const selectedDocument = await selectDocument();
        if (current(attempt) && selectedDocument) update({ selectedDocument });
      } catch { if (current(attempt)) update({ error: 'Could not select this document. Please try again.' }); }
      finally { if (current(attempt)) update({ isSelectingDocument: false }); }
    },
    async submit() {
      if (!canSubmit()) return;
      const documentType = getTierTwoDocumentType(state.selectedIdLabel ?? '');
      const selectedDocument = state.selectedDocument;
      if (!documentType || !selectedDocument) return;
      traceTierTwoDiagnostic('SUBMIT_START', tierTwoUriDiagnostics(selectedDocument.uri));
      const attempt = epoch;
      update({ isSubmitting: true, error: null });
      let stage: 'auth' | 'fetch' | 'create' | 'upload' | 'metadata' | 'refresh' = 'auth';
      try {
        const userId = await service.getCurrentUserId(); alive(attempt);
        stage = 'fetch';
        const existing = await service.fetchLatest(userId); alive(attempt);
        if (existing) {
          update({ submission: existing, screen: 'tier2Status', selectedDocument: null, selectedIdLabel: null });
          return;
        }
        stage = 'create';
        traceTierTwoDiagnostic('SUBMISSION_INSERT_START', { documentType });
        let created: TierTwoSubmission;
        try {
          created = await service.createSubmission(userId);
          traceTierTwoDiagnostic('SUBMISSION_INSERT_SUCCESS', { submissionId: created.id, documentType });
        } catch (error) {
          traceTierTwoDiagnostic('SUBMISSION_INSERT_ERROR', { documentType }, error);
          throw error;
        }
        alive(attempt);
        if (!created.id) throw new Error('Missing submission ID.');
        update({ submission: created });
        stage = 'upload';
        // Recheck identity before handing the authenticated namespace to Storage.
        if (await service.getCurrentUserId() !== userId) throw new Error('Account changed.');
        alive(attempt);
        const uploaded = await uploadDocument({ userId, submissionId: created.id, selectedDocument }); alive(attempt);
        stage = 'metadata';
        traceTierTwoDiagnostic('METADATA_INSERT_START', {
          submissionId: created.id, documentType, storagePath: uploaded.storagePath,
          fileName: uploaded.fileName, mimeType: uploaded.mimeType,
        });
        try {
          await service.insertDocument(userId, created.id, documentType, uploaded);
          traceTierTwoDiagnostic('METADATA_INSERT_SUCCESS', { submissionId: created.id, documentType });
        } catch (error) {
          traceTierTwoDiagnostic('METADATA_INSERT_ERROR', { submissionId: created.id, documentType }, error);
          throw error;
        }
        alive(attempt);
        update({ submission: { ...created, hasDocument: true } });
        stage = 'refresh';
        const submission = await service.fetchLatest(userId); alive(attempt);
        if (!submission || !submission.hasDocument) throw new Error('Submission could not be confirmed.');
        update({ submission, screen: 'tier2Status', selectedDocument: null, selectedIdLabel: null, requiresRefresh: false });
        traceTierTwoDiagnostic('SUBMIT_SUCCESS', { submissionId: submission.id, documentType });
      } catch (error) {
        traceTierTwoDiagnostic('SUBMIT_ERROR', { stage, documentType }, error);
        const messages = {
          auth: 'Sign in again, then refresh verification before submitting.',
          fetch: 'Could not check existing submissions. Refresh before trying again.',
          create: 'Submission creation could not be confirmed. Refresh before trying again; a record may already exist.',
          upload: 'A submission was created, but the document upload could not be confirmed. No automatic retry or cleanup was performed.',
          metadata: 'The document was uploaded, but its attachment could not be confirmed. No automatic retry or cleanup was performed.',
          refresh: 'The upload and attachment finished, but the latest status could not be confirmed. Refresh to check it.',
        };
        if (current(attempt)) update({ error: messages[stage], requiresRefresh: true, ...(state.submission ? { screen: 'tier2Status' as const } : {}) });
      } finally { if (current(attempt)) update({ isSubmitting: false }); }
    },
    dispose() { disposed = true; epoch++; listeners.clear(); },
  };
}
