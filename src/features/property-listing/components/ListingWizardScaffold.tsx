import type { PropsWithChildren } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const chevronIcon = require('../../../assets/verification/chevron-right.png');

interface ListingWizardScaffoldProps extends PropsWithChildren {
  onClose: () => void;
  onBack?: () => void;
  onNext?: () => void;
  step?: 1 | 2 | 3 | 4 | 5;
  stepLabel?: string;
  title?: string;
  description?: string;
}

export function ListingWizardScaffold({
  children,
  onClose,
  onBack,
  onNext,
  step,
  stepLabel,
  title,
  description,
}: ListingWizardScaffoldProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel={onBack ? 'Back' : 'Close'}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack ?? onClose}
          style={styles.closeButton}
        >
          <View style={[styles.closeLine, styles.closeLineOne]} />
          <View style={[styles.closeLine, styles.closeLineTwo]} />
        </Pressable>
      </View>
      {step ? (
        <>
          <View style={styles.progressTrack}>
            {[1, 2, 3, 4, 5].map((segment) => (
              <View
                key={segment}
                style={[styles.progressSegment, segment <= step && styles.progressSegmentActive]}
              />
            ))}
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>Step {step} of 5 — {stepLabel}</Text>
            {onNext ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={onNext}
                style={styles.nextButton}
              >
                <Text style={styles.nextLabel}>Next</Text>
                <Image resizeMode="contain" source={chevronIcon} style={styles.chevron} />
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
      <View style={styles.content}>
        {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <View style={styles.body}>{children}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  topBar: { height: 62, justifyContent: 'center', paddingHorizontal: spacing.lg },
  closeButton: { height: 28, justifyContent: 'center', width: 28 },
  closeLine: {
    backgroundColor: colors.textMuted,
    height: 1.5,
    left: 4,
    position: 'absolute',
    width: 18,
  },
  closeLineOne: { transform: [{ rotate: '45deg' }] },
  closeLineTwo: { transform: [{ rotate: '-45deg' }] },
  progressTrack: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg },
  progressSegment: { backgroundColor: colors.border, flex: 1, height: 2 },
  progressSegmentActive: { backgroundColor: colors.primarySoft },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stepLabel: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: '700',
  },
  nextButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  nextLabel: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  chevron: { height: 13, width: 13 },
  content: { alignSelf: 'center', maxWidth: 412, paddingHorizontal: spacing.lg, width: '100%' },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
    marginTop: spacing.lg,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  body: { gap: spacing.md, marginTop: spacing.lg },
});
