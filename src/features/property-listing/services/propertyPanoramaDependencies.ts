import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import type { ManipulatorModule } from './listingPhotoPreparer';
import { createPanoramaShrinker } from './propertyPanoramaShrink';
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
/** Loaded lazily: expo-image-manipulator is a native module, and a build without it must not fail at launch. Null means "not available" (a panorama upload then fails with a plain problem tile). */
function loadManipulator(): ManipulatorModule | null {
  try { return require('expo-image-manipulator') as ManipulatorModule; } catch { return null; }
}
export const propertyPanoramaService = createPropertyPanoramaService(() => getSupabaseClient(), {
  uuid: randomUUID,
  read: uri => new File(uri).arrayBuffer(),
  shrink: createPanoramaShrinker(loadManipulator),
  cleanup: uri => { try { new File(uri).delete(); } catch { /* the cache is cleaned by the system anyway */ } },
});
