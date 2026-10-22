import { StyleSheet, Text, View } from 'react-native';
import { verificationIndicatorKind, type StatusPresentation } from '../models/verificationPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function VerificationStatusIndicator({ label, tone }: StatusPresentation) {
  const indicator = verificationIndicatorKind({ label, tone });
  const ink = tone === 'success' ? colors.primaryAction : tone === 'error' ? colors.restricted : tone === 'warning' ? colors.warning : colors.textSecondary;
  return <View accessible accessibilityLabel={label} style={styles.status}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.circle, { borderColor: ink }]}>
      <Text style={[styles.symbol, { color: ink }]}>{indicator === 'check' ? '\u2713' : indicator === 'pending' ? '\u2026' : indicator === 'error' ? '\u00d7' : indicator === 'unavailable' ? '\u2013' : '\u00b7'}</Text>
    </View>
    <Text style={[styles.text, { color: ink }]}>{label}</Text>
  </View>;
}
const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1, alignSelf: 'flex-start' },
  circle: { borderWidth: 1, borderRadius: radius.pill, minWidth: 22, minHeight: 22, paddingHorizontal: spacing.xxs, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontFamily: typography.family, fontSize: 14 },
  text: { fontFamily: typography.family, fontSize: 14, flexShrink: 1 },
});
