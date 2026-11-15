import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { AdminEmptyState, AdminPills, AdminQueueCard, AdminTabs } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { documentTypeLabel, verificationStatusLabel, verificationTierLabel } from '../models/AdminVerification';
import { formatAdminAge, reportQueueFilters, reportReasonLabel, reportStatusLabel, reportStatusTone, reportTypeLabel, reviewKindLabel, reviewQueueFilters, reviewStatusLabel, reviewStatusTone, reviewTypeLabel } from '../models/AdminQueuePresentation';
import type { AdminQueueTab } from '../models/AdminModeration';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

const verificationFilters = [{ id: 'All', label: 'All' }, { id: 'Tier 2', label: 'Tier 2' }, { id: 'Tier 3', label: 'Tier 3' }] as const;

export function AdminQueueView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const tabs: { id: AdminQueueTab; label: string; count: number | null; lowerBound?: boolean }[] = [
    { id: 'verification', label: 'Verification', count: viewModel.verificationCount },
    { id: 'reports', label: 'Reports', count: viewModel.reportCount },
    { id: 'reviews', label: 'Reviews', count: viewModel.reviewCount, lowerBound: viewModel.reviewCountIsLowerBound },
  ];
  return (
    <AdminScaffold title="Review queue" onRefresh={() => void viewModel.refreshActiveQueue()} refreshing={viewModel.queueRefreshing} refreshEnabled={!viewModel.verification.reviewBusy}>
      <AdminTabs onSelect={viewModel.setQueueTab} selected={viewModel.queueTab} tabs={tabs} />
      {viewModel.queueTab === 'verification' ? <VerificationTab viewModel={viewModel} /> : null}
      {viewModel.queueTab === 'reports' ? <ReportsTab viewModel={viewModel} /> : null}
      {viewModel.queueTab === 'reviews' ? <ReviewsTab viewModel={viewModel} /> : null}
    </AdminScaffold>
  );
}

function VerificationTab({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const { verification } = viewModel;
  return (
    <View style={styles.tab}>
      <AdminPills onSelect={viewModel.setVerificationFilter} options={verificationFilters} selected={viewModel.verificationFilter} />
      {viewModel.queueRefreshing ? <Text accessibilityLiveRegion="polite" style={ui.supporting}>Loading verification submissions...</Text> : <Text style={ui.supporting}>Pull down to refresh.</Text>}
      {viewModel.dashboardNeedsRecovery ? <AppButton disabled={viewModel.queueRefreshing} label="Retry verification queue" onPress={() => void viewModel.refreshVerification()} variant="secondary" /> : null}
      <FeedbackNotice tone="error" message={verification.error} />
      <FeedbackNotice tone="error" message={verification.reviewError} />
      <FeedbackNotice tone="success" message={verification.reviewNotice} />
      {verification.status === 'success' && viewModel.verificationSubmissions.length === 0 ? <AdminEmptyState title="Nothing waiting" body="No verification submissions are waiting for review." /> : null}
      {viewModel.verificationSubmissions.map((item) => (
        <AdminQueueCard
          age={formatAdminAge(item.submittedAt)}
          key={item.submissionId}
          onPress={() => viewModel.openVerification(item.submissionId)}
          statusLabel={verificationStatusLabel(item.status)}
          statusTone={item.status === 'under_review' ? 'info' : 'warning'}
          title={item.displayName}
          type={`${verificationTierLabel(item.tier)} · ${documentTypeLabel(item.documentType)}`}
        />
      ))}
    </View>
  );
}

function ReportsTab({ viewModel }: { viewModel: AdminModerationViewModel }) {
  return (
    <View style={styles.tab}>
      <AdminPills disabled={viewModel.reportsLocked} onSelect={viewModel.setReportFilter} options={reportQueueFilters} selected={viewModel.reportFilter} />
      {viewModel.reportsBusy ? <ActivityIndicator accessibilityLabel="Loading reports" color={colors.primaryAction} /> : <Text style={ui.supporting}>Pull down to refresh.</Text>}
      <FeedbackNotice tone="error" message={viewModel.reportsError} />
      <FeedbackNotice tone="success" message={viewModel.reportsNotice} />
      {viewModel.reportsPending ? <>
        <FeedbackNotice tone="warning" message="A report action needs reconciliation. Retry the same saved operation; do not clear app data." />
        <AppButton disabled={!viewModel.reportsReady || viewModel.reportsBusy || viewModel.reportsSaving} label="Retry pending report action" onPress={() => void viewModel.retryReports()} />
      </> : null}
      {viewModel.reportsLoaded && viewModel.reportRows.length === 0 ? <AdminEmptyState title="No reports in this view" body={viewModel.reportsHasMore ? 'More reports are available on the next page.' : 'Nothing matches this filter right now.'} /> : null}
      {viewModel.reportRows.map((row) => (
        <AdminQueueCard
          age={formatAdminAge(row.submittedAt)}
          key={row.id}
          onPress={() => viewModel.openReport(row.id)}
          statusLabel={reportStatusLabel(row.status)}
          statusTone={reportStatusTone(row.status)}
          title={reportReasonLabel(row)}
          type={reportTypeLabel(row.kind)}
        />
      ))}
      {viewModel.reportsHasPrevious ? <AppButton disabled={viewModel.reportsLocked} label="Previous reports" onPress={() => void viewModel.previousReports()} variant="secondary" /> : null}
      {viewModel.reportsHasMore ? <AppButton disabled={viewModel.reportsLocked} label="More reports" onPress={() => void viewModel.moreReports()} variant="secondary" /> : null}
    </View>
  );
}

function ReviewsTab({ viewModel }: { viewModel: AdminModerationViewModel }) {
  return (
    <View style={styles.tab}>
      <AdminPills disabled={viewModel.reviewsLocked} onSelect={viewModel.setReviewStatus} options={reviewQueueFilters} selected={viewModel.reviewStatus} />
      {viewModel.reviewsBusy ? <ActivityIndicator accessibilityLabel="Loading reviews" color={colors.primaryAction} /> : <Text style={ui.supporting}>Pull down to refresh. Tap a review to moderate it.</Text>}
      <FeedbackNotice tone="error" message={viewModel.reviewsError} />
      <FeedbackNotice tone="success" message={viewModel.reviewsNotice} />
      {viewModel.reviewsPending ? <>
        <FeedbackNotice tone="warning" message="A review action needs reconciliation. Retry the same saved operation; keep app data until it is confirmed." />
        <AppButton disabled={!viewModel.reviewsReady || viewModel.reviewsBusy || viewModel.reviewsSaving} label="Retry pending review action" onPress={() => void viewModel.retryReviews()} />
      </> : null}
      {viewModel.reviewsError && !viewModel.reviewsBusy && !viewModel.reviewsPending ? <AppButton label="Retry reviews" onPress={() => void viewModel.refreshReviews()} variant="secondary" /> : null}
      {viewModel.reviewsLoaded && viewModel.reviewRows.length === 0 ? <AdminEmptyState title="Nothing here" body={viewModel.reviewStatus === 'pending' ? 'No reviews are waiting for moderation.' : 'No reviews in this moderation state.'} /> : null}
      {viewModel.reviewRows.map((row) => (
        <AdminQueueCard
          age={formatAdminAge(row.createdAt)}
          key={row.id}
          onPress={() => viewModel.openReview(row.id)}
          statusLabel={reviewStatusLabel(row.status)}
          statusTone={reviewStatusTone(row.status)}
          title={`${reviewKindLabel(row.kind)} · ${row.rating} of 5`}
          type={reviewTypeLabel(row.kind)}
        />
      ))}
      {viewModel.reviewsHasPrevious ? <AppButton disabled={viewModel.reviewsLocked} label="Previous review page" onPress={() => void viewModel.previousReviews()} variant="secondary" /> : null}
      {viewModel.reviewsHasMore ? <AppButton disabled={viewModel.reviewsLocked} label="More reviews" onPress={() => void viewModel.moreReviews()} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ tab: { gap: spacing.sm } });
