import { StyleSheet, Text, View } from 'react-native';
import type { FeedbackTone } from '../models/verificationPresentation';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';

const palette = {
  info: { backgroundColor: colors.surface, color: colors.text }, success: { backgroundColor: colors.primaryPale, color: colors.trustedText },
  warning: { backgroundColor: colors.warningSurface, color: colors.warning }, error: { backgroundColor: colors.restrictedSurface, color: colors.restricted },
};
export function FeedbackNotice({ message, tone = 'info' }: { message: string | null | undefined; tone?: FeedbackTone }) {
  if (!message) return null;
  return <View style={[styles.notice, { backgroundColor: palette[tone].backgroundColor }]}><Text accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.text, { color: palette[tone].color }]}>{message}</Text></View>;
}
const styles = StyleSheet.create({ notice: { borderRadius: radius.sm, padding: spacing.md }, text: { fontFamily: typography.family, fontSize: 14, lineHeight: 21 } });
