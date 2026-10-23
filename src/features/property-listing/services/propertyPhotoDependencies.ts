import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { normalizeDocumentSelection } from '../../../shared/models/SelectedDocument';
import { PropertyPhotoError, validatePropertyPhoto } from '../models/PropertyPhoto';
import { createPropertyPhotoService } from './propertyPhotoService';

export async function selectPropertyPhoto() {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], multiple: false, copyToCacheDirectory: true });
    const selected = normalizeDocumentSelection(result);
    if (selected) validatePropertyPhoto(selected);
    return selected;
  } catch { throw new PropertyPhotoError('Could not select this photo. Choose a JPEG, PNG or WebP file no larger than 10 MB.'); }
}
export const propertyPhotoService = createPropertyPhotoService(() => getSupabaseClient(), AsyncStorage, {
  uuid: randomUUID,
  read: file => new File(file.uri).arrayBuffer(),
});
