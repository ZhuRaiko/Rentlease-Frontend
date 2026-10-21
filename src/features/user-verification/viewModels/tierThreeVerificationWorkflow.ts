import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import type { uploadVerificationDocument } from '../../../shared/services/supabase/storage/verificationDocumentStorageService';
import { isTierThreeDocumentType, type TierThreeDocumentType, type TierThreeScreen, type TierThreeSubmission, type VerificationProperty } from '../models/TierThreeVerification';
import type { TierThreeVerificationService } from '../services/tierThreeVerificationService';

interface State {
  screen: TierThreeScreen; properties: VerificationProperty[]; propertyId: string | null;
  submission: TierThreeSubmission | null; documentType: TierThreeDocumentType | null; selectedDocument: SelectedDocument | null;
  loaded: boolean; isLoading: boolean; isSelectingDocument: boolean; isSubmitting: boolean; requiresRefresh: boolean; error: string | null;
}
interface Dependencies { service: TierThreeVerificationService; selectDocument: () => Promise<SelectedDocument | null>; uploadDocument: typeof uploadVerificationDocument }
export function createTierThreeVerificationWorkflow({ service, selectDocument, uploadDocument }: Dependencies) {
  const initialState: State = { screen: 'intro', properties: [], propertyId: null, submission: null, documentType: null, selectedDocument: null, loaded: false, isLoading: false, isSelectingDocument: false, isSubmitting: false, requiresRefresh: false, error: null };
  let state: State = initialState;
  let disposed = false; let epoch = 0; let userId: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); } };
  const current = (attempt: number) => !disposed && attempt === epoch;
  const alive = (attempt: number) => { if (!current(attempt)) throw Error('Verification closed.'); };
  const busy = () => state.isLoading || state.isSelectingDocument || state.isSubmitting;
  const canEdit = () => !disposed && state.loaded && !state.requiresRefresh && !state.submission && !busy() && !!state.propertyId && state.properties.some(p => p.id === state.propertyId);
  const canSubmit = () => canEdit() && state.screen === 'review' && !!state.selectedDocument && isTierThreeDocumentType(state.documentType ?? '');
  const refresh = async () => {
    if (disposed || busy()) return;
    const attempt = epoch;
    update({ isLoading: true, error: null, selectedDocument: null, documentType: null });
    try {
      const id = await service.getEligibleUserId(); alive(attempt);
      const properties = await service.fetchOwnedProperties(id); alive(attempt);
      const propertyId = (!userId || userId === id) && properties.some(p => p.id === state.propertyId) ? state.propertyId : null;
      const submission = propertyId ? await service.fetchLatest(id, propertyId) : null; alive(attempt);
      userId = id;
      update({ properties, propertyId, submission, loaded: true, requiresRefresh: false, screen: submission ? 'status' : propertyId ? 'documentType' : state.screen === 'intro' ? 'intro' : 'property' });
    } catch { if (current(attempt)) update({ properties: [], propertyId: null, submission: null, loaded: false, requiresRefresh: true, error: 'Could not load Tier 3. Check your connection and active Tier 1-verified landlord account, then refresh.' }); }
    finally { if (current(attempt)) update({ isLoading: false }); }
  };
  const navigate = (screen: TierThreeScreen) => {
    if (disposed || busy()) return;
    if (screen === 'intro' || screen === 'property') { update({ screen }); return; }
    if (!state.loaded || state.requiresRefresh || !state.propertyId) return;
    if (state.submission) { update({ screen: 'status' }); return; }
    if (screen === 'status' || (screen === 'review' && (!state.documentType || !state.selectedDocument))) return;
    if (screen === 'document' && !state.documentType) return;
    update({ screen });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    canSubmit, refresh, navigate,
    setEnabled(enabled: boolean) {
      if (enabled) return refresh();
      // Leaving Tier 3 invalidates work and clears local data without removing mounted subscribers.
      epoch++; userId = null; update(initialState);
      return Promise.resolve();
    },
    activate() { if (disposed) { disposed = false; update({ isLoading: false, isSubmitting: false, isSelectingDocument: false }); } },
    goBack() { navigate(({ intro: 'intro', property: 'intro', documentType: 'property', document: 'documentType', review: 'document', status: 'property' } as const)[state.screen]); },
    async selectProperty(propertyId: string) {
      if (disposed || busy() || !state.loaded || state.requiresRefresh || !userId || !state.properties.some(p => p.id === propertyId)) return;
      const sameProperty = propertyId === state.propertyId;
      const attempt = epoch;
      update({ propertyId, submission: null, ...(!sameProperty ? { selectedDocument: null, documentType: null } : {}), isLoading: true, error: null });
      try {
        const submission = await service.fetchLatest(userId, propertyId); alive(attempt);
        update({ submission, screen: submission ? 'status' : sameProperty && state.documentType ? 'document' : 'documentType', ...(submission ? { selectedDocument: null, documentType: null } : {}) });
      } catch { if (current(attempt)) update({ requiresRefresh: true, error: 'Could not check this property submission. Refresh before continuing.' }); }
      finally { if (current(attempt)) update({ isLoading: false }); }
    },
    chooseDocumentType(value: string) {
      if (!canEdit()) return;
      if (!isTierThreeDocumentType(value)) { update({ error: 'Choose one of the four supported property documents.' }); return; }
      update({ documentType: value, selectedDocument: value === state.documentType ? state.selectedDocument : null, screen: 'document', error: null });
    },
    async pickDocument() {
      if (!canEdit() || !state.documentType) return;
      const attempt = epoch; update({ isSelectingDocument: true, error: null });
      try { const selectedDocument = await selectDocument(); if (current(attempt) && selectedDocument) update({ selectedDocument }); }
      catch { if (current(attempt)) update({ error: 'Could not select this document. Please try again.' }); }
      finally { if (current(attempt)) update({ isSelectingDocument: false }); }
    },
    async submit() {
      if (!canSubmit() || !state.propertyId || !state.documentType || !state.selectedDocument || !userId) return;
      const { propertyId, documentType, selectedDocument } = state;
      const expectedUserId = userId; const attempt = epoch;
      update({ isSubmitting: true, error: null });
      let stage: 'auth' | 'fetch' | 'create' | 'upload' | 'metadata' | 'refresh' = 'auth';
      try {
        const id = await service.getEligibleUserId(); alive(attempt);
        if (id !== expectedUserId) throw Error('Account changed.');
        stage = 'fetch'; const properties = await service.fetchOwnedProperties(id); alive(attempt);
        if (!properties.some(p => p.id === propertyId && p.landlord_id === id)) throw Error('Ownership changed.');
        const existing = await service.fetchLatest(id, propertyId); alive(attempt);
        if (existing) { update({ submission: existing, screen: 'status', selectedDocument: null, documentType: null }); return; }
        stage = 'create'; const created = await service.createSubmission(id, propertyId); alive(attempt);
        if (!created.id || created.property_id !== propertyId) throw Error('Submission not confirmed.');
        update({ submission: created });
        stage = 'upload'; if (await service.getEligibleUserId() !== id) throw Error('Account changed.'); alive(attempt);
        const uploaded = await uploadDocument({ userId: id, submissionId: created.id, selectedDocument }); alive(attempt);
        stage = 'metadata'; await service.insertDocument(id, created.id, documentType, uploaded); alive(attempt);
        stage = 'refresh'; const submission = await service.fetchLatest(id, propertyId); alive(attempt);
        if (!submission || submission.id !== created.id || !submission.hasDocument) throw Error('Attachment not confirmed.');
        update({ submission, screen: 'status', requiresRefresh: false, selectedDocument: null, documentType: null });
      } catch {
        const messages = {
          auth: 'Check your account and refresh verification before submitting.',
          fetch: 'Could not confirm ownership and existing submissions. Refresh before trying again.',
          create: 'Submission creation could not be confirmed. Refresh before trying again; a record may already exist.',
          upload: 'A submission was created, but its document upload could not be confirmed. No automatic retry or cleanup was performed.',
          metadata: 'The document was uploaded, but its attachment could not be confirmed. No automatic retry or cleanup was performed.',
          refresh: 'Upload and attachment finished, but the latest backend status could not be confirmed. Refresh to check it.',
        };
        if (current(attempt)) update({ error: messages[stage], requiresRefresh: true, ...(state.submission ? { screen: 'status' as const, selectedDocument: null } : {}) });
      } finally { if (current(attempt)) update({ isSubmitting: false }); }
    },
    dispose() { state = { ...state, selectedDocument: null, documentType: null }; disposed = true; epoch++; listeners.clear(); },
  };
}
