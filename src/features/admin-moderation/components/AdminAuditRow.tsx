import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import type { AdminAuditEntry } from '../models/AdminActions';
import { presentAuditEntry, type AuditOutcome } from '../models/AuditPresentation';
import { AdminChip, adminToneColors } from './AdminCards';

/** The outcome glyph in a tone-tinted circle. Decorative: the outcome pill beside it carries the meaning in words. */
export function AuditOutcomeMark({ outcome, size = 40 }: { outcome: AuditOutcome; size?: number }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.mark, adminToneColors.surface[outcome.tone], { borderRadius: size / 2, height: size, width: size }]}>
      <Text style={[styles.markText, { color: adminToneColors.ink[outcome.tone], fontSize: size * 0.42 }]}>{outcome.icon}</Text>
    </View>
  );
}

/**
 * One audit record as a tappable card (48dp minimum): outcome icon, headline, subject, a one-line reason, outcome pill, time and a chevron.
 * At large text the pill and time drop under the copy instead of squeezing the headline.
 */
export function AdminAuditRow({ entry, onPress }: { entry: AdminAuditEntry; onPress: () => void }) {
  const view = presentAuditEntry(entry);
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.3;
  const meta = (
    <View style={stacked ? styles.metaStacked : styles.metaSide}>
      <AdminChip label={view.outcome.label} tone={view.outcome.tone} />
      {view.time ? <Text style={ui.supporting}>{view.time}</Text> : null}
    </View>
  );
  return (
    <Pressable accessibilityHint="Opens the full record" accessibilityLabel={view.listLabel} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <AuditOutcomeMark outcome={view.outcome} />
      <View style={styles.copy}>
        <Text style={styles.headline}>{view.headline}</Text>
        {view.subject ? <Text style={ui.supporting}>{view.subject}</Text> : null}
        {view.reason ? <Text numberOfLines={1} style={styles.reason}>{view.reason}</Text> : null}
        {stacked ? meta : null}
      </View>
      {stacked ? null : meta}
      <Text accessible={false} style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...ui.panel, alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, minHeight: 72, padding: spacing.sm },
  pressed: { opacity: 0.72 },
  mark: { alignItems: 'center', justifyContent: 'center' },
  markText: { fontFamily: typography.family, fontWeight: '800' },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  headline: { ...ui.body, fontWeight: '700' },
  reason: { ...ui.body, color: colors.ink, fontSize: 14, lineHeight: 20 },
  metaSide: { alignItems: 'flex-end', gap: spacing.xxs },
  metaStacked: { alignItems: 'flex-start', gap: spacing.xxs, marginTop: spacing.xxs },
  chevron: { alignSelf: 'center', color: colors.textMuted, fontFamily: typography.family, fontSize: 27 },
});
