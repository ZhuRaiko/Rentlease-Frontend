import {mapPredictionInput,parseModelPrediction,parsePredictionTarget,isPredictionId,PredictionError} from '../../../src/shared/models/RentalPrediction.ts';
export interface ProxyConfig {supabaseUrl:string;anonKey:string;mlUrl:string;mlSecret:string;timeoutMs?:number}
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
const PROPERTY_FIELDS='id,landlord_id,is_active,property_type,city,furnishing_status,bedrooms,bathrooms,floor_area_sqm,floor_number';
/** Uses only a caller-scoped JWT plus publishable/anon key. Never a service-role client. */
export function createPredictionHandler(config:ProxyConfig,http:typeof fetch=fetch){
 const pending=new Set<string>();
 return async(req:Request):Promise<Response>=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{code:'method'});
 const bearer=req.headers.get('Authorization');if(!bearer||!/^Bearer [^\s]+$/i.test(bearer))return reply(401,{code:'auth'});
 const controller=new AbortController(),cancel=()=>controller.abort();if(req.signal.aborted)cancel();req.signal.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,config.timeoutMs??70000);let actor:string|null=null,locked=false;
 try{
  const ml=new URL(config.mlUrl);if(ml.protocol!=='https:'||ml.hostname!=='rentlease-ml.onrender.com'||ml.username||ml.password||ml.search||ml.hash||!config.mlSecret||!config.supabaseUrl||!config.anonKey)return reply(503,{code:'configuration'});
  const authHeaders={apikey:config.anonKey,Authorization:bearer,'Content-Type':'application/json'};
  const read=async(path:string,method='GET',body?:string)=>{const response=await http(config.supabaseUrl.replace(/\/$/,'')+path,{method,headers:authHeaders,signal:controller.signal,...(body===undefined?{}:{body})});if(!response.ok)throw new PredictionError('Access unavailable.','access');return response.json();};
  const user=await read('/auth/v1/user');if(!isPredictionId(user?.id)||user.is_anonymous===true)return reply(401,{code:'auth'});actor=user.id;
  if(await read('/rest/v1/rpc/is_tier1_verified','POST','{}')!==true)return reply(403,{code:'eligibility'});
  if(pending.has(actor!))return reply(429,{code:'busy'});pending.add(actor!);locked=true;
  // Stream-bound body: Content-Length alone is not trusted.
  const reader=req.body?.getReader(),abortReader=()=>{void reader?.cancel().catch(()=>{});};controller.signal.addEventListener('abort',abortReader,{once:true});let text='',length=0;const decoder=new TextDecoder();if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2048){await reader.cancel();return reply(413,{code:'input'});}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{controller.signal.removeEventListener('abort',abortReader);reader.releaseLock();}}if(controller.signal.aborted)return reply(504,{code:'timeout'});
  let raw:unknown;try{raw=JSON.parse(text);}catch{return reply(400,{code:'input'});}const target=parsePredictionTarget(raw);
  let listing:Record<string,unknown>|null=null,propertyId:string;
  if(target.listingId){const rows=await read('/rest/v1/listings?select=id,property_id,landlord_id,title,status,published_at,available_from,asking_rent_monthly&id=eq.'+target.listingId+'&limit=1');listing=Array.isArray(rows)?rows[0]:null;if(!listing||!isPredictionId(listing.property_id))return reply(404,{code:'access'});propertyId=listing.property_id;}
  else if(target.propertyId)propertyId=target.propertyId;else return reply(400,{code:'input'});
  const rows=await read('/rest/v1/properties?select='+PROPERTY_FIELDS+'&id=eq.'+propertyId+'&limit=1'),property=Array.isArray(rows)?rows[0]:null;
  if(!property||property.id!==propertyId||!isPredictionId(property.landlord_id)||property.is_active!==true)return reply(404,{code:'access'});
  const owned=property.landlord_id===actor;
  if(listing&&listing.landlord_id!==property.landlord_id)return reply(404,{code:'access'});
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  if(!owned&&(!listing||listing.status!=='active'||typeof listing.published_at!=='string'||(listing.available_from&&String(listing.available_from)>today)))return reply(404,{code:'access'});
  // Do not select any location field. Model-authorized missing coordinates use imputation.
  const links=await read('/rest/v1/property_amenities?select=amenities(name)&property_id=eq.'+propertyId+'&limit=101');
  const names=Array.isArray(links)&&links.length<101&&links.every(l=>typeof l?.amenities?.name==='string')?links.map(l=>l.amenities.name):null;
  const input=mapPredictionInput(property,names);
  const response=await http(ml.origin+'/predict',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.mlSecret},body:JSON.stringify(input),signal:controller.signal,redirect:'error'});
  if(!response.ok)return reply(response.status===422?422:response.status===429?429:503,{code:response.status===422?'model_input':response.status===429?'rate_limit':'upstream'});
  let result;try{result=parseModelPrediction(await response.json());}catch{return reply(502,{code:'invalid_result'});}
  if(controller.signal.aborted)return reply(504,{code:'timeout'});
  return reply(200,{...result,target,askingRent:listing&&typeof listing.asking_rent_monthly==='number'&&Number.isFinite(listing.asking_rent_monthly)&&listing.asking_rent_monthly>0?listing.asking_rent_monthly:null,predictedAt:new Date().toISOString()});
 }catch(e){return e instanceof PredictionError?reply(e.code==='input'?422:403,{code:e.code}):reply(controller.signal.aborted?504:503,{code:controller.signal.aborted?'timeout':'unavailable'});}
 finally{if(locked&&actor)pending.delete(actor);clearTimeout(timer);req.signal.removeEventListener('abort',cancel);}
 };
}
