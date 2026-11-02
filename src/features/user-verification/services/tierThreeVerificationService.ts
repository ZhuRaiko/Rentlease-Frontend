import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
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
  const readSubmission=async(userId:string,propertyId:string,currentOnly:boolean):Promise<TierThreeSubmission|null>=>{
      await assertProperty(userId, propertyId);
      const result=await getClient().rpc('get_property_identity_submission',{p_property_id:propertyId,...(currentOnly?{p_current_only:true}:{})});
      if(!result.error){await assertIdentity(userId);return parseSubmission(result.data,propertyId);}
      if(result.error.code!=='PGRST202')throw result.error;
      // Read-only compatibility before the prepared identity migration is deployed.
      const { data, error } = await getClient().from('verification_submissions').select(`${fields},verification_documents(id)`)
        .eq('user_id', userId).eq('tier', 'tier_3_property').eq('property_id', propertyId)
        .order('submitted_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { verification_documents, ...submission } = data;
      return { ...submission, hasDocument: verification_documents.length > 0 };
  };
  return {
    getEligibleUserId,
    fetchOwnedProperties,
    fetchLatest:(userId:string,propertyId:string)=>readSubmission(userId,propertyId,false),
    fetchCurrent:(userId:string,propertyId:string)=>readSubmission(userId,propertyId,true),
    async createSubmission(userId: string, propertyId: string): Promise<TierThreeSubmission> {
      await assertProperty(userId, propertyId);
      const context=await getClient().rpc('get_property_identity_context',{p_property_id:propertyId});if(context.error)throw context.error;
      const c=context.data as {property_id?:string;owner_id?:string;current_revision_id?:string;correction?:{status?:string;candidate_revision_id?:string}}|null;
      if(!c||c.property_id!==propertyId||c.owner_id!==userId)throw new Error('Owned identity context could not be confirmed.');
      const revision=c.correction&&['draft','submitted'].includes(c.correction.status??'')?c.correction.candidate_revision_id:c.current_revision_id;
      if(!revision)throw new Error('Trusted identity data requires repair.');await assertIdentity(userId);
      const {data,error}=await getClient().rpc('begin_property_identity_verification',{p_property_id:propertyId,p_expected_revision:revision});
      if(error)throw error;
      await assertIdentity(userId);const created=parseSubmission(data,propertyId);
      if(!created)throw new Error('Submission could not be confirmed.');return created;
    },
    async insertDocument(userId: string, submissionId: string, documentType: TierThreeDocumentType, uploaded: UploadedVerificationDocument): Promise<void> {
      await assertIdentity(userId);
      if (!isTierThreeDocumentType(documentType)) throw new Error('Select a supported property document.');
      const { data: submission, error: submissionError } = await getClient().from('verification_submissions').select('property_id')
        .eq('id', submissionId).eq('user_id', userId).eq('tier', 'tier_3_property').maybeSingle();
      if (submissionError) throw submissionError;
      if (!submission?.property_id) throw new Error('Submission could not be confirmed.');
      await assertProperty(userId, submission.property_id);
      if(!uploaded.mimeType)throw new Error('Select a supported JPEG, PNG, or PDF document.');
      const {error}=await getClient().rpc('attach_property_identity_document',{p_submission_id:submissionId,p_document_type:documentType,p_storage_path:uploaded.storagePath,p_file_name:uploaded.fileName,p_mime_type:uploaded.mimeType});
      if(error)throw error;
      await assertIdentity(userId);
    },
  };
}
export type TierThreeVerificationService = ReturnType<typeof createTierThreeVerificationService>;

function parseSubmission(value:unknown,propertyId:string):TierThreeSubmission|null{
 if(value===null)return null;const s=value as TierThreeSubmission;
 if(!s||typeof s.id!=='string'||s.property_id!==propertyId||!['pending','under_review','approved','rejected','cancelled','revoked'].includes(s.status)||typeof s.hasDocument!=='boolean'||typeof s.submitted_at!=='string')throw new Error('Property verification response could not be verified.');
 return s;
}
