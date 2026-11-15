import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { AdminActionSheet } from '../components/AdminActionSheet';
import { AdminCard, AdminChip, AdminChipRow, AdminDisclosure, AdminSectionLabel, DetailRow } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { formatAdminDay, restrictionEndsLabel, restrictionNeedsRestore, restrictionStatusLabel, restrictionStatusTone } from '../models/AdminActions';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

/** One restricted account: why, since when, until when, and Restore (with a reason). Restore is the only action here. */
export function RestrictionDetailView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const row = viewModel.selectedRestriction;
  const { actionDraft, actionSubmit } = viewModel;
  if (!row) return (
    <AdminScaffold onBack={viewModel.goBack} title="Restricted account">
      <Text style={ui.body}>{viewModel.restrictions.status === 'loading' ? 'Loading...' : 'This account is no longer restricted, or the list has changed.'}</Text>
      <FeedbackNotice tone="error" message={actionSubmit.error} />
      <AppButton label="Back to restricted accounts" onPress={() => viewModel.openSection('activeRestrictions')} variant="secondary" />
    </AdminScaffold>
  );
  const footer = row.restorable
    ? <AppButton disabled={actionSubmit.busy} label="Restore account" onPress={viewModel.openRestore} />
    : <Text style={ui.supporting}>Admin accounts can't be restored from the app. Ask the backend owner.</Text>;
  return (
    <AdminScaffold footer={footer} onBack={viewModel.goBack} title="Restricted account">
      <Text accessibilityRole="header" style={styles.name}>{row.name}</Text>
      <AdminChipRow>
        <AdminChip label={restrictionStatusLabel(row.status)} tone={restrictionStatusTone(row.status)} />
        <AdminChip label={restrictionEndsLabel(row)} />
        {restrictionNeedsRestore(row) ? <AdminChip label="Ended, restore" tone="warning" /> : null}
      </AdminChipRow>
      <View style={styles.notices}>
        <FeedbackNotice tone="error" message={actionDraft ? null : actionSubmit.error} />
        {restrictionNeedsRestore(row) ? <FeedbackNotice tone="warning" message="The end date has passed, but the account stays restricted until an Admin restores it." /> : null}
      </View>
      <AdminSectionLabel>Reason</AdminSectionLabel>
      <AdminCard>{row.reason ? <Text style={ui.body}>{row.reason}</Text> : <Text style={ui.supporting}>No reason recorded.</Text>}</AdminCard>
      <AdminSectionLabel>Timing</AdminSectionLabel>
      <AdminCard>
        <DetailRow label="Started" value={row.startedAt ? formatAdminDay(row.startedAt) : 'Start date not recorded'} />
        <DetailRow label="Ends" value={row.endsAt ? formatAdminDay(row.endsAt) : 'No end date'} />
      </AdminCard>
      <AdminDisclosure title="IDs and technical details"><DetailRow label="User ID" value={row.userId} /></AdminDisclosure>
      <AdminActionSheet
        busy={actionSubmit.busy} draft={actionDraft} error={actionSubmit.error}
        onCancel={viewModel.cancelAction} onChange={viewModel.updateActionDraft} onConfirm={() => void viewModel.confirmAction()} />
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  name: { ...ui.pageTitle },
  notices: { gap: spacing.xs, marginTop: spacing.xs },
});
