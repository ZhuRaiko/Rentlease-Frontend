import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { ReferenceImageCrop } from '../../../shared/components/ReferenceImageCrop';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  AdminHeading,
  AdminStatusPill,
  DetailCard,
  DetailRow,
  EvidencePlaceholder,
  PriorityPill,
} from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

const listingReference = require('../../../assets/property-listing/listing-detail-reference.png');

export function ReportModerationView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const report = viewModel.selectedReport;
  if (!report) return null;

  if (viewModel.screen === 'reportDetails') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Report details">
        <View style={styles.caseHeader}><PriorityPill priority={report.priority} /><Text style={styles.caseId}>{report.id}</Text></View>
        <Text accessibilityRole="header" style={styles.reportTitle}>{report.reason}</Text>
        <Text style={styles.reportMeta}>{report.targetType} report · Submitted {report.age} ago</Text>
        <View style={styles.statusWrap}><AdminStatusPill status={report.status} /></View>
        <View style={styles.reportBodyCard}>
          <Text style={styles.reportBodyLabel}>REPORTER’S DESCRIPTION</Text>
          <Text style={styles.reportBody}>{report.details}</Text>
          <View style={styles.reportDivider} />
          <Text style={styles.reportBy}>Reported by {report.reporterName} · {report.submittedAt}</Text>
        </View>

        <Text style={styles.sectionLabel}>CASE CONTEXT</Text>
        <View style={styles.contextList}>
          <ContextAction label="Evidence viewer" meta={`${report.evidenceCount} submitted items`} onPress={() => viewModel.navigate('evidenceViewer')} />
          <ContextAction label="Reported user" meta={report.reportedUserName} onPress={() => viewModel.navigate('reportedUserDetails')} />
          <ContextAction label="Reported listing" meta="2-Bedroom House with Balcony" onPress={() => viewModel.navigate('reportedListingDetails')} />
          <ContextAction label="Message context" meta="Conversation excerpt" onPress={() => viewModel.navigate('reportedMessageContext')} />
        </View>

        <View style={styles.actions}>
          <AppButton label="Select moderation action" onPress={() => viewModel.navigate('moderationAction')} />
          <AppButton label="Request more information" onPress={() => viewModel.navigate('requestReportInfo')} variant="secondary" />
          <AppButton label="Dismiss report" onPress={() => viewModel.navigate('dismissReport')} variant="danger" />
        </View>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'evidenceViewer') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Evidence viewer">
        <AdminHeading body="Review the reporter’s attached screenshots and supporting material in case context." eyebrow={`${report.evidenceCount} EVIDENCE ITEMS`} title="Submitted evidence" />
        <View style={styles.evidenceList}>
          <EvidencePlaceholder index={1} label="Payment request screenshot" />
          <EvidencePlaceholder index={2} label="Account details screenshot" />
        </View>
        {report.evidenceCount > 2 ? <View style={styles.singleEvidence}><EvidencePlaceholder index={3} label="Property viewing photo" /></View> : null}
        <DetailCard>
          <DetailRow label="UPLOADED BY" value={report.reporterName} />
          <DetailRow label="SUBMITTED WITH" value={report.id} />
          <DetailRow label="INTEGRITY STATUS" last value="Not available in frontend preview" />
        </DetailCard>
        <Text style={styles.previewNote}>Secure Storage retrieval, metadata validation, zoom, and evidence-access auditing are not connected.</Text>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'reportedUserDetails') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Reported user">
        <View style={styles.userHero}>
          <View style={styles.userAvatar}><Text style={styles.userInitials}>SF</Text></View>
          <Text style={styles.userName}>{report.reportedUserName}</Text>
          <Text style={styles.userRole}>Tier 3 verified landlord · Imus, Cavite</Text>
          <View style={styles.userStats}><MiniStat label="RATING" value="4.7" /><MiniStat label="LISTINGS" value="4" /><MiniStat label="PAST REPORTS" value="2" /></View>
        </View>
        <Text style={styles.sectionLabel}>ACCOUNT CONTEXT</Text>
        <DetailCard>
          <DetailRow label="MEMBER SINCE" value="January 2025" />
          <DetailRow label="VERIFICATION" value="Tier 3 · Approved" />
          <DetailRow label="PRIOR WARNING" value="One warning · May 2026" />
          <DetailRow label="CURRENT ACCOUNT STATUS" last value="Active" />
        </DetailCard>
        <View style={styles.contextNotice}><Text style={styles.contextNoticeTitle}>Privacy boundary</Text><Text style={styles.contextNoticeBody}>Only case-relevant account data should be exposed to authorized admins when backend access rules are implemented.</Text></View>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'reportedListingDetails') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Reported listing">
        <View style={styles.listingImage}>
          <ReferenceImageCrop crop={{ x: 0, y: 90, width: 372, height: 210 }} source={listingReference} sourceHeight={499} sourceWidth={372} />
          <View style={styles.reportedBadge}><Text style={styles.reportedBadgeText}>REPORTED LISTING</Text></View>
        </View>
        <Text accessibilityRole="header" style={styles.listingTitle}>2-Bedroom House with Balcony</Text>
        <Text style={styles.listingPrice}>₱60,800 / month</Text>
        <Text style={styles.listingAddress}>Brgy. Alapan II-B, Imus, Cavite</Text>
        <Text style={styles.sectionLabel}>LISTING CONTEXT</Text>
        <DetailCard>
          <DetailRow label="OWNER" value={report.reportedUserName} />
          <DetailRow label="STATUS" value="Published · Available" />
          <DetailRow label="PUBLISHED" value="August 26, 2026" />
          <DetailRow label="REPORT HISTORY" last value="1 current · 0 previous" />
        </DetailCard>
        <AppButton label="Review moderation actions" onPress={() => viewModel.navigate('moderationAction')} />
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'reportedMessageContext') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Reported message context">
        <AdminHeading body="The reported message is highlighted with limited surrounding conversation for review." eyebrow="CASE-RELEVANT EXCERPT" title="Conversation context" />
        <View style={styles.messageContext}>
          <Text style={styles.messageDate}>SEPTEMBER 17, 2026</Text>
          <MessageBubble body="Hi! Is the unit still available for a viewing this weekend?" meta="Maria · 7:58 PM" outgoing />
          <MessageBubble body="Yes, it is available. I can reserve the schedule for you." meta="Samuel · 8:06 PM" />
          <View style={styles.reportedMessageWrap}>
            <Text style={styles.reportedMessageLabel}>REPORTED MESSAGE</Text>
            <MessageBubble body="Please send the reservation payment before the viewing so I can hold the unit." meta="Samuel · 8:14 PM" />
          </View>
          <MessageBubble body="I prefer to view the property first and use the RENTLEASE process." meta="Maria · 8:18 PM" outgoing />
        </View>
        <Text style={styles.previewNote}>Realtime conversation retrieval and deleted-message history are not connected.</Text>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'requestReportInfo') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Request more information">
        <AdminHeading body="Ask the reporter for a specific clarification needed to continue the case review." eyebrow="REPORTER FOLLOW-UP" title="What information is missing?" />
        <Text style={styles.inputLabel}>REQUEST TO {report.reporterName.toUpperCase()}</Text>
        <TextInput multiline onChangeText={viewModel.setReportInformationRequest} placeholder="Describe the information or evidence needed" placeholderTextColor={colors.textMuted} style={styles.textArea} textAlignVertical="top" value={viewModel.reportInformationRequest} />
        <Pressable accessibilityRole="button" onPress={() => viewModel.setReportInformationRequest('Please clarify when the payment request was received and whether any money was transferred.')} style={styles.previewFill}><Text style={styles.previewFillText}>Use preview information request</Text></Pressable>
        <View style={styles.deadlineCard}><Text style={styles.deadlineLabel}>RESPONSE WINDOW</Text><Text style={styles.deadlineValue}>7 days</Text><Text style={styles.deadlineMeta}>Case remains open while awaiting a response.</Text></View>
        <AppButton disabled={viewModel.reportInformationRequest.trim().length < 10} label="Send request preview" onPress={viewModel.requestReportInformation} />
        <Text style={styles.previewNote}>No email, push notification, or case update will be sent.</Text>
      </AdminScaffold>
    );
  }

  return (
    <AdminScaffold onBack={viewModel.goBack} title="Dismiss report">
      <AdminHeading body="Dismiss only when the available information does not support a policy violation or the report is outside scope." eyebrow="CLOSE WITHOUT ACTION" title="Why is this report being dismissed?" />
      <DismissReason label="No policy violation identified" onPress={() => viewModel.updateDecisionDraft('reason', 'No policy violation was identified in the available information.')} selected={viewModel.decisionDraft.reason.includes('No policy')} />
      <DismissReason label="Insufficient evidence after review" onPress={() => viewModel.updateDecisionDraft('reason', 'The available evidence is insufficient to confirm the reported behavior.')} selected={viewModel.decisionDraft.reason.includes('insufficient')} />
      <DismissReason label="Duplicate of an existing report" onPress={() => viewModel.updateDecisionDraft('reason', 'This report duplicates an existing moderation case.')} selected={viewModel.decisionDraft.reason.includes('duplicates')} />
      <Text style={styles.inputLabel}>INTERNAL NOTE</Text>
      <TextInput multiline onChangeText={(value) => viewModel.updateDecisionDraft('internalNote', value)} placeholder="Optional context for the audit history" placeholderTextColor={colors.textMuted} style={styles.textArea} textAlignVertical="top" value={viewModel.decisionDraft.internalNote} />
      <AppButton disabled={viewModel.decisionDraft.reason.length < 10} label="Confirm dismissal preview" onPress={viewModel.dismissReport} variant="danger" />
    </AdminScaffold>
  );
}

function ContextAction({ label, meta, onPress }: { label: string; meta: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.contextAction}><View><Text style={styles.contextLabel}>{label}</Text><Text style={styles.contextMeta}>{meta}</Text></View><Text style={styles.contextChevron}>›</Text></Pressable>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.miniStat}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>;
}

function MessageBubble({ body, meta, outgoing = false }: { body: string; meta: string; outgoing?: boolean }) {
  return <View style={[styles.messageBubble, outgoing && styles.messageOutgoing]}><Text style={styles.messageBody}>{body}</Text><Text style={styles.messageMeta}>{meta}</Text></View>;
}

function DismissReason({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.dismissReason, selected && styles.dismissSelected]}><Text style={styles.dismissLabel}>{label}</Text><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioCenter} /> : null}</View></Pressable>;
}

const styles = StyleSheet.create({
  caseHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  caseId: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  reportTitle: { color: colors.text, fontFamily: typography.family, fontSize: 25, fontWeight: '900', lineHeight: 31, marginTop: spacing.md },
  reportMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 4 },
  statusWrap: { marginTop: spacing.sm },
  reportBodyCard: { backgroundColor: colors.restrictedSurface, borderRadius: radius.card, marginTop: spacing.md, padding: spacing.md },
  reportBodyLabel: { color: colors.restricted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  reportBody: { color: colors.text, fontFamily: typography.family, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  reportDivider: { backgroundColor: '#E8C4C4', height: 1, marginVertical: spacing.sm },
  reportBy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9 },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  contextList: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  contextAction: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 62, paddingHorizontal: spacing.md },
  contextLabel: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  contextMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, marginTop: 3 },
  contextChevron: { color: colors.textMuted, fontFamily: typography.family, fontSize: 23 },
  actions: { gap: spacing.xs, marginTop: spacing.lg },
  evidenceList: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  singleEvidence: { alignSelf: 'stretch', marginBottom: spacing.sm, width: '49%' },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: spacing.sm, textAlign: 'center' },
  userHero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg },
  userAvatar: { alignItems: 'center', backgroundColor: '#DDA83E', borderRadius: 34, height: 68, justifyContent: 'center', width: 68 },
  userInitials: { color: colors.white, fontFamily: typography.family, fontSize: 20, fontWeight: '900' },
  userName: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '900', marginTop: spacing.sm },
  userRole: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 3 },
  userStats: { alignSelf: 'stretch', flexDirection: 'row', marginTop: spacing.md },
  miniStat: { alignItems: 'center', borderRightColor: colors.border, borderRightWidth: 1, flex: 1 },
  miniValue: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '900' },
  miniLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 7, fontWeight: '900', marginTop: 2 },
  contextNotice: { backgroundColor: '#EAF1ED', borderRadius: radius.sm, gap: 4, marginTop: spacing.md, padding: spacing.sm },
  contextNoticeTitle: { color: '#173C2C', fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  contextNoticeBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14 },
  listingImage: { height: 210, overflow: 'hidden', position: 'relative' },
  reportedBadge: { backgroundColor: colors.restricted, borderRadius: radius.pill, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, position: 'absolute', top: spacing.sm },
  reportedBadgeText: { color: colors.white, fontFamily: typography.family, fontSize: 8, fontWeight: '900' },
  listingTitle: { color: colors.text, fontFamily: typography.family, fontSize: 21, fontWeight: '900', marginTop: spacing.md },
  listingPrice: { color: '#2E7552', fontFamily: typography.family, fontSize: 16, fontWeight: '900', marginTop: 4 },
  listingAddress: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginBottom: spacing.md, marginTop: 3 },
  messageContext: { gap: spacing.xs },
  messageDate: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', marginBottom: spacing.xs, textAlign: 'center' },
  messageBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.card, maxWidth: '86%', padding: spacing.sm },
  messageOutgoing: { alignSelf: 'flex-end', backgroundColor: colors.primaryPale },
  messageBody: { color: colors.text, fontFamily: typography.family, fontSize: 11, lineHeight: 17 },
  messageMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, marginTop: 4 },
  reportedMessageWrap: { backgroundColor: colors.restrictedSurface, borderColor: colors.restricted, borderRadius: radius.card, borderWidth: 1, padding: spacing.xs },
  reportedMessageLabel: { color: colors.restricted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', marginBottom: 4, marginLeft: 4 },
  inputLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs },
  textArea: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 12, minHeight: 150, padding: spacing.md },
  previewFill: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  previewFillText: { color: '#2E7552', fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  deadlineCard: { backgroundColor: colors.warningSurface, borderRadius: radius.sm, gap: 3, marginBottom: spacing.lg, padding: spacing.sm },
  deadlineLabel: { color: colors.warning, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  deadlineValue: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  deadlineMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9 },
  dismissReason: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', marginBottom: spacing.xs, minHeight: 58, padding: spacing.sm },
  dismissSelected: { backgroundColor: colors.restrictedSurface, borderColor: colors.restricted },
  dismissLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  radio: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 2, height: 20, justifyContent: 'center', width: 20 },
  radioSelected: { borderColor: colors.restricted },
  radioCenter: { backgroundColor: colors.restricted, borderRadius: 5, height: 10, width: 10 },
});
