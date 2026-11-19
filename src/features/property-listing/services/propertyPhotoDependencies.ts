import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { normalizeDocumentSelection } from '../../../shared/models/SelectedDocument';
import { PropertyPhotoError, validatePropertyPhoto } from '../models/PropertyPhoto';
import { createPropertyPhotoService } from './propertyPhotoService';
import { normalizeImagePickerSelections } from '../models/PropertyPhotoSelection';
import { createListingPhotoPreparer, type ManipulatorModule } from './listingPhotoPreparer';

export async function selectPropertyPhotos(remainingSlots: number) {
  try {
    if (remainingSlots <= 0) return [];
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remainingSlots, allowsEditing: false });
    return result.canceled ? [] : normalizeImagePickerSelections(result.assets, remainingSlots);
  } catch { throw new PropertyPhotoError('Could not select photos. Choose JPEG, PNG or WebP images up to 10 MB each.'); }
}

export async function selectPropertyPhoto() {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], multiple: false, copyToCacheDirectory: true });
    const selected = normalizeDocumentSelection(result);
    if (selected) validatePropertyPhoto(selected);
    return selected;
  } catch { throw new PropertyPhotoError('Could not select this photo. Choose a JPEG, PNG or WebP file no larger than 10 MB.'); }
}
/** Loaded lazily: expo-image-manipulator is a native module, and a build without it must not break the whole listing flow. Null means "not available" (the upload then fails closed). */
function loadManipulator(): ManipulatorModule | null {
  try { return require('expo-image-manipulator') as ManipulatorModule; } catch { return null; }
}
const prepare = createListingPhotoPreparer({
  loadManipulator,
  readHeader: (uri, length) => {
    const handle = new File(uri).open();
    try { return handle.readBytes(Math.min(length, handle.size ?? length)); } finally { handle.close(); }
  },
  readBytes: uri => new File(uri).arrayBuffer(),
  remove: uri => { new File(uri).delete(); },
});
export const propertyPhotoService = createPropertyPhotoService(() => getSupabaseClient(), AsyncStorage, { uuid: randomUUID, prepare });
