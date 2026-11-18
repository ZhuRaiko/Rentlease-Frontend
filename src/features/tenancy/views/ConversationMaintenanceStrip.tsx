import {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {GlyphIcon} from '../../../shared/components/GlyphIcon';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {useConversationMaintenance} from '../viewModels/useConversationMaintenance';

export interface ConversationMaintenanceStripProps {
  accountId: string | undefined;
  tenancyId: string;
  role: 'tenant' | 'landlord';
  onOpenRequest: (requestId: string) => void;
  onReportAnother: () => void;
}

/** The amber maintenance strip above a chat's messages. It is not a message. Hidden when no request is open. */
export function ConversationMaintenanceStrip({accountId, tenancyId, role, onOpenRequest, onReportAnother}: ConversationMaintenanceStripProps) {
  const strip = useConversationMaintenance(accountId, tenancyId);
  const [hidden, setHidden] = useState(false);
  if (!strip || strip.openCount === 0) return null;
  return <View style={styles.card}>
    <View style={styles.head}>
      <GlyphIcon kind="wrench" size={22} color={colors.propertyProofInk} />
      <Text accessibilityRole="header" style={styles.headTitle}>{`Maintenance · ${strip.openCount} open`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show maintenance requests' : 'Hide maintenance requests'} accessibilityState={{expanded: !hidden}} onPress={() => setHidden(v => !v)} style={styles.toggle}>
        <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
        <Text accessible={false} style={styles.toggleText}>{hidden ? '⌄' : '⌃'}</Text>
      </Pressable>
    </View>
    {hidden ? null : <View style={styles.body}>
      {strip.items.map(item => <View key={item.id} style={styles.item}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.title}</Text>
          {item.urgent ? <View style={styles.urgent}><Text style={styles.urgentText}>Urgent</Text></View> : null}
        </View>
        <Text style={ui.supporting}>{item.meta}</Text>
        <View style={styles.actionRow}>
          <View style={styles.status}><Text style={styles.statusText}>{item.status}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open request: ${item.title}`} onPress={() => onOpenRequest(item.id)} style={styles.open}>
            <Text style={styles.openText}>{'Open request ›'}</Text>
          </Pressable>
        </View>
      </View>)}
      {role === 'tenant' ? <Pressable accessibilityRole="button" onPress={onReportAnother} style={styles.report}><Text style={styles.reportText}>Report another issue</Text></Pressable> : null}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: {borderRadius: radius.card, borderWidth: 1, borderColor: colors.propertyCredentialSurface, backgroundColor: colors.background, overflow: 'hidden'},
  head: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.warningSurface, paddingLeft: spacing.sm, minHeight: 48},
  headTitle: {...ui.body, flex: 1, minWidth: 0, fontWeight: '700', color: colors.propertyProofInk},
  toggle: {flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 48, minWidth: 48, paddingHorizontal: spacing.sm, justifyContent: 'center'},
  toggleText: {...ui.supporting, color: colors.propertyProofInk},
  body: {padding: spacing.sm, gap: spacing.sm},
  item: {gap: spacing.xxs},
  titleRow: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs},
  title: {...ui.body, flex: 1, minWidth: 0, fontWeight: '700'},
  urgent: {backgroundColor: colors.restricted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 24, justifyContent: 'center'},
  urgentText: {...ui.supporting, color: colors.white, fontWeight: '500', lineHeight: 16},
  actionRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, flexWrap: 'wrap'},
  status: {backgroundColor: colors.warningSurface, borderColor: colors.propertyCredentialSurface, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 28, justifyContent: 'center'},
  statusText: {...ui.supporting, color: colors.propertyProofInk, lineHeight: 18},
  open: {minHeight: 48, justifyContent: 'center'},
  openText: {...ui.body, color: colors.primaryAction, fontWeight: '700'},
  report: {minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.controlBorder, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md},
  reportText: {...ui.body, color: colors.ink},
});
