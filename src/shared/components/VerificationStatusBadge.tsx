import { StyleSheet, Text, View } from 'react-native';
import type { StatusPresentation } from '../models/verificationPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function VerificationStatusBadge({ label, tone }: StatusPresentation) {
  return <View style={[styles.badge, tone === 'success' ? styles.success : tone === 'error' ? styles.error : tone === 'warning' ? styles.warning : styles.info]}><Text style={[styles.text, { color: tone === 'success' ? colors.trustedText : tone === 'error' ? colors.restricted : tone === 'warning' ? colors.warning : colors.text }]}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, text: { fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  success: { backgroundColor: colors.primaryPale }, error: { backgroundColor: colors.restrictedSurface }, warning: { backgroundColor: colors.warningSurface }, info: { backgroundColor: colors.surface },
});
