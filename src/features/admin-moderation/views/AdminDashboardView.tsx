import { StyleSheet, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { spacing } from '../../../shared/theme/spacing';
import { ActivityIndicator, Text } from 'react-native';
import { AdminAuditTimeline } from '../components/AdminAuditTimeline';
import { AdminAttentionCard, AdminEmptyState, AdminHeading, AdminSectionLabel } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { formatAdminDuration } from '../models/AdminQueuePresentation';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function AdminDashboardView({ onExit, viewModel }: { onExit: () => void; viewModel: AdminModerationViewModel }) {
  const { total, oldest } = viewModel.work;
  const title = total === null ? 'Review queues' : total === 0 ? 'Nothing needs review' : `${total} ${total === 1 ? 'item needs' : 'items need'} review`;
  const body = total === null ? 'Some counts are still loading or unavailable.' : total === 0 ? 'All queues are clear.' : oldest ? `Oldest waiting: ${oldest.label}, ${formatAdminDuration(oldest.timestamp)}` : undefined;
  return (
    <AdminScaffold onExit={onExit} title="Admin Dashboard">
      <AdminHeading body={body} title={title} />
      {viewModel.dashboardNeedsRecovery ? <AppButton label="Retry verification queue" onPress={() => void viewModel.refreshVerification()} variant="secondary" /> : null}
      <FeedbackNotice tone="error" message={viewModel.verification.error ?? viewModel.verification.reviewError} />
      <FeedbackNotice tone="error" message={viewModel.reportsError} />
      {viewModel.reportsError && !viewModel.reportsBusy ? <AppButton label="Retry reports" onPress={() => void viewModel.refreshReports()} variant="secondary" /> : null}
      <FeedbackNotice tone="error" message={viewModel.reviewsError} />
      {viewModel.reviewsError && !viewModel.reviewsBusy ? <AppButton label="Retry reviews" onPress={() => void viewModel.refreshReviews()} variant="secondary" /> : null}

      <AdminSectionLabel>Needs attention</AdminSectionLabel>
      <View style={styles.list}>
        <AdminAttentionCard body="Tier 3 property and Tier 2 identity" count={viewModel.verificationCount} onPress={() => viewModel.openSection('reviewQueues', 'verification')} title="Verification submissions" tone="warning" />
        <AdminAttentionCard body="Listings and users" count={viewModel.reportCount} onPress={() => viewModel.openSection('reviewQueues', 'reports')} title="Safety reports" tone="danger" />
        <AdminAttentionCard body="Pending ratings and reviews" count={viewModel.reviewCount} lowerBound={viewModel.reviewCountIsLowerBound} onPress={() => viewModel.openSection('reviewQueues', 'reviews')} title="Review moderation" tone="info" />
      </View>

      <AdminSectionLabel>Recent decisions</AdminSectionLabel>
      {viewModel.recentDecisions.status === 'loading' && viewModel.recentDecisions.rows.length === 0 ? <ActivityIndicator accessibilityLabel="Loading recent decisions" color={colors.primaryAction} /> : null}
      {viewModel.recentDecisions.status === 'error' ? <>
        <FeedbackNotice tone="error" message={viewModel.recentDecisions.error} />
        <AppButton label="Retry recent decisions" onPress={() => void viewModel.refreshRecentDecisions()} variant="secondary" />
      </> : null}
      {viewModel.recentDecisions.status === 'success' && viewModel.recentDecisions.rows.length === 0 ? <AdminEmptyState body="Approvals, rejections, report decisions and actions appear here once Admins make them." title="No decisions recorded yet" /> : null}
      {viewModel.recentDecisions.rows.length > 0 ? <View style={styles.recent}>
        <AdminAuditTimeline compact entries={viewModel.recentDecisions.rows} />
        <Text style={ui.supporting}>Newest first.</Text>
        <AppButton label="See full audit history" onPress={() => viewModel.openSection('auditHistory')} variant="secondary" />
      </View> : null}
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.xs }, recent: { gap: spacing.sm } });
