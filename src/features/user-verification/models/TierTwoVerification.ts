import type { Enums, Tables } from '../../../shared/services/supabase/database.types';

export type TierTwoDocumentType = Extract<Enums<'verification_document_type'>, 'drivers_license' | 'umid' | 'passport' | 'philsys_id'>;
export const tierTwoDocumentOptions = [
  { label: 'Driver’s License', value: 'drivers_license' },
  { label: 'UMID', value: 'umid' },
  { label: 'Passport', value: 'passport' },
  { label: 'National ID / PhilSys ID', value: 'philsys_id' },
] as const satisfies ReadonlyArray<{ label: string; value: TierTwoDocumentType }>;

export function getTierTwoDocumentType(label: string): TierTwoDocumentType | null {
  return tierTwoDocumentOptions.find((option) => option.label === label)?.value ?? null;
}

export type TierTwoSubmission = Pick<Tables<'verification_submissions'>,
  'id' | 'status' | 'rejection_reason' | 'review_note' | 'submitted_at' | 'reviewed_at'> & { hasDocument: boolean };

export const tierTwoStatusLabels: Record<Enums<'verification_status'>, string> = {
  pending: 'Pending', under_review: 'Under Review', approved: 'Approved',
  rejected: 'Rejected', cancelled: 'Cancelled', revoked: 'Revoked',
};

export type TierTwoScreen = 'overview' | 'tier2Intro' | 'tier2IdType' | 'tier2Upload' | 'tier2Review' | 'tier2Status';
