import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { ui } from '../theme/ui';

/** The blue "ID verified" check. One component everywhere; it never says "Tier", and a missing check draws nothing (no cross, no warning). */
export const VERIFIED_LABEL = 'ID verified';
export function VerifiedCheck({ size = 18 }: { size?: number }) {
  return <View accessible accessibilityRole="image" accessibilityLabel={VERIFIED_LABEL} style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text accessible={false} allowFontScaling={false} style={{ color: colors.white, fontSize: Math.round(size * 0.62), lineHeight: size, fontWeight: '800' }}>{'✓'}</Text>
  </View>;
}

/** A name with the check right after it. The name wraps; the check stays beside its last word. */
export function NameWithCheck({ name, verified, size = 18, textStyle }: { name: string; verified: boolean; size?: number; textStyle?: object | undefined }) {
  return <View style={styles.row}><Text style={[ui.body, styles.name, textStyle]}>{name}</Text>{verified ? <VerifiedCheck size={size} /> : null}</View>;
}

const styles = StyleSheet.create({
  dot: { backgroundColor: colors.identityInk, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6 },
  name: { fontWeight: '700', flexShrink: 1 },
});
