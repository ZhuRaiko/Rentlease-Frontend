import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from './supabase/database.types';
import {PROPERTY_PHOTO_BUCKET,propertyPhotoObjectPath,type PublicPropertyPhoto} from '../models/PropertyMediaPath';
export type {PublicPropertyPhoto} from '../models/PropertyMediaPath';
export interface PhotoParent {propertyId:string;ownerId:string}
/** One bounded RLS-protected photo query; never signs private or arbitrary paths. */
export async function readPublicPropertyPhotos(client:SupabaseClient<Database>,parents:readonly PhotoParent[],signal?:AbortSignal,limit=200){
 if(!parents.length)return [];
 let query=client.from('property_photos').select('id,property_id,storage_path,alt_text,sort_order,is_cover,created_at').in('property_id',[...new Set(parents.map(p=>p.propertyId))]).order('is_cover',{ascending:false}).order('sort_order').order('id').limit(Math.min(500,limit));
 if(signal)query=query.abortSignal(signal);
 const {data,error}=await query;if(error||!data)throw Error('Could not load rental photos.');
 const photos:{propertyId:string;photo:PublicPropertyPhoto}[]=[];
 for(const row of [...data].sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)||a.sort_order-b.sort_order||a.id.localeCompare(b.id))){const parent=parents.find(p=>p.propertyId===row.property_id);if(!parent)continue;
  try{const path=propertyPhotoObjectPath(row.storage_path,parent.ownerId,parent.propertyId,row.id);photos.push({propertyId:row.property_id,photo:{id:row.id,url:client.storage.from(PROPERTY_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl,alt:row.alt_text}});}catch{/* Neutral fallback for invalid/foreign paths. */}
 }
 return photos;
}
