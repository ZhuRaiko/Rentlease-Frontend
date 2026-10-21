import type { Database, Enums, Tables } from '../../../shared/services/supabase/database.types';
import { isPreviewImage } from '../../../shared/models/documentImagePreview';

// RPC projection is generated from the deployed migration, not a parallel schema.
type GeneratedQueueRow = Database['public']['Functions']['get_admin_verification_queue']['Returns'][number];
// SQL LEFT JOIN/profile fields can be null even when function type generation omits nullability.
export type AdminVerificationRow = Omit<GeneratedQueueRow, 'property_id' | 'submitted_note' | 'trust_score' | 'tier1_verified_at' | 'tier2_verified_at' | 'tier3_verified_at' | 'document_id' | 'document_type' | 'file_name' | 'mime_type' | 'storage_path' | 'document_created_at'> & {
  property_id: string | null; submitted_note: string | null; trust_score: number | null;
  tier1_verified_at: string | null; tier2_verified_at: string | null; tier3_verified_at: string | null;
  document_id: string | null; document_type: Enums<'verification_document_type'> | null;
  file_name: string | null; mime_type: string | null; storage_path: string | null; document_created_at: string | null;
};
export function mapAdminVerification(row: AdminVerificationRow) {
  return {
    submissionId: row.submission_id, userId: row.user_id, displayName: row.display_name,
    tier: row.tier, status: row.status, submittedAt: row.submitted_at, updatedAt: row.updated_at,
    submittedNote: row.submitted_note, propertyId: row.property_id, trustScore: row.trust_score,
    tier1VerifiedAt: row.tier1_verified_at, tier2VerifiedAt: row.tier2_verified_at, tier3VerifiedAt: row.tier3_verified_at,
    documentCount: row.document_count, documentType: row.document_type, fileName: row.file_name, mimeType: row.mime_type,
  };
}
export type AdminVerificationQueueItem = ReturnType<typeof mapAdminVerification>;
export type AdminReviewStatus = Extract<Enums<'verification_status'>, 'under_review' | 'approved' | 'rejected'>;
export interface AdminReviewInput { submissionId: string; status: AdminReviewStatus; reviewNote?: string; rejectionReason?: string }
export interface AdminVerificationSubmissionDetail { item: AdminVerificationQueueItem; documents: Tables<'verification_documents'>[] }
export interface AdminDocumentPreview {
  requestId: number;
  isOpening: boolean;
  isVisible: boolean;
  documentId: string;
  fileName: string | null;
  mimeType: string | null;
  documentType: Enums<'verification_document_type'>;
  signedUrl: string | null;
  error: string | null;
}
export function isSupportedVerificationImage(mimeType: string | null): boolean {
  return isPreviewImage(mimeType);
}
const documentLabels: Record<Enums<'verification_document_type'>, string> = {
  passport: 'Passport', drivers_license: 'Driver’s License', umid: 'UMID', philsys_id: 'National ID / PhilSys ID',
  land_title: 'Land Title', tax_declaration: 'Tax Declaration', hoa_document: 'HOA Document', authorization_to_lease: 'Authorization to Lease', other: 'Other',
};
export const documentTypeLabel = (type: Enums<'verification_document_type'> | null) => type ? documentLabels[type] : 'No document attached';
export const verificationTierLabel = (tier: Enums<'verification_tier'>) => tier === 'tier_2_identity' ? 'Tier 2 Identity' : 'Tier 3 Property';
const statusLabels: Record<Enums<'verification_status'>, string> = {
  pending: 'Pending', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled', revoked: 'Revoked',
};
export const verificationStatusLabel = (status: Enums<'verification_status'>) => statusLabels[status];
export { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';
