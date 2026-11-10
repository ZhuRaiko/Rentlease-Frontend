import {validateReviewCloud,type ReviewCorpus} from '../../../src/shared/models/ReviewWordCloud.ts';
import type {ReviewRow} from '../../../src/shared/models/RentalReview.ts';
interface Config {supabaseUrl:string;anonKey:string;nlpUrl:string;nlpSecret:string;timeoutMs?:number}
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(status:number,code:string)=>new Response(JSON.stringify({code}),{status,headers:{...headers,'Content-Type':'application/json'}});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
class BridgeError extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
async function boundedJson(response:Response|Request,max:number,signal:AbortSignal){const reader=response.body?.getReader();if(!reader)throw new BridgeError(400,'input');let length=0,text='';const decoder=new TextDecoder();const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});try{while(true){if(signal.aborted)throw Error();const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>max){await reader.cancel();throw new BridgeError(413,'size_limit');}text+=decoder.decode(part.value,{stream:true});}if(signal.aborted)throw Error();return JSON.parse(text+decoder.decode());}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}}
/** No service role: actual session and every RPC read use the caller's JWT. */
export function createWordCloudHandler(config:Config,http:typeof fetch=fetch){const pending=new Set<string>();return async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,'method');
 const bearer=req.headers.get('Authorization');if(!bearer||!/^Bearer [^\s]+$/i.test(bearer))return reply(401,'auth');
 const c=new AbortController(),cancel=()=>c.abort();req.signal.addEventListener('abort',cancel,{once:true});if(req.signal.aborted)cancel();const timer=setTimeout(cancel,config.timeoutMs??55000);let locked:string|null=null;
 try{
  const raw=await boundedJson(req,512,c.signal).catch(e=>{if(e instanceof BridgeError)throw e;throw new BridgeError(400,'input');});
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==1||!uuid(raw.propertyId))return reply(400,'input');
  const endpoint=new URL(config.nlpUrl);if(endpoint.origin!=='https://rentlease-ml.onrender.com'||!['','/'].includes(endpoint.pathname)||endpoint.search||endpoint.hash||endpoint.username||endpoint.password||!config.nlpSecret||!config.supabaseUrl||!config.anonKey)return reply(503,'configuration');
  const authHeaders={apikey:config.anonKey,Authorization:bearer,'Content-Type':'application/json'};
  const session=async()=>{const response=await http(config.supabaseUrl+'/auth/v1/user',{headers:authHeaders,signal:c.signal,redirect:'error'});if(!response.ok)throw new BridgeError(401,'auth');const u=await boundedJson(response,65536,c.signal);if(!uuid(u?.id)||u.is_anonymous===true)throw new BridgeError(401,'auth');return u.id as string;};
  const actor=await session();if(pending.has(actor)||pending.size>=4)return reply(429,'busy');pending.add(actor);locked=actor;
  const scan=async():Promise<ReviewCorpus>=>{const rows:ReviewRow[]=[],ids=new Set<string>();let count:number|null=null;
   for(let offset=0;offset<=10000;offset+=20){
    const response=await http(config.supabaseUrl+'/rest/v1/rpc/get_published_rental_reviews',{method:'POST',headers:authHeaders,signal:c.signal,redirect:'error',body:JSON.stringify({p_kind:'property',p_target_id:raw.propertyId,p_offset:offset})});
    if(!response.ok)throw new BridgeError(response.status===401?401:response.status===403?403:503,response.status===403?'access':'reviews_unavailable');
    const page=await boundedJson(response,262144,c.signal);
    if(page?.kind!=='property'||page.targetId!==raw.propertyId||!Number.isSafeInteger(page.count)||page.count<0||page.count>10020||!Array.isArray(page.rows)||page.rows.length>20)throw new BridgeError(502,'invalid_corpus');
    if(count===null)count=Number(page.count);if(page.count!==count)throw new BridgeError(409,'corpus_changed');
    for(const r of page.rows){if(!uuid(r?.id)||ids.has(r.id)||r.propertyId!==raw.propertyId||!uuid(r.revision)||(r.text!==null&&(typeof r.text!=='string'||r.text.length>2000))||!Number.isInteger(r.rating)||r.rating<1||r.rating>5||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||[r.updatedAt,r.moderatedAt].some(x=>x!=null&&(typeof x!=='string'||!Number.isFinite(Date.parse(x))))||(r.kind!==undefined&&r.kind!=='property')||(r.status!==undefined&&r.status!=='approved'))throw new BridgeError(502,'invalid_corpus');ids.add(r.id);rows.push({id:r.id,kind:'property',status:'approved',propertyId:raw.propertyId,rating:r.rating,text:r.text,revision:r.revision,createdAt:r.createdAt,updatedAt:r.updatedAt??null,moderatedAt:r.moderatedAt??null,history:[]});}
    if(rows.length===count){if(rows.reduce((n,r)=>n+(r.text?.length??0),0)>500000)throw new BridgeError(413,'size_limit');return{propertyId:raw.propertyId,count,rows,version:JSON.stringify(rows.map(r=>[r.id,r.revision,r.moderatedAt,r.updatedAt,r.text]))};}
    if(page.rows.length<20||rows.length>count)throw new BridgeError(409,'corpus_changed');
   }throw new BridgeError(413,'size_limit');
  };
  const corpus=await scan();const before=await scan();if(before.version!==corpus.version||before.count!==corpus.count)throw new BridgeError(409,'corpus_changed');
  const payload={property_id:corpus.propertyId,corpus_version:corpus.version,reviews:corpus.rows.map(r=>({id:r.id,text:r.text}))};const body=JSON.stringify(payload);if(new TextEncoder().encode(body).length>4*1024*1024)throw new BridgeError(413,'size_limit');
  const response=await http(endpoint.origin+'/wordcloud',{method:'POST',headers:{Authorization:'Bearer '+config.nlpSecret,'Content-Type':'application/json'},body,signal:c.signal,redirect:'error'});
  if(!response.ok)throw new BridgeError(response.status===429?429:503,'processor_unavailable');const result=await boundedJson(response,8*1024*1024,c.signal);
  let validated;try{validated=validateReviewCloud(result,corpus);}catch{throw new BridgeError(502,'invalid_result');}
  const after=await scan();if(after.version!==corpus.version||after.count!==corpus.count)throw new BridgeError(409,'corpus_changed');if(await session()!==actor)throw new BridgeError(401,'auth');if(c.signal.aborted)throw Error();
  return new Response(JSON.stringify({property_id:corpus.propertyId,corpus_version:corpus.version,eligible_review_count:corpus.count,synthetic:false,span_encoding:'unicode_code_points',...validated}),{headers:{...headers,'Content-Type':'application/json'}});
 }catch(e){return e instanceof BridgeError?reply(e.status,e.code):reply(c.signal.aborted?504:503,c.signal.aborted?'timeout':'unavailable');}
 finally{if(locked)pending.delete(locked);clearTimeout(timer);req.signal.removeEventListener('abort',cancel);}
 };}
