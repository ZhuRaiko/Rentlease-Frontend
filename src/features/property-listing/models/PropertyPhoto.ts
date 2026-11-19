import type { Database } from '../../../shared/services/supabase/database.types';
import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import {photoMimeExtensions} from '../../../shared/models/PropertyMediaPath';
export {PROPERTY_PHOTO_BUCKET,photoMimeExtensions,propertyPhotoPath,propertyPhotoObjectPath} from '../../../shared/models/PropertyMediaPath';

export type PropertyPhotoRow = Database['public']['Tables']['property_photos']['Row'];
export type PropertyPhoto = PropertyPhotoRow & { publicUrl: string };
export const MAX_PROPERTY_PHOTOS = 10;
import { PHOTO_ORIGINAL_MAX_BYTES } from './PropertyPhotoReencode';
/** The limit for the re-encoded file that is uploaded (and the storage bucket's own limit). The ORIGINAL pick is only capped at PHOTO_ORIGINAL_MAX_BYTES. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_FAILED_MESSAGE = 'Photos could not be updated. Check your connection and try again.';
export function validatePropertyPhoto(file: SelectedDocument): keyof typeof photoMimeExtensions {
  if (!file.uri || !file.mimeType || !Object.hasOwn(photoMimeExtensions, file.mimeType)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  if (file.size !== null && (!Number.isFinite(file.size) || file.size <= 0 || file.size > PHOTO_ORIGINAL_MAX_BYTES)) throw new Error('Choose a photo no larger than 50 MB.');
  return file.mimeType as keyof typeof photoMimeExtensions;
}
export function orderedPropertyPhotos<T extends PropertyPhotoRow>(photos: T[]): T[] {
  return [...photos].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export function safePhotoMessage(error: unknown): string {
  return error instanceof PropertyPhotoError ? error.message : PHOTO_FAILED_MESSAGE;
}
export class PropertyPhotoError extends Error {
  constructor(message: string, public readonly reconcile = false) { super(message); }
}
