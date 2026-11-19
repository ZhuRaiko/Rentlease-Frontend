/**
 * Pure rules for re-encoding a listing photo before upload (no React, no native module). The re-encode writes a fresh JPEG, which drops the original's metadata
 * (GPS location, capture date, camera make and model, XMP). Because the EXIF orientation tag is dropped with it, the picture must already be upright in the pixels.
 */
/** The longest edge of the uploaded photo, in pixels. A smaller photo is never enlarged. */
export const PHOTO_MAX_EDGE_PX = 2560;
export const PHOTO_JPEG_QUALITY = 0.85;
/** Every re-encoded photo is a JPEG: the reserved type, the upload content type and the path extension (.jpg, chosen by the server from the type) all follow from this. */
export const PHOTO_REENCODED_MIME = 'image/jpeg' as const;
/** The most the app will try to decode (the ORIGINAL file). The 10 MB limit applies to the re-encoded file, not to this. */
export const PHOTO_ORIGINAL_MAX_BYTES = 50 * 1024 * 1024;

const positive = (value: number) => Number.isFinite(value) && value > 0;

/** What to ask the manipulator to resize to: the longest edge at most 2560 px, the other edge following (aspect kept). Null when no resize is needed (never enlarge). */
export function resizeTarget(width: number, height: number, maxEdge: number = PHOTO_MAX_EDGE_PX): { width: number } | { height: number } | null {
  if (!positive(width) || !positive(height)) return null;
  if (width >= height) return width > maxEdge ? { width: maxEdge } : null;
  return height > maxEdge ? { height: maxEdge } : null;
}

// ---- Reading the original's orientation and stored size from the first bytes of a JPEG (the header only; values are never kept or shown) ----
/** The JPEG's stored pixel size (before any orientation) from its start-of-frame segment, or null when it is not found in these bytes. */
export function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2) return null;
    const startOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (startOfFrame) {
      if (i + 9 > bytes.length) return null;
      const height = (bytes[i + 5]! << 8) | bytes[i + 6]!, width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + length;
  }
  return null;
}
/** The EXIF orientation (1 to 8) of a JPEG from its APP1 segment, or null when there is none. 1 means upright. */
export function readJpegOrientation(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2) return null;
    if (marker === 0xe1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66 && bytes[i + 8] === 0 && bytes[i + 9] === 0) {
      const tiff = i + 10, end = Math.min(bytes.length, i + 2 + length);
      const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
      if (!little && !(bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d)) return null;
      const u16 = (at: number) => at + 2 <= end ? (little ? bytes[at]! | (bytes[at + 1]! << 8) : (bytes[at]! << 8) | bytes[at + 1]!) : -1;
      const u32 = (at: number): number => {
        if (at + 4 > end) return -1;
        const a = bytes[at]!, b = bytes[at + 1]!, c = bytes[at + 2]!, d = bytes[at + 3]!;
        return little ? (a | (b << 8) | (c << 16) | (d << 24)) >>> 0 : ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
      };
      if (u16(tiff + 2) !== 42) return null;
      const ifd = tiff + u32(tiff + 4), count = u16(ifd);
      if (ifd < tiff || count < 0 || count > 200) return null;
      for (let n = 0; n < count; n++) {
        const entry = ifd + 2 + n * 12;
        if (u16(entry) === 0x0112) { const value = u16(entry + 8); return value >= 1 && value <= 8 ? value : null; }
      }
      return null;
    }
    i += 2 + length;
  }
  return null;
}

// ---- Orientation, made explicit ----
export type OrientationOp = { rotate: number } | { flip: 'horizontal' | 'vertical' };
/** What turns a picture stored with this EXIF orientation into an upright one, in order. Orientation 1 (or none) needs nothing. */
export function orientationOps(orientation: number | null): OrientationOp[] {
  switch (orientation) {
    case 2: return [{ flip: 'horizontal' }];
    case 3: return [{ rotate: 180 }];
    case 4: return [{ flip: 'vertical' }];
    case 5: return [{ flip: 'horizontal' }, { rotate: 270 }];
    case 6: return [{ rotate: 90 }];
    case 7: return [{ flip: 'horizontal' }, { rotate: 90 }];
    case 8: return [{ rotate: 270 }];
    default: return [];
  }
}
/** True for the orientations that turn the picture a quarter turn, so width and height swap on screen (5 to 8). */
export const swapsAxes = (orientation: number | null): boolean => orientation !== null && orientation >= 5 && orientation <= 8;
/**
 * The manipulator decodes through an image loader that normally applies the EXIF orientation itself. This is the check that it did: the photo as it SHOULD look (stored size,
 * turned by its orientation) must have the same shape (portrait or landscape) as the result. Returns the corrective steps when it did not (a quarter-turn photo came out
 * sideways), otherwise none. A half turn or a mirror does not change the shape, so those cannot be detected here and rely on the loader. Squares and unknown sizes need nothing.
 */
export function orientationFixFor(stored: { width: number; height: number } | null, orientation: number | null, result: { width: number; height: number }): OrientationOp[] {
  if (!stored || !swapsAxes(orientation) || !positive(result.width) || !positive(result.height)) return [];
  const expectedLandscape = (swapsAxes(orientation) ? stored.height : stored.width) > (swapsAxes(orientation) ? stored.width : stored.height);
  const expectedSquare = stored.width === stored.height, resultSquare = result.width === result.height;
  if (expectedSquare || resultSquare) return [];
  return expectedLandscape !== (result.width > result.height) ? orientationOps(orientation) : [];
}
