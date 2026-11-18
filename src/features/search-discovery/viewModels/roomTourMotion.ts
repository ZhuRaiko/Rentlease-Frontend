import type { PanoramaSide } from '../../../shared/models/PropertyPanorama';

/**
 * Pure rules for the room tour viewer's motion: momentum, soft edges, wrap-around between Front and Back, and the position dial.
 * No React and no Animated here; RoomTourViewer.tsx owns gestures and animated values and calls these. The strips are NOT calibrated and the two sides overlap,
 * so nothing in this file talks about real degrees of a room: the dial angle is only a picture of "where in the circle", never a measurement.
 */

// ---- TUNING CONSTANTS: the numbers to adjust on the phone. Everything the feel depends on lives here, in one place. ----
/** Animated.decay deceleration after the finger lifts (closer to 1 glides longer). */
export const MOMENTUM_DECELERATION = 0.997;
/** A release slower than this (px per millisecond) does not glide at all. */
export const MIN_FLING_VELOCITY = 0.05;
/** Past an end the strip follows the finger by this fraction ... */
export const RUBBER_BAND_FACTOR = 0.35;
/** ... and never shows more than this many dp past the end. */
export const RUBBER_BAND_MAX_DP = 96;
/** Finger distance (dp) dragged past an end, at release, that switches to the other side. Measured on the finger, not on the rubber-banded strip. */
export const WRAP_THRESHOLD_DP = 72;
export const WRAP_FADE_OUT_MS = 180;
export const WRAP_FADE_IN_MS = 180;
/** Animated.spring `speed` for the snap back from a soft edge (higher is quicker). */
export const SPRING_BACK_SPEED = 16;
export const DIAL_SIZE = 64;
/** Blur radius of the backdrop copy of the current side's image. */
export const BACKDROP_BLUR_RADIUS = 24;
/** How dark the backdrop is made, 0 to 1 (a dark layer over the blurred image so the sharp strip stands out). */
export const BACKDROP_DIM_OPACITY = 0.45;
/** The backdrop moves this fraction of the strip's pan distance (decoration only; see backdropShift). */
export const BACKDROP_PARALLAX_FACTOR = 0.12;
/** Width (dp) of the soft fade at the strip's left and right edges, and height (dp) at its top and bottom edges. */
export const EDGE_FADE_SIDE_DP = 48;
export const EDGE_FADE_VERTICAL_DP = 32;
/** A fade is this many stacked bands of stepped opacity (no gradient library is installed). */
export const EDGE_FADE_STEPS = 8;
/** Opacity of the darkest band, right at the edge. */
export const EDGE_FADE_MAX_OPACITY = 0.55;
/** The dial's spoken description changes at most this often (milliseconds), so a screen reader is not flooded while the strip moves. */
export const DIAL_LABEL_MIN_INTERVAL_MS = 1200;

export type Edge = 'left' | 'right';
const finite = (value: number) => Number.isFinite(value);
const unit = (value: number) => (finite(value) ? Math.min(1, Math.max(0, value)) : 0);

// ---- Soft edges ----
/** Signed finger distance past an end: negative past the left end, positive past the right end, 0 inside. `raw` is the unclamped offset the finger asks for. */
export const overshootOf = (raw: number, max: number): number => !finite(raw) ? 0 : raw < 0 ? raw : raw > Math.max(0, max) ? raw - Math.max(0, max) : 0;
/** Resistance past an end: 35% of the finger distance, never more than 96dp. Takes a distance of 0 or more. */
export const rubberBand = (distance: number): number => finite(distance) && distance > 0 ? Math.min(RUBBER_BAND_MAX_DP, distance * RUBBER_BAND_FACTOR) : 0;
/** Where the strip is drawn for a finger that asks for `raw`: exact inside [0, max], rubber-banded outside. */
export function dragOffset(raw: number, max: number): number {
  if (!finite(raw)) return 0;
  const top = Math.max(0, finite(max) ? max : 0), over = overshootOf(raw, top);
  return over < 0 ? -rubberBand(-over) : over > 0 ? top + rubberBand(over) : raw;
}
/** The end the strip is pulled past, or null. */
export const edgeOf = (overshoot: number): Edge | null => overshoot < 0 ? 'left' : overshoot > 0 ? 'right' : null;

// ---- Momentum ----
/** Gesture velocity (px per second, as reported by the gesture handler) as the animated value's velocity (px per millisecond). */
export const releaseVelocity = (velocityX: number): number => finite(velocityX) ? velocityX / 1000 : 0;
export const shouldCoast = (velocity: number): boolean => finite(velocity) && Math.abs(velocity) >= MIN_FLING_VELOCITY;

// ---- Wrap-around: only with both sides ----
/** True when the pull past an end is long enough to switch sides. Needs both sides; the threshold itself counts (72dp or more). */
export const wrapTriggered = (overshoot: number, bothSides: boolean): boolean => bothSides && finite(overshoot) && Math.abs(overshoot) >= WRAP_THRESHOLD_DP;
/** The circle: leaving a side through one end enters the OTHER side at the OPPOSITE end (Front right to Back left, Back left to Front right, and so on). */
export function wrapTarget(current: PanoramaSide, exit: Edge): { side: PanoramaSide; entry: Edge } {
  return { side: current === 'front' ? 'back' : 'front', entry: exit === 'right' ? 'left' : 'right' };
}
/** Where a strip starts, as a pan offset, when it is entered from the given end. */
export const entryOffset = (entry: Edge, max: number): number => entry === 'right' && max > 0 ? max : 0;
export const wrapChipText = (target: PanoramaSide): string => `Release to see the ${target} side`;
/** The chip shown while the pull is past the threshold; null below it (and always null with one side). */
export function wrapChip(current: PanoramaSide, overshoot: number, bothSides: boolean): { edge: Edge; text: string } | null {
  const edge = edgeOf(overshoot);
  return edge && wrapTriggered(overshoot, bothSides) ? { edge, text: wrapChipText(wrapTarget(current, edge).side) } : null;
}

// ---- Position dial ----
/** Where the pointer points, in degrees clockwise from the top, for a side and a position 0..1: Front sweeps 0 to 180, Back continues 180 to 360. A picture, not a measurement. */
export const dialPointerAngle = (side: PanoramaSide, progress: number): number => (side === 'front' ? 0 : 180) + unit(progress) * 180;
/** The start and end angle of a side's half of the ring, for animating the pointer. */
export const dialArc = (side: PanoramaSide): { from: number; to: number } => ({ from: dialPointerAngle(side, 0), to: dialPointerAngle(side, 1) });
export type DialHalfState = 'current' | 'available' | 'missing';
/** How each half of the ring is drawn: the side being looked at, the other side when it exists, or a dimmed half when there is only one side. */
export function dialHalves(sides: readonly PanoramaSide[], selected: PanoramaSide): Record<PanoramaSide, DialHalfState> {
  const state = (side: PanoramaSide): DialHalfState => side === selected ? 'current' : sides.includes(side) ? 'available' : 'missing';
  return { front: state('front'), back: state('back') };
}
/** Words for the position. Deliberately vague: the strips are not calibrated, so no degrees and no exact claims. */
export function positionWords(progress: number): string {
  const p = unit(progress);
  return p < 0.15 ? 'just starting' : p < 0.4 ? 'a bit of the way across' : p < 0.6 ? 'about halfway across' : p < 0.85 ? 'most of the way across' : 'near the end';
}
export const dialLabel = (side: PanoramaSide, progress: number): string => `Looking at the ${side} side, ${positionWords(progress)}.`;
/** Throttle for the spoken label: only a changed label, and not more often than the minimum interval. A side change should bypass this (the caller passes `force`). */
export const shouldRefreshDialLabel = (previous: string, next: string, lastAt: number, now: number, force = false): boolean => next !== previous && (force || now - lastAt >= DIAL_LABEL_MIN_INTERVAL_MS);

// ---- Backdrop and edge fades: decoration only. Nothing here invents room content; the backdrop is a blurred, darkened copy of the same image. ----
/** The most the backdrop can move: a fraction of how far the strip can pan. 0 when the strip cannot pan. Pass 0 for `max` (reduced motion) to keep the backdrop still. */
export const backdropMaxShift = (max: number): number => finite(max) && max > 0 ? max * BACKDROP_PARALLAX_FACTOR : 0;
/**
 * How far the backdrop is shifted for a strip offset (distance panned from the left end): 0 at the left end, the maximum at the right end, clamped in between.
 * The backdrop is moved in the OPPOSITE direction to the strip (the strip moves left as the offset grows; this shift moves the backdrop right), as requested.
 */
export const backdropShift = (offset: number, max: number): number => {
  const range = backdropMaxShift(max);
  return range > 0 && finite(offset) ? Math.min(range, Math.max(0, offset / max * range)) : 0;
};
/** The backdrop is wider than the screen by twice the maximum shift (it starts one shift to the left), so its edges never show at either end of the pan. */
export const backdropWidth = (screenWidth: number, maxShift: number): number => (finite(screenWidth) && screenWidth > 0 ? screenWidth : 0) + 2 * (finite(maxShift) && maxShift > 0 ? maxShift : 0);
/** Opacity of each band of an edge fade, from the edge inward: the first at the maximum, the last at 0, evenly stepped (so the fade is monotonic). */
export function edgeFadeOpacities(steps: number = EDGE_FADE_STEPS, maxOpacity: number = EDGE_FADE_MAX_OPACITY): number[] {
  const count = Number.isInteger(steps) && steps > 1 ? steps : 2, top = unit(maxOpacity);
  return Array.from({ length: count }, (_, index) => top * (count - 1 - index) / (count - 1));
}
