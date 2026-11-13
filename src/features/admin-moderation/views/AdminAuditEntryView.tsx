import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { AuditOutcomeMark } from '../components/AdminAuditRow';
import { AdminCard, AdminChip, AdminDisclosure, AdminSectionLabel, DetailRow } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { presentAuditEntry } from '../models/AuditPresentation';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

/** One audit record in full. Uses only what get_admin_audit_log returns; a row with no value is not shown. Read-only. */
export function AdminAuditEntryView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const entry = viewModel.selectedAuditEntry;
  if (!entry) return (
    <AdminScaffold onBack={viewModel.goBack} title="Audit entry">
      <Text style={ui.body}>This entry is no longer in the list. Go back and refresh the audit history.</Text>
      <View style={styles.related}><AppButton label="Back to audit history" onPress={() => viewModel.openSection('auditHistory')} variant="secondary" /></View>
    </AdminScaffold>
  );
  const view = presentAuditEntry(entry);
  const related = viewModel.auditRelatedAvailable(entry);
  return (
    <AdminScaffold onBack={viewModel.goBack} title="Audit entry">
      <View style={styles.hero}>
        <AuditOutcomeMark outcome={view.outcome} size={52} />
        <Text accessibilityRole="header" style={styles.headline}>{view.headline}</Text>
        <View style={styles.pillWrap}><AdminChip label={view.outcome.label} tone={view.outcome.tone} /></View>
        <Text style={[ui.supporting, styles.centered]}>{view.whenFull}</Text>
      </View>
      {view.detailRows.length > 0 ? <>
        <AdminSectionLabel>What happened</AdminSectionLabel>
        <AdminCard>{view.detailRows.map((row) => <DetailRow key={row.label} label={row.label} value={row.value} />)}</AdminCard>
      </> : null}
      {view.reason ? <>
        <AdminSectionLabel>Reason given</AdminSectionLabel>
        <View style={styles.quote}>
          <Text selectable style={ui.body}>{view.reason}</Text>
          <Text style={ui.supporting}>Written by the Admin who made this decision.</Text>
        </View>
      </> : null}
      <AdminSectionLabel>Decided by</AdminSectionLabel>
      <AdminCard>
        <DetailRow label="Admin" value={view.actor} />
        {view.actorReference ? <DetailRow label="Admin reference" value={view.actorReference} /> : null}
      </AdminCard>
      {related ? <View style={styles.related}><AppButton label={related.label} onPress={() => viewModel.openAuditRelated(entry)} variant="secondary" /></View> : null}
      <Text style={[ui.supporting, styles.centered, styles.note]}>This record can't be edited or deleted.</Text>
      <AdminDisclosure title="IDs and technical details">
        <DetailRow label="Audit record" value={`#${entry.id}`} />
        {entry.entityId ? <DetailRow label="Record ID" value={entry.entityId} /> : null}
        {entry.reportId ? <DetailRow label="Report ID" value={entry.reportId} /> : null}
      </AdminDisclosure>
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { ...ui.panel, alignItems: 'center', gap: spacing.xs, padding: spacing.md },
  headline: { ...ui.pageTitle, textAlign: 'center' },
  centered: { textAlign: 'center' },
  pillWrap: { alignItems: 'center' },
  related: { marginTop: spacing.md },
  note: { marginTop: spacing.sm },
  quote: { backgroundColor: colors.primaryPale, borderLeftColor: colors.primaryAction, borderLeftWidth: 4, borderRadius: radius.sm, gap: spacing.xs, padding: spacing.sm },
});
