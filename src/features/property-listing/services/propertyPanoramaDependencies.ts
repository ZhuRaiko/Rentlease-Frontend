import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { randomUUID } from 'expo-crypto';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { PANORAMA_UPLOAD_JPEG_QUALITY } from '../../../shared/models/PropertyPanorama';
import { PropertyPanoramaError, createPropertyPanoramaService } from './propertyPanoramaService';
import type { PanoramaAsset } from '../models/PropertyPanoramaSelection';

/** Opens the Android photo picker for ONE image. No cropping and no picker-side compression (quality stays at the default); the upload step shrinks the file afterwards. Null when the owner cancels. */
export async function selectPropertyPanorama(): Promise<PanoramaAsset | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: false });
    const asset = result.canceled ? null : result.assets[0];
    return asset ? { uri: asset.uri, mimeType: asset.mimeType ?? null, size: asset.fileSize ?? null, width: asset.width, height: asset.height } : null;
  } catch { throw new PropertyPanoramaError('pick', ''); }
}
/**
 * Makes the JPEG copy that is uploaded: resized to at most `maxWidth` px wide with the aspect ratio kept (a smaller original is never enlarged), saved at JPEG quality 0.8.
 * Re-encoding also drops the original's metadata (expected to include GPS EXIF; unverified on a device). The size in the result is read from the saved copy, not assumed.
 */
async function shrinkToJpeg(uri: string, maxWidth: number, originalWidth: number): Promise<{ uri: string; width: number; height: number }> {
  const context = ImageManipulator.manipulate(uri);
  try {
    if (originalWidth > maxWidth) context.resize({ width: maxWidth });   // only ever smaller: width alone is given, so the height follows and the aspect ratio is kept
    const image = await context.renderAsync();
    try {
      const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: PANORAMA_UPLOAD_JPEG_QUALITY });
      return { uri: out.uri, width: out.width, height: out.height };
    } finally { image.release(); }
  } finally { context.release(); }
}
export const propertyPanoramaService = createPropertyPanoramaService(() => getSupabaseClient(), {
  uuid: randomUUID,
  read: uri => new File(uri).arrayBuffer(),
  shrink: (uri, maxWidth, originalWidth) => shrinkToJpeg(uri, maxWidth, originalWidth),
  cleanup: uri => { try { new File(uri).delete(); } catch { /* the cache is cleaned by the system anyway */ } },
});
