import {colors} from '../../../shared/theme/colors';
import type {TileKind} from '../models/TenancyPresentation';

/** The three summary tiles: Upcoming blue (identity tokens), Active filled with the action green, Past neutral. */
export const TILE_COLORS: Record<TileKind, {backgroundColor: string; color: string; labelColor: string}> = {
  upcoming: {backgroundColor: colors.identitySurface, color: colors.identityInk, labelColor: colors.identityInk},
  active: {backgroundColor: colors.primaryAction, color: colors.white, labelColor: colors.white},
  past: {backgroundColor: colors.surface, color: colors.textSecondary, labelColor: colors.textSecondary},
};
