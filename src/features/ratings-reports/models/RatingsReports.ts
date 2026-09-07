export type RatingsReportsActor = 'tenant' | 'landlord';

export type RatingsReportsScreen =
  | 'home'
  | 'reviewAvailable'
  | 'rateParticipant'
  | 'starRating'
  | 'writtenReview'
  | 'reviewConfirmation'
  | 'reviewSubmitted'
  | 'awaitingPublication'
  | 'reviewsSummary'
  | 'reportMenu'
  | 'reportUser'
  | 'reportListing'
  | 'reportMessage'
  | 'reportReason'
  | 'reportDetails'
  | 'evidenceUpload'
  | 'reviewReport'
  | 'reportSubmitted'
  | 'reportStatus'
  | 'moreInfoRequested'
  | 'outcomeDismissed'
  | 'outcomeActionTaken';

export type ReportTargetType = 'user' | 'listing' | 'message';

export type ReportStatus =
  | 'Submitted'
  | 'Under review'
  | 'More information requested'
  | 'Dismissed'
  | 'Action taken';

export interface ReviewSubject {
  id: string;
  name: string;
  role: 'Tenant' | 'Landlord';
  context: string;
  completedAt: string;
}

export interface ReviewDraft {
  rating: number;
  text: string;
}

export interface PublishedReview {
  id: string;
  authorName: string;
  authorRole: 'Tenant' | 'Landlord';
  rating: number;
  text: string;
  publishedAt: string;
}

export interface ReportDraft {
  targetType: ReportTargetType;
  targetName: string;
  reason: string;
  details: string;
  evidenceCount: number;
}

export interface ReportPreview {
  id: string;
  submittedAt: string;
  status: ReportStatus;
}

export const emptyReviewDraft: ReviewDraft = {
  rating: 0,
  text: '',
};

export const emptyReportDraft: ReportDraft = {
  targetType: 'user',
  targetName: 'Samuel Feliciano',
  reason: '',
  details: '',
  evidenceCount: 0,
};

export const previewReviewSubjects: Record<RatingsReportsActor, ReviewSubject> = {
  tenant: {
    id: 'review-landlord-samuel',
    name: 'Samuel Feliciano',
    role: 'Landlord',
    context: '2-Bedroom House with Balcony · Unit UC-06',
    completedAt: 'Tenancy completed September 1, 2026',
  },
  landlord: {
    id: 'review-tenant-maria',
    name: 'Maria Santos',
    role: 'Tenant',
    context: '2-Bedroom House with Balcony · Unit UC-06',
    completedAt: 'Tenancy completed September 1, 2026',
  },
};

export const previewPublishedReviews: PublishedReview[] = [
  {
    id: 'review-one',
    authorName: 'Ana Reyes',
    authorRole: 'Tenant',
    rating: 5,
    text: 'Clear communication, fair house rules, and quick responses whenever the unit needed attention.',
    publishedAt: 'August 2026',
  },
  {
    id: 'review-two',
    authorName: 'Paolo Mendoza',
    authorRole: 'Tenant',
    rating: 4,
    text: 'The property matched the listing and the move-in process was organized.',
    publishedAt: 'May 2026',
  },
  {
    id: 'review-three',
    authorName: 'Carla Villanueva',
    authorRole: 'Landlord',
    rating: 5,
    text: 'Respectful tenant who kept the property clean and coordinated schedules early.',
    publishedAt: 'February 2026',
  },
];

export const reportTargets: Record<ReportTargetType, string> = {
  user: 'Samuel Feliciano',
  listing: '2-Bedroom House with Balcony',
  message: 'Conversation with Samuel Feliciano',
};

export const reportReasons: Record<ReportTargetType, readonly string[]> = {
  user: [
    'Harassment or threatening behavior',
    'Fraud or impersonation',
    'Discrimination',
    'Unsafe conduct',
    'Other user concern',
  ],
  listing: [
    'False or misleading information',
    'Duplicate or unavailable property',
    'Suspicious payment request',
    'Prohibited or unsafe property',
    'Other listing concern',
  ],
  message: [
    'Harassment or abusive language',
    'Spam or unsolicited advertising',
    'Suspicious link or payment request',
    'Personal information concern',
    'Other message concern',
  ],
};

export const initialReportPreview: ReportPreview = {
  id: 'RPT-2026-0918-0142',
  submittedAt: 'September 18, 2026 · 10:28 AM',
  status: 'Submitted',
};
