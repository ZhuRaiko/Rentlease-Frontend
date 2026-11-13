import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { useRentalReviews } from '../../../shared/viewModels/useRentalReviews';
import { useReporting } from '../../../shared/viewModels/useReporting';
import type { ReportScope } from '../../../shared/models/Reporting';
import type { ReviewStatus } from '../../../shared/models/RentalReview';
import { createAdminVerificationService } from '../services/adminVerificationService';
import { createAdminActionsService } from '../services/adminActionsService';
import { createAdminActionsWorkflow } from './adminActionsWorkflow';
import { reportActionOptions, type AdminAuditEntry, type AuditKind } from '../models/AdminActions';
import { auditRelatedTarget, type AuditRelated } from '../models/AuditPresentation';
import { createAdminVerificationQueue } from './adminVerificationQueue';
import type { AdminModerationScreen, AdminQueueTab } from '../models/AdminModeration';
import {
  filterReports,
  isOpenReport,
  oldestOf,
  reportDecisionConfirmation,
  reportDecisionOptions,
  reviewDecisionConfirmation,
  reviewDecisionOptions,
  summarizeAdminWork,
  type ReportDecisionStatus,
  type ReportQueueFilter,
  type ReviewDecisionStatus,
} from '../models/AdminQueuePresentation';

// One stable scope for the whole Admin session: counts stay consistent and the pending-operation journal is never split.
// Type and open/closed filters are applied to the loaded page, not by changing the backend scope.
const reportScope: ReportScope = { mode: 'admin', kind: 'all', status: 'all' };
const reviewPageSize = 20;

/** Keeps the last real value per account so a count does not blink to "--" while its list reloads. Never invents a value. */
function useLastKnown<T>(actor: string | undefined, value: T | null): T | null {
  const ref = useRef<{ actor: string | undefined; value: T | null }>({ actor, value: null });
  if (ref.current.actor !== actor) ref.current = { actor, value: null };
  if (value !== null) ref.current.value = value;
  return ref.current.value;
}

export function useAdminModerationViewModel(accountId?: string) {
  const [verificationQueue] = useState(() => createAdminVerificationQueue(createAdminVerificationService(getSupabaseClient)));
  const verification = useSyncExternalStore(verificationQueue.subscribe, verificationQueue.getSnapshot);
  useEffect(() => { verificationQueue.activate(); void verificationQueue.refresh(); return () => verificationQueue.dispose(); }, [verificationQueue]);
  // Admin actions and audit log (migration 20261113180000): one workflow for the Actions tab, the Audit tab, recent decisions and the action sheet.
  const [actionsWorkflow] = useState(() => createAdminActionsWorkflow(createAdminActionsService(getSupabaseClient), randomUUID));
  const actions = useSyncExternalStore(actionsWorkflow.subscribe, actionsWorkflow.getSnapshot);
  useEffect(() => { actionsWorkflow.activate(); return () => actionsWorkflow.dispose(); }, [actionsWorkflow]);
  const reports = useReporting(accountId, reportScope);
  const [reviewStatus, setReviewStatusState] = useState<ReviewStatus>('pending');
  const reviews = useRentalReviews(accountId, { mode: 'moderation', status: reviewStatus });

  const [screen, setScreen] = useState<AdminModerationScreen>('dashboard');
  const [history, setHistory] = useState<AdminModerationScreen[]>([]);
  const [verificationFilter, setVerificationFilter] = useState('All');
  const [queueTab, setQueueTab] = useState<AdminQueueTab>('verification');
  const [reportFilter, setReportFilter] = useState<ReportQueueFilter>('open');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedRestrictionId, setSelectedRestrictionId] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [reportDecision, setReportDecision] = useState<ReportDecisionStatus | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportPublicSummary, setReportPublicSummary] = useState('');

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecisionStatus | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const resetReviewDraft = () => { setReviewDecision(null); setReviewNote(''); };

  // Coming back from an audit entry (or from a report opened out of one) keeps the rows, filter and "Load more" progress already on screen.
  const previousScreen = useRef<AdminModerationScreen>(screen);
  useEffect(() => {
    const previous = previousScreen.current;
    previousScreen.current = screen;
    if (screen === 'activeRestrictions') void actionsWorkflow.loadRestrictions();
    else if (screen === 'auditHistory') { if (previous !== 'auditEntry' || actionsWorkflow.getSnapshot().audit.status !== 'success') void actionsWorkflow.loadAudit(); }
    else if (screen === 'dashboard') void actionsWorkflow.loadRecent();
  }, [screen, actionsWorkflow]);
  // A successful restore removes the account from the list, so return to the list with the confirmation.
  useEffect(() => { if (actions.submit.notice && screen === 'restrictionDetails') { setSelectedRestrictionId(null); setScreen('activeRestrictions'); setHistory([]); } }, [actions.submit.notice]);

  const resetReportDraft = () => { setReportDecision(null); setReportNote(''); setReportPublicSummary(''); };
  // A saved decision clears the form (the report reloads with its new status); same behavior as before.
  useEffect(() => { if (reports.notice) resetReportDraft(); }, [reports.notice]);
  // A saved review decision moves the review out of its current list, so return to the Reviews tab with the confirmation.
  useEffect(() => {
    if (!reviews.notice) return;
    resetReviewDraft();
    setSelectedReviewId(null);
    if (screen === 'reviewDetails') { setQueueTab('reviews'); setScreen('reviewQueues'); setHistory([]); }
  }, [reviews.notice]);

  const reportRowsAll = reports.data?.rows ?? [];
  const selectedRestriction = selectedRestrictionId ? actions.restrictions.rows.find((row) => row.userId === selectedRestrictionId) ?? null : null;
  const reportActions = reportActionOptions(selectedReportId ? (reports.data?.rows ?? []).find((row) => row.id === selectedReportId) ?? null : null);
  const selectedReport = selectedReportId ? reportRowsAll.find((row) => row.id === selectedReportId) ?? null : null;
  const reportLocked = reports.busy || reports.saving || !!reports.pending || !reports.ready;
  const reportDirty = !!reportDecision || !!reportNote || !!reportPublicSummary;
  const decisionOptions = selectedReport ? reportDecisionOptions(selectedReport.status) : [];
  const chosenOption = decisionOptions.find((option) => option.status === reportDecision) ?? null;
  const reportCanSave = !!selectedReport && !!chosenOption && !chosenOption.disabledReason && !!reportNote.trim() && !reportLocked;

  const verificationCount = verification.status === 'success' ? verification.queue.length : null;
  const reportCount = useLastKnown(accountId, reports.data ? reports.data.openCount : null);
  const reviewRows = reviews.data?.type === 'queue' ? reviews.data.rows : null;
  // The badge and dashboard count the pending list only; other status views never overwrite it.
  const pendingRows = reviewStatus === 'pending' ? reviewRows : null;
  const reviewCount = useLastKnown(accountId, pendingRows ? pendingRows.length : null);
  const reviewCountIsLowerBound = useLastKnown(accountId, pendingRows ? pendingRows.length >= reviewPageSize : null) ?? false;
  const reviewLocked = reviews.busy || reviews.saving || !!reviews.pending || !reviews.ready;
  const selectedReview = selectedReviewId ? reviewRows?.find((row) => row.id === selectedReviewId) ?? null : null;
  const reviewOptions = selectedReview ? reviewDecisionOptions(selectedReview.status) : [];
  const reviewCanSave = !!selectedReview && reviewOptions.some((option) => option.status === reviewDecision) && !!reviewNote.trim() && !reviewLocked;

  const work = summarizeAdminWork({
    verification: { count: verificationCount, oldest: oldestOf(verification.queue.map((item) => item.submittedAt)) },
    // The newest-first report page and the review page are only a window: "oldest" is shown only when the window is the whole queue.
    reports: { count: reportCount, oldest: reports.data && reports.data.count <= reports.data.rows.length ? oldestOf(reports.data.rows.filter((row) => isOpenReport(row.status)).map((row) => row.submittedAt)) : null },
    reviews: { count: reviewCount, oldest: pendingRows && pendingRows.length < reviewPageSize ? oldestOf(pendingRows.map((row) => row.createdAt)) : null },
  });

  const navigate = (next: AdminModerationScreen) => {
    if (verificationQueue.getSnapshot().reviewBusy) return;
    verificationQueue.cancelReview();
    verificationQueue.closePrivateDocument();
    setHistory((current) => [...current, screen]);
    setScreen(next);
  };

  const leave = () => {
    if (verificationQueue.getSnapshot().reviewBusy || actionsWorkflow.getSnapshot().submit.busy) return;
    actionsWorkflow.cancelAction();
    verificationQueue.cancelReview();
    verificationQueue.closePrivateDocument();
    setHistory((current) => {
      const previous = current.at(-1) ?? 'dashboard';
      setScreen(previous);
      return current.slice(0, -1);
    });
  };

  const openSection = (next: AdminModerationScreen, tab?: AdminQueueTab) => {
    if (verificationQueue.getSnapshot().reviewBusy || actionsWorkflow.getSnapshot().submit.busy) return;
    actionsWorkflow.cancelAction();
    actionsWorkflow.dismissNotice();
    verificationQueue.cancelReview();
    verificationQueue.closePrivateDocument();
    if (tab) setQueueTab(tab);
    setScreen(next);
    setHistory([]);
  };

  const openVerification = (id: string, trail: AdminModerationScreen[] = ['reviewQueues']) => {
    if (verificationQueue.getSnapshot().reviewBusy) return;
    void verificationQueue.select(id);
    setScreen('verificationDetails');
    setHistory(trail);
  };

  const openReport = (id: string, trail: AdminModerationScreen[] = ['reviewQueues']) => {
    if (reports.saving) return;
    setSelectedReportId(id);
    resetReportDraft();
    setScreen('reportDetails');
    setHistory(trail);
  };

  const openReview = (id: string, trail: AdminModerationScreen[] = ['reviewQueues']) => {
    if (reviews.saving) return;
    setSelectedReviewId(id);
    resetReviewDraft();
    setScreen('reviewDetails');
    setHistory(trail);
  };

  const openRestriction = (userId: string) => {
    if (actions.submit.busy) return;
    actionsWorkflow.dismissNotice();
    setSelectedRestrictionId(userId);
    setScreen('restrictionDetails');
    setHistory(['activeRestrictions']);
  };
  // ---- Audit entries. The record is looked up in the loaded rows each time, so a refresh can never leave a stale copy on screen.
  const selectedAuditEntry: AdminAuditEntry | null = selectedAuditId ? actions.audit.rows.find((row) => row.id === selectedAuditId) ?? null : null;
  const openAuditEntry = (id: string) => {
    if (actions.audit.rows.some((row) => row.id === id)) { setSelectedAuditId(id); navigate('auditEntry'); }
  };
  /** The report, submission or review an audit row points at, but only when that record is in the data this session already loaded (otherwise no button). */
  const auditRelatedAvailable = (entry: AdminAuditEntry): AuditRelated | null => {
    const target = auditRelatedTarget(entry);
    if (!target) return null;
    const present = target.kind === 'report' ? reportRowsAll.some((row) => row.id === target.id)
      : target.kind === 'verification' ? verification.queue.some((item) => item.submissionId === target.id)
      : (reviewRows ?? []).some((row) => row.id === target.id);
    return present ? target : null;
  };
  const openAuditRelated = (entry: AdminAuditEntry) => {
    const target = auditRelatedAvailable(entry);
    if (!target) return;
    const trail: AdminModerationScreen[] = ['auditHistory', 'auditEntry'];
    if (target.kind === 'report') openReport(target.id, trail);
    else if (target.kind === 'verification') openVerification(target.id, trail);
    else openReview(target.id, trail);
  };
  const openRestore = () => {
    if (!selectedRestriction || !selectedRestriction.restorable) return;
    actionsWorkflow.openAction({ action: 'restore_account', targetUserId: selectedRestriction.userId, targetListingId: null, reportId: null, targetLabel: selectedRestriction.name });
  };
  const openReportAction = () => {
    const option = reportActions[0], row = selectedReport;
    if (!option || !row) return;
    actionsWorkflow.openAction({ action: option.action, targetUserId: option.targetUserId, targetListingId: option.targetListingId, reportId: row.id, targetLabel: row.label });
  };

  /** Back on a report review keeps the old guards: wait while saving, confirm before discarding a draft or a pending operation. */
  const guardedBack = (leave: () => void) => {
    if (actions.submit.busy) { Alert.alert('Action in progress', 'Wait for the result before leaving.'); return; }
    if (screen === 'reviewDetails' && reviews.saving) { Alert.alert('Review in progress', 'Wait until the result is confirmed.'); return; }
    if (screen !== 'reportDetails') { leave(); return; }
    if (reports.saving) { Alert.alert('Report action in progress', 'Wait for the outcome before leaving.'); return; }
    if (reports.pending || reportDirty) {
      Alert.alert('Leave this review?', reports.pending ? 'The pending operation is kept for exact retry. Keep app data until it is reconciled.' : 'Your unsent decision will be discarded.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', onPress: () => { resetReportDraft(); leave(); } }]);
      return;
    }
    leave();
  };

  const goBack = () => guardedBack(leave);

  const saveReportDecision = () => {
    const row = selectedReport, status = chosenOption?.status;
    if (!row || !status || !reportCanSave) return;
    const note = reportNote, publicSummary = status === 'under_review' ? '' : reportPublicSummary;
    Alert.alert('Confirm report decision', reportDecisionConfirmation(status), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => void reports.workflow.submit({ action: 'moderate', reportId: row.id, revision: row.revision, status, note, publicSummary }) },
    ]);
  };

  const saveReviewDecision = () => {
    const row = selectedReview, status = reviewDecision;
    if (!row || !status || !reviewCanSave) return;
    const revision = row.revision, reviewId = row.id, note = reviewNote;
    Alert.alert('Confirm moderation', reviewDecisionConfirmation(status), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => void reviews.workflow.submit({ action: 'moderate', reviewId, revision, status, note }) },
    ]);
  };

  const refreshVerification = () => {
    const current = verificationQueue.getSnapshot();
    if (current.status === 'loading' || current.reviewBusy) return Promise.resolve();
    return verificationQueue.refresh();
  };
  const refreshReports = () => reports.workflow.load(0);
  const refreshReviews = () => reviews.workflow.load(0);

  return {
    requestBack: goBack,
    backFromWorkspace: (onClose: () => void) => { if (screen === 'dashboard') onClose(); else goBack(); },
    screen,
    verification,
    dashboardNeedsRecovery: !verification.reviewBusy && (verification.status === 'error' || verification.reviewNeedsRefresh),
    verificationSubmissions: verification.queue.filter((item) => verificationFilter === 'All' || item.tier === (verificationFilter === 'Tier 2' ? 'tier_2_identity' : 'tier_3_property')),
    verificationFilter, setVerificationFilter,
    queueRefreshing: queueTab === 'verification' ? verification.status === 'loading' : queueTab === 'reports' ? reports.busy : reviews.busy,
    refreshVerification,
    refreshActiveQueue: () => queueTab === 'verification' ? refreshVerification() : queueTab === 'reports' ? refreshReports() : refreshReviews(),
    returnToVerificationQueue: async () => {
      if (verificationQueue.getSnapshot().reviewBusy) return;
      openSection('reviewQueues', 'verification');
      await verificationQueue.refresh();
    },
    reviewActions: verificationQueue.reviewActions(),
    approveBlockedReason: verificationQueue.approveBlockedReason(),
    requestReview: verificationQueue.requestReview,
    cancelReview: verificationQueue.cancelReview,
    setRejectionReason: verificationQueue.setRejectionReason,
    setSameAssetConfirmed: verificationQueue.setSameAssetConfirmed,
    confirmReview: async () => {
      if (await verificationQueue.confirmReview()) {
        setQueueTab('verification'); setScreen('reviewQueues'); setHistory([]);
      }
    },
    canViewPrivateDocument: verificationQueue.canViewPrivateDocument,
    openPrivateDocument: verificationQueue.openPrivateDocument,
    closePrivateDocument: verificationQueue.closePrivateDocument,
    privateDocumentFailed: verificationQueue.privateDocumentFailed,
    selectedVerification: verification.detail,
    // Queues tab + counts. A null count means "not loaded", never zero.
    queueTab, setQueueTab,
    verificationCount, reportCount, reviewCount, reviewCountIsLowerBound,
    work,
    // Reports
    reportFilter, setReportFilter,
    reportRows: filterReports(reportRowsAll, reportFilter),
    reportsLoaded: !!reports.data,
    reportsBusy: reports.busy, reportsSaving: reports.saving, reportsReady: reports.ready,
    reportsError: reports.error, reportsNotice: reports.notice, reportsPending: !!reports.pending,
    reportsHasPrevious: reports.offset > 0,
    reportsHasMore: !!reports.data && reports.offset + reports.data.rows.length < reports.data.count && reports.offset < 10000,
    reportsLocked: reportLocked,
    refreshReports,
    retryReports: () => reports.workflow.retry(),
    previousReports: () => reports.workflow.load(Math.max(0, reports.offset - 20)),
    moreReports: () => reports.workflow.load(reports.offset + 20),
    selectedReport, openReport,
    decisionOptions, reportDecision, setReportDecision,
    reportNote, setReportNote, reportPublicSummary, setReportPublicSummary,
    reportCanSave, saveReportDecision,
    // Actions, restrictions and the audit log (real data; migration 20261113180000)
    restrictions: actions.restrictions, auditLog: actions.audit, recentDecisions: actions.recent,
    actionDraft: actions.draft, actionSubmit: actions.submit,
    selectedRestriction, openRestriction, openRestore, reportActions, openReportAction,
    updateActionDraft: actionsWorkflow.updateDraft, cancelAction: actionsWorkflow.cancelAction, confirmAction: actionsWorkflow.confirmAction, dismissActionNotice: actionsWorkflow.dismissNotice,
    refreshRestrictions: () => actionsWorkflow.loadRestrictions(),
    loadAudit: (kind: AuditKind, offset = 0) => actionsWorkflow.loadAudit(kind, offset),
    loadMoreAudit: () => actionsWorkflow.loadMoreAudit(),
    selectedAuditEntry, openAuditEntry, auditRelatedAvailable, openAuditRelated,
    refreshRecentDecisions: () => actionsWorkflow.loadRecent(),
    // Reviews (status filters and paging; decisions use the structured review screen)
    reviewStatus,
    setReviewStatus: (next: ReviewStatus) => { if (!reviewLocked) { setReviewStatusState(next); setSelectedReviewId(null); resetReviewDraft(); } },
    reviewRows: reviewRows ?? [],
    reviewsLoaded: !!reviewRows,
    reviewsBusy: reviews.busy, reviewsError: reviews.error, reviewsNotice: reviews.notice,
    reviewsSaving: reviews.saving, reviewsReady: reviews.ready, reviewsPending: !!reviews.pending, reviewsLocked: reviewLocked,
    reviewsHasPrevious: reviews.offset > 0,
    reviewsHasMore: !!reviewRows && reviewRows.length === reviewPageSize && reviews.offset < 10000,
    previousReviews: () => reviews.workflow.load(Math.max(0, reviews.offset - reviewPageSize)),
    moreReviews: () => reviews.workflow.load(reviews.offset + reviewPageSize),
    retryReviews: () => reviews.workflow.retry(),
    selectedReview, openReview,
    reviewOptions, reviewDecision, setReviewDecision, reviewNote, setReviewNote, reviewCanSave, saveReviewDecision,
    refreshReviews,
    navigate,
    goBack,
    openSection,
    openVerification,
  };
}

export type AdminModerationViewModel = ReturnType<typeof useAdminModerationViewModel>;
