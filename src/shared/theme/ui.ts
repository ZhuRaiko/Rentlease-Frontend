import type { TextStyle, ViewStyle } from 'react-native';
import { colors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

/** Shared Phase 1 visual vocabulary. No state, data or navigation ownership. */
export const ui = {
  panel: {
    backgroundColor: colors.background,
    borderColor: colors.outline,
    borderWidth: 1,
    borderRadius: radius.panel,
  } satisfies ViewStyle,
  control: {
    borderColor: colors.controlBorder,
    borderWidth: 1,
    borderRadius: radius.control,
    minHeight: 48,
    paddingVertical: spacing.sm,
  } satisfies ViewStyle,
  rule: { borderBottomColor: colors.outline, borderBottomWidth: 1 } satisfies ViewStyle,
  pageTitle: {
    color: colors.ink, fontFamily: typography.family,
    fontSize: 22, lineHeight: 28, fontWeight: '700',
  } satisfies TextStyle,
  sectionTitle: {
    color: colors.ink, fontFamily: typography.family,
    fontSize: 17, lineHeight: 23, fontWeight: '600',
  } satisfies TextStyle,
  body: {
    color: colors.ink, fontFamily: typography.family, fontSize: 15, lineHeight: 22,
  } satisfies TextStyle,
  supporting: {
    color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20,
  } satisfies TextStyle,
} as const;
