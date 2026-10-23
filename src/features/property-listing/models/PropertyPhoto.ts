import type { Database } from '../../../shared/services/supabase/database.types';
import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { isPropertyUuid } from './DraftProperty';

export type PropertyPhotoRow = Database['public']['Tables']['property_photos']['Row'];
export type PropertyPhoto = PropertyPhotoRow & { publicUrl: string };
export const PROPERTY_PHOTO_BUCKET = 'property-media';
export const MAX_PROPERTY_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const photoMimeExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export function validatePropertyPhoto(file: SelectedDocument): keyof typeof photoMimeExtensions {
  if (!file.uri || !file.mimeType || !Object.hasOwn(photoMimeExtensions, file.mimeType)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  if (file.size !== null && (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_PHOTO_BYTES)) throw new Error('Choose a photo no larger than 10 MB.');
  return file.mimeType as keyof typeof photoMimeExtensions;
}
export function propertyPhotoPath(ownerId: string, propertyId: string, photoId: string, mime: keyof typeof photoMimeExtensions) {
  if (![ownerId, propertyId, photoId].every(isPropertyUuid)) throw new Error('A saved property and valid photo identity are required.');
  return `${ownerId}/${propertyId}/${photoId}.${photoMimeExtensions[mime]}`;
}
export function propertyPhotoObjectPath(storedPath: string, ownerId: string, propertyId: string, photoId: string) {
  const path = storedPath.startsWith(`${PROPERTY_PHOTO_BUCKET}/`) ? storedPath.slice(PROPERTY_PHOTO_BUCKET.length + 1) : storedPath;
  const valid = Object.keys(photoMimeExtensions).some(mime => path === propertyPhotoPath(ownerId, propertyId, photoId, mime as keyof typeof photoMimeExtensions))
    || path === propertyPhotoPath(ownerId, propertyId, photoId, 'image/jpeg').replace(/\.jpg$/, '.jpeg');
  if (!valid) throw new Error('The photo path could not be safely confirmed.');
  return path;
}
export function orderedPropertyPhotos<T extends PropertyPhotoRow>(photos: T[]): T[] {
  return [...photos].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export function safePhotoMessage(error: unknown): string {
  return error instanceof PropertyPhotoError ? error.message : 'Photos could not be updated. Check your connection and try again.';
}
export class PropertyPhotoError extends Error {
  constructor(message: string, public readonly reconcile = false) { super(message); }
}
