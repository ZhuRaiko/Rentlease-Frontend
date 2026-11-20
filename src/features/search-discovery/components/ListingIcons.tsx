import {View} from 'react-native';
import {colors} from '../../../shared/theme/colors';

/**
 * Small icons for the listing card, drawn from native Views (the app has no icon library and none may be added). All are decorative: the text
 * beside each one carries the meaning, so they are hidden from screen readers.
 */
const hidden = {accessible: false, importantForAccessibility: 'no-hide-descendants'} as const;

export function PinMark({size = 18, color = colors.textSecondary}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31, borderBottomRightRadius: 0, borderWidth: 1.8, borderColor: color, transform: [{rotate: '45deg'}], alignItems: 'center', justifyContent: 'center', marginTop: -size * 0.08}}>
      <View style={{width: size * 0.18, height: size * 0.18, borderRadius: size * 0.09, backgroundColor: color}} />
    </View>
  </View>;
}

export function BedMark({size = 20, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, justifyContent: 'flex-end'}}>
    <View style={{position: 'absolute', left: 0, top: size * 0.12, width: 2, height: size * 0.8, borderRadius: 1, backgroundColor: color}} />
    <View style={{position: 'absolute', right: 0, bottom: size * 0.08, width: 2, height: size * 0.34, borderRadius: 1, backgroundColor: color}} />
    <View style={{height: size * 0.34, marginLeft: 2, borderWidth: 1.8, borderColor: color, borderRadius: 3, marginBottom: size * 0.08}} />
    <View style={{position: 'absolute', left: 4, top: size * 0.34, width: size * 0.26, height: size * 0.18, borderRadius: 2, backgroundColor: color}} />
  </View>;
}

export function BathMark({size = 20, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, justifyContent: 'flex-end', alignItems: 'center'}}>
    <View style={{position: 'absolute', left: size * 0.16, top: size * 0.14, width: size * 0.34, height: size * 0.34, borderTopLeftRadius: size * 0.17, borderTopWidth: 1.8, borderLeftWidth: 1.8, borderColor: color}} />
    <View style={{width: size, height: size * 0.36, marginBottom: size * 0.16, borderWidth: 1.8, borderColor: color, borderTopWidth: 1.8, borderBottomLeftRadius: size * 0.3, borderBottomRightRadius: size * 0.3}} />
  </View>;
}

export function PhotoMark({size = 40, color = colors.textSecondary}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size * 0.8, borderWidth: 2, borderColor: color, borderRadius: size * 0.12, overflow: 'hidden', justifyContent: 'flex-end'}}>
    <View style={{position: 'absolute', top: size * 0.12, left: size * 0.16, width: size * 0.16, height: size * 0.16, borderRadius: size * 0.08, backgroundColor: color}} />
    <View style={{width: size * 0.5, height: size * 0.3, marginLeft: size * 0.3, backgroundColor: color, borderTopLeftRadius: size * 0.25, borderTopRightRadius: size * 0.25}} />
  </View>;
}

export function ArrowRight({size = 12, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size * 1.4, height: size * 1.4, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: size, height: size, borderRightWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{rotate: '45deg'}], marginLeft: -size * 0.25}} />
  </View>;
}

/** A star drawn from two squares turned 0 and 45 degrees (an eight-point star; the design's five-point star is approximated). */
export function StarMark({size = 16, color = colors.white}: {size?: number; color?: string}) {
  const square = (turn: number) => <View key={turn} style={{position: 'absolute', width: size * 0.7, height: size * 0.7, backgroundColor: color, transform: [{rotate: `${turn}deg`}]}} />;
  return <View {...hidden} style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>{[0, 45].map(square)}</View>;
}

export function SlidersMark({size = 20, color = colors.ink}: {size?: number; color?: string}) {
  const row = (knob: number) => <View style={{height: 8, justifyContent: 'center'}}>
    <View style={{height: 2, borderRadius: 1, backgroundColor: color}} />
    <View style={{position: 'absolute', left: size * knob, width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: color, backgroundColor: colors.background}} />
  </View>;
  return <View {...hidden} style={{width: size, height: size, justifyContent: 'center', gap: size * 0.2}}>{row(0.55)}{row(0.15)}</View>;
}

/** A ring with a mark inside: a question mark's stem and dot (help), or an "i" (information). */
export function RingMark({kind, size = 20, color = colors.primaryAction}: {kind: 'help' | 'info'; size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: 2, height: size * 0.3, borderRadius: 1, backgroundColor: color, marginTop: kind === 'info' ? size * 0.14 : 0}} />
    <View style={{position: 'absolute', top: kind === 'info' ? size * 0.16 : undefined, bottom: kind === 'help' ? size * 0.16 : undefined, width: 2.4, height: 2.4, borderRadius: 1.2, backgroundColor: color}} />
  </View>;
}

export function SearchOffMark({size = 36, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31, borderWidth: 2.5, borderColor: color, alignItems: 'center', justifyContent: 'center', marginRight: size * 0.08, marginBottom: size * 0.08}}>
      <View style={{width: size * 0.26, height: 2.5, borderRadius: 1, backgroundColor: color}} />
    </View>
    <View style={{position: 'absolute', right: size * 0.1, bottom: size * 0.16, width: size * 0.26, height: 2.5, borderRadius: 1, backgroundColor: color, transform: [{rotate: '45deg'}]}} />
  </View>;
}
