import Svg, {Circle, Path} from 'react-native-svg';
import {colors} from '../theme/colors';

/**
 * Small line icons for the review word cloud, drawn with react-native-svg on a 24 x 24 grid (the heart and star use the same library). All are decorative: the text or
 * button beside each one carries the meaning, so they are hidden from screen readers.
 */
const hidden = {accessible: false, importantForAccessibility: 'no-hide-descendants', viewBox: '0 0 24 24'} as const;
const line = {fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

/** The check inside the selected word, so selection never relies on colour. */
export function CheckIcon({size = 18, color = colors.white}: {size?: number; color?: string}) {
  return <Svg {...hidden} height={size} width={size}><Path {...line} d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.6} /></Svg>;
}

export function CloseIcon({size = 18, color = colors.ink}: {size?: number; color?: string}) {
  return <Svg {...hidden} height={size} width={size}><Path {...line} d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.2} /></Svg>;
}

/** A speech bubble with two lines: written reviews. */
export function ChatIcon({size = 28, color = colors.primaryAction}: {size?: number; color?: string}) {
  return <Svg {...hidden} height={size} width={size}>
    <Path {...line} d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8.5L6 19.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke={color} strokeWidth={1.8} />
    <Path {...line} d="M8 9h8M8 12h5" stroke={color} strokeWidth={1.8} />
  </Svg>;
}

/** A wifi symbol with a slash: could not connect. */
export function OfflineIcon({size = 28, color = colors.textSecondary}: {size?: number; color?: string}) {
  return <Svg {...hidden} height={size} width={size}>
    <Path {...line} d="M3.5 9.5A13 13 0 0 1 12 6.5a13 13 0 0 1 8.5 3M6.5 13a8.5 8.5 0 0 1 11 0M9.5 16.3a4 4 0 0 1 5 0" stroke={color} strokeWidth={1.8} />
    <Circle cx={12} cy={19.2} fill={color} r={1.3} />
    <Path {...line} d="M4 4l16 16" stroke={color} strokeWidth={1.8} />
  </Svg>;
}
