import { MAX_PANORAMA_BYTES, MAX_PANORAMA_WIDTH_PX, MIN_PANORAMA_ASPECT } from '../../../shared/models/PropertyPanorama';
import { photoMimeExtensions } from '../../../shared/models/PropertyMediaPath';

/** What the Android photo picker reports for one chosen image. Width and height are the image's own pixels. */
export interface PanoramaAsset { uri: string; mimeType: string | null; size: number | null; width: number; height: number }
export type PanoramaMime = keyof typeof photoMimeExtensions;
export type PanoramaProblem = 'type' | 'size' | 'aspect' | 'width' | 'unreadable' | 'upload' | 'pick';
export type PanoramaValidation = { ok: true; mime: PanoramaMime; width: number; height: number } | { ok: false; problem: PanoramaProblem };

const byExtension: Record<string, PanoramaMime> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
/** The picker sometimes omits the mime type; fall back to the file extension, never to a guess about the content. */
function mimeOf(asset: PanoramaAsset): PanoramaMime | null {
  if (asset.mimeType && Object.hasOwn(photoMimeExtensions, asset.mimeType)) return asset.mimeType as PanoramaMime;
  if (asset.mimeType) return null;
  const ext = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(asset.uri)?.[1]?.toLowerCase();
  return ext ? byExtension[ext] ?? null : null;
}

/**
 * Checked on the ORIGINAL pick, before it is shrunk: only that it is an image type we accept and that the picker reported a real size. The original's byte size and
 * shape are not judged here: a 13 MB, 13344 px original is fine because it is shrunk first. Shape and size are checked on the shrunk result (validatePanoramaAsset).
 */
export function checkPickedPanorama(asset: PanoramaAsset): PanoramaValidation {
  if (!asset.uri.trim()) return { ok: false, problem: 'unreadable' };
  const mime = mimeOf(asset);
  if (!mime) return { ok: false, problem: 'type' };
  if (!Number.isInteger(asset.width) || !Number.isInteger(asset.height) || asset.width <= 0 || asset.height <= 0) return { ok: false, problem: 'unreadable' };
  return { ok: true, mime, width: asset.width, height: asset.height };
}

/** Checks a photo before it is uploaded (the SHRUNK result in the upload flow): type, size, then shape (at least 3:1 wide, at most 16,384 px wide). The first failing rule wins. */
export function validatePanoramaAsset(asset: PanoramaAsset): PanoramaValidation {
  if (!asset.uri.trim()) return { ok: false, problem: 'unreadable' };
  const mime = mimeOf(asset);
  if (!mime) return { ok: false, problem: 'type' };
  if (asset.size !== null && (!Number.isFinite(asset.size) || asset.size <= 0 || asset.size > MAX_PANORAMA_BYTES)) return { ok: false, problem: asset.size > 0 ? 'size' : 'unreadable' };
  const { width, height } = asset;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return { ok: false, problem: 'unreadable' };
  if (width / height < MIN_PANORAMA_ASPECT) return { ok: false, problem: 'aspect' };
  if (width > MAX_PANORAMA_WIDTH_PX) return { ok: false, problem: 'width' };
  return { ok: true, mime, width, height };
}

/** Tile copy for a problem: a short title and one line that says what to do. Never color alone: the tile also shows an alert icon. */
export const panoramaProblemText: Record<PanoramaProblem, { title: string; body: string }> = {
  type: { title: 'Use a JPEG, PNG or WebP photo.', body: 'Tap to pick another.' },
  size: { title: 'This file is over 15 MB.', body: 'Tap to pick a smaller one.' },
  aspect: { title: 'This photo isn’t wide enough', body: 'Use Panorama mode and sweep slowly. Tap to pick another.' },
  width: { title: 'This photo is too wide', body: 'It is wider than 16,384 pixels. Tap to pick another.' },
  unreadable: { title: 'We couldn’t read this photo', body: 'Tap to pick another.' },
  upload: { title: 'Couldn’t upload.', body: 'Tap to try again.' },
  pick: { title: 'Couldn’t open your photos.', body: 'Tap to try again.' },
};
