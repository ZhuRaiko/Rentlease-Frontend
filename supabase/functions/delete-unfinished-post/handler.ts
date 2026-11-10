export interface DeletionEnvironment {url:string;anonKey:string;serviceKey:string}
/** No caller-supplied paths, bucket, owner, or privileged payload. */
export function createDeletionHandler(env:DeletionEnvironment,send:typeof fetch=fetch){
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='POST')return reply(405,{error:'Method not allowed.'});
  const authorization=request.headers.get('Authorization')??'';
  if(!/^Bearer [^ ]+$/.test(authorization))return reply(401,{error:'Sign in again.'});
  let propertyId:string;
  try{const body=await request.json();if(!body||Object.keys(body).length!==1||typeof body.propertyId!=='string'||!/^([0-9a-f]{8}-){1}[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.propertyId))throw Error();propertyId=body.propertyId;}catch{return reply(400,{error:'Select a saved property.'});}
  const userHeaders={apikey:env.anonKey,Authorization:authorization,'Content-Type':'application/json'};
  const adminHeaders={apikey:env.serviceKey,Authorization:`Bearer ${env.serviceKey}`,'Content-Type':'application/json'};
  const rpc=(name:string,body:unknown,admin=false)=>send(`${env.url}/rest/v1/rpc/${name}`,{method:'POST',headers:admin?adminHeaders:userHeaders,body:JSON.stringify(body)});
  try{
   const identity=await send(`${env.url}/auth/v1/user`,{headers:userHeaders});
   if(!identity.ok)return reply(401,{error:'Sign in again.'});
   const user=await identity.json();if(typeof user.id!=='string')return reply(401,{error:'Sign in again.'});
   const started=await rpc('delete_unfinished_post',{p_property_id:propertyId});
   if(!started.ok){const error=await started.json().catch(()=>({}));return reply(error.code==='42501'?403:error.code==='22023'?409:503,{error:'Deletion could not be confirmed. Check the saved post before retrying.'});}
   const result=await started.json();
   if(result.propertyId!==propertyId||!['completed','cleanup_pending'].includes(result.state))return reply(503,{error:'Check deletion status before retrying.'});
   if(result.state==='completed')return reply(200,result);
   try{
    const queued=await rpc('get_unfinished_post_cleanup',{p_property_id:propertyId,p_owner_id:user.id},true);
    if(!queued.ok)throw Error();const job=await queued.json();
    if(!job||job.state!=='cleanup_pending'||!Array.isArray(job.paths)||job.paths.some((path:unknown)=>typeof path!=='string'||!path.startsWith(`${user.id}/${propertyId}/`)||!new RegExp(`^${user.id}/${propertyId}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$`,'i').test(path)))throw Error();
    for(let offset=0;offset<job.paths.length;offset+=1000){const removed=await send(`${env.url}/storage/v1/object/property-media`,{method:'DELETE',headers:adminHeaders,body:JSON.stringify({prefixes:job.paths.slice(offset,offset+1000)})});if(!removed.ok)throw Error();}
    const finished=await rpc('finish_unfinished_post_cleanup',{p_property_id:propertyId,p_owner_id:user.id},true);
    if(!finished.ok)throw Error();
    return reply(200,{propertyId,state:'completed'});
   }catch{return reply(202,{propertyId,state:'cleanup_pending'});}
  }catch{return reply(503,{error:'Deletion could not be confirmed. Check deletion status before retrying.'});}
 };
}
