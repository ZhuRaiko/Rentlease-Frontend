import { supabase } from '@/lib/supabase';
import {
  AdminVerificationItem,
  AppRole,
  UserProfile,
  Verification,
  VerificationStatus,
  VerificationSubmission,
} from '@/features/profile/types';

type UserProfileRow = {
  id: string;
  role: AppRole;
  account_status: UserProfile['accountStatus'];
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  tier_1_email_verified: boolean;
  tier_1_phone_verified: boolean;
  created_at: string;
};

type VerificationRow = {
  id: string;
  user_id: string;
  tier: Verification['tier'];
  status: VerificationStatus;
  document_url: string | null;
  document_type: string | null;
  notes: string | null;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    role: row.role,
    accountStatus: row.account_status,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    nickname: row.nickname,
    tier1EmailVerified: row.tier_1_email_verified,
    tier1PhoneVerified: row.tier_1_phone_verified,
    createdAt: row.created_at,
  };
}

export function rowToVerification(row: VerificationRow): Verification {
  return {
    id: row.id,
    userId: row.user_id,
    tier: row.tier,
    status: row.status,
    documentUrl: row.document_url,
    documentType: row.document_type,
    notes: row.notes,
    reviewerNote: row.reviewer_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMyProfile(userId?: string) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

  if (error || !data) {
    if (error) console.warn('Profile fetch failed.', error.message);
    return null;
  }

  return rowToProfile(data as UserProfileRow);
}

export async function getMyVerifications(userId?: string) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('verifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Verification fetch failed.', error.message);
    return [];
  }

  return (data as VerificationRow[]).map(rowToVerification);
}

export async function updateMyRole(role: Exclude<AppRole, 'admin'>) {
  const { data, error } = await supabase.rpc('set_my_role', { next_role: role });

  if (error) {
    throw error;
  }

  return rowToProfile(data as UserProfileRow);
}

export async function submitVerification(userId: string, submission: VerificationSubmission) {
  const payload = {
    user_id: userId,
    tier: submission.tier,
    status: 'pending',
    document_type: submission.documentType,
    document_url: submission.documentUrl,
    notes: submission.notes,
    reviewer_note: null,
    reviewed_by: null,
    reviewed_at: null,
  };

  const { data, error } = await supabase
    .from('verifications')
    .upsert(payload, { onConflict: 'user_id,tier' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return rowToVerification(data as VerificationRow);
}

export async function getAdminVerificationQueue() {
  const { data, error } = await supabase
    .from('verifications')
    .select('*')
    .in('tier', ['tier_2', 'tier_3'])
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Admin verification queue unavailable.', error.message);
    return [];
  }

  const verifications = (data as VerificationRow[]).map(rowToVerification);
  const userIds = [...new Set(verifications.map((item) => item.userId))];

  const { data: users } = userIds.length
    ? await supabase.from('users').select('*').in('id', userIds)
    : { data: [] };

  const profiles = new Map((users as UserProfileRow[]).map((user) => [user.id, rowToProfile(user)]));

  return verifications.map<AdminVerificationItem>((verification) => ({
    ...verification,
    user: profiles.get(verification.userId) ?? null,
  }));
}

export async function reviewVerification(
  id: string,
  status: Extract<VerificationStatus, 'approved' | 'rejected'>,
  reviewerNote: string
) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('verifications')
    .update({
      status,
      reviewer_note: reviewerNote,
      reviewed_by: auth.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return rowToVerification(data as VerificationRow);
}

export function calculateTrustScore(verifications: Verification[]) {
  const tierStatus = new Map(verifications.map((verification) => [verification.tier, verification.status]));
  const tier1 = tierStatus.get('tier_1') === 'approved' ? 0.4 : 0;
  const tier2 = tierStatus.get('tier_2') === 'approved' ? 0.4 : 0;
  const tier3 = tierStatus.get('tier_3') === 'approved' ? 0.2 : 0;
  return Number((tier1 + tier2 + tier3).toFixed(1));
}

export function trustBadgeForScore(score: number) {
  if (score >= 1) return 'Premium';
  if (score >= 0.8) return 'Trusted';
  if (score >= 0.4) return 'Verified';
  return 'Unverified';
}
