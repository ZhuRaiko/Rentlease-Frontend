import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { normalizeError } from '../../../shared/errors/AppError';
import { mapAdminVerification, type AdminReviewInput, type AdminVerificationSubmissionDetail } from '../models/AdminVerification';

export const VERIFICATION_DOCUMENT_VIEW_EXPIRY_SECONDS = 90;

export function createAdminVerificationService(getClient: () => SupabaseClient<Database>) {
  const fetchVerificationQueue = async () => {
    try {
      const { data, error } = await getClient().rpc('get_admin_verification_queue');
      if (error) throw error;
      return (data ?? []).map(mapAdminVerification);
    } catch (error) { throw { ...normalizeError(error), message: 'Could not load the Admin verification queue. Check your connection and Admin access, then refresh.' }; }
  };
  return {
    fetchVerificationQueue,
    async reviewSubmission(input: AdminReviewInput): Promise<void> {
      try {
        const reason = input.rejectionReason?.trim();
        if (input.status === 'rejected' && !reason) throw new Error('Reason required');
        // Generated optional text arguments exclude null. Omission uses the RPC's SQL NULL defaults.
        const args: Database['public']['Functions']['review_verification_submission']['Args'] = {
          requested_submission_id: input.submissionId, requested_status: input.status,
          ...(input.reviewNote?.trim() ? { requested_review_note: input.reviewNote.trim() } : {}),
          ...(input.status === 'rejected' && reason ? { requested_rejection_reason: reason } : {}),
        };
        const { error } = await getClient().rpc('review_verification_submission', args);
        if (error) throw error;
      } catch (error) {
        throw { code: normalizeError(error).code, message: 'Could not confirm the review result. Check your connection and Admin access, then refresh before trying again. The submission may have changed or may not meet review requirements.' };
      }
    },
    async createVerificationDocumentViewUrl(storagePath: string): Promise<string> {
      try {
        // Called on demand with loaded metadata, never an arbitrary View-supplied path.
        // Authenticated Storage RLS enforces owner/Admin access; no public URL or DB write.
        const { data, error } = await getClient().storage.from('verification-documents')
          .createSignedUrl(storagePath, VERIFICATION_DOCUMENT_VIEW_EXPIRY_SECONDS);
        if (error) throw error;
        if (!data?.signedUrl) throw new Error('No document link returned.');
        return data.signedUrl;
      } catch (error) {
        // Keep only a normalized safe code/message: raw transport errors can contain signed URLs.
        throw { code: normalizeError(error).code, message: 'Could not open this private document. Close and reopen to try again.' };
      }
    },
    async fetchVerificationSubmissionDetails(submissionId: string): Promise<AdminVerificationSubmissionDetail> {
      try {
        // Revalidate active membership and Admin authorization; never query applicants' profiles.
        const queue = await fetchVerificationQueue();
        const item = queue.find((entry) => entry.submissionId === submissionId);
        if (!item) throw new Error('Submission is no longer in the active queue.');
        const { data, error } = await getClient().from('verification_documents')
          .select('id,submission_id,document_type,storage_path,file_name,mime_type,created_at')
          .eq('submission_id', submissionId).order('created_at', { ascending: true }).order('id', { ascending: true });
        if (error) throw error;
        return { item, documents: data ?? [] };
      } catch (error) { throw { ...normalizeError(error), message: 'Could not load this verification submission. Refresh the queue and try again.' }; }
    },
  };
}
export type AdminVerificationService = ReturnType<typeof createAdminVerificationService>;
