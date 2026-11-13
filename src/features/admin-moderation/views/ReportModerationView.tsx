import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { reportStatusLabels } from '../../../shared/models/Reporting';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import { AdminCard, AdminChip, AdminChipRow, AdminDisclosure, AdminRadioOption, AdminSectionLabel, DetailRow } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { formatAdminAge, reportReasonLabel, reportStatusLabel, reportStatusTone, reportTypeLabel } from '../models/AdminQueuePresentation';
import { formatVerificationDate } from '../models/AdminVerification';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

/** One structured report review. Decisions map onto the existing moderate_rental_report inputs: status, private note, public summary. */
export function ReportModerationView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const row = viewModel.selectedReport;
  if (!row) return (
    <AdminScaffold onBack={viewModel.requestBack} title="Report review">
      {viewModel.reportsBusy || viewModel.reportsSaving ? <ActivityIndicator accessibilityLabel="Loading report" color={colors.primaryAction} /> : <Text style={ui.body}>{viewModel.reportsError ? 'This report could not be loaded.' : 'This report is no longer in the current list.'}</Text>}
      <FeedbackNotice tone="error" message={viewModel.reportsError} />
      <FeedbackNotice tone="success" message={viewModel.reportsNotice} />
      {viewModel.reportsPending ? <AppButton disabled={!viewModel.reportsReady || viewModel.reportsBusy || viewModel.reportsSaving} label="Retry pending report action" onPress={() => void viewModel.retryReports()} /> : null}
      <AppButton disabled={viewModel.reportsSaving} label="Back to review queue" onPress={() => viewModel.openSection('reviewQueues', 'reports')} variant="secondary" />
    </AdminScaffold>
  );
  const locked = viewModel.reportsLocked;
  const open = viewModel.decisionOptions.length > 0;
  const showSummary = viewModel.reportDecision === 'upheld' || viewModel.reportDecision === 'dismissed';
  const footer = open ? <AppButton disabled={!viewModel.reportCanSave} label={viewModel.reportsSaving ? 'Saving decision...' : 'Save decision'} onPress={viewModel.saveReportDecision} /> : undefined;
  return (
    <AdminScaffold footer={footer} onBack={viewModel.requestBack} title="Report review">
      <Text accessibilityRole="header" style={styles.name}>{reportReasonLabel(row)}</Text>
      <AdminChipRow>
        <AdminChip label={reportTypeLabel(row.kind)} />
        <AdminChip label={reportStatusLabel(row.status)} tone={reportStatusTone(row.status)} />
      </AdminChipRow>
      <Text style={styles.submitted}>{`Reported ${formatAdminAge(row.submittedAt).toLowerCase()}`}</Text>

      <View style={styles.notices}>
        {viewModel.reportsBusy ? <ActivityIndicator accessibilityLabel="Loading reports" color={colors.primaryAction} /> : null}
        <FeedbackNotice tone="error" message={viewModel.reportsError} />
        <FeedbackNotice tone="success" message={viewModel.reportsNotice} />
        {viewModel.reportsPending ? <>
          <FeedbackNotice tone="warning" message="A report action needs reconciliation. Retry the same saved operation; do not clear app data." />
          <AppButton disabled={!viewModel.reportsReady || viewModel.reportsBusy || viewModel.reportsSaving} label="Retry pending report action" onPress={() => void viewModel.retryReports()} />
        </> : null}
      </View>

      <AdminSectionLabel>{row.kind === 'listing' ? 'Reported listing' : 'Reported user'}</AdminSectionLabel>
      <AdminCard><Text style={styles.cardTitle}>{row.label}</Text></AdminCard>

      <AdminSectionLabel>What the reporter said</AdminSectionLabel>
      <AdminCard>{row.details ? <Text style={ui.body}>{row.details}</Text> : <Text style={ui.supporting}>No additional explanation.</Text>}</AdminCard>
      {row.publicSummary ? <><AdminSectionLabel>Summary shown to the reporter</AdminSectionLabel><AdminCard><Text style={ui.body}>{row.publicSummary}</Text></AdminCard></> : null}

      <AdminSectionLabel>Your decision</AdminSectionLabel>
      {open ? <>
        <View accessibilityRole="radiogroup">
          {viewModel.decisionOptions.map((option) => (
            <AdminRadioOption description={option.description} disabled={locked || !!option.disabledReason} disabledReason={option.disabledReason} key={option.status} label={option.label} onSelect={() => viewModel.setReportDecision(option.status)} selected={viewModel.reportDecision === option.status} />
          ))}
        </View>
        <Text style={styles.fieldLabel}>Private note (admins only, required)</Text>
        <TextInput accessibilityLabel="Private report decision reason" editable={!locked} maxLength={1000} multiline onChangeText={viewModel.setReportNote} style={styles.textArea} textAlignVertical="top" value={viewModel.reportNote} />
        {!viewModel.reportCanSave && !viewModel.reportsSaving ? <Text style={ui.supporting}>Choose a decision and enter a private note to save.</Text> : null}
        {showSummary ? <>
          <Text style={styles.fieldLabel}>Summary shown to the reporter (optional)</Text>
          <Text style={ui.supporting}>Shared only with the reporter. Do not copy confidential notes.</Text>
          <TextInput accessibilityLabel="Public-safe report resolution summary" editable={!locked} maxLength={500} multiline onChangeText={viewModel.setReportPublicSummary} style={styles.textArea} textAlignVertical="top" value={viewModel.reportPublicSummary} />
        </> : null}
      </> : <Text style={ui.supporting}>This report has a final decision. No enforcement or reopening action is available.</Text>}

      <AdminSectionLabel>History</AdminSectionLabel>
      {row.history && row.history.length > 0 ? (
        <View style={styles.timeline}>
          {row.history.map((entry, index) => (
            <View key={`${entry.createdAt}-${index}`} style={styles.event}>
              <View style={[styles.dot, entry.status === 'dismissed' && styles.dotMuted]} />
              <View style={styles.eventCopy}>
                <Text style={styles.cardTitle}>{reportStatusLabels[entry.status]}</Text>
                <Text style={ui.supporting}>{formatVerificationDate(entry.createdAt)}</Text>
                {entry.note ? <Text style={ui.supporting}>{entry.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : <Text style={ui.supporting}>No decisions recorded for this report yet.</Text>}

      <AdminDisclosure title="IDs and technical details">
        <DetailRow label="Report ID" value={row.id} />
        {row.targetId ? <DetailRow label="Target reference" value={row.targetId} /> : null}
        {Object.entries(row.context ?? {}).filter(([key]) => key !== 'label').map(([key, value]) => <DetailRow key={key} label={key} value={value} />)}
      </AdminDisclosure>
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  name: { ...ui.pageTitle },
  submitted: { ...ui.supporting, marginTop: spacing.xs },
  notices: { gap: spacing.xs, marginTop: spacing.xs },
  cardTitle: { ...ui.body, fontWeight: '600' },
  fieldLabel: { ...ui.supporting, fontWeight: '700', marginTop: spacing.xs },
  textArea: { borderColor: colors.controlBorder, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontFamily: typography.family, fontSize: 16, lineHeight: 22, minHeight: 96, padding: spacing.sm },
  timeline: { borderLeftColor: colors.outline, borderLeftWidth: 2, gap: spacing.sm, marginLeft: spacing.xxs, paddingLeft: spacing.sm },
  event: { flexDirection: 'row' },
  eventCopy: { flex: 1, minWidth: 0 },
  dot: { backgroundColor: colors.primaryAction, borderColor: colors.background, borderRadius: radius.pill, borderWidth: 2, height: 12, left: -(spacing.sm + 7), marginTop: 5, position: 'absolute', width: 12 },
  dotMuted: { backgroundColor: colors.textMuted },
});
