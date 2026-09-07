import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AdminHeading, AdminStatCard, AuditCard } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function AdminDashboardView({ onExit, viewModel }: { onExit: () => void; viewModel: AdminModerationViewModel }) {
  return (
    <AdminScaffold onExit={onExit} subtitle="Frontend moderation workspace" title="Admin dashboard">
      <View style={styles.previewBanner}>
        <View style={styles.previewDot} />
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle}>ADMIN PREVIEW MODE</Text>
          <Text style={styles.previewBody}>No admin identity, queue item, document, or decision is loaded from or written to a backend.</Text>
        </View>
      </View>
      <AdminHeading
        body="Review trust, safety, and enforcement work that needs attention today."
        eyebrow="SEPTEMBER 18, 2026"
        title="Good morning, Admin"
      />
      <View style={styles.statsGrid}>
        <AdminStatCard label="PENDING VERIFICATIONS" tone="warning" value={viewModel.pendingVerificationCount} />
        <AdminStatCard label="OPEN REPORTS" tone="danger" value={viewModel.openReportCount} />
        <AdminStatCard label="ACTIVE RESTRICTIONS" value={viewModel.restrictions.length} />
        <AdminStatCard label="DECISIONS TODAY" tone="positive" value="12" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>REVIEW QUEUES</Text>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('reviewQueues')}><Text style={styles.viewAll}>View all</Text></Pressable>
      </View>
      <View style={styles.queueSummaryList}>
        <QueueSummary
          body="Identity and property documents awaiting verification."
          count={viewModel.pendingVerificationCount}
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
        <Text style={styles.sectionLabel}>RECENT ADMIN ACTIVITY</Text>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('auditHistory')}><Text style={styles.viewAll}>Full audit</Text></Pressable>
      </View>
      {viewModel.auditEntries.slice(0, 3).map((item) => (
        <AuditCard key={item.id} item={item} onPress={() => viewModel.navigate('caseHistory')} />
      ))}
    </AdminScaffold>
  );
}

function QueueSummary({ label, body, count, tone, onPress }: { label: string; body: string; count: number; tone: 'warning' | 'danger'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.queueSummary, pressed && styles.pressed]}>
      <View style={[styles.queueCount, tone === 'danger' ? styles.queueCountDanger : styles.queueCountWarning]}><Text style={[styles.queueCountValue, tone === 'danger' ? styles.queueTextDanger : styles.queueTextWarning]}>{count}</Text></View>
      <View style={styles.queueCopy}><Text style={styles.queueLabel}>{label}</Text><Text style={styles.queueBody}>{body}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  previewBanner: { alignItems: 'flex-start', backgroundColor: '#EAF1ED', borderRadius: radius.sm, flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg, padding: spacing.sm },
  previewDot: { backgroundColor: '#173C2C', borderRadius: 5, height: 10, marginTop: 2, width: 10 },
  previewCopy: { flex: 1 },
  previewTitle: { color: '#173C2C', fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  previewBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs, marginTop: spacing.lg },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  viewAll: { color: '#2E7552', fontFamily: typography.family, fontSize: 9, fontWeight: '900' },
  queueSummaryList: { gap: spacing.xs },
  queueSummary: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  queueCount: { alignItems: 'center', borderRadius: radius.sm, height: 46, justifyContent: 'center', width: 46 },
  queueCountWarning: { backgroundColor: colors.warningSurface },
  queueCountDanger: { backgroundColor: colors.restrictedSurface },
  queueCountValue: { fontFamily: typography.family, fontSize: 20, fontWeight: '900' },
  queueTextWarning: { color: colors.warning },
  queueTextDanger: { color: colors.restricted },
  queueCopy: { flex: 1 },
  queueLabel: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  queueBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: 3 },
  chevron: { color: colors.textMuted, fontFamily: typography.family, fontSize: 27 },
  pressed: { opacity: 0.72 },
});
