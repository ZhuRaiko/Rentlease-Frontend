import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tagDisabled, tagOptions, type TagGroup } from '../models/ReviewTags';
import { starWord } from '../models/ReviewPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { ui } from '../theme/ui';

/** Five stars, filled up to `filled`. Decorative: the label next to it carries the number. */
export function StarRow({ filled, size = 16 }: { filled: number; size?: number }) {
  return <Text accessible={false} allowFontScaling={false} style={{ fontSize: size, letterSpacing: 2, color: colors.outline }}>
    <Text style={{ color: colors.reviewOrange }}>{'★'.repeat(filled)}</Text>{'★'.repeat(Math.max(0, 5 - filled))}
  </Text>;
}

/** Five big tappable stars with the word underneath. Each star is at least 48dp wide and tall. */
export function StarPicker({ value, onChange, disabled = false }: { value: number | null; onChange: (rating: number) => void; disabled?: boolean }) {
  return <View style={styles.pickerWrap}>
    <View accessibilityRole="radiogroup" style={styles.pickerRow}>
      {[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}, ${starWord(n)}`} accessibilityState={{ selected: value === n, disabled }} disabled={disabled} onPress={() => onChange(n)} style={styles.star}>
        <Text accessible={false} allowFontScaling={false} style={[styles.starGlyph, { color: value !== null && n <= value ? colors.reviewOrange : colors.outline }]}>{'★'}</Text>
      </Pressable>)}
    </View>
    <Text accessibilityLiveRegion="polite" style={[ui.body, styles.word]}>{starWord(value)}</Text>
  </View>;
}

/** Tag choices: tap to select up to the limit; the rest are disabled once the limit is reached. */
export function TagPicker({ group, selected, onToggle, disabled = false }: { group: TagGroup; selected: readonly string[]; onToggle: (code: string) => void; disabled?: boolean }) {
  return <View style={styles.tags}>{tagOptions(group).map(t => {
    const on = selected.includes(t.code), off = disabled || tagDisabled(selected, t.code);
    return <Pressable key={t.code} accessibilityRole="checkbox" accessibilityLabel={t.label} accessibilityState={{ checked: on, disabled: off }} disabled={off} onPress={() => onToggle(t.code)} style={[styles.tag, on && styles.tagOn, off && !on && styles.tagOff]}>
      <Text style={[ui.body, { color: on ? colors.primaryAction : colors.ink }]}>{t.label}</Text>
    </Pressable>;
  })}</View>;
}

/** Read-only tag labels (already known labels). */
export function TagPills({ labels, counts }: { labels: readonly string[]; counts?: readonly number[] }) {
  if (labels.length === 0) return null;
  return <View style={styles.tags}>{labels.map((l, i) => <View key={l} style={styles.pill}><Text style={[ui.supporting, { color: colors.ink }]}>{l}{counts ? <Text style={{ fontWeight: '700' }}>{`  ${counts[i]}`}</Text> : null}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  pickerWrap: { alignItems: 'center', gap: spacing.xs },
  pickerRow: { flexDirection: 'row', justifyContent: 'center', alignSelf: 'stretch' },
  star: { flex: 1, minWidth: 48, maxWidth: 64, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  starGlyph: { fontSize: 40, lineHeight: 48 },
  word: { fontWeight: '600', textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.controlBorder, justifyContent: 'center', backgroundColor: colors.background },
  tagOn: { backgroundColor: colors.primaryPale, borderColor: colors.primaryAction },
  tagOff: { opacity: 0.45 },
  pill: { minHeight: 32, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.controlBorder, justifyContent: 'center', backgroundColor: colors.background },
});
