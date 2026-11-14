import { spacing } from '../theme/spacing';
/** Bottom padding for a sheet inside a Modal: never less than the base, and always clear of the system navigation bar. */
export const sheetBottomPadding = (bottomInset: number, base: number = spacing.lg) => Math.max(base, bottomInset + spacing.sm);
