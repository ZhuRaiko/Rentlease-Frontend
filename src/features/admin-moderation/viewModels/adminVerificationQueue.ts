import type { AppError } from '../../../shared/errors/AppError';
import { isSupportedVerificationImage, type AdminReviewStatus, type AdminDocumentPreview, type AdminVerificationQueueItem, type AdminVerificationSubmissionDetail } from '../models/AdminVerification';
import type { AdminVerificationService } from '../services/adminVerificationService';

interface QueueState {
  queue: AdminVerificationQueueItem[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  detail: AdminVerificationSubmissionDetail | null;
  detailStatus: 'idle' | 'loading' | 'success' | 'error';
  detailError: string | null;
  documentPreview: AdminDocumentPreview | null;
  reviewDialog: AdminReviewStatus | null;
  rejectionReason: string;
  reviewBusy: boolean;
  reviewError: string | null;
  reviewNotice: string | null;
  reviewNeedsRefresh: boolean;
}
export function createAdminVerificationQueue(service: AdminVerificationService) {
  let state: QueueState = { queue: [], status: 'idle', error: null, detail: null, detailStatus: 'idle', detailError: null, documentPreview: null, reviewDialog: null, rejectionReason: '', reviewBusy: false, reviewError: null, reviewNotice: null, reviewNeedsRefresh: false };
  let disposed = false; let generation = 0; let detailGeneration = 0;
  let previewGeneration = 0;
  let reviewGeneration = 0;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<QueueState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); } };
  const findDocument = (id: string) => {
    const detail = state.detail;
    if (disposed || state.reviewBusy || state.detailStatus !== 'success' || !detail) return undefined;
    return detail.documents.find((document) => document.id === id && document.submission_id === detail.item.submissionId);
  };
  const canViewPrivateDocument = (id: string) => {
    const document = findDocument(id);
    return !!document && isSupportedVerificationImage(document.mime_type) && !!document.storage_path.trim();
  };
  const closePrivateDocument = () => { previewGeneration++; update({ documentPreview: null }); };
  const reviewActions = (): AdminReviewStatus[] => {
    if (disposed || state.reviewBusy || state.reviewNeedsRefresh || state.detailStatus !== 'success' || !state.detail) return [];
    return state.detail.item.status === 'pending' ? ['under_review'] : state.detail.item.status === 'under_review' ? ['approved', 'rejected'] : [];
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { disposed = false; },
    canViewPrivateDocument,
    closePrivateDocument,
    reviewActions,
    requestReview(status: AdminReviewStatus) {
      if (!reviewActions().includes(status)) return;
      closePrivateDocument(); update({ reviewDialog: status, rejectionReason: '', reviewError: null, reviewNotice: null });
    },
    cancelReview() { if (!state.reviewBusy) update({ reviewDialog: null, rejectionReason: '' }); },
    setRejectionReason(rejectionReason: string) { if (!state.reviewBusy && state.reviewDialog === 'rejected') update({ rejectionReason }); },
    async confirmReview(): Promise<boolean> {
      const status = state.reviewDialog; const detail = state.detail;
      if (!status || !detail || !reviewActions().includes(status)) return false;
      const reason = state.rejectionReason.trim();
      if (status === 'rejected' && !reason) { update({ reviewError: 'Enter a rejection reason.' }); return false; }
      const request = ++reviewGeneration;
      closePrivateDocument(); generation++; detailGeneration++;
      update({ reviewBusy: true, reviewError: null, reviewNotice: null });
      try {
        await service.reviewSubmission({ submissionId: detail.item.submissionId, status, ...(status === 'rejected' ? { rejectionReason: reason } : {}) });
      } catch {
        if (!disposed && request === reviewGeneration) update({ reviewBusy: false, reviewDialog: null, rejectionReason: '', reviewNeedsRefresh: true, reviewError: 'Could not confirm the review result. Refresh before trying again; check your connection, Admin access and submission requirements.' });
        return false;
      }
      if (disposed || request !== reviewGeneration) return false;
      update({ reviewDialog: null, rejectionReason: '', detail: null, detailStatus: 'idle', status: 'loading', queue: [] });
      const terminal = status !== 'under_review';
      try {
        const queue = await service.fetchVerificationQueue();
        if (disposed || request !== reviewGeneration) return false;
        update({ queue, status: 'success', error: null });
        if (!terminal && queue.some(item => item.submissionId === detail.item.submissionId)) {
          const refreshed = await service.fetchVerificationSubmissionDetails(detail.item.submissionId);
          if (disposed || request !== reviewGeneration) return false;
          update({ detail: refreshed, detailStatus: 'success', detailError: null });
        }
        const tier = detail.item.tier === 'tier_3_property' ? 'Tier 3 property' : 'Tier 2';
        update({ reviewBusy: false, reviewNotice: status === 'approved' ? `${tier} verification approved.` : status === 'rejected' ? `${tier} verification rejected.` : 'Review started. Backend state refreshed.' });
      } catch {
        if (disposed || request !== reviewGeneration) return false;
        update({ reviewBusy: false, detail: null, detailStatus: 'idle', status: 'error', error: 'Review was saved, but current data could not be loaded. Refresh the queue.', reviewError: 'Review was saved. Refresh the queue to load current backend state.', reviewNeedsRefresh: true });
      }
      return terminal || !state.detail;
    },
    async openPrivateDocument(id: string) {
      if (disposed || state.documentPreview?.isOpening || !canViewPrivateDocument(id)) return;
      const document = findDocument(id);
      if (!document) return;
      const request = ++previewGeneration;
      const preview: AdminDocumentPreview = {
        requestId: request,
        isOpening: true, isVisible: true, documentId: document.id,
        fileName: document.file_name, mimeType: document.mime_type, documentType: document.document_type,
        signedUrl: null, error: null,
      };
      update({ documentPreview: preview });
      try {
        const signedUrl = await service.createVerificationDocumentViewUrl(document.storage_path);
        if (request === previewGeneration) update({ documentPreview: { ...preview, isOpening: false, signedUrl } });
      } catch {
        if (request === previewGeneration) update({ documentPreview: { ...preview, isOpening: false, error: 'Could not open this private document. Close and reopen to try again.' } });
      }
    },
    privateDocumentFailed(requestId: number) {
      if (!state.documentPreview || disposed || state.documentPreview.requestId !== requestId) return;
      previewGeneration++;
      update({ documentPreview: { ...state.documentPreview, signedUrl: null, isOpening: false, error: 'The image could not be loaded or its link expired. Close and reopen to try again.' } });
    },
    async refresh() {
      if (disposed || state.reviewBusy) return;
      closePrivateDocument();
      const request = ++generation; detailGeneration++;
      update({ status: 'loading', queue: [], error: null, detail: null, detailStatus: 'idle', detailError: null, reviewDialog: null, rejectionReason: '', reviewNotice: null });
      try {
        const queue = await service.fetchVerificationQueue();
        if (request === generation) update({ queue, status: 'success', reviewNeedsRefresh: false, reviewError: null });
      } catch (error) { if (request === generation) update({ queue: [], status: 'error', error: (error as AppError).message || 'Could not load verification queue.' }); }
    },
    async select(id: string) {
      if (disposed || state.reviewBusy) return;
      closePrivateDocument();
      const request = ++detailGeneration;
      update({ detail: null, detailStatus: 'loading', detailError: null, reviewDialog: null, rejectionReason: '', reviewNotice: null });
      try {
        const detail = await service.fetchVerificationSubmissionDetails(id);
        if (request === detailGeneration) update({ detail, detailStatus: 'success' });
      } catch (error) { if (request === detailGeneration) update({ detail: null, detailStatus: 'error', detailError: (error as AppError).message || 'Could not load verification details.' }); }
    },
    dispose() { state = { ...state, documentPreview: null, reviewDialog: null, rejectionReason: '', reviewBusy: false }; disposed = true; generation++; detailGeneration++; previewGeneration++; reviewGeneration++; listeners.clear(); },
  };
}
