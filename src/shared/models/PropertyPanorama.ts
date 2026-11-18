import { photoMimeExtensions } from './PropertyMediaPath';

/** Room tour: up to two phone panoramas per property. They are NOT property photos (no photo count, no cover). Contract: docs/design/room-tour-backend-design.md. */
export type PanoramaSide = 'front' | 'back';
export const PANORAMA_SIDES: readonly PanoramaSide[] = ['front', 'back'];
export const panoramaSideLabel: Record<PanoramaSide, string> = { front: 'Front side', back: 'Back side' };
export const PROPERTY_PANORAMA_BUCKET = 'property-panoramas';
export const MIN_PANORAMA_ASPECT = 3;
export const MAX_PANORAMA_BYTES = 15 * 1024 * 1024;
export const MAX_PANORAMA_WIDTH_PX = 16384;
export interface PublicPropertyPanorama { side: PanoramaSide; url: string; width: number; height: number }

export const isPanoramaSide = (value: unknown): value is PanoramaSide => value === 'front' || value === 'back';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const isUuid = (value: unknown): value is string => typeof value === 'string' && new RegExp(`^${UUID}$`).test(value);
const EXTENSIONS = [...Object.values(photoMimeExtensions), 'jpeg'];

/** The object path for a new upload: `<ownerId>/<propertyId>/<uuid>.<ext>`, lower-case uuids, no bucket prefix. */
export function propertyPanoramaPath(ownerId: string, propertyId: string, fileId: string, mime: keyof typeof photoMimeExtensions): string {
  if (![ownerId, propertyId, fileId].every(isUuid)) throw new Error('A saved property and a valid panorama identity are required.');
  return `${ownerId}/${propertyId}/${fileId}.${photoMimeExtensions[mime]}`;
}
/** Confirms a stored path belongs to this owner and property and has the exact shape the backend accepts. Anything else throws; nothing is ever signed or fetched from an unconfirmed path. */
export function propertyPanoramaObjectPath(storedPath: unknown, ownerId: string, propertyId: string): string {
  if (typeof storedPath !== 'string' || !isUuid(ownerId) || !isUuid(propertyId)) throw new Error('The panorama path could not be safely confirmed.');
  const match = new RegExp(`^(${UUID})/(${UUID})/${UUID}\\.(${EXTENSIONS.join('|')})$`).exec(storedPath);
  if (!match || match[1] !== ownerId || match[2] !== propertyId) throw new Error('The panorama path could not be safely confirmed.');
  return storedPath;
}

// ---- Viewer geometry (pure). The strip fills its area by HEIGHT; its width follows the image shape, so most of it is off-screen. ----
export const VIEWER_HEIGHT_FRACTION = 0.52;
const positive = (value: number) => Number.isFinite(value) && value > 0;
/** Height of the strip area for a viewer of the given height (about 52%: 460 of 891dp in the design). */
export const stripAreaHeight = (viewerHeight: number): number => positive(viewerHeight) ? Math.round(viewerHeight * VIEWER_HEIGHT_FRACTION) : 0;
/** Rendered width of the whole strip: height times the image's own aspect ratio (its stored width and height). */
export const stripWidth = (areaHeight: number, imageWidth: number, imageHeight: number): number => positive(areaHeight) && positive(imageWidth) && positive(imageHeight) ? areaHeight * (imageWidth / imageHeight) : 0;
/** How far the strip can move: everything that does not fit in the viewport. Never negative. */
export const maxPanOffset = (strip: number, viewportWidth: number): number => positive(strip) && positive(viewportWidth) ? Math.max(0, strip - viewportWidth) : 0;
/** Keeps a pan offset (distance moved from the left edge) inside [0, max]. A bad number becomes the left edge. */
export const clampPanOffset = (offset: number, max: number): number => !Number.isFinite(offset) || max <= 0 ? 0 : Math.min(max, Math.max(0, offset));
/** Position in the strip as 0..1 (0 at the left edge, 1 at the right edge; 0 when nothing can move). */
export const panProgress = (offset: number, max: number): number => max > 0 ? clampPanOffset(offset, max) / max : 0;
/** Size of the position-bar thumb as a fraction of the track: the part of the strip that is on screen. */
export const visibleFraction = (strip: number, viewportWidth: number): number => positive(strip) && positive(viewportWidth) ? Math.min(1, viewportWidth / strip) : 1;
