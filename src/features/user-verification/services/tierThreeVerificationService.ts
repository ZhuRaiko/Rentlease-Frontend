import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '../../../shared/services/supabase/database.types';
import type { UploadedVerificationDocument } from '../../../shared/services/supabase/storage/verificationDocumentStorageService';
import { isTierThreeDocumentType, type TierThreeDocumentType, type TierThreeSubmission, type VerificationProperty } from '../models/TierThreeVerification';

const fields = 'id,property_id,status,rejection_reason,review_note,submitted_at,reviewed_at' as const;
export function createTierThreeVerificationService(getClient: () => SupabaseClient<Database>) {
  const getEligibleUserId = async (): Promise<string> => {
    const client = getClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) throw new Error('Sign in again to use property verification.');
    const id = auth.user.id;
    const { data: profile, error: profileError } = await client.from('profiles').select('account_status,tier1_verified_at').eq('id', id).maybeSingle();
    if (profileError) throw profileError;
    const { data: roles, error: roleError } = await client.from('user_roles').select('role').eq('user_id', id);
    if (roleError) throw roleError;
    if (profile?.account_status !== 'active' || !profile.tier1_verified_at || !roles?.some(row => row.role === 'landlord')) throw new Error('Tier 3 requires an active Tier 1-verified landlord account.');
    return id;
  };
  const assertIdentity = async (userId: string) => {
    if (await getEligibleUserId() !== userId) throw new Error('Your account changed. Reopen verification.');
  };
  const fetchOwnedProperties = async (userId: string): Promise<VerificationProperty[]> => {
    await assertIdentity(userId);
    // Publicly readable properties may exist under RLS: an explicit owner filter is essential.
    const { data, error } = await getClient().from('properties').select('id,landlord_id,property_type,barangay,city')
      .eq('landlord_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false });
    if (error) throw error;
    return (data ?? []).filter(property => property.landlord_id === userId);
  };
  const assertProperty = async (userId: string, propertyId: string) => {
    if (!(await fetchOwnedProperties(userId)).some(property => property.id === propertyId)) throw new Error('Select a property that belongs to your account.');
  };
  return {
    getEligibleUserId,
    fetchOwnedProperties,
    async fetchLatest(userId: string, propertyId: string): Promise<TierThreeSubmission | null> {
      await assertProperty(userId, propertyId);
      const { data, error } = await getClient().from('verification_submissions').select(`${fields},verification_documents(id)`)
        .eq('user_id', userId).eq('tier', 'tier_3_property').eq('property_id', propertyId)
        .order('submitted_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { verification_documents, ...submission } = data;
      return { ...submission, hasDocument: verification_documents.length > 0 };
    },
    async createSubmission(userId: string, propertyId: string): Promise<TierThreeSubmission> {
      await assertProperty(userId, propertyId);
      const payload = { user_id: userId, tier: 'tier_3_property', property_id: propertyId } satisfies TablesInsert<'verification_submissions'>;
      const { data, error } = await getClient().from('verification_submissions').insert(payload).select(fields).single();
      if (error) throw error;
      if (!data?.id || data.property_id !== propertyId) throw new Error('Created submission could not be confirmed.');
      return { ...data, hasDocument: false };
    },
    async insertDocument(userId: string, submissionId: string, documentType: TierThreeDocumentType, uploaded: UploadedVerificationDocument): Promise<void> {
      await assertIdentity(userId);
      if (!isTierThreeDocumentType(documentType)) throw new Error('Select a supported property document.');
      const { data: submission, error: submissionError } = await getClient().from('verification_submissions').select('property_id')
        .eq('id', submissionId).eq('user_id', userId).eq('tier', 'tier_3_property').maybeSingle();
      if (submissionError) throw submissionError;
      if (!submission?.property_id) throw new Error('Submission could not be confirmed.');
      await assertProperty(userId, submission.property_id);
      const payload = { submission_id: submissionId, document_type: documentType, storage_path: uploaded.storagePath, file_name: uploaded.fileName, mime_type: uploaded.mimeType } satisfies TablesInsert<'verification_documents'>;
      const { error } = await getClient().from('verification_documents').insert(payload);
      if (error) throw error;
    },
  };
}
export type TierThreeVerificationService = ReturnType<typeof createTierThreeVerificationService>;
