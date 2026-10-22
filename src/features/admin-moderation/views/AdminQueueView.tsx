import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { AppButton } from '../../../shared/components/AppButton';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  AdminHeading,
  ReportQueueCard,
  VerificationQueueCard,
} from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function AdminQueueView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  if (viewModel.screen === 'reviewQueues') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Admin Review Queues">
        <AdminHeading
          body="Prioritize verification and safety work by age, risk, and required action."
          eyebrow="QUEUE OVERVIEW"
          title="Work requiring review"
        />
        <View style={styles.overviewList}>
          <QueueOverview
            count={viewModel.verification.status === 'success' ? viewModel.verification.queue.length : '--'}
            label="Verification"
            meta="Pending and under review; oldest first"
            onPress={() => viewModel.navigate('verificationQueue')}
            tone="warning"
          />
          <QueueOverview
            count={viewModel.openReportCount}
            label="Reports"
            meta="1 urgent item"
            onPress={() => viewModel.navigate('reportsQueue')}
            tone="danger"
          />
        </View>
        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>Queue handling guidance</Text>
          <Text style={styles.guidanceBody}>Review urgent safety reports first, then age-sensitive verification requests. Tier 2 decisions use the backend review workflow; other moderation actions remain local previews.</Text>
        </View>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'verificationQueue') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Verification Queue" onRefresh={() => void viewModel.refreshVerification()} refreshing={viewModel.queueRefreshing} refreshEnabled={!viewModel.verification.reviewBusy}>
        <AdminHeading
          body="Review submitted identity and property-authorization materials."
          eyebrow={viewModel.verification.status === 'success' ? `${viewModel.verification.queue.length} WAITING FOR REVIEW` : 'VERIFICATION QUEUE'}
          title="Verification submissions"
        />
        <FilterRow accessibleSelection labels={['All', 'Tier 2', 'Tier 3']} selected={viewModel.verificationFilter} onSelect={viewModel.setVerificationFilter} />
        {viewModel.queueRefreshing ? <Text accessibilityLiveRegion="polite" style={styles.guidanceBody}>Loading verification submissions...</Text> : <Text style={styles.guidanceBody}>Pull down to refresh.</Text>}
        {viewModel.dashboardNeedsRecovery ? <AppButton disabled={viewModel.queueRefreshing} label="Retry verification queue" onPress={() => void viewModel.refreshVerification()} variant="secondary" /> : null}
        <FeedbackNotice tone="error" message={viewModel.verification.error} />
        <FeedbackNotice tone="error" message={viewModel.verification.reviewError} />
        <FeedbackNotice tone="success" message={viewModel.verification.reviewNotice} />
        {viewModel.verification.status === 'success' && viewModel.verificationSubmissions.length === 0 ? <Text style={styles.guidanceBody}>No verification submissions are waiting for review.</Text> : null}
        <View style={styles.queueList}>
          {viewModel.verificationSubmissions.map((item) => (
            <VerificationQueueCard item={item} key={item.submissionId} onPress={() => viewModel.openVerification(item.submissionId)} />
          ))}
        </View>
      </AdminScaffold>
    );
  }

  return (
    <AdminScaffold onBack={viewModel.goBack} title="Reports queue">
      <AdminHeading
        body="Review reported users, listings, and conversations using the available context."
        eyebrow={`${viewModel.openReportCount} OPEN REPORTS`}
        title="Safety reports"
      />
      <FilterRow labels={['All', 'Urgent', 'Users', 'Listings', 'Messages']} />
      <View style={styles.queueList}>
        {viewModel.reports.map((item) => (
          <ReportQueueCard item={item} key={item.id} onPress={() => viewModel.openReport(item.id)} />
        ))}
      </View>
    </AdminScaffold>
  );
}

function FilterRow({ labels, selected, onSelect, accessibleSelection = false }: { labels: readonly string[]; selected?: string; onSelect?: (label: string) => void; accessibleSelection?: boolean }) {
  return (
    <View style={styles.filters}>
      {labels.map((label, index) => (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === label }} key={label} onPress={() => onSelect?.(label)} style={[styles.filter, accessibleSelection && { minHeight: 48, justifyContent: 'center' }, (selected ? selected === label : index === 0) && styles.filterActive]}>
          <Text style={[styles.filterLabel, (selected ? selected === label : index === 0) && styles.filterLabelActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function QueueOverview({ label, count, meta, tone, onPress }: { label: string; count: number | string; meta: string; tone: 'warning' | 'danger'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.overviewCard}>
      <Text style={[styles.overviewCount, tone === 'danger' ? styles.danger : styles.warning]}>{count}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewMeta}>{meta}</Text>
      <Text style={styles.openQueue}>Open queue ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overviewList: { flexDirection: 'row', gap: spacing.sm },
  overviewCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flex: 1, padding: spacing.md },
  overviewCount: { fontFamily: typography.family, fontSize: 32, fontWeight: '900' },
  warning: { color: colors.warning },
  danger: { color: colors.restricted },
  overviewLabel: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '900', marginTop: 3 },
  overviewMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 13, marginTop: 3 },
  openQueue: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 13, fontWeight: '900', marginTop: spacing.md },
  guidanceCard: { backgroundColor: '#EAF1ED', borderRadius: radius.card, gap: 5, marginTop: spacing.lg, padding: spacing.md },
  guidanceTitle: { color: '#173C2C', fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  guidanceBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  filter: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  filterActive: { backgroundColor: colors.primaryAction },
  filterLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  filterLabelActive: { color: colors.white },
  queueList: { gap: spacing.sm },
});
