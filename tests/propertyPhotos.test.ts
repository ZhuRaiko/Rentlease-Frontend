/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import type { SelectedDocument } from '../src/shared/models/SelectedDocument';
import { MAX_PHOTO_BYTES, PropertyPhotoError, orderedPropertyPhotos, propertyPhotoObjectPath, propertyPhotoPath, validatePropertyPhoto, type PropertyPhotoRow } from '../src/features/property-listing/models/PropertyPhoto';
import { createPropertyPhotoService, type PhotoContext } from '../src/features/property-listing/services/propertyPhotoService';
import { createPropertyPhotoWorkflow } from '../src/features/property-listing/viewModels/propertyPhotoWorkflow';
const owner = '10000000-0000-4000-8000-000000000001', property = '20000000-0000-4000-8000-000000000001', photoId = '30000000-0000-4000-8000-000000000001';
const context: PhotoContext = { ownerId: owner, propertyId: property };
const file: SelectedDocument = { uri: 'file:///cache/photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg', size: 24 };
const row = (id = photoId, order = 0): PropertyPhotoRow => ({ id, property_id: property, storage_path: `property-media/${owner}/${property}/${id}.jpg`, alt_text: null, sort_order: order, is_cover: false, created_at: '2026-10-23T00:00:00Z' });
function harness() {
  let user = owner, rows: PropertyPhotoRow[] = [], error: { code: string; message: string } | null = null;
  let uploadError = false, removalError = false, refreshError = false, coverError = false, deletionError = false, storageFail = false;
  let wait: Promise<void> | null = null, bytes = 24, pickerCount = 0, pickResult: SelectedDocument | null = file;
  const journal = new Map<string, string>(), calls: { name: string; value: unknown }[] = [];
  let unavailableContract=false;let unknownReceipt=false;let cancelConflict=false;let reorderUnavailable=false;
  let serial=1;const receipts=new Map<string,unknown>();let mediaVersion='50000000-0000-4000-8000-000000000001';
  const client = {
    auth: { getUser: async () => {calls.push({name:'request:auth',value:null});return { data: { user: user ? { id: user } : null }, error: null };} },
    from(table: string) {
      let operation = 'read', payload: Record<string, unknown> = {}, filters: Record<string, unknown> = {};
      const execute = async () => {
        if(table==='properties')calls.push({name:'request:property',value:null});
        if(table==='property_photos'&&operation==='read')calls.push({name:'request:metadata',value:null});
        if (table === 'properties') return { data: user === owner ? { id: property, landlord_id: owner } : null, error: null };
        const matches = (p: PropertyPhotoRow) => Object.entries(filters).every(([k, v]) => p[k as keyof PropertyPhotoRow] === v);
        if (operation === 'insert') { calls.push({ name: 'insert', value: payload }); if (error) return { data: null, error }; rows.push({ ...row(), ...payload } as PropertyPhotoRow); return { data: rows.at(-1), error: null }; }
        if (operation === 'delete') { calls.push({ name: 'delete', value: filters }); if (deletionError) return { data: null, error: { code: '', message: 'private details' } }; rows = rows.filter(p => !matches(p)); return { data: [], error: null }; }
        if (operation === 'update') { calls.push({ name: 'update', value: payload }); rows = rows.map(p => matches(p) ? { ...p, ...payload } : p); return { data: rows.find(matches) ?? null, error: null }; }
        if (refreshError) return { data: null, error: { message: 'private failure' } };
        return { data: rows.filter(matches), error: null };
      };
      const query = {
        select: (_: string) => query, eq: (k: string, v: unknown) => { filters[k] = v; return query; },
        order: (k: string, _: unknown) => { calls.push({ name: 'order', value: k }); return query; },
        insert: (p: Record<string, unknown>) => { operation = 'insert'; payload = p; return query; },
        update: (p: Record<string, unknown>) => { operation = 'update'; payload = p; return query; },
        delete: () => { operation = 'delete'; return query; },
        single: () => execute(),
        maybeSingle: async () => { const r = await execute(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }; },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => execute().then(resolve, reject),
      }; return query;
    },
    rpc: async(name:string,args:any)=>{
      calls.push({name,value:args});
      if(name==='get_property_media_state'&&unavailableContract)return {data:null,error:{code:'PGRST202'}};
      if(name==='get_property_media_state')return {data:mediaVersion,error:null};
      if(name==='get_property_media_operation'&&unknownReceipt)return {data:null,error:null};
      if(name==='get_property_media_operation')return {data:receipts.get(args.p_request_id)??null,error:null};
      assert.equal(name,'manage_property_media');const action=args.p_action,p=args.p_args;
      if(action==='reorder_cover'&&reorderUnavailable)return {data:null,error:{code:'22023',message:'Unexpected fields'}};
      if(action==='register'&&error&&error.code)return {data:null,error};
      if(action==='cancel'&&cancelConflict)return {data:null,error:{code:'40001',message:'stale'}};
      let path:string|null=null,id:string|null=p.photo_id??null;
      if(action==='reserve'){id=photoId;path=`${owner}/${property}/${photoId}.jpg`;}
      if(action==='register')rows.push({...row(),alt_text:p.alt_text,is_cover:!rows.length,sort_order:Math.max(-1,...rows.map(r=>r.sort_order))+1});
      if(action==='cover')rows=rows.map(r=>({...r,is_cover:r.id===p.photo_id}));
      if(action==='alt')rows=rows.map(r=>r.id===p.photo_id?{...r,alt_text:p.alt_text}:r);
      if(action==='reorder'||action==='reorder_cover')rows=rows.map(r=>({...r,sort_order:p.photo_ids.indexOf(r.id),is_cover:p.photo_ids[0]===r.id}));
      if(action==='remove'){path=`${owner}/${property}/${p.photo_id}.jpg`;rows=rows.filter(r=>r.id!==p.photo_id);}
      mediaVersion=`50000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
      const result={property_id:property,media_version:mediaVersion,action,photo_id:id,path};receipts.set(args.p_request_id,result);
      if((action==='register'&&(coverError||error))||(action==='cover'&&coverError)||(action==='remove'&&deletionError))return {data:null,error:{code:'',message:'reply lost'}};
      return {data:result,error:null};
    },
    storage: { from: (bucket: string) => { assert.equal(bucket, 'property-media'); return {
      getPublicUrl: (path: string) => { calls.push({ name: 'url', value: path }); return { data: { publicUrl: `https://example.invalid/${path}` } }; },
      upload: async (path: string, body: ArrayBuffer, options: unknown) => { calls.push({ name: 'upload', value: { path, length: body.byteLength, options } }); if (wait) await wait; return { data: { path }, error: uploadError ? { message: 'unknown response' } : null }; },
      remove: async (paths: string[]) => { calls.push({ name: 'removeObject', value: paths }); return { error: removalError ? { message: 'private cleanup failure' } : null }; },
    }; } },
  } as unknown as SupabaseClient<Database>;
  const service = createPropertyPhotoService(() => client, { getItem: async k => journal.get(k) ?? null, setItem: async (k, v) => { if (storageFail) throw Error('private disk error'); journal.set(k, v); }, removeItem: async k => { journal.delete(k); } }, { uuid: () => `60000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`, read: async () => new ArrayBuffer(bytes) });
  const flow = createPropertyPhotoWorkflow(service, async () => { pickerCount++; return pickResult; });
  const ready = async () => { flow.setProperty(property); await flow.load(); };
  return { reorderUnavailable:()=>{reorderUnavailable=true;}, cancelConflict:()=>{cancelConflict=true;}, unavailable:()=>{unavailableContract=true;}, unknownReceipt:()=>{unknownReceipt=true;}, service, flow, ready, calls, journal, rows: () => rows, setRows: (r: PropertyPhotoRow[]) => { rows = r; }, setUser: (u: string) => { user = u; }, setError: (e: typeof error) => { error = e; }, uploadFail: (v: boolean) => { uploadError = v; }, removeFail: (v: boolean) => { removalError = v; }, refreshFail: (v: boolean) => { refreshError = v; }, coverFail: (v: boolean) => { coverError = v; }, deleteFail: (v: boolean) => { deletionError = v; }, journalFail: () => { storageFail = true; }, bytes: (v: number) => { bytes = v; }, delay: (v: Promise<void>) => { wait = v; }, picks: () => pickerCount, pickResult: (v: SelectedDocument | null) => { pickResult = v; } };
}
const callsOf = (h: ReturnType<typeof harness>, name: string) => h.calls.filter(c => c.name === name);

test('photo namespace uses owner/property/photo UUID with no duplicate bucket prefix', () => {
  const path = propertyPhotoPath(owner, property, photoId, 'image/jpeg');
  assert.equal(path, `${owner}/${property}/${photoId}.jpg`);
  assert.equal(propertyPhotoObjectPath(`property-media/${path}`, owner, property, photoId), path);
  assert.equal(propertyPhotoObjectPath(path, owner, property, photoId), path);
  assert.equal(propertyPhotoObjectPath(path.replace(/\.jpg$/, '.jpeg'), owner, property, photoId), path.replace(/\.jpg$/, '.jpeg'));
  assert.throws(() => propertyPhotoObjectPath(`property-media/property-media/${path}`, owner, property, photoId));
  assert.throws(() => propertyPhotoObjectPath(`other/${property}/${photoId}.jpg`, owner, property, photoId));
  assert.throws(() => propertyPhotoPath(owner, 'preview-id', photoId, 'image/jpeg'));
});
test('ordinary photos accept only JPEG PNG WebP and reject unknown MIME, videos and oversize metadata', () => {
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(validatePropertyPhoto({ ...file, mimeType }), mimeType);
  for (const mimeType of [null, 'video/mp4', 'image/heic', 'application/pdf', 'image/svg+xml', 'toString']) assert.throws(() => validatePropertyPhoto({ ...file, mimeType }));
  assert.throws(() => validatePropertyPhoto({ ...file, size: MAX_PHOTO_BYTES + 1 }));
  assert.equal(validatePropertyPhoto({ ...file, size: MAX_PHOTO_BYTES }), 'image/jpeg');
});
test('actual binary size is validated even if picker metadata is absent or misleading', async () => {
  for (const size of [0, MAX_PHOTO_BYTES + 1]) { const h = harness(); h.bytes(size); await assert.rejects(h.service.upload(context, { ...file, size: null }, '')); assert.equal(callsOf(h, 'upload').length, 0); }
});
test('upload requires a persisted owned UUID and non-owner errors expose no raw details', async () => {
  const h = harness(); await assert.rejects(h.service.context('sample-property')); h.setUser('another');
  await assert.rejects(h.service.upload(context, file, ''), /unavailable/); assert.equal(callsOf(h, 'upload').length, 0);
});
test('upload sends ArrayBuffer and upsert false; atomic registration assigns the first cover', async () => {
  const h = harness(); await h.service.upload(context, file, ' Bedroom ');
  assert.deepEqual(callsOf(h, 'upload')[0]?.value, { path: `${owner}/${property}/${photoId}.jpg`, length: 24, options: { upsert: false, contentType: 'image/jpeg' } });
  assert.deepEqual((callsOf(h,'manage_property_media').find(c=>(c.value as any).p_action==='register')?.value as any).p_args,{photo_id:photoId,alt_text:'Bedroom'});
  assert.equal(h.rows()[0]?.is_cover,true); assert.equal(h.journal.size, 0);
});
test('subsequent uploads preserve the current cover and append after persisted order', async () => {
  const h = harness(); h.setRows([{ ...row('40000000-0000-4000-8000-000000000001', 4), is_cover: true }]);
  await h.service.upload(context, file, ''); assert.equal(h.rows()[1]?.sort_order, 5); assert.equal(callsOf(h, 'set_property_cover_photo').length, 0);
});
test('ten persisted photos disable the picker and prevent a service upload', async () => {
  const h = harness(); h.setRows(Array.from({ length: 10 }, () => row())); await h.ready(); await h.flow.select();
  assert.equal(h.picks(), 0); await assert.rejects(h.service.upload(context, file, ''), /10 photos/); assert.equal(callsOf(h, 'upload').length, 0);
});
test('backend serialized photo-limit rejection is normalized and safely compensates Storage', async () => {
  const h = harness(); h.setError({ code: '22023', message: 'A property may have at most 10 photos' });
  await assert.rejects(h.service.upload(context, file, ''), /10-photo limit/);
  assert.equal(callsOf(h, 'removeObject').length, 1); assert.equal(h.rows().length, 0); assert.equal(h.journal.size, 0);
});
test('photo list is deterministic, uses actual public URL mechanism and strips metadata bucket prefix', async () => {
  const h = harness(); h.setRows([row('40000000-0000-4000-8000-000000000001', 3), row()]);
  const result = await h.service.list(context); assert.equal(result[0]?.id, photoId);
  assert.deepEqual(callsOf(h, 'order').map(c => c.value), ['sort_order', 'created_at', 'id']);
  assert.ok(callsOf(h, 'url').every(c => !(c.value as string).startsWith('property-media/')));
  assert.equal(orderedPropertyPhotos([{ ...row(), created_at: '2026-10-24' }, row()])[0]?.created_at, '2026-10-23T00:00:00Z');
});
test('picking is local only; upload needs a separate explicit action', async () => {
  const h = harness(); await h.ready(); await h.flow.select(); assert.equal(h.flow.getSnapshot().selected?.uri, file.uri);
  assert.equal(callsOf(h, 'upload').length, 0); assert.equal(callsOf(h, 'insert').length, 0);
  await h.flow.upload(); assert.equal(h.flow.getSnapshot().photos.length, 1); assert.equal(h.flow.getSnapshot().selected, null);
});
test('cancelling the picker preserves the current local selection', async () => {
  const h = harness(); await h.ready(); await h.flow.select(); h.pickResult(null); await h.flow.select(); assert.equal(h.flow.getSnapshot().selected?.uri, file.uri);
});
test('rapid upload taps cannot run concurrent duplicate writes', async () => {
  const h = harness(); await h.ready(); await h.flow.select(); let release!: () => void; h.delay(new Promise<void>(resolve => { release = resolve; }));
  const first = h.flow.upload(); await h.flow.upload(); release(); await first; assert.equal(callsOf(h, 'upload').length, 1);
});
test('service also blocks duplicate upload from another workflow in the same process', async () => {
  const h = harness(); let release!: () => void; h.delay(new Promise<void>(resolve => { release = resolve; }));
  const first = h.service.upload(context, file, ''); await assert.rejects(h.service.upload(context, file, '')); release(); await first; assert.equal(callsOf(h, 'upload').length, 1);
});
test('uncertain Storage response blocks blind retry; explicit reconciliation cancels exact reservation before cleanup', async () => {
  const h = harness(); h.uploadFail(true); await assert.rejects(h.service.upload(context, file, ''));
  await assert.rejects(h.service.upload(context, file, '')); await h.service.reconcile(context);
  assert.equal(callsOf(h, 'upload').length, 1); assert.equal(callsOf(h, 'insert').length, 0); assert.equal(callsOf(h, 'removeObject').length, 1); assert.equal(h.journal.size, 0);
});
test('uncertain metadata response never deletes possibly registered Storage and reconciles by known photo ID', async () => {
  const h = harness(); h.setError({ code: '', message: 'response lost' }); await assert.rejects(h.service.upload(context, file, ''));
  assert.equal(callsOf(h, 'removeObject').length, 0); h.setRows([row()]); await h.service.reconcile(context); assert.equal(h.journal.size, 0);
  assert.equal(callsOf(h, 'upload').length, 1);
});
test('known metadata rejection attempts cleanup; failed cleanup can be explicitly resumed', async () => {
  const h = harness(); h.setError({ code: '42501', message: 'secret RLS details' }); h.removeFail(true);
  await assert.rejects(h.service.upload(context, file, ''), /cleanup/); assert.equal(h.journal.size, 1);
  h.removeFail(false); await h.service.reconcile(context); assert.equal(h.journal.size, 0); assert.equal(callsOf(h, 'upload').length, 1);
});
test('refresh failure after confirmed upload never reports success or reuploads the selection', async () => {
  const h = harness(); await h.ready(); await h.flow.select();
  // Cover failure occurs after metadata committed, and requires status reconciliation.
  h.coverFail(true); await h.flow.upload(); assert.equal(h.flow.getSnapshot().needsReconcile, true); assert.equal(h.flow.getSnapshot().notice, null);
  await h.flow.upload(); assert.equal(callsOf(h, 'upload').length, 1);
  h.coverFail(false); await h.flow.checkStatus(); assert.equal(h.flow.getSnapshot().photos.length, 1); assert.equal(h.flow.getSnapshot().selected, null);
});
test('cover UI changes only after RPC confirmation and authoritative reload', async () => {
  const h = harness(); h.setRows([row()]); await h.ready(); h.coverFail(true); await h.flow.setCover(photoId);
  assert.equal(h.flow.getSnapshot().photos[0]?.is_cover, false); assert.equal(h.flow.getSnapshot().needsReconcile, true);
  h.coverFail(false); await h.flow.checkStatus(); await h.flow.setCover(photoId); assert.equal(h.flow.getSnapshot().photos[0]?.is_cover, true);
});
test('atomic order command sends exact photo IDs and alt command touches only permitted text', async () => {
  const h = harness(); const other = '40000000-0000-4000-8000-000000000001'; h.setRows([row(), row(other, 7)]);
  await h.service.move(context, other, -1); const photos = await h.service.list(context); assert.deepEqual(photos.map(p => [p.id, p.sort_order]), [[other, 0], [photoId, 1]]);
  await h.service.updateAlt(context, photoId, ' Window '); assert.equal(h.rows().find(p => p.id === photoId)?.alt_text, 'Window');
  assert.ok(callsOf(h, 'update').every(c => Object.keys(c.value as object).every(k => ['sort_order', 'alt_text'].includes(k))));
});
test('deletion confirms versioned metadata removal before deleting exact known Storage object', async () => {
  const h = harness(); h.setRows([{ ...row(), is_cover: true }]); await h.service.remove(context, photoId);
  assert.equal(h.rows().length, 0); assert.ok(h.calls.findIndex(c => c.name === 'manage_property_media' && (c.value as any).p_action==='remove') < h.calls.findIndex(c => c.name === 'removeObject'));
  assert.deepEqual(callsOf(h, 'removeObject')[0]?.value, [`${owner}/${property}/${photoId}.jpg`]); assert.equal(callsOf(h, 'set_property_cover_photo').length, 0);
});
test('failed Storage deletion remains recoverable across reopen and is not hidden', async () => {
  const h = harness(); h.setRows([row()]); h.removeFail(true); await assert.rejects(h.service.remove(context, photoId), /cleanup/);
  assert.equal(h.rows().length, 0); assert.equal(h.journal.size, 1); h.removeFail(false); await h.service.reconcile(context); assert.equal(h.journal.size, 0);
});
test('uncertain metadata deletion never removes the image until record absence is confirmed', async () => {
  const h = harness(); h.setRows([row()]); h.deleteFail(true); await assert.rejects(h.service.remove(context, photoId));
  assert.equal(callsOf(h, 'removeObject').length, 0); h.deleteFail(false); await h.service.reconcile(context); assert.equal(h.rows().length, 0); assert.equal(h.journal.size, 0);
});
test('photo deletion requires confirmation and Android Back dismisses confirmation first', async () => {
  const h = harness(); h.setRows([row()]); await h.ready(); h.flow.requestRemove(photoId); assert.equal(callsOf(h, 'delete').length, 0);
  assert.equal(h.flow.back(), true); assert.equal(h.flow.getSnapshot().removeId, null); await h.flow.confirmRemove(); assert.equal(callsOf(h, 'delete').length, 0);
  h.flow.requestRemove(photoId); await h.flow.confirmRemove(); assert.equal(h.flow.getSnapshot().photos.length, 0);
});
test('no UUID means no picker/upload and invalidating workflow clears local state', async () => {
  const h = harness(); await h.flow.select(); await h.flow.upload(); assert.equal(h.picks(), 0);
  await h.ready(); await h.flow.select(); assert.equal(h.flow.dirty(), true); h.flow.setProperty(null); assert.equal(h.flow.getSnapshot().selected, null);
});
test('old account and disposed workflows cannot populate state from delayed upload results', async () => {
  for (const change of ['account', 'dispose', 'property']) {
    const h = harness(); await h.ready(); await h.flow.select(); let release!: () => void; h.delay(new Promise<void>(resolve => { release = resolve; }));
    const pending = h.flow.upload();
    // Wait until Storage is actually in flight before invalidating.
    while (!callsOf(h, 'upload').length) await new Promise<void>(resolve => setImmediate(resolve));
    if (change === 'account') h.setUser('another'); else if (change === 'dispose') h.flow.dispose(); else h.flow.setProperty(null);
    release(); await pending; assert.equal(h.flow.getSnapshot().photos.length, 0); assert.equal(h.flow.getSnapshot().selected, null);
  }
});
test('journal write failure prevents upload before a durable operation ID is recorded', async () => {
  const h = harness(); h.journalFail(); await assert.rejects(h.service.upload(context, file, '')); assert.equal(callsOf(h, 'upload').length, 0);
});
test('real photo Views have no backend calls; old sample-count behavior and teammate integrations are absent', () => {
  const source = readFileSync('src/features/property-listing/views/PropertyPhotosView.tsx', 'utf8');
  assert.doesNotMatch(source, /getSupabaseClient|\.rpc\(|\.from\(|\/services\//);
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.doesNotMatch(vm, /selectSamplePhotos|photoCount: 4/); assert.match(vm, /photoCount: photoState.photos.length/); assert.match(vm, /propertyPhotos.dirty\(\)/); assert.match(vm, /propertyPhotos.getSnapshot\(\).busy/);
  const picker = readFileSync('src/features/property-listing/services/propertyPhotoDependencies.ts', 'utf8'); assert.match(picker, /copyToCacheDirectory: true/); assert.match(picker, /multiple: false/);
  for (const path of ['models/PropertyPhoto.ts', 'services/propertyPhotoService.ts', 'services/propertyPhotoDependencies.ts', 'viewModels/propertyPhotoWorkflow.ts', 'views/PropertyPhotosView.tsx']) {
    assert.doesNotMatch(readFileSync(`src/features/property-listing/${path}`, 'utf8'), /media_type|panorama|has_360|MapTiler|geocodeAddress|Overpass|XGBoost|expo-location|NLP/);
  }
});


test('account switching during a reload clears prior owner photos and selection', async () => {
  const h = harness(); h.setRows([row()]); await h.ready(); await h.flow.select(); h.setUser('another'); await h.flow.load();
  assert.equal(h.flow.getSnapshot().photos.length, 0); assert.equal(h.flow.getSnapshot().selected, null);
});
test('refresh failure after successful metadata and cover does not permit duplicate upload', async () => {
  const h = harness(); let failReload = false;
  const flow = createPropertyPhotoWorkflow({ ...h.service, list: async c => { if (failReload && h.rows().length) throw new PropertyPhotoError('Could not reload photos.'); return h.service.list(c); } }, async () => file);
  flow.setProperty(property); await flow.load(); await flow.select(); failReload = true;
  await flow.upload(); assert.equal(flow.getSnapshot().notice, null); assert.equal(flow.getSnapshot().selected, null); assert.equal(flow.getSnapshot().needsReconcile, true);
  await flow.upload(); assert.equal(callsOf(h, 'upload').length, 1); failReload = false; await flow.checkStatus(); assert.equal(flow.getSnapshot().photos.length, 1);
});
test('malformed or foreign photo paths cannot be deleted', async () => {
  const h = harness(); h.setRows([{ ...row(), storage_path: `property-media/other/${property}/${photoId}.jpg` }]);
  await assert.rejects(h.service.remove(context, photoId)); assert.equal(callsOf(h, 'delete').length, 0); assert.equal(callsOf(h, 'removeObject').length, 0);
});


test('temporary photo identity-read failure retains property binding and Check status can recover without writes',async()=>{
  let unavailable=false,reads=0,ownerId=owner;
  const service={context:async()=>({ownerId,propertyId:property}),assertContext:async()=>{if(unavailable)throw Error('read interrupted');},list:async()=>{reads++;return [{...row(),publicUrl:'https://example.test/photo'}];},hasPending:async()=>false};
  const flow=createPropertyPhotoWorkflow(service as any,async()=>null);flow.setProperty(property);await flow.load();assert.equal(flow.getSnapshot().photos.length,1);
  unavailable=true;await flow.load();assert.equal(flow.getSnapshot().propertyId,property);assert.equal(flow.getSnapshot().photos.length,0);assert.equal(flow.getSnapshot().needsReconcile,true);
  unavailable=false;await flow.checkStatus();assert.equal(flow.getSnapshot().propertyId,property);assert.equal(flow.getSnapshot().loaded,true);assert.equal(flow.getSnapshot().needsReconcile,false);assert.match(flow.getSnapshot().notice??'',/refreshed/);assert.ok(reads>=3);
  ownerId='another-owner';await flow.checkStatus();assert.equal(flow.getSnapshot().photos.length,0);assert.equal(flow.getSnapshot().propertyId,null);flow.dispose();
});


test('photo commands require versioned server contract, never fallback to direct metadata writes', async () => {
  const h=harness();await h.service.upload(context,file,'');
  assert.equal(callsOf(h,'insert').length,0);
  assert.ok(callsOf(h,'manage_property_media').length>=2);
});
test('cover, description and reorder use exact-target media commands', async () => {
 const h=harness();h.setRows([row(),row('40000000-0000-4000-8000-000000000001',1)]);await h.service.list(context);
 await h.service.setCover(context,photoId);await h.service.updateAlt(context,photoId,'New');await h.service.move(context,photoId,1);
 assert.equal(callsOf(h,'update').length,0);
 assert.ok(callsOf(h,'manage_property_media').length>=3);
});


test('true unknown command retains its journal and reconciliation never resends that command',async()=>{
 const h=harness();h.setRows([row()]);await h.ready();h.coverFail(true);await h.flow.setCover(photoId);
 const sent=callsOf(h,'manage_property_media').length;assert.equal(h.journal.size,1);await h.service.reconcile(context);
 assert.equal(callsOf(h,'manage_property_media').length,sent);assert.equal(h.journal.size,0);
});
test('versioned cover supplies the loaded snapshot token and exact property and photo IDs',async()=>{
 const h=harness();h.setRows([row()]);await h.service.list(context);await h.service.setCover(context,photoId);
 const p=callsOf(h,'manage_property_media')[0]?.value as any;
 assert.equal(p.p_property_id,property);assert.equal(p.p_expected_version,'50000000-0000-4000-8000-000000000001');assert.equal(p.p_args.photo_id,photoId);assert.equal(p.p_action,'cover');assert.match(p.p_request_id,/^60000000/);
});
test('published management routes editing to the shared editor and photo manager without publication or verification calls',()=>{
 const source=readFileSync('src/features/property-listing/views/PublishedListingStatusView.tsx','utf8');assert.match(source,/editManagedListing/);assert.match(source,/\['active','paused'\]/);assert.doesNotMatch(source,/navigate\('photoManager'\)/);const editor=readFileSync('src/features/property-listing/views/ListingDetailsView.tsx','utf8');assert.match(editor,/Manage Property Photos/);assert.match(editor,/navigate\('photoManager'\)/);
});

test('undeployed media contract preserves read-only saved photos but prevents new writes',async()=>{
 const h=harness();h.setRows([row()]);h.unavailable();assert.equal((await h.service.list(context)).length,1);
 await assert.rejects(h.service.setCover(context,photoId),/not available right now/);assert.equal(callsOf(h,'manage_property_media').length,0);
});
test('missing receipt after unknown command keeps journal and never retries mutation',async()=>{
 const h=harness();h.setRows([row()]);await h.ready();h.coverFail(true);await h.flow.setCover(photoId);h.unknownReceipt();const sent=callsOf(h,'manage_property_media').length;
 await assert.rejects(h.service.reconcile(context),/could not be confirmed/);assert.equal(h.journal.size,1);assert.equal(callsOf(h,'manage_property_media').length,sent);
});

test('cleanup conflict retains known immutable path rather than abandoning a reserved upload',async()=>{
 const h=harness();h.uploadFail(true);await assert.rejects(h.service.upload(context,file,''));h.cancelConflict();
 await assert.rejects(h.service.reconcile(context));assert.equal(h.journal.size,1);const pending=JSON.parse([...h.journal.values()][0]!);assert.equal(pending.kind,'cleanup');assert.equal(pending.photoId,photoId);assert.equal(callsOf(h,'removeObject').length,0);
});

test('photo metadata load brackets the read with tokens without duplicate owner checks (7 requests)',async()=>{
 const h=harness();h.setRows([row()]);await h.service.list(context);
 assert.equal(h.calls.filter(c=>c.name.startsWith('request:')||c.name==='get_property_media_state').length,7);
});

test('grid reorder sends one complete atomic reorder_cover command, never separate cover writes',async()=>{
 const h=harness(),other='40000000-0000-4000-8000-000000000001';h.setRows([row(),row(other,1)]);await h.service.list(context);await h.service.reorder(context,[other,photoId]);
 const cmds=callsOf(h,'manage_property_media');assert.equal(cmds.length,1);assert.equal((cmds[0]?.value as any).p_action,'reorder_cover');assert.deepEqual((cmds[0]?.value as any).p_args.photo_ids,[other,photoId]);assert.equal(h.rows().find(p=>p.id===other)?.is_cover,true);
});
test('old deployed backend rejects new atomic action without falling back to two unsafe commands',async()=>{
 const h=harness();h.setRows([row()]);h.reorderUnavailable();await h.service.list(context);await assert.rejects(h.service.reorder(context,[photoId]),/not available right now/);assert.equal(callsOf(h,'manage_property_media').length,1);assert.equal(h.journal.size,0);
});
