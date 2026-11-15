import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { AdminActionSheet } from '../components/AdminActionSheet';
import { AdminCard, AdminEmptyState, AdminHeading, AdminQueueCard } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { reinstateBlockedReason, removedListingMeta, removedListingReason, removedListingsHeading, restrictionEndsLabel, restrictionNeedsRestore, restrictionStatusLabel, restrictionStatusTone } from '../models/AdminActions';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

/** Actions tab: accounts that are currently suspended or restricted, from get_admin_restrictions. Open one to restore it. */
export function AdminActionsView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const { restrictions, removedListings: removed, actionSubmit, actionDraft } = viewModel;
  const loading = restrictions.status === 'loading' || removed.status === 'loading';
  const title = restrictions.status === 'success' ? `${restrictions.count} ${restrictions.count === 1 ? 'restricted account' : 'restricted accounts'}` : 'Restricted accounts';
  return (
    <AdminScaffold onRefresh={() => void viewModel.refreshRestrictions()} refreshing={loading} title="Actions">
      <AdminHeading body="Suspended or restricted accounts. Open one to restore it. New actions start from an upheld report." title={title} />
      <View style={styles.list}>
        <FeedbackNotice tone="success" message={actionSubmit.notice} />
        <FeedbackNotice tone="error" message={actionDraft ? null : actionSubmit.error} />
        {loading && restrictions.rows.length === 0 ? <ActivityIndicator accessibilityLabel="Loading restricted accounts" color={colors.primaryAction} /> : null}
        {restrictions.status === 'error' ? <>
          <FeedbackNotice tone="error" message={restrictions.error} />
          <AppButton label="Retry" onPress={() => void viewModel.refreshRestrictions()} variant="secondary" />
        </> : null}
        {restrictions.status === 'success' && restrictions.rows.length === 0 ? <AdminEmptyState body="Accounts you suspend appear here, so you can restore them." title="No restricted accounts" /> : null}
        {restrictions.rows.map((row) => (
          <AdminQueueCard
            age={restrictionEndsLabel(row)}
            flag={restrictionNeedsRestore(row) ? 'Ended, restore' : undefined}
            key={row.userId}
            onPress={() => viewModel.openRestriction(row.userId)}
            statusLabel={restrictionStatusLabel(row.status)}
            statusTone={restrictionStatusTone(row.status)}
            title={row.name}
            type={row.reason ?? 'No reason recorded'}
          />
        ))}
        {restrictions.status === 'success' && restrictions.count > restrictions.rows.length ? <Text style={ui.supporting}>{`Showing the ${restrictions.rows.length} most recent of ${restrictions.count}.`}</Text> : null}
        {restrictions.status === 'success' ? <Text style={ui.supporting}>An end date is a reminder only. An account stays restricted until you restore it.</Text> : null}
      </View>
      <AdminHeading body="A reinstated listing returns as paused. The owner reactivates it." title={removed.status === 'success' ? removedListingsHeading(removed.count) : 'Removed listings'} />
      <View style={styles.list}>
        {removed.status === 'error' ? <>
          <FeedbackNotice tone="error" message={removed.error} />
          <AppButton label="Retry" onPress={() => void viewModel.refreshRestrictions()} variant="secondary" />
        </> : null}
        {removed.status === 'success' && removed.rows.length === 0 ? <AdminEmptyState body="Listings removed after an upheld report appear here, so you can reinstate one removed in error." title="No removed listings" /> : null}
        {removed.rows.map((row) => {
          const blocked = reinstateBlockedReason(row);
          return <AdminCard key={row.listingId}>
            <Text accessibilityRole="header" style={ui.sectionTitle}>{row.title}</Text>
            <Text style={ui.supporting}>{removedListingMeta(row)}</Text>
            <Text style={ui.body}>{removedListingReason(row)}</Text>
            {blocked ? <Text style={ui.supporting}>{blocked}</Text> : null}
            <AppButton disabled={!!blocked || actionSubmit.busy} label="Reinstate" onPress={() => viewModel.openReinstate(row)} variant="secondary" />
          </AdminCard>;
        })}
        {removed.status === 'success' && removed.count > removed.rows.length ? <Text style={ui.supporting}>{`Showing ${removed.rows.length} of ${removed.count}.`}</Text> : null}
      </View>
      <AdminActionSheet
        busy={actionSubmit.busy} draft={actionDraft} error={actionSubmit.error}
        onCancel={viewModel.cancelAction} onChange={viewModel.updateActionDraft} onConfirm={() => void viewModel.confirmAction()} />
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.sm } });
