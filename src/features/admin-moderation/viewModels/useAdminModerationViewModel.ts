import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { createAdminVerificationService } from '../services/adminVerificationService';
import { createAdminVerificationQueue } from './adminVerificationQueue';

import {
  initialDecisionDraft,
  previewActiveRestrictions,
  previewAuditEntries,
  previewModerationReports,
  type ActiveRestrictionPreview,
  type AdminModerationScreen,
  type AuditEntryPreview,
  type ModerationActionType,
  type ModerationDecisionDraft,
  type ModerationReportPreview,
  type ReportQueueStatus,
} from '../models/AdminModeration';

export function useAdminModerationViewModel() {
  const [verificationQueue] = useState(() => createAdminVerificationQueue(createAdminVerificationService(getSupabaseClient)));
  const verification = useSyncExternalStore(verificationQueue.subscribe, verificationQueue.getSnapshot);
  useEffect(() => { verificationQueue.activate(); void verificationQueue.refresh(); return () => verificationQueue.dispose(); }, [verificationQueue]);
  const [screen, setScreen] = useState<AdminModerationScreen>('dashboard');
  const [history, setHistory] = useState<AdminModerationScreen[]>([]);
  const [verificationFilter, setVerificationFilter] = useState('All');
  const [reports, setReports] = useState<ModerationReportPreview[]>(previewModerationReports);
  const [restrictions, setRestrictions] = useState<ActiveRestrictionPreview[]>(previewActiveRestrictions);
  const [auditEntries, setAuditEntries] = useState<AuditEntryPreview[]>(previewAuditEntries);
  const [selectedReportId, setSelectedReportId] = useState(previewModerationReports[0]?.id ?? '');
  const [selectedRestrictionId, setSelectedRestrictionId] = useState(previewActiveRestrictions[0]?.id ?? '');
  const [decisionDraft, setDecisionDraft] = useState<ModerationDecisionDraft>(initialDecisionDraft);
  const [verificationNote, setVerificationNote] = useState('');
  const [reportInformationRequest, setReportInformationRequest] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const selectedReport = reports.find((item) => item.id === selectedReportId) ?? reports[0];
  const selectedRestriction = restrictions.find((item) => item.id === selectedRestrictionId) ?? restrictions[0];

  const pendingVerificationCount = verification.queue.filter((item) => item.status === 'pending').length;
  const openReportCount = useMemo(
    () => reports.filter((item) => item.status !== 'Dismissed' && item.status !== 'Action taken').length,
    [reports],
  );

  const navigate = (next: AdminModerationScreen) => {
    if (verificationQueue.getSnapshot().reviewBusy) return;
    verificationQueue.cancelReview();
    verificationQueue.closePrivateDocument();
    setHistory((current) => [...current, screen]);
    setScreen(next);
    setNotice(null);
  };

  const replace = (next: AdminModerationScreen) => {
    if (verificationQueue.getSnapshot().reviewBusy) return;
    verificationQueue.cancelReview();
    verificationQueue.closePrivateDocument();
    setScreen(next);
    setNotice(null);
  };

  const goBack = () => {
    if (verificationQueue.getSnapshot().reviewBusy) return;
    verificationQueue.cancelReview();
    verificationQueue.closePrivateDocument();
    setHistory((current) => {
      const previous = current.at(-1) ?? 'dashboard';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const openSection = (next: AdminModerationScreen) => {
    if (verificationQueue.getSnapshot().reviewBusy) return;
    verificationQueue.cancelReview();
    verificationQueue.closePrivateDocument();
    setScreen(next);
    setHistory([]);
    setNotice(null);
  };

  const openVerification = (id: string) => {
    if (verificationQueue.getSnapshot().reviewBusy) return;
    void verificationQueue.select(id);
    setScreen('verificationDetails');
    setHistory(['verificationQueue']);
    setVerificationNote('');
    setNotice(null);
  };

  const openReport = (id: string) => {
    setSelectedReportId(id);
    setScreen('reportDetails');
    setHistory(['reportsQueue']);
    setReportInformationRequest('');
    setNotice(null);
  };

  const updateReportStatus = (status: ReportQueueStatus, auditAction: string) => {
    setReports((current) => current.map((item) => item.id === selectedReportId ? { ...item, status } : item));
    appendAudit(auditAction, selectedReport?.targetName ?? 'Reported subject', selectedReportId, status === 'Dismissed' ? 'neutral' : status === 'Action taken' ? 'danger' : 'warning');
  };

  const requestReportInformation = () => {
    updateReportStatus('Information requested', 'Report information requested');
    replace('moderationConfirmation');
    setDecisionDraft({ ...initialDecisionDraft, action: null, reason: reportInformationRequest || 'Additional context is required from the reporter', userNotice: 'More information is required to continue reviewing your report.' });
  };

  const dismissReport = () => {
    updateReportStatus('Dismissed', 'Report dismissed');
    replace('moderationConfirmation');
    setDecisionDraft({ ...initialDecisionDraft, action: null, reason: decisionDraft.reason || 'Available information did not confirm a policy violation', userNotice: 'The report was reviewed and closed without enforcement action.' });
  };

  const chooseModerationAction = (action: ModerationActionType, next: AdminModerationScreen) => {
    setDecisionDraft({ ...initialDecisionDraft, action });
    navigate(next);
  };

  const updateDecisionDraft = <TField extends keyof ModerationDecisionDraft>(field: TField, value: ModerationDecisionDraft[TField]) => {
    setDecisionDraft((current) => ({ ...current, [field]: value }));
  };

  const confirmModerationAction = () => {
    const action = decisionDraft.action;
    if (!action) return;
    updateReportStatus('Action taken', action);
    if (action === 'Account restriction' || action === 'Account suspension' || action === 'Permanent account removal') {
      const restriction: ActiveRestrictionPreview = {
        id: `RST-LOCAL-${Date.now()}`,
        userName: selectedReport?.reportedUserName ?? 'Reported user',
        action,
        reason: decisionDraft.reason,
        startedAt: 'Today · Local preview',
        endsAt: action === 'Permanent account removal' ? 'Permanent' : decisionDraft.duration,
        caseId: selectedReportId,
      };
      setRestrictions((current) => [restriction, ...current]);
      setSelectedRestrictionId(restriction.id);
    }
    replace('moderationConfirmation');
  };

  const openRestriction = (id: string) => {
    setSelectedRestrictionId(id);
    navigate('restoreAccount');
  };

  const restoreAccount = () => {
    const restriction = selectedRestriction;
    setRestrictions((current) => current.filter((item) => item.id !== selectedRestrictionId));
    appendAudit('Account restored', restriction?.userName ?? 'Restricted user', restriction?.caseId ?? selectedRestrictionId, 'positive');
    replace('moderationConfirmation');
    setDecisionDraft({ ...initialDecisionDraft, action: null, reason: verificationNote || 'Restriction reviewed and lifted', userNotice: 'Your account access has been restored.' });
  };

  function appendAudit(
    action: string,
    subject: string,
    caseId: string,
    tone: AuditEntryPreview['tone'],
  ) {
    setAuditEntries((current) => [
      {
        id: `AUD-LOCAL-${Date.now()}`,
        action,
        subject,
        adminName: 'Admin Preview',
        occurredAt: 'Today · Just now',
        caseId,
        tone,
      },
      ...current,
    ]);
  }

  return {
    screen,
    verification,
    verificationSubmissions: verification.queue.filter((item) => verificationFilter === 'All' || item.tier === (verificationFilter === 'Tier 2' ? 'tier_2_identity' : 'tier_3_property')),
    verificationFilter, setVerificationFilter,
    refreshVerification: verificationQueue.refresh,
    reviewActions: verificationQueue.reviewActions(),
    requestReview: verificationQueue.requestReview,
    cancelReview: verificationQueue.cancelReview,
    setRejectionReason: verificationQueue.setRejectionReason,
    confirmReview: async () => {
      if (await verificationQueue.confirmReview()) {
        setScreen('verificationQueue'); setHistory(['reviewQueues']);
      }
    },
    canViewPrivateDocument: verificationQueue.canViewPrivateDocument,
    openPrivateDocument: verificationQueue.openPrivateDocument,
    closePrivateDocument: verificationQueue.closePrivateDocument,
    privateDocumentFailed: verificationQueue.privateDocumentFailed,
    reports,
    restrictions,
    auditEntries,
    selectedVerification: verification.detail,
    selectedReport,
    selectedRestriction,
    pendingVerificationCount,
    openReportCount,
    decisionDraft,
    verificationNote,
    reportInformationRequest,
    notice,
    navigate,
    replace,
    goBack,
    openSection,
    openVerification,
    openReport,
    requestReportInformation,
    dismissReport,
    chooseModerationAction,
    updateDecisionDraft,
    confirmModerationAction,
    openRestriction,
    restoreAccount,
    setVerificationNote,
    setReportInformationRequest,
    setNotice,
  };
}

export type AdminModerationViewModel = ReturnType<typeof useAdminModerationViewModel>;
