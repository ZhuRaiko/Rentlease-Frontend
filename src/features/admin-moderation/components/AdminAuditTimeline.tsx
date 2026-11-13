import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { auditActorLabel } from '../models/AuditPresentation';
import { auditEntrySubject, auditEntryTitle, formatAdminDateTime, formatAdminDay, type AdminAuditEntry } from '../models/AdminActions';

/** Real audit rows as a timeline. Every line is text (never color alone); long reasons wrap. */
export function AdminAuditTimeline({ entries, compact = false }: { entries: readonly AdminAuditEntry[]; compact?: boolean }) {
  return (
    <View accessibilityRole="list" style={styles.timeline}>
      {entries.map((entry) => {
        const subject = auditEntrySubject(entry);
        return (
          <View accessibilityLabel={`${auditEntryTitle(entry)}${subject ? `. ${subject}` : ''}. By ${auditActorLabel(entry.actor)}. ${formatAdminDay(entry.createdAt)}`} accessible key={entry.id} style={styles.event}>
            <View style={[styles.dot, dotTone(entry.action)]} />
            <View style={styles.copy}>
              <Text style={styles.title}>{auditEntryTitle(entry)}</Text>
              {subject ? <Text style={ui.supporting}>{subject}</Text> : null}
              <Text style={ui.supporting}>{`By ${auditActorLabel(entry.actor)} · ${compact ? formatAdminDay(entry.createdAt) : formatAdminDateTime(entry.createdAt)}`}</Text>
              {!compact && entry.reason ? <Text style={ui.supporting}>{`Reason: ${entry.reason}`}</Text> : null}
              {!compact && entry.endsAt ? <Text style={ui.supporting}>{`End date: ${formatAdminDay(entry.endsAt)}`}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const dotTone = (action: string) => action === 'suspend_account' || action === 'remove_listing' || action.endsWith('_rejected') ? styles.dotDanger
  : action === 'pause_listing' || action === 'restrict_account' || action.endsWith('_hidden') ? styles.dotWarning : styles.dotPositive;

const styles = StyleSheet.create({
  timeline: { borderLeftColor: colors.outline, borderLeftWidth: 2, gap: spacing.md, marginLeft: spacing.xxs, paddingLeft: spacing.sm },
  event: { flexDirection: 'row' },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: { ...ui.body, fontWeight: '600' },
  dot: { borderColor: colors.background, borderRadius: radius.pill, borderWidth: 2, height: 12, left: -(spacing.sm + 7), marginTop: 5, position: 'absolute', width: 12 },
  dotPositive: { backgroundColor: colors.primaryAction },
  dotWarning: { backgroundColor: colors.warning },
  dotDanger: { backgroundColor: colors.restricted },
});
