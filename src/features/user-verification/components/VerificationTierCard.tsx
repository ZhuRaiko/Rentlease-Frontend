import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { VerificationStatus, VerificationTier } from '../models/Verification';

interface VerificationTierCardProps {
  tier: VerificationTier;
  title: string;
  subtitle: string;
  badge: string;
  items: string[];
  status: VerificationStatus;
  icon: ImageSourcePropType;
  onPress: () => void;
}

const paletteByTier = {
  1: {
    background: colors.tierOneSurface,
    border: colors.tierOneBorder,
    text: colors.text,
    button: '#B8B8B8',
  },
  2: {
    background: colors.trustedSurface,
    border: colors.trustedBorder,
    text: colors.trustedText,
    button: '#98D29F',
  },
  3: {
    background: colors.premiumSurface,
    border: colors.premiumBorder,
    text: colors.premiumText,
    button: '#D29898',
  },
} as const;

const actionByStatus: Record<VerificationStatus, string> = {
  locked: 'Locked',
  notStarted: 'Verify',
  inProgress: 'Continue',
  pending: 'View pending',
  approved: 'Verified',
  rejected: 'Correct & resubmit',
};

export function VerificationTierCard({
  tier,
  title,
  subtitle,
  badge,
  items,
  status,
  icon,
  onPress,
}: VerificationTierCardProps) {
  const palette = paletteByTier[tier];
  return (
    <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.headingRow}>
        <Image resizeMode="contain" source={icon} style={styles.icon} />
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: palette.text }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: palette.button, borderColor: palette.border }]}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
      <View style={styles.items}>
        {items.map((item) => (
          <View key={item} style={styles.itemRow}>
            <View style={[styles.itemDot, { backgroundColor: palette.text }]} />
            <Text style={[styles.itemText, { color: palette.text }]}>{item}</Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: palette.button, borderColor: palette.border },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.actionText}>{actionByStatus[status]}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 29,
    borderWidth: 1,
    height: 466,
    padding: 24,
    width: 337,
  },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  icon: { height: 60, width: 60 },
  headingCopy: { flex: 1, gap: spacing.xxs },
  title: {
    fontFamily: typography.family,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: { fontFamily: typography.family, fontSize: 14, fontWeight: '700', opacity: 0.58 },
  badge: {
    alignSelf: 'flex-end',
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    color: colors.white,
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: '700',
  },
  items: { flex: 1, gap: spacing.lg, justifyContent: 'center' },
  itemRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  itemDot: { borderRadius: radius.pill, height: 8, marginTop: 6, opacity: 0.7, width: 8 },
  itemText: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    opacity: 0.86,
  },
  action: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 2,
    height: 41,
    justifyContent: 'center',
  },
  actionText: {
    color: colors.white,
    fontFamily: typography.family,
    fontSize: 20,
    fontWeight: '700',
  },
  pressed: { opacity: 0.75 },
});
