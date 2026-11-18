import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme/colors';

export type GlyphKind = 'house' | 'chat' | 'wrench' | 'shield' | 'flag' | 'star' | 'warning';

/**
 * Small line icons drawn from native Views (the app has no icon library and none may be added). Decorative: the text next to an icon carries
 * the meaning, so it is hidden from screen readers. The shapes are simple on purpose; they match the designed icons in weight and color, not in detail.
 */
export function GlyphIcon({kind, size = 24, color = colors.primaryAction}: {kind: GlyphKind; size?: number; color?: string}) {
  const w = Math.max(1.5, size / 13);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    {kind === 'house' ? <>
      <View style={{position: 'absolute', top: size * 0.12, width: size * 0.5, height: size * 0.5, borderLeftWidth: w, borderTopWidth: w, borderColor: color, transform: [{rotate: '45deg'}], borderTopLeftRadius: 2}} />
      <View style={{position: 'absolute', bottom: size * 0.1, width: size * 0.68, height: size * 0.42, borderWidth: w, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2}} />
      <View style={{position: 'absolute', bottom: size * 0.1, width: size * 0.18, height: size * 0.22, borderWidth: w, borderBottomWidth: 0, borderColor: color}} />
    </> : kind === 'chat' ? <>
      <View style={{width: size * 0.86, height: size * 0.62, borderWidth: w, borderColor: color, borderRadius: size * 0.14, marginBottom: size * 0.1}} />
      <View style={{position: 'absolute', left: size * 0.16, bottom: size * 0.1, width: size * 0.22, height: size * 0.22, borderLeftWidth: w, borderBottomWidth: w, borderColor: color, transform: [{rotate: '-45deg'}, {skewX: '10deg'}]}} />
    </> : kind === 'wrench' ? <>
      <View style={{width: size * 0.84, height: w * 2.2, borderRadius: w, backgroundColor: color, transform: [{rotate: '-45deg'}]}} />
      <View style={{position: 'absolute', top: size * 0.08, right: size * 0.08, width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, borderWidth: w * 1.4, borderColor: color}} />
    </> : kind === 'shield' ? <View style={{width: size * 0.66, height: size * 0.78, borderWidth: w, borderColor: color, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderBottomLeftRadius: size * 0.33, borderBottomRightRadius: size * 0.33}} />
    : kind === 'flag' ? <>
      <View style={{position: 'absolute', left: size * 0.22, top: size * 0.08, width: w, height: size * 0.84, backgroundColor: color}} />
      <View style={{position: 'absolute', left: size * 0.22 + w, top: size * 0.12, width: size * 0.52, height: size * 0.36, borderWidth: w, borderColor: color}} />
    </> : kind === 'star' ? <Text allowFontScaling={false} style={{color, fontSize: size * 0.95, lineHeight: size}}>{'☆'}</Text>
    : <>
      <View style={{width: 0, height: 0, borderLeftWidth: size * 0.46, borderRightWidth: size * 0.46, borderBottomWidth: size * 0.8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color}} />
      <Text allowFontScaling={false} style={[styles.bang, {fontSize: size * 0.42, lineHeight: size * 0.5, top: size * 0.4}]}>!</Text>
    </>}
  </View>;
}

const styles = StyleSheet.create({bang: {position: 'absolute', color: colors.white, fontWeight: '800'}});
