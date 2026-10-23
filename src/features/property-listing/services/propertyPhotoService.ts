import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { isPropertyUuid } from '../models/DraftProperty';
import { MAX_PHOTO_BYTES, MAX_PROPERTY_PHOTOS, PROPERTY_PHOTO_BUCKET, PropertyPhotoError, orderedPropertyPhotos, propertyPhotoObjectPath, propertyPhotoPath, validatePropertyPhoto, type PropertyPhoto, type PropertyPhotoRow } from '../models/PropertyPhoto';

interface Journal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
interface PendingPhoto { kind: 'upload' | 'delete' | 'cleanup'; photoId: string; path: string }
export interface PhotoContext { ownerId: string; propertyId: string }
export interface PhotoDevice { read(file: SelectedDocument): Promise<ArrayBuffer>; uuid(): string }
const inFlight = new Set<string>();
const columns = 'id,property_id,storage_path,alt_text,sort_order,is_cover,created_at';
const uncertain = () => new PropertyPhotoError('The photo operation could not be confirmed. Check photo status before making further changes.', true);
const rejected = (error: { code?: string }) => /^(22|23|42|P0001)/.test(error.code ?? '');
const dbError = (error: { code?: string; message?: string }) => new PropertyPhotoError(
  ['22023', 'P0001'].includes(error.code ?? '') && /10|limit|maximum/i.test(error.message ?? '') ? 'This property has reached the 10-photo limit. Check photo status.' : 'The photo change was rejected. Check your access and photo limits.');

export function createPropertyPhotoService(getClient: () => SupabaseClient<Database>, journal: Journal, device: PhotoDevice) {
  const key = (c: PhotoContext) => `rentlease:property-photos:${c.ownerId}:${c.propertyId}`;
  const context = async (propertyId: string): Promise<PhotoContext> => {
    if (!isPropertyUuid(propertyId)) throw new PropertyPhotoError('Save a real property before adding photos.');
    const client = getClient();
    const { data: auth, error } = await client.auth.getUser();
    if (error || !auth.user) throw new PropertyPhotoError('Sign in again to manage property photos.');
    const { data: property, error: readError } = await client.from('properties').select('id,landlord_id').eq('id', propertyId).eq('landlord_id', auth.user.id).maybeSingle();
    if (readError || !property || property.landlord_id !== auth.user.id) throw new PropertyPhotoError('This property is unavailable for photo management.');
    return { ownerId: auth.user.id, propertyId };
  };
  const assertContext = async (c: PhotoContext) => {
    const current = await context(c.propertyId);
    if (current.ownerId !== c.ownerId) throw new PropertyPhotoError('Your account changed. Reopen property photos.');
  };
  const bucket = () => getClient().storage.from(PROPERTY_PHOTO_BUCKET);
  const list = async (c: PhotoContext): Promise<PropertyPhoto[]> => {
    await assertContext(c);
    const { data, error } = await getClient().from('property_photos').select(columns).eq('property_id', c.propertyId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true });
    await assertContext(c);
    if (error || !data) throw new PropertyPhotoError('Could not load saved photos. Check your connection.');
    return orderedPropertyPhotos(data).map(row => {
      const path = propertyPhotoObjectPath(row.storage_path, c.ownerId, c.propertyId, row.id);
      return { ...row, publicUrl: bucket().getPublicUrl(path).data.publicUrl };
    });
  };
  const find = async (c: PhotoContext, id: string): Promise<PropertyPhotoRow | null> => {
    await assertContext(c);
    const { data, error } = await getClient().from('property_photos').select(columns).eq('property_id', c.propertyId).eq('id', id).maybeSingle();
    await assertContext(c); if (error) throw uncertain(); return data;
  };
  const readPending = async (c: PhotoContext): Promise<PendingPhoto | null> => {
    const value = await journal.getItem(key(c)); if (!value) return null;
    let pending: PendingPhoto;
    try { pending = JSON.parse(value); } catch { throw uncertain(); }
    if (!pending || !['upload', 'delete', 'cleanup'].includes(pending.kind) || !isPropertyUuid(pending.photoId)) throw uncertain();
    propertyPhotoObjectPath(pending.path, c.ownerId, c.propertyId, pending.photoId);
    return pending;
  };
  const lock = async <T>(c: PhotoContext, action: () => Promise<T>, recovery = false): Promise<T> => {
    const k = key(c); if (inFlight.has(k)) throw uncertain(); inFlight.add(k);
    try { await assertContext(c); if (!recovery && await readPending(c)) throw uncertain(); return await action(); }
    finally { inFlight.delete(k); }
  };
  const removeObject = async (c: PhotoContext, pending: PendingPhoto) => {
    await assertContext(c);
    const path = propertyPhotoObjectPath(pending.path, c.ownerId, c.propertyId, pending.photoId);
    const { error } = await bucket().remove([path]);
    if (error) throw new PropertyPhotoError('Photo cleanup is incomplete. Check photo status to retry removal.', true);
    await assertContext(c); await journal.removeItem(key(c));
  };
  const deleteRecord = async (c: PhotoContext, id: string) => {
    await assertContext(c);
    const { error } = await getClient().from('property_photos').delete().eq('property_id', c.propertyId).eq('id', id).select('id');
    if (error) throw uncertain();
    if (await find(c, id)) throw new PropertyPhotoError('The photo could not be removed. Check your access.', true);
  };
  const cover = async (c: PhotoContext, id: string) => {
    if (!await find(c, id)) throw new PropertyPhotoError('This photo is no longer available.');
    await assertContext(c);
    const { error } = await getClient().rpc('set_property_cover_photo', { p_photo_id: id });
    await assertContext(c); if (error) throw new PropertyPhotoError('Cover change could not be confirmed. Check photo status.', true);
  };
  return {
    context, assertContext, list,
    hasPending: async (c: PhotoContext) => !!await readPending(c),
    async upload(c: PhotoContext, file: SelectedDocument, altText: string) {
      return lock(c, async () => {
        const mime = validatePropertyPhoto(file);
        const existing = await list(c); if (existing.length >= MAX_PROPERTY_PHOTOS) throw new PropertyPhotoError('This property already has 10 photos.');
        const body = await device.read(file);
        if (!body.byteLength || body.byteLength > MAX_PHOTO_BYTES) throw new PropertyPhotoError('Choose a photo no larger than 10 MB.');
        const id = device.uuid(); const path = propertyPhotoPath(c.ownerId, c.propertyId, id, mime);
        await assertContext(c);
        const pending: PendingPhoto = { kind: 'upload', photoId: id, path };
        await journal.setItem(key(c), JSON.stringify(pending));
        // Unknown responses remain journaled. Never remove an object if metadata may have committed.
        const { error: uploadError } = await bucket().upload(path, body, { upsert: false, contentType: mime });
        if (uploadError) throw uncertain();
        await assertContext(c);
        const nextOrder = Math.max(-1, ...existing.map(p => p.sort_order)) + 1;
        const { data, error } = await getClient().from('property_photos').insert({ id, property_id: c.propertyId, storage_path: `${PROPERTY_PHOTO_BUCKET}/${path}`, alt_text: altText.trim() || null, sort_order: Math.min(32767, nextOrder), is_cover: false }).select(columns).single();
        if (error) {
          if (!rejected(error)) throw uncertain();
          await journal.setItem(key(c), JSON.stringify({ ...pending, kind: 'cleanup' }));
          await removeObject(c, pending); throw dbError(error);
        }
        if (!data || data.id !== id || data.property_id !== c.propertyId) throw uncertain();
        await assertContext(c); await journal.removeItem(key(c));
        if (!existing.length) await cover(c, id);
      });
    },
    async setCover(c: PhotoContext, id: string) { return lock(c, () => cover(c, id)); },
    async updateAlt(c: PhotoContext, id: string, altText: string) {
      return lock(c, async () => {
        const { data, error } = await getClient().from('property_photos').update({ alt_text: altText.trim() || null }).eq('property_id', c.propertyId).eq('id', id).select('id').maybeSingle();
        await assertContext(c); if (error || !data) throw new PropertyPhotoError('Photo description could not be confirmed. Check photo status.', true);
      });
    },
    async move(c: PhotoContext, id: string, direction: -1 | 1) {
      return lock(c, async () => {
        const photos = await list(c); const index = photos.findIndex(p => p.id === id); const target = index + direction;
        if (index < 0 || target < 0 || target >= photos.length) return;
        const moved = photos.splice(index, 1)[0]!; photos.splice(target, 0, moved);
        // No order uniqueness constraint. Sequential updates can partially succeed; always reload on failure.
        for (const [sort_order, photo] of photos.entries()) {
          await assertContext(c);
          const { data, error } = await getClient().from('property_photos').update({ sort_order }).eq('property_id', c.propertyId).eq('id', photo.id).select('id').maybeSingle();
          if (error || !data) throw new PropertyPhotoError('Photo order may be partially updated. Check photo status before continuing.', true);
        }
        await assertContext(c);
      });
    },
    async remove(c: PhotoContext, id: string) {
      return lock(c, async () => {
        const photo = await find(c, id); if (!photo) return;
        const path = propertyPhotoObjectPath(photo.storage_path, c.ownerId, c.propertyId, photo.id);
        const pending: PendingPhoto = { kind: 'delete', photoId: id, path };
        await journal.setItem(key(c), JSON.stringify(pending));
        // Confirm metadata removal before touching Storage; known namespace retained for cleanup.
        await deleteRecord(c, id); await removeObject(c, pending);
      });
    },
    async reconcile(c: PhotoContext) {
      return lock(c, async () => {
        const pending = await readPending(c); if (!pending) return;
        const photo = await find(c, pending.photoId);
        if (pending.kind === 'upload') {
          if (!photo) throw new PropertyPhotoError('Upload outcome remains unknown. Do not upload another copy. Backend outcome confirmation is needed if this persists.', true);
          propertyPhotoObjectPath(photo.storage_path, c.ownerId, c.propertyId, photo.id);
          await journal.removeItem(key(c)); return;
        }
        if (pending.kind === 'cleanup' && photo) throw uncertain();
        if (photo) await deleteRecord(c, pending.photoId);
        await removeObject(c, pending);
      }, true);
    },
  };
}
export type PropertyPhotoService = ReturnType<typeof createPropertyPhotoService>;
