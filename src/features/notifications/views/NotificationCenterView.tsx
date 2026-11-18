import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {AppButton} from '../../../shared/components/AppButton';
import {GlyphIcon} from '../../../shared/components/GlyphIcon';
import {ui} from '../../../shared/theme/ui';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import type {InAppNotificationsViewModel} from '../viewModels/useInAppNotifications';
import type {InAppTarget} from '../models/InAppNotification';
import {groupNotifications, type NotificationTone} from '../models/NotificationPresentation';

/** Icon circle colors per tone, from the app's tokens: amber maintenance, blue messages, green tenancy, grey review/verification, red urgent. */
const TONES: Record<NotificationTone, {background: string; ink: string}> = {
  amber: {background: colors.warningSurface, ink: colors.propertyProofInk},
  blue: {background: colors.identityCredentialSurface, ink: colors.identityInk},
  green: {background: colors.primaryPale, ink: colors.primaryAction},
  grey: {background: colors.surface, ink: colors.textSecondary},
  red: {background: colors.restrictedSurface, ink: colors.restricted},
};

export function NotificationCenterView({viewModel: vm, onClose, onOpenTarget}: {viewModel: InAppNotificationsViewModel; onClose: () => void; onOpenTarget: (t: InAppTarget) => void}) {
  const locked = vm.busy || vm.writing || !!vm.pending;
  const groups = vm.page ? groupNotifications(vm.page.rows, Date.now()) : [];
  const markDisabled = locked || !vm.page?.unread;
  return <View style={styles.screen}>
    <ScreenHeader title="Notifications" onBack={onClose} />
    <ScrollView refreshControl={<RefreshControl refreshing={vm.busy} onRefresh={() => void vm.workflow.refresh()} />} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text accessibilityLiveRegion="polite" style={styles.count}>{vm.page ? `${vm.page.unread} unread` : 'Unread count unavailable'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Mark all read" accessibilityState={{disabled: markDisabled}} disabled={markDisabled} onPress={() => void vm.workflow.markAll()} style={[styles.pill, markDisabled && styles.pillOff]}>
          <Text style={styles.pillText}>Mark all read</Text>
        </Pressable>
      </View>
      {vm.writing ? <ActivityIndicator accessibilityLabel="Updating notification" /> : null}
      {vm.busy && !vm.page ? <ActivityIndicator accessibilityLabel="Loading notifications" /> : null}
      {vm.error ? <View style={styles.gap}><Text accessibilityRole="alert" style={ui.body}>{vm.error}</Text><AppButton label={vm.pending ? 'Retry read update' : 'Retry'} disabled={vm.busy || vm.writing} onPress={() => void vm.workflow.retry()} /></View> : null}
      {vm.notice ? <Text accessibilityLiveRegion="polite" style={ui.supporting}>{vm.notice}</Text> : null}
      {!vm.busy && !vm.error && vm.page?.rows.length === 0 ? <View style={styles.empty}><Text style={ui.sectionTitle}>You're all caught up</Text><Text style={ui.body}>New rental activity will appear here. No push permission is required.</Text></View> : null}
      {groups.map(group => <View key={group.label} style={styles.gap}>
        <Text accessibilityRole="header" style={styles.groupLabel}>{group.label}</Text>
        <View style={styles.card}>
          {group.rows.map((row, i) => {
            const tone = TONES[row.tone];
            return <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${row.unread ? 'Unread' : 'Read'}: ${row.title}. Open update`} accessibilityState={{disabled: locked}} disabled={locked}
              onPress={() => { void vm.workflow.open(row.id).then(t => { if (t) onOpenTarget(t); }); }} style={[styles.row, i > 0 && styles.rowRule]}>
              <View style={[styles.icon, {backgroundColor: tone.background}]}><GlyphIcon kind={row.icon} size={22} color={tone.ink} /></View>
              <View style={styles.copy}>
                <Text style={[styles.title, row.unread ? styles.titleUnread : null, row.urgent ? {color: colors.restricted} : null]}>{row.title}</Text>
                <Text style={ui.supporting}>{row.text}</Text>
                <View style={styles.meta}>
                  {row.urgent ? <View style={styles.urgentChip}><Text style={styles.urgentText}>Urgent</Text></View> : null}
                  <Text style={styles.when}>{row.when}</Text>
                </View>
              </View>
              {row.unread ? <View accessible={false} style={styles.dot} /> : null}
            </Pressable>;
          })}
        </View>
      </View>)}
      {vm.page?.next ? <AppButton label="Load older updates" variant="secondary" disabled={locked} onPress={() => void vm.workflow.more()} /> : null}
      <Text style={ui.supporting}>Updates appear here while the app is open.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.canvas},
  content: {padding: spacing.md, gap: spacing.md},
  summary: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs},
  count: {...ui.sectionTitle, fontWeight: '700'},
  pill: {minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  pillOff: {opacity: 0.5},
  pillText: {...ui.body, fontWeight: '500'},
  gap: {gap: spacing.xs},
  groupLabel: {...ui.supporting, fontWeight: '700', paddingHorizontal: spacing.xxs},
  card: {backgroundColor: colors.background, borderRadius: radius.card, borderWidth: 1, borderColor: colors.outline, overflow: 'hidden'},
  row: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm + 2, minHeight: 72},
  rowRule: {borderTopWidth: 1, borderTopColor: colors.outline},
  icon: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'},
  copy: {flex: 1, minWidth: 0, gap: spacing.xxs},
  title: {...ui.body, fontWeight: '400'},
  titleUnread: {fontWeight: '700'},
  meta: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  when: {...ui.supporting, fontSize: 12, lineHeight: 16},
  urgentChip: {backgroundColor: colors.restricted, borderRadius: radius.pill, paddingHorizontal: spacing.xs + 2, minHeight: 24, justifyContent: 'center'},
  urgentText: {...ui.supporting, color: colors.white, fontWeight: '500', lineHeight: 16},
  dot: {width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryAction, marginTop: spacing.xxs + 2},
  empty: {...ui.panel, padding: spacing.md, gap: spacing.xs},
});
