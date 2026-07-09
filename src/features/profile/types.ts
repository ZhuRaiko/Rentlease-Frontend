export type AppRole = 'tenant' | 'landlord' | 'admin';
export type AccountStatus = 'tier_1_pending' | 'authenticated' | 'suspended';
export type VerificationTier = 'tier_1' | 'tier_2' | 'tier_3';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export type UserProfile = {
  id: string;
  role: AppRole;
  accountStatus: AccountStatus;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  tier1EmailVerified: boolean;
  tier1PhoneVerified: boolean;
  createdAt: string;
};

export type Verification = {
  id: string;
  userId: string;
  tier: VerificationTier;
  status: VerificationStatus;
  documentUrl: string | null;
  documentType: string | null;
  notes: string | null;
  reviewerNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VerificationSubmission = {
  tier: Exclude<VerificationTier, 'tier_1'>;
  documentType: string;
  documentUrl: string;
  notes: string;
};

export type AdminVerificationItem = Verification & {
  user?: UserProfile | null;
};
