import { stripAreaHeight } from '../../../shared/models/PropertyPanorama';

/**
 * Pure layout math for the room tour viewer's container (shared by the WebGL strip and the flat fallback). The viewer is a full-screen Modal drawn edge to edge,
 * so the system bars sit on top of it: the header must start below the status bar and the dial and Front/Back switch must sit above the navigation bar.
 * The inset values come from the shared library hook; the bottom clearance comes from the shared useBottomClearance hook. This file only combines numbers.
 */
/** Space between the status bar and the header row (the X and the title). */
export const ROOM_TOUR_HEADER_EXTRA_TOP_DP = 12;
/** The least space between the bottom of the Front/Back switch and the top of the navigation bar, for 3-button and gesture navigation alike. */
export const ROOM_TOUR_MIN_BOTTOM_GAP_DP = 16;

const safe = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;

/** Top padding of the header: below the status bar plus 12dp. Uses the larger of the reported inset and the Android status bar height, since a Modal can report 0. */
export const headerTopPadding = (topInset: number, statusBarHeight = 0): number => Math.max(safe(topInset), safe(statusBarHeight)) + ROOM_TOUR_HEADER_EXTRA_TOP_DP;
/** Bottom padding of the footer: the shared clearance (already above the bar), and never less than the inset plus the minimum gap. */
export const footerBottomPadding = (bottomInset: number, clearance: number): number => Math.max(safe(clearance), safe(bottomInset) + ROOM_TOUR_MIN_BOTTOM_GAP_DP);
/** The strip is a fraction of the USABLE height (the space between the header and the dial), centered in it. */
export function centeredStrip(usableHeight: number): { height: number; top: number } {
  const height = stripAreaHeight(usableHeight);
  return { height, top: height > 0 ? (usableHeight - height) / 2 : 0 };
}
