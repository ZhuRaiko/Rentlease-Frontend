import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '../../../shared/services/supabase/database.types';
import type { UploadedVerificationDocument } from '../../../shared/services/supabase/storage/verificationDocumentStorageService';
import type { TierTwoDocumentType, TierTwoSubmission } from '../models/TierTwoVerification';
import { traceTierTwoDiagnostic } from '../../../shared/utils/tierTwoDiagnostics';

const submissionFields = 'id,status,rejection_reason,review_note,submitted_at,reviewed_at' as const;

// Client injection keeps native initialization at the composition boundary.
// Identity is obtained through Auth, never from View props. RLS remains authoritative.
export function createTierTwoVerificationService(getClient: () => SupabaseClient<Database>) {
  const getCurrentUserId = async (): Promise<string> => {
    traceTierTwoDiagnostic('AUTH_START');
    let diagnosticError: unknown;
    try {
      const { data, error } = await getClient().auth.getUser();
      if (error || !data.user) {
        diagnosticError = error ?? { message: 'No authenticated user.' };
        // Retain the existing user-facing error and identity behavior.
        throw new Error('Sign in again to use identity verification.');
      }
      traceTierTwoDiagnostic('AUTH_SUCCESS', { userPresent: true });
      return data.user.id;
    } catch (error) {
      traceTierTwoDiagnostic('AUTH_ERROR', {}, diagnosticError ?? error);
      throw error;
    }
  };
  const assertIdentity = async (expectedUserId: string) => {
    if (await getCurrentUserId() !== expectedUserId) throw Object.assign(new Error('Your account changed. Reopen verification.'), { code: 'verification_identity_changed' });
  };
  return {
    getCurrentUserId,
    async fetchLatest(userId: string): Promise<TierTwoSubmission | null> {
      await assertIdentity(userId);
      const { data, error } = await getClient().from('verification_submissions')
        .select(`${submissionFields},verification_documents(id)`)
        .eq('user_id', userId).eq('tier', 'tier_2_identity')
        .order('submitted_at', { ascending: false }).order('id', { ascending: false })
        .limit(1).maybeSingle();
      if (error) throw error;
      await assertIdentity(userId);
      if (!data) return null;
      const { verification_documents, ...submission } = data;
      return { ...submission, hasDocument: verification_documents.length > 0 };
    },
    async fetchSubmission(userId: string, submissionId: string): Promise<TierTwoSubmission | null> {
      await assertIdentity(userId);
      const { data, error } = await getClient().from('verification_submissions')
        .select(`${submissionFields},verification_documents(id)`)
        .eq('user_id', userId).eq('tier', 'tier_2_identity').eq('id', submissionId).maybeSingle();
      if (error) throw error;
      await assertIdentity(userId);
      if (!data) return null;
      const { verification_documents, ...submission } = data;
      return { ...submission, hasDocument: verification_documents.length > 0 };
    },
    async fetchPreviousRejection(userId: string): Promise<TierTwoSubmission | null> {
      await assertIdentity(userId);
      const { data, error } = await getClient().from('verification_submissions')
        .select(`${submissionFields},verification_documents(id)`)
        .eq('user_id', userId).eq('tier', 'tier_2_identity').eq('status', 'rejected')
        .order('submitted_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      await assertIdentity(userId);
      if (!data) return null;
      const { verification_documents, ...submission } = data;
      return { ...submission, hasDocument: verification_documents.length > 0 };
    },
    async beginSubmission(userId: string): Promise<TierTwoSubmission> {
      await assertIdentity(userId);
      const { data, error } = await getClient().rpc('begin_tier2_verification_resubmission');
      if (error) throw error;
      await assertIdentity(userId);
      if (!data?.id || data.user_id !== userId || data.tier !== 'tier_2_identity' || data.property_id !== null || data.status !== 'pending') {
        throw new Error('The pending application could not be confirmed. Check status before continuing.');
      }
      // The RPC guarantees no registered document at return; re-read before upload.
      return { ...data, hasDocument: false };
    },
    async insertDocument(userId: string, submissionId: string, documentType: TierTwoDocumentType, uploaded: UploadedVerificationDocument): Promise<void> {
      await assertIdentity(userId);
      const payload = {
        submission_id: submissionId, document_type: documentType, storage_path: uploaded.storagePath,
        file_name: uploaded.fileName, mime_type: uploaded.mimeType,
      } satisfies TablesInsert<'verification_documents'>;
      const { error } = await getClient().from('verification_documents').insert(payload);
      if (error) throw error;
      await assertIdentity(userId);
    },
  };
}

export type TierTwoVerificationService = ReturnType<typeof createTierTwoVerificationService>;
