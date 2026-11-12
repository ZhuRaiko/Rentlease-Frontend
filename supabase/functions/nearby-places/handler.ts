import {boundedJson,geoapify,PlacesFailure,categories,radius} from './provider.ts';
import {validPoint} from '../../../src/shared/models/NearbyPlace.ts';
import {parseNearbyPlacesRows} from '../../../src/shared/models/NearbyPlacesResponse.ts';
type Config={supabaseUrl:string;anonKey:string;serviceKey:string;providerKey:string;timeoutMs?:number};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Cache-Control':'no-store'};
const reply=(status:number,code:string,retry=60)=>new Response(JSON.stringify({error:{code,message:'Nearby places are unavailable. Retry later.'}}),{status,headers:{...headers,...(status===429?{'Retry-After':String(retry)}:{})}});
export function createNearbyHandler(config:Config,http:typeof fetch=fetch){return async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,'method');const bearer=req.headers.get('authorization');if(!bearer||!/^Bearer [^\s]+$/i.test(bearer))return reply(401,'auth');
 const c=new AbortController(),abort=()=>c.abort();req.signal.addEventListener('abort',abort,{once:true});if(req.signal.aborted)abort();const timer=setTimeout(abort,config.timeoutMs??12000);
 let lease:string|null=null,key:string|null=null;
 const rpc=async(name:string,body:unknown,worker=false)=>{const r=await http(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:worker?config.serviceKey:config.anonKey,Authorization:worker?'Bearer '+config.serviceKey:bearer,'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal,redirect:'error'});if(!r.ok)throw new PlacesFailure(r.status===401?'auth':r.status===403?'access':'backend_unavailable',r.status===401?401:r.status===403?403:503);return boundedJson(r,120000,c.signal);};
 try{
  const raw=await boundedJson(req,512,c.signal).catch(()=>{throw new PlacesFailure('input',400);});if(!raw||Object.keys(raw).length!==1||!uuid(raw.listingId))return reply(400,'input');
  if(!config.providerKey||!config.serviceKey||!config.anonKey||!config.supabaseUrl)return reply(503,'configuration');
  const session=await http(config.supabaseUrl+'/auth/v1/user',{headers:{apikey:config.anonKey,Authorization:bearer},signal:c.signal,redirect:'error'});if(!session.ok)return reply(401,'auth');const user=await boundedJson(session,65536,c.signal);if(!uuid(user?.id)||user.is_anonymous===true)return reply(401,'auth');
  const context=()=>rpc('get_nearby_places_context',{p_listing_id:raw.listingId});
  const before=await context();if(before?.listingId!==raw.listingId||!uuid(before.propertyId)||!uuid(before.version))throw new PlacesFailure('access',403);
  const origin={latitude:before.latitude,longitude:before.longitude};if(!validPoint(origin))throw new PlacesFailure('missing_public_location',422);
  const bytes=new TextEncoder().encode(JSON.stringify(['geoapify-v1',origin.latitude,origin.longitude,radius,categories]));key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  const cache=await rpc('claim_nearby_places',{p_actor:user.id,p_key:key},true);let rows:unknown,fetchedAt=cache.fetchedAt,expiresAt=cache.expiresAt,stale=false;
  if(cache.status==='rate_limited')throw new PlacesFailure('rate_limited',429);
  if(cache.status==='hit'){rows=parseNearbyPlacesRows(cache.rows,origin);}
  else if(cache.status==='refresh'&&uuid(cache.lease)){
   lease=cache.lease;
   try{rows=await geoapify(origin,config.providerKey,http,c.signal);parseNearbyPlacesRows(rows,origin);const finished=await rpc('finish_nearby_places',{p_key:key,p_lease:lease,p_rows:rows},true);if(finished!==true)throw new PlacesFailure('refresh_conflict',503);lease=null;fetchedAt=new Date().toISOString();expiresAt=new Date(Date.now()+86400000).toISOString();}
   catch(e){const failure=e instanceof PlacesFailure?e:new PlacesFailure('temporarily_unavailable');if(lease){await rpc('finish_nearby_places',{p_key:key,p_lease:lease,p_rows:null,p_failure_seconds:failure.retryAfter},true).catch(()=>{});lease=null;}if(!Array.isArray(cache.rows))throw failure;rows=parseNearbyPlacesRows(cache.rows,origin);stale=true;}
  }else if(cache.status==='busy'&&Array.isArray(cache.rows)){rows=parseNearbyPlacesRows(cache.rows,origin);stale=true;}
  else throw new PlacesFailure('temporarily_unavailable');
  if(!Number.isFinite(Date.parse(fetchedAt))||!Number.isFinite(Date.parse(expiresAt))||Date.now()-Date.parse(fetchedAt)>72*3600000)throw new PlacesFailure('invalid_cache',502);
  const after=await context();if(JSON.stringify(after)!==JSON.stringify(before))throw new PlacesFailure('location_changed',409);
  if(c.signal.aborted)throw new PlacesFailure('timeout',504);
  return new Response(JSON.stringify({listingId:raw.listingId,provider:'geoapify',rows,stale,fetchedAt,expiresAt,limited:true,attribution:'Powered by Geoapify | OpenStreetMap contributors'}),{headers});
 }catch(e){if(c.signal.aborted)return reply(504,'timeout');return e instanceof PlacesFailure?reply(e.status,e.code,e.retryAfter):reply(c.signal.aborted?504:503,c.signal.aborted?'timeout':'temporarily_unavailable');}
 finally{clearTimeout(timer);req.signal.removeEventListener('abort',abort);}
};}
