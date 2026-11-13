import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { AdminAuditRow } from '../components/AdminAuditRow';
import { AdminEmptyState, AdminHeading, AdminScrollChips, AdminSectionLabel } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { auditFilters } from '../models/AdminActions';
import { auditEmptyCopy, groupAuditByDay } from '../models/AuditPresentation';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

/** Audit tab: day-grouped records from get_admin_audit_log. Tap a record for the full entry. Read-only: the app cannot write or edit the log. */
export function AdminAuditView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const log = viewModel.auditLog;
  const loading = log.status === 'loading';
  const groups = groupAuditByDay(log.rows);
  const hasMore = log.rows.length < log.count;
  const empty = auditEmptyCopy(log.kind);
  return (
    <AdminScaffold onRefresh={() => void viewModel.loadAudit(log.kind, 0)} refreshing={loading} title="Audit history">
      <AdminHeading body="Admin decisions, newest first. This history is written by the server and can't be edited here." title={log.status === 'success' ? `${log.count} ${log.count === 1 ? 'entry' : 'entries'}` : 'Audit history'} />
      <AdminScrollChips disabled={loading} onSelect={(kind) => void viewModel.loadAudit(kind, 0)} options={auditFilters} selected={log.kind} />
      <View style={styles.list}>
        {loading && log.rows.length === 0 ? <ActivityIndicator accessibilityLabel="Loading audit history" color={colors.primaryAction} /> : null}
        {log.status === 'error' ? <>
          <AdminEmptyState body={log.error ?? 'Check your connection and try again.'} title="Couldn't load the audit log" />
          <AppButton label="Try again" onPress={() => void viewModel.loadAudit(log.kind, 0)} variant="secondary" />
        </> : null}
        {log.status === 'success' && log.rows.length === 0 ? <AdminEmptyState body={empty.body} title={empty.title} /> : null}
        {groups.map((group) => (
          <View key={`${group.label}-${group.entries[0]!.id}`} style={styles.group}>
            <AdminSectionLabel>{group.label}</AdminSectionLabel>
            {group.entries.map((entry) => <AdminAuditRow entry={entry} key={entry.id} onPress={() => viewModel.openAuditEntry(entry.id)} />)}
          </View>
        ))}
        {log.rows.length > 0 ? <Text style={styles.count}>{`Showing ${log.rows.length} of ${log.count}`}</Text> : null}
        {log.moreStatus === 'error' ? <FeedbackNotice tone="error" message={log.moreError} /> : null}
        {hasMore && log.status === 'success' ? (
          <AppButton disabled={log.moreStatus === 'loading'} label={log.moreStatus === 'loading' ? 'Loading...' : log.moreStatus === 'error' ? 'Try again' : 'Load more'} onPress={() => void viewModel.loadMoreAudit()} variant="secondary" />
        ) : null}
      </View>
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  group: { gap: spacing.xs },
  count: { ...ui.supporting, textAlign: 'center' },
});
