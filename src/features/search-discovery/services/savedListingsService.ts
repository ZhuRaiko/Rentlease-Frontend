import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {readPublicPropertyPhotos} from '../../../shared/services/publicPropertyPhotos';
import {SavedError,parseSavedPage,parseSavedStates,type SavedSort,type SavedPage} from '../models/SavedListing';
export interface SavedListingsService {states(actor:string,ids:readonly string[],signal:AbortSignal):Promise<Record<string,boolean>>;page(actor:string,offset:number,sort:SavedSort,signal:AbortSignal):Promise<SavedPage>;set(actor:string,id:string,saved:boolean,signal:AbortSignal):Promise<void>}
export function createSavedListingsService(client:()=>SupabaseClient<Database>):SavedListingsService{
 const identity=async(a:string,s:AbortSignal,uncertain=false)=>{const r=await client().auth.getUser();if(s.aborted||r.error||r.data.user?.id!==a)throw new SavedError(uncertain?'Bookmark outcome is not confirmed for this account. Reopen or retry.':'Your account changed. Reopen Saved Listings.',!uncertain);};
 const fail=(error:{code?:string}|null,write=false)=>{if(error)throw new SavedError(error.code==='PGRST202'?'This feature is not available right now. Try again later.':error.code==='42501'?'Saved listing access is unavailable. Refresh.':'Saved listings could not be confirmed. Retry.',!write||['42501','22023','PGRST202'].includes(error.code??''));};
 return{
 async states(actor,ids,signal){await identity(actor,signal);if(!ids.length)return{};if(ids.length>100)throw new SavedError('Too many listing references.');const r=await client().rpc('get_saved_listing_states',{p_listing_ids:[...ids]}).abortSignal(signal);await identity(actor,signal);fail(r.error);return parseSavedStates(r.data,ids);},
 async page(actor,offset,sort,signal){await identity(actor,signal);const r=await client().rpc('get_saved_listings',{p_offset:offset,p_sort:sort}).abortSignal(signal);await identity(actor,signal);fail(r.error);const page=parseSavedPage(r.data);const parents=page.rows.flatMap(r=>r.listing?[r.listing]:[]);try{const photos=await readPublicPropertyPhotos(client(),parents,signal);await identity(actor,signal);return{...page,rows:page.rows.map(r=>({...r,listing:r.listing?{...r.listing,thumbnailUrl:photos.find(p=>p.propertyId===r.listing!.propertyId)?.photo.url??null}:null}))};}catch{await identity(actor,signal);return page;}},
 async set(actor,id,saved,signal){await identity(actor,signal);const r=await client().rpc('set_saved_listing',{p_listing_id:id,p_saved:saved}).abortSignal(signal);await identity(actor,signal,true);fail(r.error,true);const data=r.data;if(!data||typeof data!=='object'||Array.isArray(data)||data.listingId!==id||data.saved!==saved)throw new SavedError('Bookmark outcome is unknown. Retry the same action.');}
 };
}
