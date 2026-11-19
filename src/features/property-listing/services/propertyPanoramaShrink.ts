import { PANORAMA_UPLOAD_JPEG_QUALITY } from '../../../shared/models/PropertyPanorama';
import type { ManipulatorModule } from './listingPhotoPreparer';

/**
 * Makes the JPEG copy that is uploaded for a panorama: resized to at most `maxWidth` px wide with the aspect ratio kept (a smaller original is never enlarged), saved at JPEG
 * quality 0.8. Re-encoding also drops the original's metadata. The size in the result is read from the saved copy, not assumed.
 * The native module is passed in as a loader that returns null when it is not in this build: then this throws, the service reports a plain upload problem
 * ("Couldn't upload. Tap to try again.") and nothing is uploaded. Nothing here imports the module, so a build without it cannot fail at launch.
 */
export function createPanoramaShrinker(loadManipulator: () => ManipulatorModule | null) {
  return async function shrinkToJpeg(uri: string, maxWidth: number, originalWidth: number): Promise<{ uri: string; width: number; height: number }> {
    const mod = loadManipulator();
    if (!mod) throw new Error('The image manipulator is not available in this build.');
    const context = mod.ImageManipulator.manipulate(uri);
    try {
      if (originalWidth > maxWidth) context.resize({ width: maxWidth });   // only ever smaller: width alone is given, so the height follows and the aspect ratio is kept
      const image = await context.renderAsync();
      try {
        const out = await image.saveAsync({ format: mod.SaveFormat.JPEG, compress: PANORAMA_UPLOAD_JPEG_QUALITY });
        return { uri: out.uri, width: out.width, height: out.height };
      } finally { image.release?.(); }
    } finally { context.release?.(); }
  };
}
