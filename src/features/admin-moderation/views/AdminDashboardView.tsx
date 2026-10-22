import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { AppButton } from '../../../shared/components/AppButton';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AdminHeading, AdminStatCard, AuditCard } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function AdminDashboardView({ onExit, viewModel }: { onExit: () => void; viewModel: AdminModerationViewModel }) {
  return (
    <AdminScaffold onExit={onExit} title="Admin Dashboard">
      <View style={styles.previewBanner}>
        <View style={styles.previewDot} />
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle}>Verification queue + moderation preview</Text>
          <Text style={styles.previewBody}>Verification loads real submission metadata. Verification review is connected. Reports, enforcement and audit remain previews.</Text>
        </View>
      </View>
      <AdminHeading
        body="Review verification requests and moderation queues."
        eyebrow=""
        title="Admin overview"
      />
      {viewModel.dashboardNeedsRecovery ? <AppButton label="Retry verification queue" onPress={() => void viewModel.refreshVerification()} variant="secondary" /> : null}
      {viewModel.verification.status === 'loading' ? <Text accessibilityLiveRegion="polite" style={styles.previewBody}>Loading verification queue...</Text> : null}
      <FeedbackNotice tone="error" message={viewModel.verification.error ?? viewModel.verification.reviewError} />
      <View style={styles.statsGrid}>
        <AdminStatCard label="Pending verifications" tone="warning" value={viewModel.verification.status === 'success' ? viewModel.pendingVerificationCount : '--'} />
        <AdminStatCard label="Open reports (Preview)" tone="danger" value={viewModel.openReportCount} />
        <AdminStatCard label="Restrictions (Preview)" value={viewModel.restrictions.length} />
        <AdminStatCard label="Decisions today (Preview)" tone="positive" value="12" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Review queues</Text>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('reviewQueues')} style={styles.sectionAction}><Text style={styles.viewAll}>View all</Text></Pressable>
      </View>
      <View style={styles.queueSummaryList}>
        <QueueSummary
          body="Identity and property documents awaiting verification."
          count={viewModel.verification.status === 'success' ? viewModel.verification.queue.length : '--'}
          label="Verification queue"
          onPress={() => viewModel.navigate('verificationQueue')}
          tone="warning"
        />
        <QueueSummary
          body="User, listing, and message reports requiring review."
          count={viewModel.openReportCount}
          label="Reports queue"
          onPress={() => viewModel.navigate('reportsQueue')}
          tone="danger"
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Recent activity (Preview)</Text>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('auditHistory')} style={styles.sectionAction}><Text style={styles.viewAll}>Full audit</Text></Pressable>
      </View>
      {viewModel.auditEntries.slice(0, 3).map((item) => (
        <AuditCard key={item.id} item={item} onPress={() => viewModel.navigate('caseHistory')} />
      ))}
    </AdminScaffold>
  );
}

function QueueSummary({ label, body, count, tone, onPress }: { label: string; body: string; count: number | string; tone: 'warning' | 'danger'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.queueSummary, pressed && styles.pressed]}>
      <View style={[styles.queueCount, tone === 'danger' ? styles.queueCountDanger : styles.queueCountWarning]}><Text style={[styles.queueCountValue, tone === 'danger' ? styles.queueTextDanger : styles.queueTextWarning]}>{count}</Text></View>
      <View style={styles.queueCopy}><Text style={styles.queueLabel}>{label}</Text><Text style={styles.queueBody}>{body}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionAction: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
  previewBanner: { ...ui.panel, backgroundColor: colors.canvas, alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, padding: spacing.sm },
  previewDot: { backgroundColor: colors.primaryAction, borderRadius: radius.pill, height: 10, marginTop: 5, width: 10 },
  previewCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  previewTitle: { ...ui.supporting, color: colors.ink, fontWeight: '600' },
  previewBody: { ...ui.supporting },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'space-between', marginBottom: spacing.xs, marginTop: spacing.md },
  sectionLabel: { ...ui.sectionTitle, flexShrink: 1 },
  viewAll: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  queueSummaryList: { gap: spacing.xs },
  queueSummary: { ...ui.panel, alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.sm },
  queueCount: { alignItems: 'center', borderRadius: radius.sm, minHeight: 40, padding: spacing.xs, justifyContent: 'center', minWidth: 40 },
  queueCountWarning: { backgroundColor: colors.warningSurface },
  queueCountDanger: { backgroundColor: colors.restrictedSurface },
  queueCountValue: { fontFamily: typography.family, fontSize: 20, fontWeight: '900' },
  queueTextWarning: { color: colors.warning },
  queueTextDanger: { color: colors.restricted },
  queueCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 145, minWidth: 0 },
  queueLabel: { ...ui.body, fontWeight: '600' },
  queueBody: { ...ui.supporting, marginTop: spacing.xxs },
  chevron: { color: colors.textMuted, fontFamily: typography.family, fontSize: 27 },
  pressed: { opacity: 0.72 },
});
