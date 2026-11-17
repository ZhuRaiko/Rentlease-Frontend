import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from './supabase/database.types';
import {PROPERTY_PHOTO_BUCKET,propertyPhotoObjectPath,type PublicPropertyPhoto} from '../models/PropertyMediaPath';
export type {PublicPropertyPhoto} from '../models/PropertyMediaPath';
export interface PhotoParent {propertyId:string;ownerId:string}
const COLUMNS='id,property_id,storage_path,alt_text,sort_order,is_cover,created_at';
/**
 * One bounded RLS-protected photo query; never signs private or arbitrary paths.
 * `coverOnly` (list cards) reads just the cover row per property. A property with no usable cover row falls back to its first photo by
 * sort_order, created_at, id in one extra read, so no listing loses its image. Detail screens keep the full read.
 */
export async function readPublicPropertyPhotos(client:SupabaseClient<Database>,parents:readonly PhotoParent[],signal?:AbortSignal,limit=200,coverOnly=false){
 if(!parents.length)return [];
 const ids=[...new Set(parents.map(p=>p.propertyId))];
 const read=async(propertyIds:string[],covers:boolean,tieBreak=coverOnly)=>{
  let query=client.from('property_photos').select(COLUMNS).in('property_id',propertyIds);
  if(covers)query=query.eq('is_cover',true);
  query=query.order('is_cover',{ascending:false}).order('sort_order');
  if(tieBreak)query=query.order('created_at');
  query=query.order('id').limit(Math.min(500,covers?Math.max(propertyIds.length,1)*2:limit));
  if(signal)query=query.abortSignal(signal);
  const {data,error}=await query;if(error||!data)throw Error('Could not load rental photos.');
  return covers?data.filter(row=>row.is_cover):data;
 };
 const toPhotos=(rows:Awaited<ReturnType<typeof read>>)=>{
  const photos:{propertyId:string;photo:PublicPropertyPhoto}[]=[];
  for(const row of [...rows].sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)||a.sort_order-b.sort_order||(coverOnly?a.created_at.localeCompare(b.created_at):0)||a.id.localeCompare(b.id))){const parent=parents.find(p=>p.propertyId===row.property_id);if(!parent)continue;
   try{const path=propertyPhotoObjectPath(row.storage_path,parent.ownerId,parent.propertyId,row.id);photos.push({propertyId:row.property_id,photo:{id:row.id,url:client.storage.from(PROPERTY_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl,alt:row.alt_text}});}catch{/* Neutral fallback for invalid/foreign paths. */}
  }
  return photos;
 };
 if(!coverOnly)return toPhotos(await read(ids,false));
 const first=<T extends {propertyId:string}>(photos:T[])=>{const seen=new Set<string>();return photos.filter(p=>!seen.has(p.propertyId)&&!!seen.add(p.propertyId));};
 const covers=first(toPhotos(await read(ids,true)));
 const missing=ids.filter(id=>!covers.some(p=>p.propertyId===id));
 if(!missing.length)return covers;
 return [...covers,...first(toPhotos(await read(missing,false)))];
}
