import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ratingLabels, ratingScaleLabel, ratingScaleState } from '../models/RatingScale';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ui } from '../theme/ui';

/** One rating scale for every review screen: 1 to 5, chosen number solid, lower tinted, higher outlined, with a text label. */
export function RatingScale({ value, onChange, disabled = false }: { value: number | null; onChange: (rating: number) => void; disabled?: boolean }) {
  return <View style={styles.wrap}>
    <View accessibilityRole="radiogroup" style={styles.row}>
      {[1, 2, 3, 4, 5].map(n => {
        const state = ratingScaleState(n, value);
        return <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} of 5, ${ratingLabels[n]}`} accessibilityState={{ selected: state === 'selected', disabled }} disabled={disabled} onPress={() => onChange(n)} style={[styles.button, styles[state]]}>
          <Text style={[styles.number, state === 'selected' ? styles.selectedText : styles.otherText]}>{n}</Text>
        </Pressable>;
      })}
    </View>
    <Text accessibilityLiveRegion="polite" style={[ui.supporting, styles.label]}>{ratingScaleLabel(value)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.panel, borderWidth: 1.5 },
  selected: { backgroundColor: colors.primaryAction, borderColor: colors.primaryAction },
  lower: { backgroundColor: colors.accountCredentialSurface, borderColor: colors.accountCredentialSurface },
  higher: { backgroundColor: colors.background, borderColor: colors.controlBorder },
  number: { fontFamily: typography.family, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  selectedText: { color: colors.white },
  otherText: { color: colors.ink },
  label: { fontWeight: '600', color: colors.ink },
});
