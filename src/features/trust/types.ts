import { UserProfile } from '@/features/profile/types';

export type Rating = {
  id: string;
  raterId: string;
  rateeId: string | null;
  listingRef: string | null;
  score: number;
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RatingSubmission = {
  rateeId?: string | null;
  listingRef?: string | null;
  score: number;
  reviewText: string;
};

export type ReportSubjectType = 'listing' | 'user';
export type ReportStatus = 'pending' | 'upheld' | 'dismissed';

export type Report = {
  id: string;
  reporterId: string;
  subjectType: ReportSubjectType;
  subjectId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportSubmission = {
  subjectType: ReportSubjectType;
  subjectId: string;
  reason: string;
  details: string;
};

export type AdminReportItem = Report & {
  reporter?: UserProfile | null;
};
