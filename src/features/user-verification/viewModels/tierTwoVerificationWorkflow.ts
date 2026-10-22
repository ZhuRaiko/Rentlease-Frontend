import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import type { uploadVerificationDocument } from '../../../shared/services/supabase/storage/verificationDocumentStorageService';
import { getTierTwoDocumentType, tierTwoRecoveryKind, type TierTwoScreen, type TierTwoSubmission } from '../models/TierTwoVerification';
import type { TierTwoVerificationService } from '../services/tierTwoVerificationService';
import { tierTwoUriDiagnostics, traceTierTwoDiagnostic } from '../../../shared/utils/tierTwoDiagnostics';

interface TierTwoState {
  screen: TierTwoScreen;
  submission: TierTwoSubmission | null;
  previousRejection: TierTwoSubmission | null;
  historyError: string | null;
  editingApplication: boolean;
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
const initialState = (): TierTwoState => ({
  screen: 'overview', submission: null, previousRejection: null, historyError: null, editingApplication: false,
  selectedIdLabel: null, selectedDocument: null, loaded: false, isLoading: false,
  isSelectingDocument: false, isSubmitting: false, requiresRefresh: false, error: null,
});

export function createTierTwoVerificationWorkflow({ service, selectDocument, uploadDocument }: Dependencies) {
  let state = initialState();
  let disposed = false, epoch = 0;
  let ownerId: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<TierTwoState>) => {
    if (disposed) return;
    state = { ...state, ...patch }; listeners.forEach(listener => listener());
  };
  const busy = () => state.isLoading || state.isSelectingDocument || state.isSubmitting;
  const eligible = () => !disposed && state.loaded && !state.requiresRefresh && !busy();
  const canStartRecovery = () => eligible() && !!state.submission && tierTwoRecoveryKind(state.submission) !== null;
  const canEdit = () => eligible() && tierTwoRecoveryKind(state.submission) !== null && (!state.submission || state.editingApplication);
  const canSubmit = () => canEdit() && !!state.selectedDocument && getTierTwoDocumentType(state.selectedIdLabel ?? '') !== null;
  const current = (attempt: number) => !disposed && epoch === attempt;
  const alive = (attempt: number) => { if (!current(attempt)) throw new Error('Verification closed.'); };
  const changedIdentity = () => Object.assign(new Error('Account changed.'), { code: 'verification_identity_changed' });
  const assertCurrent = async (userId: string, attempt: number) => {
    alive(attempt);
    if (await service.getCurrentUserId() !== userId || ownerId !== userId) throw changedIdentity();
    alive(attempt);
  };
  const handleIdentityError = (error: unknown) => {
    if ((error as { code?: string } | null)?.code !== 'verification_identity_changed') return false;
    epoch++; ownerId = null;
    update({ ...initialState(), requiresRefresh: true, error: 'Your account changed. Check status to load the current account.' });
    return true;
  };
  const loadHistory = async (userId: string, attempt: number, submission: TierTwoSubmission | null) => {
    try {
      const previous = submission?.status === 'rejected' ? submission : await service.fetchPreviousRejection(userId);
      await assertCurrent(userId, attempt);
      update({ previousRejection: previous?.id !== submission?.id ? previous : null, historyError: null });
    } catch (error) {
      if (current(attempt)) {
        if (handleIdentityError(error)) throw error;
        update({ previousRejection: null, historyError: 'Previous rejection details could not be loaded.' });
      }
    }
  };
  const applySubmission = (submission: TierTwoSubmission | null) => update({
    submission, loaded: true, requiresRefresh: false, editingApplication: false,
    selectedDocument: null, selectedIdLabel: null,
    ...(submission && state.screen !== 'overview' ? { screen: 'tier2Status' as const } : {}),
  });
  const refresh = async () => {
    if (disposed || busy()) return;
    const attempt = epoch;
    update({ isLoading: true, error: null });
    try {
      const userId = await service.getCurrentUserId(); alive(attempt);
      if (ownerId && ownerId !== userId) { ownerId = userId; update({ ...initialState(), isLoading: true }); }
      ownerId = userId;
      const submission = await service.fetchLatest(userId); await assertCurrent(userId, attempt);
      applySubmission(submission);
      await loadHistory(userId, attempt, submission);
    } catch (error) {
      if (current(attempt) && !handleIdentityError(error)) update({ error: 'Could not load your Tier 2 verification. Check your connection and sign-in, then check status.', requiresRefresh: true });
    } finally { if (current(attempt)) update({ isLoading: false }); }
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    canSubmit, canStartRecovery,
    activate() { if (disposed) { disposed = false; update({ isLoading: false, isSelectingDocument: false, isSubmitting: false }); } },
    refresh,
    startRecovery() {
      if (!canStartRecovery()) return;
      update({ editingApplication: true, selectedIdLabel: null, selectedDocument: null, screen: 'tier2IdType', error: null });
    },
    navigate(screen: TierTwoScreen) {
      if (disposed || busy()) return;
      if (screen === 'overview' || screen === 'tier2Status') {
        update({ screen, editingApplication: false, selectedDocument: null, selectedIdLabel: null }); return;
      }
      if (!state.loaded || state.requiresRefresh) return;
      update({ screen: state.submission && (!state.editingApplication || tierTwoRecoveryKind(state.submission) === null) ? 'tier2Status' : screen, error: null });
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
        if (ownerId) await assertCurrent(ownerId, attempt);
        if (current(attempt) && selectedDocument) update({ selectedDocument });
      } catch (error) { if (current(attempt) && !handleIdentityError(error)) update({ error: 'Could not select this document. Please try again.' }); }
      finally { if (current(attempt)) update({ isSelectingDocument: false }); }
    },
    async submit() {
      // The existing review screen is the explicit confirmation boundary.
      if (!canSubmit() || state.screen !== 'tier2Review') return;
      const documentType = getTierTwoDocumentType(state.selectedIdLabel ?? '');
      const selectedDocument = state.selectedDocument;
      if (!documentType || !selectedDocument) return;
      const attempt = epoch;
      traceTierTwoDiagnostic('SUBMIT_START', tierTwoUriDiagnostics(selectedDocument.uri));
      update({ isSubmitting: true, error: null });
      let stage: 'auth' | 'fetch' | 'begin' | 'upload' | 'metadata' | 'refresh' = 'auth';
      try {
        const userId = await service.getCurrentUserId();
        if (!ownerId || ownerId !== userId) throw changedIdentity();
        await assertCurrent(userId, attempt);
        stage = 'fetch';
        const latest = await service.fetchLatest(userId); await assertCurrent(userId, attempt);
        if (tierTwoRecoveryKind(latest) === null) { applySubmission(latest); update({ screen: 'tier2Status' }); return; }
        stage = 'begin';
        const begun = await service.beginSubmission(userId); await assertCurrent(userId, attempt);
        if (!begun.id || begun.status !== 'pending' || (latest?.status === 'pending' && latest.id !== begun.id)) throw new Error('Unexpected pending application.');
        update({ submission: begun, previousRejection: latest?.status === 'rejected' ? latest : state.previousRejection });
        stage = 'fetch';
        const beforeUpload = await service.fetchSubmission(userId, begun.id); await assertCurrent(userId, attempt);
        if (!beforeUpload || beforeUpload.id !== begun.id) throw new Error('Application unavailable.');
        if (beforeUpload.status !== 'pending' || beforeUpload.hasDocument) { applySubmission(beforeUpload); update({ screen: 'tier2Status' }); return; }
        stage = 'upload';
        const uploaded = await uploadDocument({ userId, submissionId: begun.id, selectedDocument }); await assertCurrent(userId, attempt);
        stage = 'metadata';
        const beforeMetadata = await service.fetchSubmission(userId, begun.id); await assertCurrent(userId, attempt);
        if (!beforeMetadata || beforeMetadata.id !== begun.id) throw new Error('Application unavailable.');
        if (beforeMetadata.status !== 'pending' || beforeMetadata.hasDocument) {
          applySubmission(beforeMetadata); update({ screen: 'tier2Status', error: 'The application changed during upload. Showing current backend state. The uploaded file was not registered by this attempt or deleted.' }); return;
        }
        await service.insertDocument(userId, begun.id, documentType, uploaded); await assertCurrent(userId, attempt);
        stage = 'refresh';
        const submission = await service.fetchLatest(userId); await assertCurrent(userId, attempt);
        if (!submission || submission.id !== begun.id || !submission.hasDocument) throw new Error('Submission could not be confirmed.');
        applySubmission(submission); update({ screen: 'tier2Status' });
        await loadHistory(userId, attempt, submission);
      } catch (error) {
        const messages = {
          auth: 'Sign in again, then check status before submitting.',
          fetch: 'Could not recheck the application. Check status before continuing.',
          begin: (error as { code?: string } | null)?.code === '23505'
            ? 'An open or approved application already exists. Check status before continuing.'
            : 'The application start could not be confirmed. It may already exist. Check status before another attempt.',
          upload: 'The pending application exists, but upload could not be confirmed. A private file may already exist. Check status before choosing Complete Document Upload.',
          metadata: 'The file may have uploaded, but its registration could not be confirmed. Check status before resuming. No private file was deleted.',
          refresh: 'The upload and registration finished, but current status could not be confirmed. Check status before continuing.',
        };
        if (current(attempt) && !handleIdentityError(error)) update({ error: messages[stage], requiresRefresh: true, editingApplication: false, screen: 'tier2Status' });
      } finally { if (current(attempt)) update({ isSubmitting: false }); }
    },
    dispose() { disposed = true; epoch++; ownerId = null; listeners.clear(); },
  };
}
