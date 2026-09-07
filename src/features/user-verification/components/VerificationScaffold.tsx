import type { PropsWithChildren } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const backIcon = require('../../../assets/verification/back.png');

interface VerificationScaffoldProps extends PropsWithChildren {
  title: string;
  description?: string;
  onBack: () => void;
  onClose?: () => void;
  compact?: boolean;
}

export function VerificationScaffold({
  title,
  description,
  onBack,
  onClose,
  compact = false,
  children,
}: VerificationScaffoldProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack}>
          <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
        </Pressable>
        {onClose ? (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.content, compact && styles.compactContent]}>
        <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.description, compact && styles.compactDescription]}>{description}</Text>
        ) : null}
        <View style={styles.body}>{children}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 112,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  backIcon: { height: 47, width: 47 },
  close: {
    color: colors.primary,
    fontFamily: typography.family,
    fontSize: typography.body,
    fontWeight: '700',
  },
  content: { alignSelf: 'center', maxWidth: 412, paddingHorizontal: 25, width: '100%' },
  compactContent: { paddingHorizontal: 0 },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  compactTitle: { fontSize: 32, lineHeight: 38, paddingHorizontal: 25 },
  description: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  compactDescription: { paddingHorizontal: 25 },
  body: { gap: spacing.md, marginTop: spacing.xl },
});
