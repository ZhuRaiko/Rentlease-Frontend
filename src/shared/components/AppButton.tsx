import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  icon?: ImageSourcePropType;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <Image resizeMode="contain" source={icon} style={styles.icon} /> : null}
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
  danger: { backgroundColor: colors.restricted },
  disabled: { backgroundColor: '#D3D3D3' },
  pressed: { opacity: 0.78 },
  icon: { height: 22, width: 22 },
  label: {
    color: colors.white,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryLabel: { color: '#595959' },
});
