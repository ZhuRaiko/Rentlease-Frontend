import { useMemo, useState } from 'react';

import {
  initialDecisionDraft,
  previewActiveRestrictions,
  previewAuditEntries,
  previewModerationReports,
  previewVerificationSubmissions,
  type ActiveRestrictionPreview,
  type AdminModerationScreen,
  type AuditEntryPreview,
  type ModerationActionType,
  type ModerationDecisionDraft,
  type ModerationReportPreview,
  type ReportQueueStatus,
  type VerificationQueueStatus,
  type VerificationSubmissionPreview,
} from '../models/AdminModeration';

export function useAdminModerationViewModel() {
  const [screen, setScreen] = useState<AdminModerationScreen>('dashboard');
  const [history, setHistory] = useState<AdminModerationScreen[]>([]);
  const [verificationSubmissions, setVerificationSubmissions] = useState<VerificationSubmissionPreview[]>(previewVerificationSubmissions);
  const [reports, setReports] = useState<ModerationReportPreview[]>(previewModerationReports);
  const [restrictions, setRestrictions] = useState<ActiveRestrictionPreview[]>(previewActiveRestrictions);
  const [auditEntries, setAuditEntries] = useState<AuditEntryPreview[]>(previewAuditEntries);
  const [selectedVerificationId, setSelectedVerificationId] = useState(previewVerificationSubmissions[0]?.id ?? '');
  const [selectedReportId, setSelectedReportId] = useState(previewModerationReports[0]?.id ?? '');
  const [selectedRestrictionId, setSelectedRestrictionId] = useState(previewActiveRestrictions[0]?.id ?? '');
  const [decisionDraft, setDecisionDraft] = useState<ModerationDecisionDraft>(initialDecisionDraft);
  const [verificationNote, setVerificationNote] = useState('');
  const [reportInformationRequest, setReportInformationRequest] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const selectedVerification = verificationSubmissions.find((item) => item.id === selectedVerificationId) ?? verificationSubmissions[0];
  const selectedReport = reports.find((item) => item.id === selectedReportId) ?? reports[0];
  const selectedRestriction = restrictions.find((item) => item.id === selectedRestrictionId) ?? restrictions[0];

  const pendingVerificationCount = useMemo(
    () => verificationSubmissions.filter((item) => item.status === 'Awaiting review').length,
    [verificationSubmissions],
  );
  const openReportCount = useMemo(
    () => reports.filter((item) => item.status !== 'Dismissed' && item.status !== 'Action taken').length,
    [reports],
  );

  const navigate = (next: AdminModerationScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(next);
    setNotice(null);
  };

  const replace = (next: AdminModerationScreen) => {
    setScreen(next);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1) ?? 'dashboard';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const openSection = (next: AdminModerationScreen) => {
    setScreen(next);
    setHistory([]);
    setNotice(null);
  };

  const openVerification = (id: string) => {
    setSelectedVerificationId(id);
    setScreen('verificationDetails');
    setHistory(['verificationQueue']);
    setVerificationNote('');
    setNotice(null);
  };

  const updateVerificationStatus = (status: VerificationQueueStatus, auditAction: string) => {
    setVerificationSubmissions((current) => current.map((item) => item.id === selectedVerificationId ? { ...item, status } : item));
    appendAudit(auditAction, selectedVerification?.applicantName ?? 'Verification applicant', selectedVerificationId, status === 'Approved' ? 'positive' : status === 'Rejected' ? 'danger' : 'warning');
  };

  const approveVerification = () => {
    updateVerificationStatus('Approved', 'Verification approved');
    replace('moderationConfirmation');
    setDecisionDraft({ ...initialDecisionDraft, action: null, reason: `Tier ${selectedVerification?.requestedTier ?? 2} verification approved`, userNotice: 'Your verification has been approved.' });
  };

  const rejectVerification = () => {
    updateVerificationStatus('Rejected', 'Verification rejected');
    replace('moderationConfirmation');
    setDecisionDraft({ ...initialDecisionDraft, action: null, reason: verificationNote || 'Submitted documents could not be verified', userNotice: 'Your verification was not approved. Review the reason and submit a new request if eligible.' });
  };

  const requestVerificationInformation = () => {
    updateVerificationStatus('Additional information requested', 'Verification information requested');
    replace('moderationConfirmation');
    setDecisionDraft({ ...initialDecisionDraft, action: null, reason: verificationNote || 'A clearer or corrected document is required', userNotice: 'Please provide the requested corrected or additional verification information.' });
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
    verificationSubmissions,
    reports,
    restrictions,
    auditEntries,
    selectedVerification,
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
    approveVerification,
    rejectVerification,
    requestVerificationInformation,
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
