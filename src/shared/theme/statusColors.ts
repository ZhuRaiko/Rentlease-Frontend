import { colors } from './colors';
import type { ChipTone } from '../models/StatusChip';

/** Status chip colors, existing theme tokens only. Palette: green active, blue upcoming/vacant, amber needs someone, grey over, red cancelled/urgent. */
export const CHIP_COLORS: Record<ChipTone, { backgroundColor: string; color: string; borderColor: string }> = {
  positive: { backgroundColor: colors.primaryPale, color: colors.primaryAction, borderColor: colors.primaryAction },
  warning: { backgroundColor: colors.warningSurface, color: colors.warning, borderColor: colors.warning },
  restricted: { backgroundColor: colors.restrictedSurface, color: colors.restricted, borderColor: colors.restricted },
  info: { backgroundColor: colors.identitySurface, color: colors.identityInk, borderColor: colors.identityInk },
  neutral: { backgroundColor: colors.surface, color: colors.textSecondary, borderColor: colors.border },
  urgent: { backgroundColor: colors.restricted, color: colors.white, borderColor: colors.restricted },
};
