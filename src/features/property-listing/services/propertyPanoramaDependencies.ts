import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { PropertyPanoramaError, createPropertyPanoramaService } from './propertyPanoramaService';
import type { PanoramaAsset } from '../models/PropertyPanoramaSelection';

/** Opens the Android photo picker for ONE image. No cropping and no re-encoding options: the file is uploaded as the phone saved it. Null when the owner cancels. */
export async function selectPropertyPanorama(): Promise<PanoramaAsset | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: false });
    const asset = result.canceled ? null : result.assets[0];
    return asset ? { uri: asset.uri, mimeType: asset.mimeType ?? null, size: asset.fileSize ?? null, width: asset.width, height: asset.height } : null;
  } catch { throw new PropertyPanoramaError('pick', ''); }
}
export const propertyPanoramaService = createPropertyPanoramaService(() => getSupabaseClient(), { uuid: randomUUID, read: uri => new File(uri).arrayBuffer() });
