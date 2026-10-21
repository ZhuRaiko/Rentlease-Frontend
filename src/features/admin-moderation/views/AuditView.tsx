import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AdminHeading, AuditCard, DetailCard, DetailRow } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function AuditView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  if (viewModel.screen === 'auditHistory') {
    return (
      <AdminScaffold title="Admin audit history">
        <AdminHeading body="Review the chronological local preview of report and enforcement decisions. Verification audit integration is deferred." eyebrow="ACCOUNTABILITY" title="Moderation audit log" />
        <View style={styles.filterRow}>
          {['All activity', 'Reports', 'Enforcement'].map((filter, index) => (
            <Pressable accessibilityRole="button" key={filter} style={[styles.filter, index === 0 && styles.filterActive]}><Text style={[styles.filterLabel, index === 0 && styles.filterLabelActive]}>{filter}</Text></Pressable>
          ))}
        </View>
        <View style={styles.dateHeader}><Text style={styles.dateLabel}>SEPTEMBER 18, 2026</Text><Text style={styles.dateCount}>{viewModel.auditEntries.length} entries</Text></View>
        {viewModel.auditEntries.map((item) => (
          <AuditCard key={item.id} item={item} onPress={() => viewModel.navigate('caseHistory')} />
        ))}
        <View style={styles.auditNote}><Text style={styles.auditNoteTitle}>Frontend audit preview</Text><Text style={styles.auditNoteBody}>This list is held only in React state. A production audit trail must be immutable, server-authored, access-controlled, and retained according to approved policy.</Text></View>
      </AdminScaffold>
    );
  }

  const report = viewModel.selectedReport;
  return (
    <AdminScaffold onBack={viewModel.goBack} title="Moderation case history">
      <View style={styles.caseHeader}>
        <View><Text style={styles.caseEyebrow}>CASE HISTORY</Text><Text accessibilityRole="header" style={styles.caseId}>{report?.id ?? 'CASE-2026-0115'}</Text></View>
        <View style={styles.caseStatus}><Text style={styles.caseStatusText}>{report?.status ?? 'Investigating'}</Text></View>
      </View>
      <Text style={styles.caseTitle}>{report?.reason ?? 'Moderation review'}</Text>
      <Text style={styles.caseSubtitle}>{report?.targetType ?? 'Account'} · {report?.targetName ?? 'Case subject'}</Text>

      <Text style={styles.sectionLabel}>CASE SUMMARY</Text>
      <DetailCard>
        <DetailRow label="OPENED" value={report?.submittedAt ?? 'September 18, 2026'} />
        <DetailRow label="REPORTER" value={report?.reporterName ?? 'Confidential reporter'} />
        <DetailRow label="SUBJECT" value={report?.reportedUserName ?? 'Account holder'} />
        <DetailRow label="CURRENT OWNER" last value="Admin Preview" />
      </DetailCard>

      <Text style={styles.sectionLabel}>EVENT HISTORY</Text>
      <View style={styles.timelineCard}>
        <CaseEvent active body="Report entered the moderation queue." label="Report submitted" meta="September 18 · 10:28 AM" />
        <CaseEvent active body="Priority set from reported payment behavior and available evidence." label="Initial risk triage" meta="September 18 · 10:29 AM" />
        <CaseEvent active={report?.status !== 'New'} body="Admin Preview opened the report and reviewed case context." label="Review started" meta="Local preview event" />
        <CaseEvent active={report?.status === 'Information requested' || report?.status === 'Action taken' || report?.status === 'Dismissed'} body="Latest local moderation decision appears here." label="Decision update" last meta={report?.status ?? 'Pending'} />
      </View>

      <View style={styles.integrityCard}><Text style={styles.integrityTitle}>Audit integrity unavailable</Text><Text style={styles.integrityBody}>Actor verification, immutable timestamps, reason codes, before/after values, and server signatures require the future backend audit contract.</Text></View>
    </AdminScaffold>
  );
}

function CaseEvent({ label, meta, body, active, last = false }: { label: string; meta: string; body: string; active: boolean; last?: boolean }) {
  return (
    <View style={styles.eventRow}>
      <View style={styles.eventRail}><View style={[styles.eventDot, active && styles.eventDotActive]} />{!last ? <View style={[styles.eventLine, active && styles.eventLineActive]} /> : null}</View>
      <View style={styles.eventCopy}><Text style={[styles.eventLabel, active && styles.eventLabelActive]}>{label}</Text><Text style={styles.eventMeta}>{meta}</Text><Text style={styles.eventBody}>{body}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  filter: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  filterActive: { backgroundColor: '#173C2C' },
  filterLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, fontWeight: '800' },
  filterLabelActive: { color: colors.white },
  dateHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  dateLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  dateCount: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8 },
  auditNote: { backgroundColor: colors.warningSurface, borderRadius: radius.sm, gap: 4, marginTop: spacing.lg, padding: spacing.sm },
  auditNoteTitle: { color: colors.warning, fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  auditNoteBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14 },
  caseHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  caseEyebrow: { color: '#2E7552', fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  caseId: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900', marginTop: 3 },
  caseStatus: { backgroundColor: colors.warningSurface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  caseStatusText: { color: colors.warning, fontFamily: typography.family, fontSize: 8, fontWeight: '900' },
  caseTitle: { color: colors.text, fontFamily: typography.family, fontSize: 23, fontWeight: '900', lineHeight: 29, marginTop: spacing.lg },
  caseSubtitle: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 4 },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  timelineCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, padding: spacing.md },
  eventRow: { flexDirection: 'row', minHeight: 92 },
  eventRail: { alignItems: 'center', width: 24 },
  eventDot: { backgroundColor: colors.surfaceStrong, borderRadius: 7, height: 14, width: 14 },
  eventDotActive: { backgroundColor: '#2E7552' },
  eventLine: { backgroundColor: colors.border, flex: 1, width: 2 },
  eventLineActive: { backgroundColor: '#2E7552' },
  eventCopy: { flex: 1, paddingBottom: spacing.sm, paddingLeft: spacing.xs },
  eventLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  eventLabelActive: { color: colors.text },
  eventMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, marginTop: 3 },
  eventBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: 5 },
  integrityCard: { backgroundColor: colors.restrictedSurface, borderRadius: radius.sm, gap: 4, marginTop: spacing.md, padding: spacing.sm },
  integrityTitle: { color: colors.restricted, fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  integrityBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14 },
});
