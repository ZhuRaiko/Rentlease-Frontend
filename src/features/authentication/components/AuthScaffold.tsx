import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface AuthScaffoldProps extends PropsWithChildren {
  title: string;
  description?: string;
  onBack?: () => void;
  footer?: ReactNode;
  largeTitle?: boolean;
  progress?: { step: number; total: number; completed: number } | null;
  backDisabled?: boolean;
  formLayout?: boolean;
}

export function AuthScaffold({
  title,
  description,
  onBack,
  footer,
  children,
  largeTitle = false,
  progress,
  backDisabled = false,
  formLayout = false,
}: AuthScaffoldProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : progress || formLayout ? 'height' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: backDisabled }} disabled={backDisabled} hitSlop={12} onPress={onBack} style={styles.backTarget}>
              <Text style={styles.back}>Back</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.content, (!!progress || formLayout) && styles.registrationContent]}>
          {progress ? <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: progress.total, now: progress.completed, text: `Step ${progress.step} of ${progress.total}` }}>
            <Text style={styles.progressLabel}>Step {progress.step} of {progress.total}</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.completed / progress.total * 100}%` }]} /></View>
          </View> : null}
          <View style={styles.headingBlock}>
            <Text accessibilityRole="header" style={[styles.title, largeTitle && styles.largeTitle]}>
              {title}
            </Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  topBar: { height: 52, justifyContent: 'center', paddingHorizontal: spacing.lg },
  backTarget: { minHeight: 48, minWidth: 48, alignSelf: 'flex-start', justifyContent: 'center' },
  registrationContent: { paddingTop: spacing.lg },
  progress: { gap: spacing.xs, marginBottom: spacing.lg },
  progressLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: typography.caption },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  back: {
    color: colors.primary,
    fontFamily: typography.family,
    fontSize: typography.body,
    fontWeight: '700',
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 412,
    paddingHorizontal: 26,
    paddingTop: 82,
    width: '100%',
  },
  headingBlock: { gap: spacing.sm },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: typography.heading,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 39,
  },
  largeTitle: { fontSize: typography.display, letterSpacing: -1.4, lineHeight: 54 },
  description: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 20,
  },
  body: { gap: spacing.md, marginTop: spacing.xl },
  footer: { marginTop: spacing.xl },
});
