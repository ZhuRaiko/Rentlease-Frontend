import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface VerificationScaffoldProps extends PropsWithChildren {
  title: string;
  description?: string;
  onBack: () => void;
  onClose?: () => void;
  compact?: boolean;
  fill?: boolean;
}

export function VerificationScaffold({
  title,
  description,
  onBack,
  onClose,
  compact = false,
  fill = false,
  children,
}: VerificationScaffoldProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <ScreenHeader onBack={onBack} onClose={onClose} />
      <View style={[styles.content, compact && styles.compactContent, fill && styles.fill]}>
        <View style={[styles.headingFrame, compact && styles.compactHeadingFrame]}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
        {description ? (
          <Text style={[styles.description, compact && styles.compactDescription]}>{description}</Text>
        ) : null}
        <View style={[styles.body, fill && styles.fill]}>{children}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  content: { alignSelf: 'center', maxWidth: 412, paddingHorizontal: spacing.lg, width: '100%' },
  compactContent: { paddingHorizontal: 0 },
  headingFrame: { paddingBottom: spacing.xxs },
  compactHeadingFrame: { marginHorizontal: spacing.lg },
  title: { ...ui.pageTitle },
  description: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  compactDescription: { paddingHorizontal: spacing.lg },
  body: { gap: spacing.md, marginTop: spacing.md },
});
