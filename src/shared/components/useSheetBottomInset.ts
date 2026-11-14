import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/spacing';
import { sheetBottomPadding } from './sheetInset';
/**
 * A Modal is its own native window and draws under the Android navigation bar (3-button or gesture). Bottom sheets inside a Modal use this
 * padding below their content. The inset comes from the app's existing safe-area provider; protected layout components are not involved.
 */
export const useSheetBottomInset = (base: number = spacing.lg) => sheetBottomPadding(useSafeAreaInsets().bottom, base);
