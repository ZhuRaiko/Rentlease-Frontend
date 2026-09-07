import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  FlowHeading,
  ReportSummaryCard,
  SelectionCard,
  StatusPill,
} from '../components/RatingsReportsCards';
import { RatingsReportsScaffold } from '../components/RatingsReportsScaffold';
import type { RatingsReportsViewModel } from '../viewModels/useRatingsReportsViewModel';

const targetScreens = new Set(['reportUser', 'reportListing', 'reportMessage']);

export function ReportFlowView({ viewModel }: { viewModel: RatingsReportsViewModel }) {
  if (viewModel.screen === 'reportMenu') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Report a concern">
        <FlowHeading
          body="Choose what you want the RENTLEASE safety team to review. Reports are confidential."
          eyebrow="REPORT MENU"
          title="What would you like to report?"
        />
        <View style={styles.selectionList}>
          <SelectionCard
            body="Behavior, identity, harassment, or safety concerns involving a member."
            onPress={() => viewModel.chooseReportTarget('user')}
            title="Report user"
            tone="danger"
          />
          <SelectionCard
            body="False details, suspicious payments, duplicates, or an unsafe property."
            onPress={() => viewModel.chooseReportTarget('listing')}
            title="Report listing"
            tone="danger"
          />
          <SelectionCard
            body="Abusive, suspicious, spam, or privacy-violating conversation content."
            onPress={() => viewModel.chooseReportTarget('message')}
            title="Report message"
            tone="danger"
          />
        </View>
        <View style={styles.emergencyNote}>
          <Text style={styles.emergencyTitle}>Immediate danger?</Text>
          <Text style={styles.emergencyBody}>Contact local emergency services first. Reporting in RENTLEASE is not an emergency response service.</Text>
        </View>
      </RatingsReportsScaffold>
    );
  }

  if (targetScreens.has(viewModel.screen)) {
    const title = viewModel.reportDraft.targetType === 'user'
      ? 'Report user'
      : viewModel.reportDraft.targetType === 'listing'
        ? 'Report listing'
        : 'Report message';
    const context = viewModel.reportDraft.targetType === 'user'
      ? 'Tier 3 verified landlord · Imus, Cavite'
      : viewModel.reportDraft.targetType === 'listing'
        ? '₱60,800/mo · Imus City, Cavite'
        : 'Listing inquiry · 2-Bedroom House with Balcony';
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title={title}>
        <FlowHeading
          body="Confirm the selected item before choosing a reason."
          eyebrow="STEP 1 OF 5"
          title="Is this the correct item?"
        />
        <View style={styles.targetCard}>
          <View style={styles.targetMark}><View style={styles.targetLine} /><View style={[styles.targetLine, styles.targetLineShort]} /></View>
          <Text style={styles.targetType}>{viewModel.reportDraft.targetType.toUpperCase()}</Text>
          <Text style={styles.targetName}>{viewModel.reportDraft.targetName}</Text>
          <Text style={styles.targetContext}>{context}</Text>
        </View>
        {viewModel.reportDraft.targetType === 'message' ? (
          <View style={styles.messagePreview}>
            <Text style={styles.messageSender}>Samuel Feliciano · 9:42 AM</Text>
            <Text style={styles.messageText}>Please send the reservation payment before the viewing so I can hold the unit.</Text>
          </View>
        ) : null}
        <AppButton label="Select report reason" onPress={() => viewModel.navigate('reportReason')} />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'reportReason') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Report reason">
        <FlowHeading
          body="Select the option that most closely describes your concern."
          eyebrow="STEP 2 OF 5"
          title="Why are you reporting this?"
        />
        <View style={styles.reasonList}>
          {viewModel.availableReasons.map((reason) => {
            const selected = viewModel.reportDraft.reason === reason;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={reason}
                onPress={() => viewModel.chooseReason(reason)}
                style={({ pressed }) => [styles.reasonRow, selected && styles.reasonRowSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>{reason}</Text>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioCenter} /> : null}</View>
              </Pressable>
            );
          })}
        </View>
        <AppButton disabled={!viewModel.reportDraft.reason} label="Describe what happened" onPress={() => viewModel.navigate('reportDetails')} />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'reportDetails') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Report details">
        <FlowHeading
          body="Share specific facts such as what happened, when it happened, and why it concerns you."
          eyebrow="STEP 3 OF 5"
          title="Tell us more"
        />
        <View style={styles.selectedReason}>
          <Text style={styles.selectedReasonLabel}>SELECTED REASON</Text>
          <Text style={styles.selectedReasonValue}>{viewModel.reportDraft.reason}</Text>
        </View>
        <Text style={styles.inputLabel}>DETAILS</Text>
        <TextInput
          accessibilityLabel="Report details"
          maxLength={1000}
          multiline
          onChangeText={(value) => viewModel.updateReportDraft('details', value)}
          placeholder="Describe the incident without adding unrelated private information."
          placeholderTextColor={colors.textMuted}
          style={styles.textArea}
          textAlignVertical="top"
          value={viewModel.reportDraft.details}
        />
        <View style={styles.inputMeta}>
          <Pressable accessibilityRole="button" onPress={() => viewModel.updateReportDraft('details', 'The user requested an advance payment through a personal account before allowing a property viewing. I asked to use the normal RENTLEASE process, but the request continued.')}>
            <Text style={styles.previewFill}>Use preview report details</Text>
          </Pressable>
          <Text style={styles.characterCount}>{viewModel.reportDraft.details.length}/1000</Text>
        </View>
        <AppButton disabled={viewModel.reportDraft.details.trim().length < 15} label="Add evidence" onPress={() => viewModel.navigate('evidenceUpload')} />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'evidenceUpload') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Evidence">
        <FlowHeading
          body="Add screenshots or photos that help explain the concern. Evidence is optional in this presentation."
          eyebrow="STEP 4 OF 5"
          title="Support your report"
        />
        <View style={styles.evidenceGrid}>
          {[0, 1, 2].map((index) => {
            const added = index < viewModel.reportDraft.evidenceCount;
            return (
              <View key={index} style={[styles.evidenceSlot, added && styles.evidenceAdded]}>
                {added ? (
                  <>
                    <View style={styles.evidenceIcon}><View style={styles.evidenceMountain} /><View style={styles.evidenceSun} /></View>
                    <Text style={styles.evidenceLabel}>EVIDENCE {index + 1}</Text>
                  </>
                ) : <Text style={styles.emptyLabel}>OPTIONAL</Text>}
              </View>
            );
          })}
        </View>
        <View style={styles.evidenceActions}>
          <Pressable accessibilityRole="button" onPress={viewModel.addEvidencePreview} style={styles.smallAction}><Text style={styles.smallActionLabel}>Add preview evidence</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={viewModel.removeEvidencePreview} style={styles.smallAction}><Text style={styles.smallActionLabel}>Remove</Text></Pressable>
        </View>
        <Text style={styles.uploadNotice}>Actual document and image upload is not connected.</Text>
        <AppButton label="Review report" onPress={() => viewModel.navigate('reviewReport')} />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'reviewReport') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Review report">
        <FlowHeading
          body="Confirm the information below before submitting this frontend preview."
          eyebrow="STEP 5 OF 5"
          title="Ready to send for review?"
        />
        <ReportSummaryCard report={viewModel.reportDraft} />
        <View style={styles.confidentialCard}>
          <Text style={styles.confidentialTitle}>Confidential report</Text>
          <Text style={styles.confidentialBody}>Only authorized moderation staff should be able to access submitted report details when the backend is connected.</Text>
        </View>
        <AppButton label="Submit report" onPress={viewModel.submitReport} variant="danger" />
        <Text style={styles.uploadNotice}>No report or evidence will be sent to Supabase.</Text>
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'reportSubmitted') {
    return (
      <RatingsReportsScaffold title="Report submitted">
        <SuccessMark />
        <View style={styles.outcomeCopy}>
          <Text style={styles.successEyebrow}>REPORT SAVED LOCALLY</Text>
          <Text accessibilityRole="header" style={styles.outcomeTitle}>Thank you for helping keep RENTLEASE safe</Text>
          <Text style={styles.outcomeBody}>A real report would now enter the moderation queue. You could follow updates using the reference below.</Text>
        </View>
        <View style={styles.referenceCard}>
          <Text style={styles.referenceLabel}>REPORT REFERENCE</Text>
          <Text style={styles.referenceValue}>{viewModel.reportPreview.id}</Text>
        </View>
        <AppButton label="Track report" onPress={() => viewModel.replace('reportStatus')} />
        <AppButton label="Return to ratings & reports" onPress={viewModel.openHome} variant="secondary" />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'reportStatus') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Report status">
        <View style={styles.statusHeader}>
          <StatusPill status={viewModel.reportPreview.status} />
          <Text style={styles.statusId}>{viewModel.reportPreview.id}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.statusTitle}>Your report is being tracked</Text>
        <Text style={styles.statusBody}>Status updates remain private and will appear here after moderation services are connected.</Text>
        <View style={styles.statusTimeline}>
          <TimelineRow active label="Report submitted" meta={viewModel.reportPreview.submittedAt} />
          <TimelineRow active={viewModel.reportPreview.status !== 'Submitted'} label="Initial safety review" meta="Usually within 24–48 hours" />
          <TimelineRow active={viewModel.reportPreview.status === 'Dismissed' || viewModel.reportPreview.status === 'Action taken'} label="Outcome issued" meta="You will be notified when available" last />
        </View>
        {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
        <Text style={styles.previewSection}>PREVIEW MODERATION RESPONSES</Text>
        <View style={styles.previewActions}>
          <AppButton label="More information requested" onPress={() => viewModel.previewReportStatus('More information requested')} variant="secondary" />
          <AppButton label="Outcome: dismissed" onPress={() => viewModel.previewReportStatus('Dismissed')} variant="secondary" />
          <AppButton label="Outcome: action taken" onPress={() => viewModel.previewReportStatus('Action taken')} variant="secondary" />
        </View>
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'moreInfoRequested') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="More information needed">
        <FlowHeading
          body="The safety team needs one clarification before continuing its review."
          eyebrow="ACTION REQUIRED"
          title="Can you provide more detail?"
        />
        <View style={styles.requestCard}>
          <Text style={styles.requestLabel}>REQUEST FROM SAFETY TEAM</Text>
          <Text style={styles.requestText}>Please clarify when the payment request was received and whether any money was transferred.</Text>
          <Text style={styles.requestDeadline}>Respond by September 25, 2026</Text>
        </View>
        <Text style={styles.inputLabel}>YOUR RESPONSE</Text>
        <TextInput
          accessibilityLabel="Additional report information"
          multiline
          onChangeText={viewModel.setAdditionalInformation}
          placeholder="Add the requested details"
          placeholderTextColor={colors.textMuted}
          style={styles.textArea}
          textAlignVertical="top"
          value={viewModel.additionalInformation}
        />
        <Pressable accessibilityRole="button" onPress={() => viewModel.setAdditionalInformation('The request was received on September 17 at 8:14 PM. I did not transfer any money.')} style={styles.previewResponse}>
          <Text style={styles.previewFill}>Use preview response</Text>
        </Pressable>
        <AppButton disabled={viewModel.additionalInformation.trim().length < 10} label="Submit additional information" onPress={viewModel.submitAdditionalInformation} />
      </RatingsReportsScaffold>
    );
  }

  const actionTaken = viewModel.screen === 'outcomeActionTaken';
  return (
    <RatingsReportsScaffold onBack={viewModel.goBack} title="Report outcome">
      <View style={[styles.outcomeMark, actionTaken ? styles.outcomeMarkSuccess : styles.outcomeMarkNeutral]}>
        {actionTaken ? <><View style={styles.outcomeCheckShort} /><View style={styles.outcomeCheckLong} /></> : <View style={styles.dismissedLine} />}
      </View>
      <View style={styles.outcomeCopy}>
        <Text style={[styles.outcomeEyebrow, actionTaken && styles.outcomeEyebrowSuccess]}>{actionTaken ? 'ACTION TAKEN' : 'REPORT DISMISSED'}</Text>
        <Text accessibilityRole="header" style={styles.outcomeTitle}>{actionTaken ? 'The safety team took action' : 'No policy violation was confirmed'}</Text>
        <Text style={styles.outcomeBody}>{actionTaken ? 'The reported content or account received action under RENTLEASE safety policies. Privacy rules limit the details shown.' : 'The available information did not confirm a violation. You can submit a new report if materially different evidence becomes available.'}</Text>
      </View>
      <View style={styles.referenceCard}>
        <Text style={styles.referenceLabel}>REPORT REFERENCE</Text>
        <Text style={styles.referenceValue}>{viewModel.reportPreview.id}</Text>
        <Text style={styles.referenceMeta}>Closed September 20, 2026</Text>
      </View>
      <AppButton label="Return to ratings & reports" onPress={viewModel.openHome} />
    </RatingsReportsScaffold>
  );
}

function SuccessMark() {
  return (
    <View style={styles.successMark}>
      <View style={styles.successCheckShort} />
      <View style={styles.successCheckLong} />
    </View>
  );
}

function TimelineRow({ active, label, meta, last = false }: { active: boolean; label: string; meta: string; last?: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
        {!last ? <View style={[styles.timelineLine, active && styles.timelineLineActive]} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={[styles.timelineLabel, active && styles.timelineLabelActive]}>{label}</Text>
        <Text style={styles.timelineMeta}>{meta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selectionList: { gap: spacing.sm },
  emergencyNote: { backgroundColor: colors.restrictedSurface, borderRadius: radius.sm, gap: 4, marginTop: spacing.md, padding: spacing.sm },
  emergencyTitle: { color: colors.restricted, fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  emergencyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15 },
  targetCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, gap: 4, marginBottom: spacing.md, padding: spacing.lg },
  targetMark: { alignItems: 'center', backgroundColor: colors.restricted, borderRadius: 25, height: 50, justifyContent: 'center', marginBottom: spacing.xs, width: 50 },
  targetLine: { backgroundColor: colors.white, borderRadius: 2, height: 3, marginVertical: 2, width: 24 },
  targetLineShort: { width: 15 },
  targetType: { color: colors.restricted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  targetName: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  targetContext: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, textAlign: 'center' },
  messagePreview: { alignSelf: 'flex-end', backgroundColor: colors.primaryPale, borderRadius: radius.card, gap: 4, marginBottom: spacing.md, maxWidth: '88%', padding: spacing.md },
  messageSender: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '800' },
  messageText: { color: colors.text, fontFamily: typography.family, fontSize: 11, lineHeight: 17 },
  reasonList: { gap: spacing.xs, marginBottom: spacing.lg },
  reasonRow: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', minHeight: 60, padding: spacing.md },
  reasonRowSelected: { backgroundColor: colors.restrictedSurface, borderColor: colors.restricted },
  reasonLabel: { color: colors.textSecondary, flex: 1, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  reasonLabelSelected: { color: colors.text },
  radio: { alignItems: 'center', borderColor: colors.border, borderRadius: 11, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 },
  radioSelected: { borderColor: colors.restricted },
  radioCenter: { backgroundColor: colors.restricted, borderRadius: 6, height: 12, width: 12 },
  selectedReason: { backgroundColor: colors.restrictedSurface, borderRadius: radius.sm, gap: 4, marginBottom: spacing.md, padding: spacing.sm },
  selectedReasonLabel: { color: colors.restricted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  selectedReasonValue: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  inputLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs },
  textArea: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 13, minHeight: 170, padding: spacing.md },
  inputMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, marginTop: spacing.xs },
  previewFill: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  characterCount: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  evidenceGrid: { flexDirection: 'row', gap: spacing.xs },
  evidenceSlot: { alignItems: 'center', aspectRatio: 0.9, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderStyle: 'dashed', borderWidth: 1, flex: 1, justifyContent: 'center' },
  evidenceAdded: { backgroundColor: colors.restrictedSurface, borderColor: colors.restricted, borderStyle: 'solid' },
  evidenceIcon: { borderColor: colors.restricted, borderRadius: 4, borderWidth: 2, height: 34, overflow: 'hidden', position: 'relative', width: 42 },
  evidenceMountain: { borderBottomColor: colors.restricted, borderBottomWidth: 18, borderLeftColor: 'transparent', borderLeftWidth: 18, borderRightColor: 'transparent', borderRightWidth: 18, bottom: 0, height: 0, left: 2, position: 'absolute', width: 0 },
  evidenceSun: { backgroundColor: colors.restricted, borderRadius: 4, height: 7, left: 7, position: 'absolute', top: 6, width: 7 },
  evidenceLabel: { color: colors.restricted, fontFamily: typography.family, fontSize: 7, fontWeight: '900', marginTop: spacing.xs },
  emptyLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '800' },
  evidenceActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  smallAction: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flex: 1, minHeight: 42, justifyContent: 'center' },
  smallActionLabel: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  uploadNotice: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginBottom: spacing.lg, marginTop: spacing.sm, textAlign: 'center' },
  confidentialCard: { backgroundColor: '#EFF7FC', borderRadius: radius.sm, gap: 4, marginVertical: spacing.md, padding: spacing.sm },
  confidentialTitle: { color: '#33799E', fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  confidentialBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15 },
  successMark: { alignSelf: 'center', backgroundColor: colors.primaryPale, borderRadius: 55, height: 110, marginBottom: spacing.md, marginTop: spacing.xl, position: 'relative', width: 110 },
  successCheckShort: { backgroundColor: colors.primary, height: 5, left: 25, position: 'absolute', top: 58, transform: [{ rotate: '45deg' }], width: 27 },
  successCheckLong: { backgroundColor: colors.primary, height: 5, left: 43, position: 'absolute', top: 50, transform: [{ rotate: '-45deg' }], width: 47 },
  outcomeCopy: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  successEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  outcomeTitle: { color: colors.text, fontFamily: typography.family, fontSize: 25, fontWeight: '900', lineHeight: 31, maxWidth: 340, textAlign: 'center' },
  outcomeBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 330, textAlign: 'center' },
  referenceCard: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, gap: 4, marginBottom: spacing.lg, padding: spacing.md },
  referenceLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  referenceValue: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '900' },
  referenceMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  statusHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  statusId: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  statusTitle: { color: colors.text, fontFamily: typography.family, fontSize: 26, fontWeight: '900', lineHeight: 32, marginTop: spacing.md },
  statusBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  statusTimeline: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, marginTop: spacing.lg, padding: spacing.md },
  timelineRow: { flexDirection: 'row', minHeight: 66 },
  timelineRail: { alignItems: 'center', width: 24 },
  timelineDot: { backgroundColor: colors.surfaceStrong, borderRadius: 7, height: 14, width: 14 },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineLine: { backgroundColor: colors.border, flex: 1, width: 2 },
  timelineLineActive: { backgroundColor: colors.primary },
  timelineCopy: { flex: 1, paddingBottom: spacing.sm, paddingLeft: spacing.xs },
  timelineLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  timelineLabelActive: { color: colors.text },
  timelineMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, marginTop: 4 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.md, padding: spacing.sm },
  previewSection: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  previewActions: { gap: spacing.xs },
  requestCard: { backgroundColor: colors.warningSurface, borderRadius: radius.card, gap: spacing.xs, marginBottom: spacing.md, padding: spacing.md },
  requestLabel: { color: colors.warning, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  requestText: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  requestDeadline: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  previewResponse: { alignSelf: 'flex-start', marginBottom: spacing.lg, marginTop: spacing.xs, paddingVertical: spacing.xs },
  outcomeMark: { alignSelf: 'center', borderRadius: 55, height: 110, marginBottom: spacing.md, marginTop: spacing.xl, position: 'relative', width: 110 },
  outcomeMarkSuccess: { backgroundColor: colors.primaryPale },
  outcomeMarkNeutral: { backgroundColor: colors.surfaceStrong },
  outcomeCheckShort: { backgroundColor: colors.primary, height: 5, left: 25, position: 'absolute', top: 58, transform: [{ rotate: '45deg' }], width: 27 },
  outcomeCheckLong: { backgroundColor: colors.primary, height: 5, left: 43, position: 'absolute', top: 50, transform: [{ rotate: '-45deg' }], width: 47 },
  dismissedLine: { backgroundColor: colors.textMuted, borderRadius: 3, height: 5, left: 30, position: 'absolute', top: 52, width: 50 },
  outcomeEyebrow: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  outcomeEyebrowSuccess: { color: colors.primary },
  pressed: { opacity: 0.72 },
});
