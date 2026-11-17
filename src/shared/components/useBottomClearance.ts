import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {spacing} from '../theme/spacing';
/**
 * Bottom padding for the end of a scrolling screen, so the last action clears the Android navigation bar: spacing.lg plus the system inset,
 * and never less than spacing.xl for the bar even where the host reports no inset. For screens with no bottom navigation under them (a
 * screen under it pads for the bar itself). It only reads the library inset; the footer inset mechanism and the bottom navigation are untouched.
 */
export function useBottomClearance():number{
  return spacing.lg+Math.max(useSafeAreaInsets().bottom,spacing.xl);
}
