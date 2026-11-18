import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { BACKDROP_BLUR_RADIUS, BACKDROP_DIM_OPACITY, EDGE_FADE_SIDE_DP, EDGE_FADE_VERTICAL_DP, backdropWidth, edgeFadeOpacities } from '../viewModels/roomTourMotion';

/**
 * Decoration behind the room tour strip: a blurred, darkened copy of the CURRENT side's own image fills the viewer, so the strip does not read as a thin band.
 * It adds no room content (no fill, no mirroring). It uses the same URL as the strip (the HTTP cache serves it once) and asks the decoder for screen size.
 * It drifts a little as the strip pans: `progress` (0..1, the value the strip already drives) is interpolated to a shift of at most `maxShift`, so no extra listener runs per frame.
 * It fades with the strip during a wrap (`fade`). If its image cannot load it is simply the dark background; it never shows an error, because the strip owns "Couldn't load".
 * Mount it with a key of the url so a side change starts clean.
 */
export function RoomTourBackdrop({ url, width, height, maxShift, progress, fade }: { url: string; width: number; height: number; maxShift: number; progress: Animated.Value; fade: Animated.Value }) {
  const [failed, setFailed] = useState(false);
  const shift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, maxShift], extrapolate: 'clamp' });
  return <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.fill, { opacity: fade }]}>
    {failed ? null : <Animated.Image source={{ uri: url }} blurRadius={BACKDROP_BLUR_RADIUS} resizeMode="cover" resizeMethod="resize" onError={() => setFailed(true)}
      style={{ position: 'absolute', top: 0, left: -maxShift, width: backdropWidth(width, maxShift), height, transform: [{ translateX: shift }] }} />}
    <View style={[styles.fill, styles.dim]} />
  </Animated.View>;
}

/** One soft edge: bands of stepped opacity, darkest at the edge. `along` is the band direction (a column of bands for the left and right edges). */
function Fade({ size, edge }: { size: number; edge: 'left' | 'right' | 'top' | 'bottom' }) {
  const bands = edgeFadeOpacities(), band = size / bands.length, horizontal = edge === 'left' || edge === 'right';
  const ordered = edge === 'right' || edge === 'bottom' ? [...bands].reverse() : bands;   // the darkest band is always at the outer edge
  return <View pointerEvents="none" style={[styles.edge, { [edge]: 0 }, horizontal ? { top: 0, bottom: 0, width: size, flexDirection: 'row' } : { left: 0, right: 0, height: size }]}>
    {ordered.map((opacity, index) => <View key={index} style={[horizontal ? { width: band } : { height: band }, { backgroundColor: colors.ink, opacity }]} />)}
  </View>;
}

/** Soft dark fades where the strip meets the backdrop: left and right (48dp), top and bottom (32dp). Fixed on screen; they never take touches. */
export function RoomTourEdgeFades() {
  return <View pointerEvents="none" style={styles.fill}>
    <Fade edge="left" size={EDGE_FADE_SIDE_DP} /><Fade edge="right" size={EDGE_FADE_SIDE_DP} />
    <Fade edge="top" size={EDGE_FADE_VERTICAL_DP} /><Fade edge="bottom" size={EDGE_FADE_VERTICAL_DP} />
  </View>;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill as object, overflow: 'hidden' },
  dim: { backgroundColor: colors.ink, opacity: BACKDROP_DIM_OPACITY },
  edge: { position: 'absolute' },
});
