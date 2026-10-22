import { verificationStatusPresentation, type StatusPresentation } from '../../../shared/models/verificationPresentation';
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

/** Presentation eligibility only; the begin RPC remains authoritative. */
export function tierTwoRecoveryKind(submission: TierTwoSubmission | null): 'initial' | 'correction' | 'upload' | null {
  if (!submission) return 'initial';
  if (submission.status === 'rejected') return 'correction';
  if (submission.status === 'pending' && !submission.hasDocument) return 'upload';
  return null;
}

export function tierTwoSubmissionPresentation(submission: TierTwoSubmission | null, requiresRefresh = false): StatusPresentation {
  if (requiresRefresh) return { label: 'Status Unconfirmed', tone: 'info' };
  if (!submission) return { label: 'Status Unavailable', tone: 'info' };
  if (submission.status === 'pending' && !submission.hasDocument) return { label: 'Incomplete Upload', tone: 'warning' };
  return verificationStatusPresentation(submission.status);
}
