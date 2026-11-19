import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { PHOTO_FAILED_MESSAGE, PropertyPhotoError } from '../models/PropertyPhoto';
import { PHOTO_JPEG_QUALITY, PHOTO_REENCODED_MIME, orientationFixFor, orientationOps, readJpegOrientation, readJpegSize, resizeTarget, swapsAxes, type OrientationOp } from '../models/PropertyPhotoReencode';

/** The slice of expo-image-manipulator this code uses. The module is loaded lazily and may be missing, so nothing here imports it. */
interface ContextLike { resize(size: { width?: number; height?: number }): ContextLike; rotate(degrees: number): ContextLike; flip(type: 'horizontal' | 'vertical'): ContextLike; renderAsync(): Promise<RefLike>; release?(): void }
interface RefLike { width: number; height: number; saveAsync(options: { format: unknown; compress: number }): Promise<{ uri: string; width: number; height: number }>; release?(): void }
export interface ManipulatorModule { ImageManipulator: { manipulate(source: string | RefLike): ContextLike }; SaveFormat: { JPEG: unknown } }
export interface PreparerDeps {
  /** Null when the native module is not in this build. */
  loadManipulator(): ManipulatorModule | null;
  /** The first bytes of the picked file (to read its size and orientation), or null if they cannot be read. */
  readHeader(uri: string, length: number): Uint8Array | null;
  readBytes(uri: string): Promise<ArrayBuffer>;
  /** Deletes the temporary re-encoded copy; failures are ignored. */
  remove(uri: string): void;
}
export interface PreparedPhoto { body: ArrayBuffer; mime: typeof PHOTO_REENCODED_MIME }
const HEADER_BYTES = 256 * 1024;

/**
 * Makes the file that is uploaded for a listing photo: a FRESH JPEG (longest edge at most 2560 px, never enlarged, quality 0.85), which carries none of the original's metadata
 * (GPS, capture date, camera make and model, XMP). It never returns the original bytes: if the module is missing or anything fails, it throws the existing failed-photo
 * error and the caller uploads nothing (fail closed).
 * Orientation: the EXIF orientation tag does not survive a re-encode, so the picture must be upright in the pixels. The manipulator's image loader normally applies the
 * orientation; this checks that against the file's own stored size and orientation and turns the picture itself when a quarter-turn photo came out sideways.
 */
export function createListingPhotoPreparer(deps: PreparerDeps) {
  return async function prepare(file: SelectedDocument): Promise<PreparedPhoto> {
    const mod = deps.loadManipulator();
    if (!mod) throw new PropertyPhotoError(PHOTO_FAILED_MESSAGE);
    let header: Uint8Array | null = null;
    try { header = deps.readHeader(file.uri, HEADER_BYTES); } catch { header = null; }
    const stored = header ? readJpegSize(header) : null, orientation = header ? readJpegOrientation(header) : null;
    const holders: { release?(): void }[] = [];
    let outUri: string | null = null;
    try {
      // Pass 1: decode, resized up front when the size is known (the usual case: a JPEG from the gallery).
      const display = stored ? (swapsAxes(orientation) ? { width: stored.height, height: stored.width } : stored) : null;
      const target = display ? resizeTarget(display.width, display.height) : null;
      const first = mod.ImageManipulator.manipulate(file.uri); holders.push(first);
      if (target) first.resize(target);
      let ref = await first.renderAsync(); holders.push(ref);
      // Pass 2: turn the picture ourselves only if the loader left a quarter-turn photo sideways.
      const fix: OrientationOp[] = orientationFixFor(stored, orientation, ref);
      if (fix.length) {
        const context = mod.ImageManipulator.manipulate(ref); holders.push(context);
        for (const op of fix) { if ('rotate' in op) context.rotate(op.rotate); else context.flip(op.flip); }
        ref = await context.renderAsync(); holders.push(ref);
      }
      // Pass 3: the longest edge, when the size was not known up front (PNG, WebP) or the turn above changed it.
      const edge = resizeTarget(ref.width, ref.height);
      if (edge) { const context = mod.ImageManipulator.manipulate(ref); holders.push(context); context.resize(edge); ref = await context.renderAsync(); holders.push(ref); }
      const saved = await ref.saveAsync({ format: mod.SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY });
      outUri = saved.uri;
      const body = await deps.readBytes(saved.uri);
      if (!body.byteLength) throw new Error('empty');
      return { body, mime: PHOTO_REENCODED_MIME };
    } catch (error) {
      if (error instanceof PropertyPhotoError) throw error;
      throw new PropertyPhotoError(PHOTO_FAILED_MESSAGE);
    } finally {
      for (const holder of holders) { try { holder.release?.(); } catch { /* ignored */ } }
      if (outUri) { try { deps.remove(outUri); } catch { /* ignored */ } }
    }
  };
}
export { orientationOps };
