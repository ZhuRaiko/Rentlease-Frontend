/**
 * Pure geometry for the WebGL room tour (a photo seen from inside a cylinder). No React, no WebView. The same formulas are inlined in the renderer
 * (GL_MATH_SOURCE in roomTourGlHtml.ts); tests evaluate that source and compare it with these functions so the two cannot drift.
 *
 * The span is an ESTIMATE: phone panoramas are not calibrated and the two sides overlap, so nothing here is a measured angle of the room.
 */

// ---- TUNING CONSTANTS for the GL viewer ----
/** Master switch for the WebGL viewer. When false (or when the GL viewer is unavailable), the flat strip viewer is used. */
export const ROOM_TOUR_GL_ENABLED = true;
/** How many degrees of the cylinder the photo covers (one constant; an estimate, not a measurement). */
export const GL_SPAN_DEGREES = 200;
/** Vertical field of view of the virtual camera, in degrees. */
export const GL_FOV_DEGREES = 60;
/** How far the camera may tilt up or down, in degrees (0 at rest). */
export const GL_PITCH_LIMIT_DEGREES = 8;
/** If the renderer has not reported its first frame within this time (milliseconds), the viewer falls back to the flat strip for the rest of the session. */
export const GL_READY_TIMEOUT_MS = 8000;
/** The renderer reports the position at most this often (per second). */
export const GL_POSITION_MAX_HZ = 30;
/** Vertical drag tilts the camera by this many degrees per pixel; the tilt eases back to 0 on release. */
export const GL_PITCH_DEG_PER_PX = 0.05;

const finite = (value: number) => Number.isFinite(value);
const positive = (value: number) => finite(value) && value > 0;
const RAD = Math.PI / 180;

/** Height of the cylinder (radius 1) for a photo that spans `spanDegrees`, so the photo keeps its real proportions: arc length divided by the image aspect. */
export const cylinderHeight = (spanDegrees: number, aspect: number): number => positive(spanDegrees) && positive(aspect) ? spanDegrees * RAD / aspect : 0;
/** Horizontal field of view (degrees) for a vertical one and a viewport aspect (width over height). */
export const horizontalFov = (verticalDegrees: number, viewportAspect: number): number => positive(verticalDegrees) && positive(viewportAspect) ? 2 * Math.atan(Math.tan(verticalDegrees * RAD / 2) * viewportAspect) / RAD : 0;
/** The camera's yaw may move this far either side of the photo's center so the view never shows past the photo's left or right end (0 when the photo is not wider than the view). */
export const yawLimit = (spanDegrees: number, horizontalDegrees: number): number => finite(spanDegrees) && finite(horizontalDegrees) ? Math.max(0, (spanDegrees - horizontalDegrees) / 2) : 0;
export const clampYaw = (yaw: number, limit: number): number => !finite(yaw) || limit <= 0 ? 0 : Math.min(limit, Math.max(-limit, yaw));
export const clampPitch = (pitch: number, limit: number = GL_PITCH_LIMIT_DEGREES): number => !finite(pitch) ? 0 : Math.min(limit, Math.max(-limit, pitch));
/** Position across the photo, 0 at the left end and 1 at the right end. 0 when nothing can move. */
export const positionFromYaw = (yaw: number, limit: number): number => limit > 0 && finite(yaw) ? Math.min(1, Math.max(0, (yaw + limit) / (2 * limit))) : 0;
/** How far a finger would have to drag (dp) to cross the whole photo: the viewport width scaled by how many views fit in the span. Used for the backdrop drift and the dial, as the flat strip's pan distance. */
export const panDistanceDp = (spanDegrees: number, horizontalDegrees: number, viewportWidth: number): number => positive(horizontalDegrees) && positive(viewportWidth) ? Math.max(0, viewportWidth * (spanDegrees - horizontalDegrees) / horizontalDegrees) : 0;
