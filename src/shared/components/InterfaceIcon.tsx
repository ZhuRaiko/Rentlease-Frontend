import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/** Decorative native shapes; the enclosing action supplies its accessible label. */
export function InterfaceIcon({ name, size = 24, color = colors.primaryAction }: { name: 'verification' | 'reviews' | 'notifications'; size?: number; color?: string }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {name === 'verification' ? <View style={[styles.document, { borderColor: color, width: size * 0.72, height: size * 0.9 }]}><View style={[styles.check, { borderColor: color }]} /></View>
      : name === 'reviews' ? <View style={[styles.bubble, { borderColor: color, width: size * 0.96, height: size * 0.74 }]}><Text style={{ color, fontSize: size * 0.48, lineHeight: size * 0.58 }}>{'\u2605'}</Text><View style={[styles.tail, { borderColor: color }]} /></View>
      : <><View style={[styles.bell, { borderColor: color, width: size * 0.65, height: size * 0.65 }]} /><View style={[styles.base, { backgroundColor: color, width: size * 0.85 }]} /><View style={[styles.clapper, { backgroundColor: color }]} /></>}
  </View>;
}
const styles = StyleSheet.create({
  document: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.7, borderRadius: 3 },
  check: { borderBottomWidth: 1.8, borderRightWidth: 1.8, width: 5, height: 9, transform: [{ rotate: '45deg' }] },
  bubble: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.7, borderRadius: 5 },
  tail: { position: 'absolute', bottom: -4, left: 4, width: 5, height: 5, borderBottomWidth: 1.7, borderLeftWidth: 1.7 },
  bell: { borderWidth: 1.7, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  base: { height: 2, borderRadius: 2 },
  clapper: { width: 4, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginTop: 2 },
});
