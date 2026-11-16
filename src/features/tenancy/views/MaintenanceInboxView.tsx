import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {CHIP_COLORS} from '../../../shared/theme/statusColors';
import {ui} from '../../../shared/theme/ui';
import {ButtonRow, Slot, StatusButton, StatusChip} from '../../../shared/components/StatusParts';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {ageText, careActionsFor, categoryLabel, requestChip, resolvedLine, type InboxRow} from '../models/Maintenance';
import {NoteBubble, Notice} from '../components/MaintenanceParts';
import {useMaintenanceInboxViewModel, useTenantNames} from '../viewModels/useMaintenanceViewModels';

function Count({value, label, tone}: {value: number; label: string; tone: 'warning' | 'info' | 'neutral'}) {
  const c = CHIP_COLORS[tone];
  return <View accessible accessibilityLabel={`${value} ${label}`} style={[styles.count, {backgroundColor: c.backgroundColor, borderColor: c.borderColor}]}><Text style={[styles.countValue, {color: c.color}]}>{value}</Text><Text style={[ui.supporting, {color: c.color}]}>{label}</Text></View>;
}

/** The landlord's inbox: counts, then the requests in the order the server returned them (urgent open first). */
export function MaintenanceInboxView({accountId, propertyId, onOpen}: {accountId: string | undefined; propertyId: string | null; onOpen: (row: InboxRow, tenantName: string) => void}) {
  const vm = useMaintenanceInboxViewModel(accountId, propertyId), nameOf = useTenantNames(accountId, true), now = Date.now(), locked = vm.busy || vm.saving;
  const counts = vm.counts;
  return <KeyboardAwareScrollView contentContainerStyle={styles.content}>
    {counts ? <View style={styles.counts}><Count value={counts.open} label="Open" tone="warning"/><Count value={counts.inProgress} label="In progress" tone="info"/><Count value={counts.resolved} label="Resolved" tone="neutral"/></View> : null}
    {vm.busy && !vm.ready ? <ActivityIndicator accessibilityLabel="Loading maintenance requests" color={colors.primaryAction}/> : null}
    {vm.error ? <Notice text={vm.error} onRetry={() => void vm.workflow.retry()} disabled={locked}/> : null}
    {vm.ready && !vm.rows.length ? <View style={styles.card}><Text accessibilityRole="header" style={ui.sectionTitle}>Nothing needs you</Text><Text style={ui.supporting}>New maintenance requests from your tenants show up here.</Text></View> : null}
    {vm.rows.map(r => {
      const confirmed = r.tenantConfirmedAt !== null, tenant = nameOf(r.tenancyId), a = careActionsFor({role: 'landlord', tenancy: r.tenancyEnded ? 'ended' : 'active', status: r.status, confirmed});
      const chip = requestChip({priority: r.priority, status: r.status, confirmed}), busyHere = vm.savingId === r.id;
      return <View key={r.id} style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${r.title}. Open request`} onPress={() => onOpen(r, tenant)} style={{gap: spacing.xs}}>
          <View style={styles.head}><View style={{flex: 1, minWidth: 0}}><Text style={ui.sectionTitle}>{r.title}</Text><Text style={ui.supporting}>{tenant} · {ageText(r.createdAt, now)} · {categoryLabel(r.category)}</Text></View>{chip ? <StatusChip chip={chip}/> : null}</View>
          {r.status === 'resolved' ? <Text style={[ui.body, !confirmed && {color: colors.warning, fontWeight: '700'}]}>{resolvedLine({role: 'landlord', otherName: tenant, confirmed})}</Text> : null}
          {r.lastNote ? <NoteBubble who={r.lastNote.role === 'landlord' ? 'You' : tenant} text={r.lastNote.note} mine={r.lastNote.role === 'landlord'}/> : null}
        </Pressable>
        {a.reply || a.start || a.seen ? <ButtonRow>
          {a.reply ? <Slot><StatusButton label="Reply" accessibilityLabel={`Reply: ${r.title}`} disabled={locked} onPress={() => onOpen(r, tenant)}/></Slot> : null}
          {a.start ? <Slot><StatusButton tone="primary" label={busyHere ? 'Saving…' : 'Mark in progress'} accessibilityLabel={`Mark in progress: ${r.title}`} disabled={locked} onPress={() => void vm.workflow.act(r, 'in_progress')}/></Slot> : null}
          {a.seen && r.status === 'submitted' ? <Slot><StatusButton label="Seen" accessibilityLabel={`Mark seen: ${r.title}`} disabled={locked} onPress={() => void vm.workflow.act(r, 'acknowledged')}/></Slot> : null}
        </ButtonRow> : null}
      </View>;
    })}
  </KeyboardAwareScrollView>;
}
const styles = StyleSheet.create({
  content: {padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg},
  counts: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  count: {flexGrow: 1, flexBasis: 90, padding: spacing.sm, borderRadius: radius.control, borderWidth: 1, alignItems: 'center'},
  countValue: {...ui.pageTitle},
  card: {...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card},
  head: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.xs},
});
