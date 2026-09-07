import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

interface ScreenContainerProps extends PropsWithChildren {
  includeBottomInset?: boolean;
  padded?: boolean;
}

export function ScreenContainer({
  children,
  includeBottomInset = true,
  padded = true,
}: ScreenContainerProps) {
  return (
    <SafeAreaView
      edges={includeBottomInset ? ['top', 'right', 'bottom', 'left'] : ['top', 'right', 'left']}
      style={[styles.container, padded && styles.padded]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  padded: { padding: 24 },
});
