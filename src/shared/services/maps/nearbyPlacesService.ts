import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../supabase/database.types';
import {parseNearbyPlacesResult,type NearbyPlacesResult} from '../../models/NearbyPlacesResponse';
import {NearbyPlacesError} from '../../models/NearbyPlacesResponse';
export function createNearbyPlacesService(client:()=>SupabaseClient<Database>){return async(actor:string,listingId:string,signal?:AbortSignal):Promise<NearbyPlacesResult>=>{
 const c=new AbortController(),abort=()=>c.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(abort,15000);
 const bounded=<T>(work:Promise<T>)=>new Promise<T>((resolve,reject)=>{const stop=()=>reject(new NearbyPlacesError('Nearby places request canceled or timed out.'));if(c.signal.aborted){stop();return;}c.signal.addEventListener('abort',stop,{once:true});work.then(resolve,reject).finally(()=>c.signal.removeEventListener('abort',stop));});
 const identity=async()=>{const result=await bounded(client().auth.getUser());if(c.signal.aborted||result.error||result.data.user?.id!==actor)throw new NearbyPlacesError('Your account changed or the request was canceled.');};
 try{if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(listingId))throw new NearbyPlacesError('Choose an available rental.');await identity();
 const {data,error}=await bounded(client().functions.invoke('nearby-places',{body:{listingId},signal:c.signal}));await identity();
 if(error){let code='';try{const body=await error.context?.clone().json();code=body?.error?.code??'';}catch{}throw new NearbyPlacesError(code==='missing_public_location'?'This rental has no usable public location.':code==='rate_limited'?'Nearby places are rate limited. Wait before retrying.':code==='timeout'?'Nearby places timed out. Retry later.':code==='invalid_response'||code==='size_limit'?'Nearby places returned unreadable data. Retry later.':'Nearby places are temporarily unavailable. Retry later.',code==='rate_limited'?'rate_limit':code==='timeout'?'timeout':code==='invalid_response'||code==='size_limit'?'response':'unavailable');}
 try{return parseNearbyPlacesResult(data,listingId);}catch{throw new NearbyPlacesError('Nearby places returned unreadable data. Retry later.');}
 }catch(e){throw e instanceof NearbyPlacesError?e:new NearbyPlacesError(c.signal.aborted?'Nearby places request canceled or timed out.':'Nearby places are temporarily unavailable. Retry later.');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
};}
