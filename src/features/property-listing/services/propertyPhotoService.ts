import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '../../../shared/services/supabase/database.types';
import type { Database } from '../../../shared/services/supabase/database.types';
import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { isPropertyUuid } from '../models/DraftProperty';
import { MAX_PHOTO_BYTES, MAX_PROPERTY_PHOTOS, PROPERTY_PHOTO_BUCKET, PropertyPhotoError, orderedPropertyPhotos, propertyPhotoObjectPath, validatePropertyPhoto, type PropertyPhoto, type PropertyPhotoRow } from '../models/PropertyPhoto';

interface Journal { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
interface PendingPhoto { kind: 'upload' | 'delete' | 'cleanup' | 'command'; photoId: string; path: string; requestId?: string; version?: string; action?: string; args?: Json }
interface MediaReceipt { property_id: string; media_version: string; action: string; photo_id: string | null; path: string | null }
export interface PhotoContext { ownerId: string; propertyId: string }
export interface PhotoDevice { read(file: SelectedDocument): Promise<ArrayBuffer>; uuid(): string }
const inFlight = new Set<string>();
const columns = 'id,property_id,storage_path,alt_text,sort_order,is_cover,created_at';
const uncertain = () => new PropertyPhotoError('The photo operation could not be confirmed. Check photo status before making further changes.', true);
const rejected = (error: { code?: string }) => /^(22|23|40|42|P0001|PGRST202)/.test(error.code ?? '');
const dbError = (error: { code?: string; message?: string }) => new PropertyPhotoError(
  error.code === '40001' ? 'Photos changed on another device. Check saved photos before trying again.' : error.code === 'PGRST202' ? 'This feature is not available right now. Try again later. Your saved photos are retained.' : error.code === 'P0001' ? 'This change would leave an active listing incomplete. Add a replacement photo before removing this one.' : ['22023'].includes(error.code ?? '') && /10|limit|maximum/i.test(error.message ?? '') ? 'This property has reached the 10-photo limit. Check photo status.' : 'The photo change was rejected. Check your access and photo limits.');

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
  const versions = new Map<string,string>();
  const readVersion = async(c:PhotoContext, optional=false,validateIdentity=true):Promise<string|null> => {
    if(validateIdentity)await assertContext(c);
    const {data,error}=await getClient().rpc('get_property_media_state',{p_property_id:c.propertyId});
    if(optional && error?.code==='PGRST202'){versions.delete(key(c));return null;}
    if(error || !isPropertyUuid(data)) throw new PropertyPhotoError(error?.code==='PGRST202'?'This feature is not available right now. Try again later. Saved records are retained.':'Could not verify saved photos. Check your connection and access.');
    if(validateIdentity)await assertContext(c);return data;
  };
  const receipt = (value:unknown,c:PhotoContext,action:string):MediaReceipt => {
    if(!value || typeof value!=='object' || Array.isArray(value))throw uncertain();
    const r=value as Partial<MediaReceipt>;
    if(r.property_id!==c.propertyId || !isPropertyUuid(r.media_version) || r.action!==action || (r.photo_id!==null&&!isPropertyUuid(r.photo_id)) || (r.path!==null&&typeof r.path!=='string'))throw uncertain();
    if(r.photo_id&&r.path)propertyPhotoObjectPath(r.path,c.ownerId,c.propertyId,r.photo_id);
    return r as MediaReceipt;
  };
  const command = async(c:PhotoContext,action:string,args:Json,photoId=c.propertyId,path=''):Promise<MediaReceipt> => {
    await assertContext(c);
    const version=versions.get(key(c))??await readVersion(c);if(!version)throw new PropertyPhotoError('This feature is not available right now. Try again later.');
    const pending:PendingPhoto={kind:'command',photoId,path,requestId:device.uuid(),version,action,args};
    await journal.setItem(key(c),JSON.stringify(pending));
    const {data,error}=await getClient().rpc('manage_property_media',{p_property_id:c.propertyId,p_expected_version:version,p_request_id:pending.requestId!,p_action:action,p_args:args});
    await assertContext(c);
    if(error){if(rejected(error)){await journal.removeItem(key(c));if(action==='reorder_cover'&&error.code==='22023'&&/Unknown media action|Unexpected fields/.test(error.message??''))throw new PropertyPhotoError('This feature is not available right now. Try again later. Saved photos are unchanged.');throw dbError(error);}throw uncertain();}
    const r=receipt(data,c,action);versions.set(key(c),r.media_version);
    // Caller replaces the marker or clears it only after the next safe boundary.
    return r;
  };
  const list = async (c: PhotoContext): Promise<PropertyPhoto[]> => {
    const started=Date.now();let result='error';try{
    await assertContext(c);
    const before=await readVersion(c,true,false);
    const { data, error } = await getClient().from('property_photos').select(columns).eq('property_id', c.propertyId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true });
    if (error || !data) throw new PropertyPhotoError('Could not load saved photos. Check your connection.');
    const after=await readVersion(c,true,false);await assertContext(c);if(before!==after)throw new PropertyPhotoError('Photos changed while loading. Check saved photos again.');if(after)versions.set(key(c),after);
    result='success';return orderedPropertyPhotos(data).map(row => {
      const path = propertyPhotoObjectPath(row.storage_path, c.ownerId, c.propertyId, row.id);
      return { ...row, publicUrl: bucket().getPublicUrl(path).data.publicUrl };
    });
    }finally{if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[PHOTO-PERF]',{stage:'metadata',durationMs:Date.now()-started,result,requests:7});}
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
    if (!pending || !['upload', 'delete', 'cleanup', 'command'].includes(pending.kind) || !isPropertyUuid(pending.photoId)) throw uncertain();
    if(pending.path)propertyPhotoObjectPath(pending.path, c.ownerId, c.propertyId, pending.photoId);
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
  const cleanup = async(c:PhotoContext,pending:PendingPhoto) => {
    const version=await readVersion(c);if(!version)throw uncertain();versions.set(key(c),version);
    try{await command(c,'cancel',{photo_id:pending.photoId},pending.photoId,pending.path);}
    catch(error){
      if(error instanceof PropertyPhotoError&&!error.reconcile)await journal.setItem(key(c),JSON.stringify({...pending,kind:'cleanup'}));
      throw error;
    }
    await journal.setItem(key(c),JSON.stringify({...pending,kind:'cleanup'}));
    await removeObject(c,pending);
  };
  const change = async(c:PhotoContext,action:string,args:Json,id=c.propertyId,path='') => {
    await command(c,action,args,id,path);await journal.removeItem(key(c));
  };
  return {
    context, assertContext, list,
    hasPending: async (c: PhotoContext) => !!await readPending(c),
    async upload(c:PhotoContext,file:SelectedDocument,altText:string){
      return lock(c,async()=>{
        const mime=validatePropertyPhoto(file),existing=await list(c);
        if(existing.length>=MAX_PROPERTY_PHOTOS)throw new PropertyPhotoError('This property already has 10 photos.');
        const body=await device.read(file);if(!body.byteLength||body.byteLength>MAX_PHOTO_BYTES)throw new PropertyPhotoError('Choose a photo no larger than 10 MB.');
        const reserved=await command(c,'reserve',{mime});
        if(!reserved.photo_id||!reserved.path)throw uncertain();
        const pending:PendingPhoto={kind:'upload',photoId:reserved.photo_id,path:reserved.path};
        await journal.setItem(key(c),JSON.stringify(pending));
        const {error}=await bucket().upload(pending.path,body,{upsert:false,contentType:mime});
        if(error)throw uncertain();await assertContext(c);
        try{await command(c,'register',{photo_id:pending.photoId,alt_text:altText.trim()||null},pending.photoId,pending.path);}
        catch(error){if(error instanceof PropertyPhotoError&&!error.reconcile){await journal.setItem(key(c),JSON.stringify({...pending,kind:'cleanup'}));await cleanup(c,pending);}throw error;}
        await journal.removeItem(key(c));
      });
    },
    async setCover(c:PhotoContext,id:string){return lock(c,async()=>{if(!await find(c,id))throw new PropertyPhotoError('This photo is no longer available.');await change(c,'cover',{photo_id:id},id);});},
    async updateAlt(c:PhotoContext,id:string,altText:string){return lock(c,()=>change(c,'alt',{photo_id:id,alt_text:altText.trim()||null},id));},
    async move(c:PhotoContext,id:string,direction:-1|1){return lock(c,async()=>{
      // Preserve the version of the editor snapshot; do not silently adopt another writer's order.
      const version=versions.get(key(c));const photos=await list(c);if(version&&version!==versions.get(key(c)))throw new PropertyPhotoError('Photos changed. Review the saved order before trying again.');
      const index=photos.findIndex(p=>p.id===id),target=index+direction;if(index<0||target<0||target>=photos.length)return;
      photos.splice(target,0,photos.splice(index,1)[0]!);await change(c,'reorder',{photo_ids:photos.map(p=>p.id)});
    });},
    async reorder(c:PhotoContext,ids:string[]){return lock(c,async()=>{
      if(new Set(ids).size!==ids.length||ids.some(id=>!isPropertyUuid(id)))throw new PropertyPhotoError('Check the saved photo order.');
      await change(c,'reorder_cover',{photo_ids:ids});
    });},
    async remove(c:PhotoContext,id:string){return lock(c,async()=>{
      const photo=await find(c,id);if(!photo)return;
      const path=propertyPhotoObjectPath(photo.storage_path,c.ownerId,c.propertyId,id);
      await command(c,'remove',{photo_id:id},id,path);
      const pending:PendingPhoto={kind:'cleanup',photoId:id,path};await journal.setItem(key(c),JSON.stringify(pending));await removeObject(c,pending);
    });},
    async reconcile(c:PhotoContext){return lock(c,async()=>{
      const pending=await readPending(c);if(!pending)return;
      if(pending.kind==='command'&&pending.requestId&&pending.action){
        const {data,error}=await getClient().rpc('get_property_media_operation',{p_property_id:c.propertyId,p_request_id:pending.requestId});
        await assertContext(c);if(error||!data)throw uncertain();
        const r=receipt(data,c,pending.action);versions.set(key(c),r.media_version);
        if(r.action==='reserve'&&r.photo_id&&r.path){await cleanup(c,{kind:'cleanup',photoId:r.photo_id,path:r.path});return;}
        if(['remove','cancel'].includes(r.action)&&r.photo_id&&r.path){await journal.setItem(key(c),JSON.stringify({kind:'cleanup',photoId:r.photo_id,path:r.path}));await removeObject(c,{kind:'cleanup',photoId:r.photo_id,path:r.path});return;}
        await journal.removeItem(key(c));return;
      }
      const photo=await find(c,pending.photoId);
      if(pending.kind==='upload'){
        if(photo){propertyPhotoObjectPath(photo.storage_path,c.ownerId,c.propertyId,photo.id);await journal.removeItem(key(c));return;}
        // Cancel exact reservation under the server gate before cleanup. A late register cannot commit afterward.
        await cleanup(c,pending);return;
      }
      if(pending.kind==='delete'&&photo){await command(c,'remove',{photo_id:pending.photoId},pending.photoId,pending.path);}
      else if(photo)throw uncertain();
      if(pending.kind==='cleanup')await cleanup(c,pending);else await removeObject(c,pending);
    },true);},
  };
}
export type PropertyPhotoService = ReturnType<typeof createPropertyPhotoService>;
