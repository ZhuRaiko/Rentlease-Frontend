import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface ScreenHeaderProps {
  title?: string;
  onBack?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  disabled?: boolean;
  action?: ReactNode;
}

/** Small visual navigation, full Android touch targets, wrapping titles. */
export function ScreenHeader({ title, onBack, onClose, disabled = false, action }: ScreenHeaderProps) {
  return <View style={styles.header}>
    {onBack ? <Pressable accessibilityLabel="Back" accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onBack} style={styles.control}>
      <Text accessible={false} style={styles.arrow}>‹</Text>
      {!title ? <Text style={styles.label}>Back</Text> : null}
    </Pressable> : null}
    {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : <View style={styles.spacer} />}
    {action ?? (onClose ? <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onClose} style={styles.control}><Text style={styles.label}>Close</Text></Pressable> : null)}
  </View>;
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 56, paddingHorizontal: spacing.md },
  control: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs, justifyContent: 'center', minHeight: 48, minWidth: 48 },
  arrow: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 28, fontWeight: '600' },
  label: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 18, fontWeight: '700', paddingVertical: spacing.sm },
  spacer: { flex: 1 },
});
