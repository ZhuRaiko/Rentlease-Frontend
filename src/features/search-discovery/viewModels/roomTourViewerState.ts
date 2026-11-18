import type { PanoramaSide, PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';

/** Pure state for the renter's room tour viewer. The component owns the gestures; every decision about sides, loading and the hint lives here. */
export type SideLoad = 'loading' | 'loaded' | 'failed';
export interface RoomTourViewerState { sides: PanoramaSide[]; selected: PanoramaSide; load: Record<PanoramaSide, SideLoad>; reloads: Record<PanoramaSide, number> }

/** Front comes first when both exist. Null means there is no tour and nothing should render. */
export function openRoomTour(tour: readonly PublicPropertyPanorama[]): RoomTourViewerState | null {
  const sides = (['front', 'back'] as const).filter(side => tour.some(p => p.side === side));
  const first = sides[0];
  return first ? { sides, selected: first, load: { front: 'loading', back: 'loading' }, reloads: { front: 0, back: 0 } } : null;
}
/** Card subtitle: "Front and back side", "Front side only" or "Back side only". */
export function roomTourSubtitle(tour: readonly PublicPropertyPanorama[]): string | null {
  const front = tour.some(p => p.side === 'front'), back = tour.some(p => p.side === 'back');
  return front && back ? 'Front and back side' : front ? 'Front side only' : back ? 'Back side only' : null;
}
/** The Front/Back switch exists only when both sides do. With one side the viewer shows a small label instead. */
export const showSideSwitch = (s: RoomTourViewerState): boolean => s.sides.length > 1;
/** The switch is disabled while the current side is still loading; a failed side can be left by switching. */
export const switchEnabled = (s: RoomTourViewerState): boolean => showSideSwitch(s) && s.load[s.selected] !== 'loading';
export function selectSide(s: RoomTourViewerState, side: PanoramaSide): RoomTourViewerState {
  return s.sides.includes(side) && side !== s.selected && switchEnabled(s) ? { ...s, selected: side } : s;
}
/** A wrap-around switch: moves to the other side without the load check the Front/Back switch needs (the side being left has loaded). Only with both sides. */
export const wrapToSide = (s: RoomTourViewerState, side: PanoramaSide): RoomTourViewerState => showSideSwitch(s) && s.sides.includes(side) && side !== s.selected ? { ...s, selected: side } : s;
export const sideLoaded = (s: RoomTourViewerState, side: PanoramaSide): RoomTourViewerState => ({ ...s, load: { ...s.load, [side]: 'loaded' } });
export const sideFailed = (s: RoomTourViewerState, side: PanoramaSide): RoomTourViewerState => ({ ...s, load: { ...s.load, [side]: 'failed' } });
/** "Try again": back to loading and a new key, so the image is mounted again and fetched again. */
export const retrySide = (s: RoomTourViewerState, side: PanoramaSide): RoomTourViewerState => ({ ...s, load: { ...s.load, [side]: 'loading' }, reloads: { ...s.reloads, [side]: s.reloads[side] + 1 } });

// "Drag to look around": shown once per app session (module memory, not stored), gone on the first touch.
let hintSeen = false;
export const shouldShowDragHint = (): boolean => !hintSeen;
export const markDragHintSeen = (): void => { hintSeen = true; };
export const resetDragHintForTests = (): void => { hintSeen = false; };
