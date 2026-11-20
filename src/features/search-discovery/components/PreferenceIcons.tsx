import {View} from 'react-native';
import {colors} from '../../../shared/theme/colors';

/**
 * Small icons for the Matching preferences screen, drawn from native Views (the app has no icon library and none may be added).
 * All are decorative: the label beside each carries the meaning, so they are hidden from screen readers.
 */
const hidden = {accessible: false, importantForAccessibility: 'no-hide-descendants'} as const;

export function Chevron({up = false, size = 12, color = colors.ink}: {up?: boolean; size?: number; color?: string}) {
  return <View {...hidden} style={{width: size * 1.6, height: size * 1.6, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: size, height: size, borderRightWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{rotate: up ? '225deg' : '45deg'}], marginTop: up ? size * 0.25 : -size * 0.25}} />
  </View>;
}

export function CheckMark({size = 14, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: size * 0.42, height: size * 0.72, borderRightWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{rotate: '45deg'}], marginTop: -size * 0.1}} />
  </View>;
}

export function CloseMark({size = 18, color = colors.ink}: {size?: number; color?: string}) {
  const bar = {position: 'absolute', width: size, height: 2, borderRadius: 1, backgroundColor: color} as const;
  return <View {...hidden} style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <View style={[bar, {transform: [{rotate: '45deg'}]}]} /><View style={[bar, {transform: [{rotate: '-45deg'}]}]} />
  </View>;
}

export function PlusMinus({plus, size = 16, color = colors.ink}: {plus: boolean; size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{position: 'absolute', width: size, height: 2, borderRadius: 1, backgroundColor: color}} />
    {plus ? <View style={{position: 'absolute', width: 2, height: size, borderRadius: 1, backgroundColor: color}} /> : null}
  </View>;
}

/** Six dots in two columns: the drag handle. */
export function GripDots({color = colors.textMuted}: {color?: string}) {
  const dot = {width: 4, height: 4, borderRadius: 2, backgroundColor: color} as const;
  return <View {...hidden} style={{flexDirection: 'row', gap: 4}}>
    {[0, 1].map(column => <View key={column} style={{gap: 4}}><View style={dot} /><View style={dot} /><View style={dot} /></View>)}
  </View>;
}

export function ListMark({size = 22, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, gap: size * 0.16}}>
    {[0, 1, 2].map(row => <View key={row} style={{flexDirection: 'row', alignItems: 'center', gap: size * 0.14}}>
      <View style={{width: 3, height: 3, borderRadius: 2, backgroundColor: color}} /><View style={{flex: 1, height: 2, borderRadius: 1, backgroundColor: color}} />
    </View>)}
  </View>;
}

export function WalletMark({size = 24, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size * 0.72, borderWidth: 2, borderColor: color, borderRadius: 5, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3}}>
    <View style={{width: 5, height: 3, borderRadius: 1, backgroundColor: color}} />
  </View>;
}

export function PencilMark({size = 26, color = colors.propertyProofInk}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: size * 0.82, height: size * 0.2, borderWidth: 2, borderColor: color, borderRadius: 3, transform: [{rotate: '-45deg'}]}} />
  </View>;
}

export function AlertMark({size = 20, color = colors.restricted}: {size?: number; color?: string}) {
  return <View {...hidden} style={{width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: 2, height: size * 0.36, backgroundColor: color, borderRadius: 1, marginBottom: 1}} />
    <View style={{position: 'absolute', bottom: size * 0.17, width: 2, height: 2, borderRadius: 1, backgroundColor: color}} />
  </View>;
}
