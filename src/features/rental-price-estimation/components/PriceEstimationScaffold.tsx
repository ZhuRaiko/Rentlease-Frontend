import type { PropsWithChildren } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const backIcon = require('../../../assets/verification/back.png');
const homeIcon = require('../../../assets/authentication/rentlease-home.png');

interface PriceEstimationScaffoldProps extends PropsWithChildren {
  title: string;
  description?: string;
  eyebrow?: string;
  onBack?: (() => void) | undefined;
  onClose: () => void;
  centered?: boolean;
}

export function PriceEstimationScaffold({
  children,
  title,
  description,
  eyebrow,
  onBack,
  onClose,
  centered = false,
}: PriceEstimationScaffoldProps) {
  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, centered && styles.centered]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={10} onPress={onBack}>
            <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
          </Pressable>
        ) : (
          <View style={styles.topSpacer} />
        )}
        <View style={styles.brandRow}>
          <Text style={styles.brand}>RentLease</Text>
          <Image resizeMode="contain" source={homeIcon} style={styles.brandHome} />
        </View>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.closeButton}>
          <View style={[styles.closeLine, styles.closeLineOne]} />
          <View style={[styles.closeLine, styles.closeLineTwo]} />
        </Pressable>
      </View>
      <View style={styles.content}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <View style={styles.body}>{children}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  centered: { justifyContent: 'center' },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  topSpacer: { width: 34 },
  backIcon: { height: 34, width: 34 },
  brandRow: { alignItems: 'center', flexDirection: 'row' },
  brand: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '900' },
  brandHome: { height: 19, marginLeft: 2, width: 19 },
  closeButton: { height: 34, position: 'relative', width: 34 },
  closeLine: {
    backgroundColor: colors.textSecondary,
    height: 1.5,
    left: 8,
    position: 'absolute',
    top: 16,
    width: 18,
  },
  closeLineOne: { transform: [{ rotate: '45deg' }] },
  closeLineTwo: { transform: [{ rotate: '-45deg' }] },
  content: { alignSelf: 'center', maxWidth: 412, paddingHorizontal: spacing.lg, width: '100%' },
  eyebrow: {
    color: colors.primary,
    fontFamily: typography.family,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 34,
    marginTop: spacing.xs,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  body: { gap: spacing.md, marginTop: spacing.lg },
});
