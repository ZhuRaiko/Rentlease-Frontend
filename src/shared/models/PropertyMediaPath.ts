export interface PublicPropertyPhoto {id:string;url:string;alt:string|null}
const isPropertyUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const PROPERTY_PHOTO_BUCKET = 'property-media';
export const photoMimeExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
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
