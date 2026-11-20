import Svg, {Path} from 'react-native-svg';
import {colors} from '../theme/colors';

/** The one heart shape from the design pack (docs/design/discover-foryou, board 5): even round lobes and a soft point, drawn on a 24 x 24 grid. */
export const HEART_PATH = 'M12 20.4C5.6 16.2 3 12.9 3 9.5 3 6.9 5 5 7.4 5c1.9 0 3.5 1 4.6 2.7C13.1 6 14.7 5 16.6 5 19 5 21 6.9 21 9.5c0 3.4-2.6 6.7-9 10.9z';

/**
 * Outline when not saved (stroke in `color`), filled when saved (fill and stroke in `color`). Decorative: the button around it carries the name and
 * the saved state, so it is hidden from screen readers. `background` is kept for older callers and is not needed any more.
 */
export function HeartIcon({filled = false, size = 24, color = colors.ink}: {filled?: boolean; size?: number; color?: string; background?: string}) {
  return <Svg accessible={false} height={size} importantForAccessibility="no-hide-descendants" viewBox="0 0 24 24" width={size}>
    <Path d={HEART_PATH} fill={filled ? color : 'none'} stroke={color} strokeLinejoin="round" strokeWidth={filled ? 1.6 : 1.8} />
  </Svg>;
}
