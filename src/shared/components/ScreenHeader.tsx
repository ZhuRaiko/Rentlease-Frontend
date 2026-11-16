import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ui } from '../theme/ui';

interface ScreenHeaderProps {
  title?: string;
  onBack?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  disabled?: boolean;
  action?: ReactNode;
  /** Replaces the title text with richer content (for example a name with a check and a role line). The title is still the accessible name when none is given. */
  titleContent?: ReactNode;
}

/** Small visual navigation, full Android touch targets, wrapping titles. */
export function ScreenHeader({ title, onBack, onClose, disabled = false, action, titleContent }: ScreenHeaderProps) {
  return <View style={styles.header}>
    {onBack ? <Pressable accessibilityLabel="Back" accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onBack} style={styles.control}>
      <Text accessible={false} style={styles.arrow}>‹</Text>
      {!title ? <Text style={styles.label}>Back</Text> : null}
    </Pressable> : null}
    {titleContent ? <View style={styles.titleContent}>{titleContent}</View> : title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : <View style={styles.spacer} />}
    {action ?? (onClose ? <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onClose} style={styles.control}><Text style={styles.label}>Close</Text></Pressable> : null)}
  </View>;
}

const styles = StyleSheet.create({
  header: { ...ui.rule, backgroundColor: colors.background, alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 56, paddingHorizontal: spacing.md },
  control: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs, justifyContent: 'center', minHeight: 48, minWidth: 48 },
  arrow: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 28, fontWeight: '600' },
  label: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  title: { ...ui.sectionTitle, fontWeight: '700', flex: 1, minWidth: 0, paddingVertical: spacing.sm },
  spacer: { flex: 1 },
  titleContent: { flex: 1, minWidth: 0, paddingVertical: spacing.xs },
});
