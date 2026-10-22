import type { ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface ProfileActionRowProps {
  icon?: ImageSourcePropType;
  leading?: ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
}

export function ProfileActionRow({
  icon, leading,
  label,
  detail,
  onPress,
  destructive = false,
}: ProfileActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {leading ? <View style={styles.iconSlot}>{leading}</View> : icon ? <Image resizeMode="contain" source={icon} style={styles.icon} /> : null}
      <View style={styles.copy}><Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>
      <Text accessible={false} style={styles.chevron}>›</Text>
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
    paddingVertical: spacing.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.surface },
  iconSlot: { alignItems: 'center', justifyContent: 'center', width: 30, height: 30, marginRight: spacing.md },
  icon: { height: 30, marginRight: spacing.md, opacity: 0.65, width: 30 },
  copy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  chevron: { color: colors.textSecondary, fontSize: 24 },
  label: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontFamily: typography.family,
    fontSize: typography.body,
    fontWeight: '700',
  },
  detail: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  destructive: { color: colors.restricted },
});
