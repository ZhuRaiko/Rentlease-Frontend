import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { MAX_PANORAMA_BYTES, PROPERTY_PANORAMA_BUCKET, propertyPanoramaObjectPath, propertyPanoramaPath, type PanoramaSide, type PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';
import { panoramaClient } from '../../../shared/services/propertyPanoramaClient';
import { readPublicPropertyPanoramas } from '../../../shared/services/publicPropertyPanoramas';
import { isPropertyUuid } from '../models/DraftProperty';
import { validatePanoramaAsset, type PanoramaAsset, type PanoramaProblem } from '../models/PropertyPanoramaSelection';

export interface PanoramaContext { ownerId: string; propertyId: string }
export interface PanoramaDevice { read(uri: string): Promise<ArrayBuffer>; uuid(): string }
/** `kind` is what the owner can act on; the message is already safe to show. */
export class PropertyPanoramaError extends Error { constructor(readonly kind: PanoramaProblem | 'remove' | 'context', message: string) { super(message); } }

const inFlight = new Set<string>();
const unavailable = 'This feature is not available right now. Try again later.';
/** Maps a set_property_panorama failure to a tile problem. Messages come from the backend contract; anything else is a plain upload failure. */
function setProblem(error: { code?: string; message?: string }): PanoramaProblem {
  if (error.code === '22023' && error.message === 'Panorama must be at least 3:1 wide') return 'aspect';
  if (error.code === '22023' && error.message === 'Panorama is too wide') return 'width';
  return 'upload';
}

export function createPropertyPanoramaService(getClient: () => SupabaseClient<Database>, device: PanoramaDevice) {
  const context = async (propertyId: string): Promise<PanoramaContext> => {
    if (!isPropertyUuid(propertyId)) throw new PropertyPanoramaError('context', 'Save the property before adding a room tour.');
    const client = getClient();
    const { data: auth, error } = await client.auth.getUser();
    if (error || !auth.user) throw new PropertyPanoramaError('context', 'Sign in again to manage the room tour.');
    const { data: property, error: readError } = await client.from('properties').select('id,landlord_id').eq('id', propertyId).eq('landlord_id', auth.user.id).maybeSingle();
    if (readError || !property || property.landlord_id !== auth.user.id) throw new PropertyPanoramaError('context', 'This property is unavailable for a room tour.');
    return { ownerId: auth.user.id, propertyId };
  };
  const assertContext = async (c: PanoramaContext) => {
    if ((await context(c.propertyId)).ownerId !== c.ownerId) throw new PropertyPanoramaError('context', 'Your account changed. Reopen the property.');
  };
  const bucket = () => panoramaClient(getClient()).storage.from(PROPERTY_PANORAMA_BUCKET);
  /** Best effort: a file that cannot be deleted is left behind, never an error for the owner. Only a path confirmed for this owner and property is ever deleted. */
  const discard = async (c: PanoramaContext, path: unknown) => {
    try { await bucket().remove([propertyPanoramaObjectPath(path, c.ownerId, c.propertyId)]); } catch { /* ignored on purpose */ }
  };
  const list = async (c: PanoramaContext, signal?: AbortSignal): Promise<PublicPropertyPanorama[]> => {
    await assertContext(c);
    try { return await readPublicPropertyPanoramas(getClient(), c, signal); }
    catch { throw new PropertyPanoramaError('context', 'Could not load the room tour. Check your connection.'); }
  };
  // A function declaration, not a generic arrow: some test loaders compile .ts with JSX on, where `<T>(` would be read as a tag.
  async function lock<T>(c: PanoramaContext, work: () => Promise<T>): Promise<T> {
    const key = `${c.ownerId}:${c.propertyId}`;
    if (inFlight.has(key)) throw new PropertyPanoramaError('upload', 'Another room tour change is still running.');
    inFlight.add(key);
    try { return await work(); } finally { inFlight.delete(key); }
  }
  return {
    context, assertContext, list,
    /** Uploads a new object, records it for the side, then deletes the file it replaced. An existing working side is never removed by a failed upload. */
    upload: (c: PanoramaContext, side: PanoramaSide, asset: PanoramaAsset): Promise<PublicPropertyPanorama> => lock(c, async () => {
      const checked = validatePanoramaAsset(asset);
      if (!checked.ok) throw new PropertyPanoramaError(checked.problem, '');
      await assertContext(c);
      let body: ArrayBuffer;
      try { body = await device.read(asset.uri); } catch { throw new PropertyPanoramaError('unreadable', ''); }
      if (!body.byteLength) throw new PropertyPanoramaError('unreadable', '');
      if (body.byteLength > MAX_PANORAMA_BYTES) throw new PropertyPanoramaError('size', '');
      const path = propertyPanoramaPath(c.ownerId, c.propertyId, device.uuid(), checked.mime);
      const { error: uploadError } = await bucket().upload(path, body, { upsert: false, contentType: checked.mime });
      if (uploadError) throw new PropertyPanoramaError('upload', '');
      const saved = (): PublicPropertyPanorama => ({ side, url: bucket().getPublicUrl(path).data.publicUrl, width: checked.width, height: checked.height });
      let result: { data: unknown; error: { code?: string; message?: string } | null };
      try { result = await panoramaClient(getClient()).rpc('set_property_panorama', { p_property_id: c.propertyId, p_side: side, p_storage_path: path, p_width: checked.width, p_height: checked.height }); }
      catch {
        // No answer: the save may or may not have happened. Keep the file only if the row now points at it; otherwise remove it.
        try { if ((await readPublicPropertyPanoramas(getClient(), c)).some(p => p.side === side && p.url.endsWith(path))) return saved(); } catch { /* fall through */ }
        await discard(c, path);
        throw new PropertyPanoramaError('upload', '');
      }
      if (result.error) {
        // The backend refused: delete the object just uploaded BEFORE reporting, so refused saves cannot fill the 6-object folder cap.
        await discard(c, path);
        throw new PropertyPanoramaError(result.error.code === 'PGRST202' ? 'context' : setProblem(result.error), result.error.code === 'PGRST202' ? unavailable : '');
      }
      const data = result.data as { replaced_path?: unknown } | null;
      if (data && typeof data === 'object' && typeof data.replaced_path === 'string' && data.replaced_path !== path) await discard(c, data.replaced_path);
      return saved();
    }),
    /** Idempotent on the backend. The removed file is deleted afterwards, best effort. */
    remove: (c: PanoramaContext, side: PanoramaSide): Promise<void> => lock(c, async () => {
      await assertContext(c);
      let result: { data: unknown; error: { code?: string; message?: string } | null };
      try { result = await panoramaClient(getClient()).rpc('remove_property_panorama', { p_property_id: c.propertyId, p_side: side }); }
      catch { throw new PropertyPanoramaError('remove', 'Couldn’t remove it. Check your connection and try again.'); }
      if (result.error) throw new PropertyPanoramaError('remove', result.error.code === 'PGRST202' ? unavailable : 'Couldn’t remove it. Check your connection and try again.');
      const data = result.data as { removed_path?: unknown } | null;
      if (data && typeof data === 'object' && typeof data.removed_path === 'string') await discard(c, data.removed_path);
    }),
  };
}
export type PropertyPanoramaService = ReturnType<typeof createPropertyPanoramaService>;
