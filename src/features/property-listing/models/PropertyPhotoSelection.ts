import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { MAX_PROPERTY_PHOTOS, PropertyPhotoError, validatePropertyPhoto } from './PropertyPhoto';

interface GalleryAsset { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number }
export function normalizeImagePickerSelections(assets: readonly GalleryAsset[], remaining: number): SelectedDocument[] {
  if (!Number.isInteger(remaining) || remaining < 1 || remaining > MAX_PROPERTY_PHOTOS || assets.length > remaining) throw new PropertyPhotoError('Choose photos within the remaining 10-photo limit.');
  return assets.map((asset, index) => {
    const selected: SelectedDocument = { uri: asset.uri, fileName: asset.fileName?.trim() || `Property photo ${index + 1}`, mimeType: asset.mimeType ?? null, size: asset.fileSize ?? null };
    try { validatePropertyPhoto(selected); if (!selected.uri.trim()) throw Error('Empty URI'); }
    catch { throw new PropertyPhotoError('Choose JPEG, PNG or WebP photos no larger than 10 MB each.'); }
    return selected;
  });
}
