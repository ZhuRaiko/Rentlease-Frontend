import type { Enums } from '../services/supabase/database.types';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';
export interface StatusPresentation { label: string; tone: FeedbackTone }
const statuses: Record<Enums<'verification_status'>, StatusPresentation> = {
  pending: { label: 'Pending', tone: 'warning' }, under_review: { label: 'Under Review', tone: 'info' },
  approved: { label: 'Verified', tone: 'success' }, rejected: { label: 'Rejected', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'info' }, revoked: { label: 'Revoked', tone: 'error' },
};
export const verificationStatusPresentation = (status: Enums<'verification_status'>) => statuses[status];
export const needsVerificationRecovery = (state: { loaded: boolean; requiresRefresh: boolean; error: string | null }) => !state.loaded || state.requiresRefresh || !!state.error;
