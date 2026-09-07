import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface ProfileActionRowProps {
  icon?: ImageSourcePropType;
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
}

export function ProfileActionRow({
  icon,
  label,
  detail,
  onPress,
  destructive = false,
}: ProfileActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon ? <Image resizeMode="contain" source={icon} style={styles.icon} /> : null}
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.surface },
  icon: { height: 30, marginRight: spacing.md, opacity: 0.65, width: 30 },
  label: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: typography.family,
    fontSize: typography.body,
    fontWeight: '700',
  },
  detail: {
    color: colors.textMuted,
    fontFamily: typography.family,
    fontSize: typography.caption,
    marginLeft: spacing.sm,
  },
  destructive: { color: colors.restricted },
});
