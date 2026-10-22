import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

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
      <ScreenHeader onBack={onBack} onClose={onClose} />
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
  content: { alignSelf: 'center', maxWidth: 412, paddingHorizontal: 25, width: '100%' },
  compactContent: { paddingHorizontal: 0 },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 35,
  },
  compactTitle: { fontSize: 28, lineHeight: 35, paddingHorizontal: 25 },
  description: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  compactDescription: { paddingHorizontal: 25 },
  body: { gap: spacing.md, marginTop: spacing.lg },
});
