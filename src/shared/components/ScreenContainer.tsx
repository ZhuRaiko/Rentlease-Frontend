import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { FooterInsetContext } from './FooterInsetContext';
import {KeyboardViewport} from './KeyboardViewport';

interface ScreenContainerProps extends PropsWithChildren {
  includeBottomInset?: boolean;
  padded?: boolean;
  /** True when a bottom navigation bar sits under this content: pinned footers inside then add no bottom inset. Never changes the real insets. */
  bottomChrome?: boolean;
}

export function ScreenContainer({
  children,
  includeBottomInset = true,
  padded = true,
  bottomChrome = false,
}: ScreenContainerProps) {
  const body = <KeyboardViewport>{children}</KeyboardViewport>;
  return (
    <SafeAreaView
      edges={includeBottomInset ? ['top', 'right', 'bottom', 'left'] : ['top', 'right', 'left']}
      style={[styles.container, padded && styles.padded]}
    >
      {bottomChrome ? <FooterInsetContext.Provider value>{body}</FooterInsetContext.Provider> : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  padded: { padding: 24 },
});
