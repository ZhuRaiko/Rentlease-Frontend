import { supabase } from '@/lib/supabase';
import { rowToProfile } from '@/features/profile/profile-service';
import { UserProfile } from '@/features/profile/types';
import {
  AdminReportItem,
  Rating,
  RatingSubmission,
  Report,
  ReportStatus,
  ReportSubmission,
} from '@/features/trust/types';

type RatingRow = {
  id: string;
  rater_id: string;
  ratee_id: string | null;
  listing_ref: string | null;
  score: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  subject_type: Report['subjectType'];
  subject_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserProfileRow = {
  id: string;
  role: UserProfile['role'];
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

const mockRatings: Rating[] = [
  {
    id: 'mock-review-1',
    raterId: 'demo-tenant-1',
    rateeId: 'demo-landlord-2',
    listingRef: 'listing-dasma-studio',
    score: 5,
    reviewText: 'Clean unit, fast replies, and the location was easy for commuting.',
    createdAt: '2026-07-02T08:00:00.000Z',
    updatedAt: '2026-07-02T08:00:00.000Z',
  },
  {
    id: 'mock-review-2',
    raterId: 'demo-tenant-2',
    rateeId: 'demo-landlord-2',
    listingRef: 'listing-dasma-studio',
    score: 4,
    reviewText: 'Good value near school. The viewing schedule was handled smoothly.',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
];

export function rowToRating(row: RatingRow): Rating {
  return {
    id: row.id,
    raterId: row.rater_id,
    rateeId: row.ratee_id,
    listingRef: row.listing_ref,
    score: row.score,
    reviewText: row.review_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getListingRatings(listingId: string) {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('listing_ref', listingId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Using mock ratings because Supabase ratings fetch failed.', error.message);
    return mockRatings.filter((rating) => rating.listingRef === listingId);
  }

  const ratings = (data as RatingRow[]).map(rowToRating);
  return ratings.length > 0 ? ratings : mockRatings.filter((rating) => rating.listingRef === listingId);
}

export async function submitRating(raterId: string, submission: RatingSubmission) {
  const payload = {
    rater_id: raterId,
    ratee_id: isUuid(submission.rateeId) ? submission.rateeId : null,
    listing_ref: submission.listingRef,
    score: submission.score,
    review_text: submission.reviewText,
  };

  const { data, error } = await supabase
    .from('ratings')
    .upsert(payload, { onConflict: 'rater_id,ratee_id,listing_ref' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return rowToRating(data as RatingRow);
}

export async function submitReport(reporterId: string, submission: ReportSubmission) {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      subject_type: submission.subjectType,
      subject_id: submission.subjectId,
      reason: submission.reason,
      details: submission.details,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return rowToReport(data as ReportRow);
}

export async function getAdminReportQueue() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Admin report queue unavailable.', error.message);
    return [];
  }

  const reports = (data as ReportRow[]).map(rowToReport);
  const reporterIds = [...new Set(reports.map((report) => report.reporterId))];
  const { data: users } = reporterIds.length
    ? await supabase.from('users').select('*').in('id', reporterIds)
    : { data: [] };
  const profiles = new Map((users as UserProfileRow[]).map((user) => [user.id, rowToProfile(user)]));

  return reports.map<AdminReportItem>((report) => ({
    ...report,
    reporter: profiles.get(report.reporterId) ?? null,
  }));
}

export async function reviewReport(id: string, status: Extract<ReportStatus, 'upheld' | 'dismissed'>) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('reports')
    .update({
      status,
      reviewed_by: auth.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return rowToReport(data as ReportRow);
}

export function getRatingSummary(ratings: Rating[]) {
  if (ratings.length === 0) {
    return { average: 0, count: 0 };
  }

  const average = ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length;
  return { average: Number(average.toFixed(1)), count: ratings.length };
}

function isUuid(value?: string | null) {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  );
}
