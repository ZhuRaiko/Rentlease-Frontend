export type AdminModerationScreen =
  | 'dashboard'
  | 'reviewQueues'
  | 'verificationQueue'
  | 'verificationDetails'
  | 'verificationDocument'
  | 'approveVerification'
  | 'rejectVerification'
  | 'requestVerificationInfo'
  | 'reportsQueue'
  | 'reportDetails'
  | 'evidenceViewer'
  | 'reportedUserDetails'
  | 'reportedListingDetails'
  | 'reportedMessageContext'
  | 'requestReportInfo'
  | 'dismissReport'
  | 'moderationAction'
  | 'warnUser'
  | 'restrictAccount'
  | 'suspendAccount'
  | 'removeListing'
  | 'permanentRemoval'
  | 'moderationConfirmation'
  | 'activeRestrictions'
  | 'restoreAccount'
  | 'auditHistory'
  | 'caseHistory';

export type AdminNavigationSection = 'dashboard' | 'queues' | 'enforcement' | 'audit';

export type QueuePriority = 'Urgent' | 'High' | 'Normal';

export type ReportQueueStatus =
  | 'New'
  | 'Investigating'
  | 'Information requested'
  | 'Dismissed'
  | 'Action taken';

export type ModerationActionType =
  | 'Warning'
  | 'Account restriction'
  | 'Account suspension'
  | 'Listing removal'
  | 'Permanent account removal';

export interface ModerationReportPreview {
  id: string;
  reporterName: string;
  reportedUserName: string;
  targetType: 'User' | 'Listing' | 'Message';
  targetName: string;
  reason: string;
  details: string;
  submittedAt: string;
  age: string;
  priority: QueuePriority;
  status: ReportQueueStatus;
  evidenceCount: number;
}

export interface ActiveRestrictionPreview {
  id: string;
  userName: string;
  action: ModerationActionType;
  reason: string;
  startedAt: string;
  endsAt: string;
  caseId: string;
}

export interface AuditEntryPreview {
  id: string;
  action: string;
  subject: string;
  adminName: string;
  occurredAt: string;
  caseId: string;
  tone: 'neutral' | 'warning' | 'danger' | 'positive';
}

export interface ModerationDecisionDraft {
  action: ModerationActionType | null;
  reason: string;
  internalNote: string;
  userNotice: string;
  duration: string;
}

export const previewModerationReports: ModerationReportPreview[] = [
  {
    id: 'RPT-2026-0918-0142',
    reporterName: 'Maria Santos',
    reportedUserName: 'Samuel Feliciano',
    targetType: 'Message',
    targetName: 'Conversation with Samuel Feliciano',
    reason: 'Suspicious link or payment request',
    details: 'The landlord requested an advance payment through a personal account before allowing a property viewing.',
    submittedAt: 'September 18, 2026 · 10:28 AM',
    age: 'Just now',
    priority: 'Urgent',
    status: 'New',
    evidenceCount: 2,
  },
  {
    id: 'RPT-2026-0918-0141',
    reporterName: 'Jose Villanueva',
    reportedUserName: 'Rico Mendoza',
    targetType: 'Listing',
    targetName: 'Studio Unit near DLSU-D',
    reason: 'False or misleading information',
    details: 'The listing photos and stated unit size do not match the property shown during viewing.',
    submittedAt: 'September 18, 2026 · 9:05 AM',
    age: '1h 23m',
    priority: 'High',
    status: 'Investigating',
    evidenceCount: 3,
  },
  {
    id: 'RPT-2026-0917-0138',
    reporterName: 'Ana Reyes',
    reportedUserName: 'Paolo Cruz',
    targetType: 'User',
    targetName: 'Paolo Cruz',
    reason: 'Harassment or threatening behavior',
    details: 'Repeated unwanted messages were sent after the viewing request was declined.',
    submittedAt: 'September 17, 2026 · 4:32 PM',
    age: '17h 56m',
    priority: 'High',
    status: 'Information requested',
    evidenceCount: 1,
  },
];

export const previewActiveRestrictions: ActiveRestrictionPreview[] = [
  {
    id: 'RST-2026-0041',
    userName: 'Rico Mendoza',
    action: 'Account suspension',
    reason: 'Repeated misleading listings after a prior warning',
    startedAt: 'September 12, 2026',
    endsAt: 'October 12, 2026',
    caseId: 'CASE-2026-0114',
  },
  {
    id: 'RST-2026-0038',
    userName: 'Paolo Cruz',
    action: 'Account restriction',
    reason: 'Messaging privileges restricted during investigation',
    startedAt: 'September 10, 2026',
    endsAt: 'Manual review required',
    caseId: 'CASE-2026-0108',
  },
];

export const previewAuditEntries: AuditEntryPreview[] = [
  {
    id: 'AUD-0880',
    action: 'Report information requested',
    subject: 'Suspicious payment request',
    adminName: 'Admin Preview',
    occurredAt: 'September 18, 2026 · 9:20 AM',
    caseId: 'RPT-2026-0918-0139',
    tone: 'warning',
  },
  {
    id: 'AUD-0879',
    action: 'Listing removed',
    subject: 'Duplicate property listing',
    adminName: 'Admin Preview',
    occurredAt: 'September 18, 2026 · 8:51 AM',
    caseId: 'CASE-2026-0115',
    tone: 'danger',
  },
  {
    id: 'AUD-0878',
    action: 'Account restored',
    subject: 'Liza Ramos',
    adminName: 'Admin Preview',
    occurredAt: 'September 17, 2026 · 5:08 PM',
    caseId: 'CASE-2026-0101',
    tone: 'neutral',
  },
];

export const initialDecisionDraft: ModerationDecisionDraft = {
  action: null,
  reason: '',
  internalNote: '',
  userNotice: '',
  duration: '7 days',
};

export const moderationActions: Array<{
  action: ModerationActionType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  screen: AdminModerationScreen;
}> = [
  { action: 'Warning', description: 'Send a formal policy warning without limiting access.', severity: 'low', screen: 'warnUser' },
  { action: 'Account restriction', description: 'Temporarily disable selected account capabilities.', severity: 'medium', screen: 'restrictAccount' },
  { action: 'Account suspension', description: 'Block account access for a defined period.', severity: 'high', screen: 'suspendAccount' },
  { action: 'Listing removal', description: 'Remove the reported listing while retaining the account.', severity: 'high', screen: 'removeListing' },
  { action: 'Permanent account removal', description: 'Permanently disable account access after final review.', severity: 'critical', screen: 'permanentRemoval' },
];
