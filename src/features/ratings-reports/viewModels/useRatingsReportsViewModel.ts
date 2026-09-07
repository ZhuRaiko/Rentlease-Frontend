import { useMemo, useState } from 'react';

import {
  emptyReportDraft,
  emptyReviewDraft,
  initialReportPreview,
  previewPublishedReviews,
  previewReviewSubjects,
  reportReasons,
  reportTargets,
  type RatingsReportsActor,
  type RatingsReportsScreen,
  type ReportDraft,
  type ReportPreview,
  type ReportStatus,
  type ReportTargetType,
  type ReviewDraft,
} from '../models/RatingsReports';

export function useRatingsReportsViewModel(actor: RatingsReportsActor) {
  const [screen, setScreen] = useState<RatingsReportsScreen>('home');
  const [history, setHistory] = useState<RatingsReportsScreen[]>([]);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(emptyReviewDraft);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(emptyReportDraft);
  const [reportPreview, setReportPreview] = useState<ReportPreview>(initialReportPreview);
  const [additionalInformation, setAdditionalInformation] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const reviewSubject = previewReviewSubjects[actor];
  const availableReasons = reportReasons[reportDraft.targetType];
  const averageRating = useMemo(() => {
    const total = previewPublishedReviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / previewPublishedReviews.length).toFixed(1);
  }, []);

  const navigate = (next: RatingsReportsScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(next);
    setNotice(null);
  };

  const replace = (next: RatingsReportsScreen) => {
    setScreen(next);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1) ?? 'home';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const openHome = () => {
    setScreen('home');
    setHistory([]);
    setNotice(null);
  };

  const startReview = () => {
    setReviewDraft(emptyReviewDraft);
    navigate('reviewAvailable');
  };

  const setRating = (rating: number) =>
    setReviewDraft((current) => ({ ...current, rating }));

  const setReviewText = (text: string) =>
    setReviewDraft((current) => ({ ...current, text }));

  const submitReview = () => replace('reviewSubmitted');

  const openReportMenu = () => {
    setReportDraft(emptyReportDraft);
    navigate('reportMenu');
  };

  const chooseReportTarget = (targetType: ReportTargetType) => {
    setReportDraft({
      ...emptyReportDraft,
      targetType,
      targetName: reportTargets[targetType],
    });
    navigate(
      targetType === 'user'
        ? 'reportUser'
        : targetType === 'listing'
          ? 'reportListing'
          : 'reportMessage',
    );
  };

  const updateReportDraft = <TField extends keyof ReportDraft>(
    field: TField,
    value: ReportDraft[TField],
  ) => setReportDraft((current) => ({ ...current, [field]: value }));

  const chooseReason = (reason: string) =>
    setReportDraft((current) => ({ ...current, reason }));

  const addEvidencePreview = () =>
    setReportDraft((current) => ({
      ...current,
      evidenceCount: Math.min(3, current.evidenceCount + 1),
    }));

  const removeEvidencePreview = () =>
    setReportDraft((current) => ({
      ...current,
      evidenceCount: Math.max(0, current.evidenceCount - 1),
    }));

  const submitReport = () => {
    setReportPreview({ ...initialReportPreview, status: 'Submitted' });
    replace('reportSubmitted');
  };

  const previewReportStatus = (status: ReportStatus) => {
    setReportPreview((current) => ({ ...current, status }));
    replace(
      status === 'More information requested'
        ? 'moreInfoRequested'
        : status === 'Dismissed'
          ? 'outcomeDismissed'
          : status === 'Action taken'
            ? 'outcomeActionTaken'
            : 'reportStatus',
    );
  };

  const submitAdditionalInformation = () => {
    setReportPreview((current) => ({ ...current, status: 'Under review' }));
    replace('reportStatus');
    setNotice('Additional information added locally. No evidence was uploaded.');
  };

  return {
    actor,
    screen,
    reviewSubject,
    reviewDraft,
    reportDraft,
    reportPreview,
    availableReasons,
    publishedReviews: previewPublishedReviews,
    averageRating,
    additionalInformation,
    notice,
    navigate,
    replace,
    goBack,
    openHome,
    startReview,
    setRating,
    setReviewText,
    submitReview,
    openReportMenu,
    chooseReportTarget,
    updateReportDraft,
    chooseReason,
    addEvidencePreview,
    removeEvidencePreview,
    submitReport,
    previewReportStatus,
    submitAdditionalInformation,
    setAdditionalInformation,
    setNotice,
  };
}

export type RatingsReportsViewModel = ReturnType<typeof useRatingsReportsViewModel>;
