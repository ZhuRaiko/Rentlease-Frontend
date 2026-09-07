import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface ListingButtonProps {
  label: string;
  onPress: () => void;
  tone?: 'green' | 'dark' | 'orange' | 'outline' | 'danger';
  disabled?: boolean;
  compact?: boolean;
}

export function ListingButton({
  label,
  onPress,
  tone = 'green',
  disabled = false,
  compact = false,
}: ListingButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[tone],
        compact && styles.compact,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, tone === 'outline' && styles.outlineLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  compact: { minHeight: 38, paddingHorizontal: spacing.sm },
  green: { backgroundColor: colors.primary },
  dark: { backgroundColor: colors.text },
  orange: { backgroundColor: '#DF9415' },
  danger: { backgroundColor: colors.restricted },
  outline: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1.2 },
  disabled: { backgroundColor: colors.border, opacity: 0.75 },
  pressed: { opacity: 0.72 },
  label: {
    color: colors.white,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  outlineLabel: { color: colors.text },
});
