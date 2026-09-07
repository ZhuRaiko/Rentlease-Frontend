import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  AdminHeading,
  DetailCard,
  DetailRow,
} from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { moderationActions, type ModerationActionType } from '../models/AdminModeration';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

const actionScreens = new Set(['warnUser', 'restrictAccount', 'suspendAccount', 'removeListing', 'permanentRemoval']);

export function EnforcementView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  if (viewModel.screen === 'moderationAction') {
    const report = viewModel.selectedReport;
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Moderation action">
        <AdminHeading body="Choose the minimum proportionate action supported by the reviewed evidence and policy." eyebrow="ENFORCEMENT" title="Select an action" />
        {report ? (
          <View style={styles.caseSummary}>
            <Text style={styles.caseLabel}>CURRENT CASE · {report.id}</Text>
            <Text style={styles.caseTitle}>{report.reason}</Text>
            <Text style={styles.caseMeta}>Reported user · {report.reportedUserName}</Text>
          </View>
        ) : null}
        <View style={styles.actionList}>
          {moderationActions.map((option) => (
            <ActionCard
              action={option.action}
              description={option.description}
              key={option.action}
              onPress={() => viewModel.chooseModerationAction(option.action, option.screen)}
              severity={option.severity}
            />
          ))}
        </View>
        <View style={styles.policyNote}><Text style={styles.policyTitle}>Policy note</Text><Text style={styles.policyBody}>Permanent removal is shown only as a frontend policy-state preview. A production workflow should require confirmed authority, complete audit context, and server-side enforcement.</Text></View>
      </AdminScaffold>
    );
  }

  if (actionScreens.has(viewModel.screen)) {
    const action = viewModel.decisionDraft.action;
    if (!action) return null;
    const configuration = actionCopy[action];
    const timed = action === 'Account restriction' || action === 'Account suspension';
    const critical = action === 'Permanent account removal';
    return (
      <AdminScaffold onBack={viewModel.goBack} title={action}>
        <AdminHeading body={configuration.body} eyebrow={configuration.eyebrow} title={configuration.title} />
        <DetailCard>
          <DetailRow label="SUBJECT" value={action === 'Listing removal' ? '2-Bedroom House with Balcony' : viewModel.selectedReport?.reportedUserName ?? 'Reported user'} />
          <DetailRow label="RELATED CASE" value={viewModel.selectedReport?.id ?? 'No selected report'} />
          <DetailRow label="ACTION" last value={action} />
        </DetailCard>
        {timed ? (
          <>
            <Text style={styles.inputLabel}>DURATION</Text>
            <View style={styles.durationRow}>
              {['24 hours', '7 days', '30 days', 'Manual review'].map((duration) => (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: viewModel.decisionDraft.duration === duration }} key={duration} onPress={() => viewModel.updateDecisionDraft('duration', duration)} style={[styles.durationChip, viewModel.decisionDraft.duration === duration && styles.durationSelected]}>
                  <Text style={[styles.durationLabel, viewModel.decisionDraft.duration === duration && styles.durationLabelSelected]}>{duration}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.inputLabel}>POLICY REASON</Text>
        <TextInput multiline onChangeText={(value) => viewModel.updateDecisionDraft('reason', value)} placeholder={configuration.reasonPlaceholder} placeholderTextColor={colors.textMuted} style={styles.textArea} textAlignVertical="top" value={viewModel.decisionDraft.reason} />
        <Pressable accessibilityRole="button" onPress={() => viewModel.updateDecisionDraft('reason', configuration.previewReason)} style={styles.previewFill}><Text style={styles.previewFillText}>Use preview policy reason</Text></Pressable>
        <Text style={styles.inputLabel}>NOTICE TO USER</Text>
        <TextInput multiline onChangeText={(value) => viewModel.updateDecisionDraft('userNotice', value)} placeholder="Explain the action and any available next steps" placeholderTextColor={colors.textMuted} style={[styles.textArea, styles.noticeArea]} textAlignVertical="top" value={viewModel.decisionDraft.userNotice} />
        {critical ? <CriticalConfirmation /> : null}
        <AppButton disabled={viewModel.decisionDraft.reason.trim().length < 10} label={`Confirm ${action.toLowerCase()} preview`} onPress={viewModel.confirmModerationAction} variant={critical || action === 'Account suspension' || action === 'Listing removal' ? 'danger' : 'primary'} />
        <Text style={styles.previewNote}>No account, permission, listing, or backend moderation record will be changed.</Text>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'moderationConfirmation') {
    return (
      <AdminScaffold title="Moderation confirmation">
        <View style={styles.successMark}><View style={styles.checkShort} /><View style={styles.checkLong} /></View>
        <View style={styles.successCopy}>
          <Text style={styles.successEyebrow}>LOCAL DECISION PREVIEW</Text>
          <Text accessibilityRole="header" style={styles.successTitle}>The moderation decision was recorded locally</Text>
          <Text style={styles.successBody}>The queue and audit presentation have been updated for this session only. No backend enforcement occurred.</Text>
        </View>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>DECISION</Text>
          <Text style={styles.resultValue}>{viewModel.decisionDraft.action ?? 'Case review update'}</Text>
          <Text style={styles.resultReason}>{viewModel.decisionDraft.reason}</Text>
        </View>
        <AppButton label="Return to admin dashboard" onPress={() => viewModel.openSection('dashboard')} />
        <AppButton label="View review queues" onPress={() => viewModel.openSection('reviewQueues')} variant="secondary" />
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'activeRestrictions') {
    return (
      <AdminScaffold title="Active restrictions">
        <AdminHeading body="Review temporary restrictions, suspensions, and permanent-access states represented in this frontend preview." eyebrow={`${viewModel.restrictions.length} ACTIVE`} title="Restricted accounts" />
        <View style={styles.restrictionList}>
          {viewModel.restrictions.map((restriction) => (
            <Pressable accessibilityRole="button" key={restriction.id} onPress={() => viewModel.openRestriction(restriction.id)} style={styles.restrictionCard}>
              <View style={styles.restrictionTop}><Text style={styles.restrictionAction}>{restriction.action.toUpperCase()}</Text><Text style={styles.restrictionId}>{restriction.id}</Text></View>
              <Text style={styles.restrictionUser}>{restriction.userName}</Text>
              <Text style={styles.restrictionReason}>{restriction.reason}</Text>
              <View style={styles.restrictionBottom}><Text style={styles.restrictionEnd}>Ends · {restriction.endsAt}</Text><Text style={styles.restoreLabel}>Review / restore ›</Text></View>
            </Pressable>
          ))}
        </View>
      </AdminScaffold>
    );
  }

  const restriction = viewModel.selectedRestriction;
  if (!restriction) {
    return (
      <AdminScaffold onBack={() => viewModel.openSection('activeRestrictions')} title="Restore account">
        <AdminHeading body="There is no selected active restriction in this local preview." eyebrow="NO ACTIVE RECORD" title="Restriction unavailable" />
        <AppButton label="Return to restrictions" onPress={() => viewModel.openSection('activeRestrictions')} />
      </AdminScaffold>
    );
  }
  return (
    <AdminScaffold onBack={viewModel.goBack} title="Restore account">
      <AdminHeading body="Review the active enforcement record before restoring account access." eyebrow="RESTORATION REVIEW" title={`Restore ${restriction.userName}?`} />
      <DetailCard>
        <DetailRow label="CURRENT ACTION" value={restriction.action} />
        <DetailRow label="STARTED" value={restriction.startedAt} />
        <DetailRow label="SCHEDULED END" value={restriction.endsAt} />
        <DetailRow label="RELATED CASE" value={restriction.caseId} />
        <DetailRow label="ORIGINAL REASON" last value={restriction.reason} />
      </DetailCard>
      <Text style={styles.inputLabel}>RESTORATION REASON</Text>
      <TextInput multiline onChangeText={viewModel.setVerificationNote} placeholder="Explain why access should be restored" placeholderTextColor={colors.textMuted} style={styles.textArea} textAlignVertical="top" value={viewModel.verificationNote} />
      <Pressable accessibilityRole="button" onPress={() => viewModel.setVerificationNote('Restriction period completed and the account is eligible for restoration after review.')} style={styles.previewFill}><Text style={styles.previewFillText}>Use preview restoration reason</Text></Pressable>
      <AppButton disabled={viewModel.verificationNote.trim().length < 10} label="Restore account preview" onPress={viewModel.restoreAccount} />
      <Text style={styles.previewNote}>This action does not change Supabase Auth, JWT claims, RLS access, or account records.</Text>
    </AdminScaffold>
  );
}

const actionCopy: Record<ModerationActionType, { eyebrow: string; title: string; body: string; reasonPlaceholder: string; previewReason: string }> = {
  Warning: {
    eyebrow: 'LOW-SEVERITY ACTION',
    title: 'Issue a formal warning',
    body: 'Document the policy concern and explain the expected corrective behavior without limiting account access.',
    reasonPlaceholder: 'Identify the policy concern',
    previewReason: 'The reported payment request did not follow safe platform practices. Future rental coordination must remain transparent and verifiable.',
  },
  'Account restriction': {
    eyebrow: 'LIMITED ACCESS',
    title: 'Restrict account capabilities',
    body: 'Temporarily limit selected capabilities while preserving access needed to review the action.',
    reasonPlaceholder: 'Explain why limited access is proportionate',
    previewReason: 'Messaging and new listing activity are restricted while the suspicious payment report is reviewed.',
  },
  'Account suspension': {
    eyebrow: 'TEMPORARY ACCESS REMOVAL',
    title: 'Suspend this account',
    body: 'Block sign-in access for a defined period based on the reviewed safety concern.',
    reasonPlaceholder: 'Explain why suspension is required',
    previewReason: 'Account access is suspended due to repeated off-platform payment requests after a prior warning.',
  },
  'Listing removal': {
    eyebrow: 'CONTENT ENFORCEMENT',
    title: 'Remove the reported listing',
    body: 'Remove this listing from discovery while retaining the underlying account and case record.',
    reasonPlaceholder: 'Explain why the listing violates policy',
    previewReason: 'The listing contains materially misleading rental terms and requests payment before an in-person viewing.',
  },
  'Permanent account removal': {
    eyebrow: 'HIGHEST-SEVERITY ACTION',
    title: 'Permanently remove account access',
    body: 'Use only when severe or repeated violations support permanent removal under an approved policy.',
    reasonPlaceholder: 'Document the final policy basis and review history',
    previewReason: 'Permanent removal preview based on repeated serious payment fraud reports and prior enforcement history.',
  },
};

function ActionCard({ action, description, severity, onPress }: { action: ModerationActionType; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; onPress: () => void }) {
  const dangerous = severity === 'high' || severity === 'critical';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.actionCard, dangerous && styles.actionDanger, severity === 'critical' && styles.actionCritical]}>
      <View style={[styles.severityMark, severity === 'medium' && styles.markMedium, dangerous && styles.markDanger]}><View style={styles.markLine} /></View>
      <View style={styles.actionCopy}><Text style={styles.actionTitle}>{action}</Text><Text style={styles.actionBody}>{description}</Text><Text style={[styles.severityLabel, dangerous && styles.severityDanger]}>{severity.toUpperCase()} SEVERITY</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function CriticalConfirmation() {
  return <View style={styles.criticalCard}><Text style={styles.criticalTitle}>Final policy review required</Text><Text style={styles.criticalBody}>A production permanent-removal action must require server-authoritative admin permission, immutable auditing, and any applicable appeal or second-review process.</Text></View>;
}

const styles = StyleSheet.create({
  caseSummary: { backgroundColor: colors.restrictedSurface, borderRadius: radius.card, gap: 4, marginBottom: spacing.md, padding: spacing.md },
  caseLabel: { color: colors.restricted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  caseTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  caseMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9 },
  actionList: { gap: spacing.xs },
  actionCard: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  actionDanger: { backgroundColor: colors.restrictedSurface, borderColor: '#E8C4C4' },
  actionCritical: { borderColor: colors.restricted, borderWidth: 2 },
  severityMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  markMedium: { backgroundColor: colors.warning },
  markDanger: { backgroundColor: colors.restricted },
  markLine: { backgroundColor: colors.white, borderRadius: 2, height: 3, width: 19 },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  actionBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: 3 },
  severityLabel: { color: '#2E7552', fontFamily: typography.family, fontSize: 7, fontWeight: '900', marginTop: 5 },
  severityDanger: { color: colors.restricted },
  chevron: { color: colors.textMuted, fontFamily: typography.family, fontSize: 24 },
  policyNote: { backgroundColor: colors.warningSurface, borderRadius: radius.sm, gap: 4, marginTop: spacing.md, padding: spacing.sm },
  policyTitle: { color: colors.warning, fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  policyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14 },
  inputLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.md },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  durationChip: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  durationSelected: { backgroundColor: '#173C2C' },
  durationLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, fontWeight: '800' },
  durationLabelSelected: { color: colors.white },
  textArea: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 12, minHeight: 125, padding: spacing.md },
  noticeArea: { marginBottom: spacing.md, minHeight: 100 },
  previewFill: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  previewFillText: { color: '#2E7552', fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  criticalCard: { backgroundColor: colors.restrictedSurface, borderColor: colors.restricted, borderRadius: radius.sm, borderWidth: 1, gap: 4, marginBottom: spacing.md, padding: spacing.sm },
  criticalTitle: { color: colors.restricted, fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  criticalBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14 },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: spacing.sm, textAlign: 'center' },
  successMark: { alignSelf: 'center', backgroundColor: colors.primaryPale, borderRadius: 55, height: 110, marginBottom: spacing.md, marginTop: spacing.xl, position: 'relative', width: 110 },
  checkShort: { backgroundColor: colors.primary, height: 5, left: 25, position: 'absolute', top: 58, transform: [{ rotate: '45deg' }], width: 27 },
  checkLong: { backgroundColor: colors.primary, height: 5, left: 43, position: 'absolute', top: 50, transform: [{ rotate: '-45deg' }], width: 47 },
  successCopy: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  successEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  successTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', lineHeight: 30, maxWidth: 340, textAlign: 'center' },
  successBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 19, maxWidth: 330, textAlign: 'center' },
  resultCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: 4, marginBottom: spacing.lg, padding: spacing.md },
  resultLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  resultValue: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '900' },
  resultReason: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15, marginTop: 3 },
  restrictionList: { gap: spacing.sm },
  restrictionCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: 5, padding: spacing.md },
  restrictionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  restrictionAction: { color: colors.restricted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  restrictionId: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8 },
  restrictionUser: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '900' },
  restrictionReason: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15 },
  restrictionBottom: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  restrictionEnd: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8 },
  restoreLabel: { color: '#2E7552', fontFamily: typography.family, fontSize: 9, fontWeight: '900' },
});
