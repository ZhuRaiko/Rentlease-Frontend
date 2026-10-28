import { isExactPropertyPoint, type ExactPropertyPoint } from './PropertyLocationConfirmation';
export type GeographicPoint = ExactPropertyPoint;
export interface WebMercatorPoint { x: number; y: number }
export const PUBLIC_LOCATION_GRID_METERS = 300;
export const WEB_MERCATOR_RADIUS_METERS = 6378137;
export const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;
const radians = Math.PI / 180;
export function projectWebMercator(point: GeographicPoint): WebMercatorPoint {
  if (!isExactPropertyPoint(point)) throw new Error('A valid geographic point is required.');
  const latitude = Math.max(-WEB_MERCATOR_MAX_LATITUDE, Math.min(WEB_MERCATOR_MAX_LATITUDE, point.latitude));
  return { x: WEB_MERCATOR_RADIUS_METERS * point.longitude * radians,
    // Equivalent to log(tan(pi/4 + latitude/2)), with exact zero at the origin.
    y: WEB_MERCATOR_RADIUS_METERS * Math.asinh(Math.tan(latitude * radians)) };
}
export function unprojectWebMercator(point: WebMercatorPoint): GeographicPoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('A valid projected point is required.');
  const geographic = { longitude: point.x / WEB_MERCATOR_RADIUS_METERS / radians,
    latitude: Math.atan(Math.sinh(point.y / WEB_MERCATOR_RADIUS_METERS)) / radians };
  if (!isExactPropertyPoint(geographic)) throw new Error('A valid geographic point could not be derived.');
  return geographic;
}
/** Deterministic 300m projected-grid generalization, not a fixed displacement. */
export function derivePublicPropertyPoint(exact: GeographicPoint): GeographicPoint {
  const projected = projectWebMercator(exact);
  const center = (value: number) => (Math.floor(value / PUBLIC_LOCATION_GRID_METERS) + 0.5) * PUBLIC_LOCATION_GRID_METERS;
  const publicPoint = unprojectWebMercator({ x: center(projected.x), y: center(projected.y) });
  if (!isExactPropertyPoint(publicPoint)) throw new Error('A valid geographic point could not be derived.');
  return publicPoint;
}
