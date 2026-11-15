import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {propertyOwnerLabel,renterLabel} from '../../../shared/models/PublicInquiryIdentity';
import {inquiryDiagnostic,traceInquiryDiagnostic,type InquiryDiagnostic,type InquiryOperation} from '../../../shared/services/supabase/inquiryDiagnostics';
import {MessagingError,isUuid,validateMessage,type Conversation,type PersistentMessage} from '../models/PersistentMessaging';
const record=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new MessagingError('The messaging response could not be read.');return v as Record<string,unknown>;};
const string=(v:unknown):string=>{if(typeof v!=='string')throw new MessagingError('The messaging response could not be read.');return v;};
const nullable=(v:unknown)=>v===null?null:string(v);
export function messagingFailure(error:unknown,write=false):MessagingError{const e=error&&typeof error==='object'?error as Record<string,unknown>:{};
 if(e.code==='PGRST202'||e.code==='42883')return new MessagingError('This feature is not available right now. Try again later.');
 if(e.code==='42501'&&e.message==='Conversation is not open')return new MessagingError('This conversation is closed. Reopen it to view its current status.');
 if(e.code==='42501'||e.code==='28000')return new MessagingError('This conversation is unavailable or your account is no longer eligible.',true);
 if(e.code==='22023')return new MessagingError('This inquiry or message is not available. Check the listing and message.');
 return new MessagingError(write?'Message delivery was not confirmed. Retry safely using the same message.':'Could not load messages. Check your connection and retry.',false,write);
}
export function parseConversation(value:unknown,owner:string):Conversation{const r=record(value);if(!isUuid(r.id)||!isUuid(r.listing_id)||![r.tenant_id,r.landlord_id].includes(owner))throw new MessagingError('Conversation access could not be verified.');return{id:r.id,listingId:r.listing_id,listingTitle:nullable(r.listing_title),tenantId:string(r.tenant_id),landlordId:string(r.landlord_id),participantName:owner===r.tenant_id?propertyOwnerLabel:renterLabel,status:string(r.status),activityAt:string(r.activity_at),latestBody:nullable(r.latest_body),latestType:nullable(r.latest_type)};}
export function parseMessage(value:unknown,id:string):PersistentMessage{const r=record(value);if(!isUuid(r.id)||r.conversation_id!==id||!isUuid(r.sender_id)||typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at)))throw new MessagingError('Message response could not be verified.');return{id:r.id,conversationId:id,senderId:r.sender_id,body:nullable(r.body),type:string(r.message_type),createdAt:r.created_at,deleted:r.deleted_at!==null};}
async function timedRead<T>(signal:AbortSignal|undefined,read:(signal:AbortSignal)=>PromiseLike<T>):Promise<T>{
 const controller=new AbortController(),cancel=()=>controller.abort();if(signal?.aborted)controller.abort();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,20000);
 try{return await read(controller.signal);}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export function createMessagingService(getClient:()=>SupabaseClient<Database>,diagnose:(event:InquiryDiagnostic)=>void=traceInquiryDiagnostic){
 const request=async(operation:InquiryOperation,query:PromiseLike<{data:unknown;error:unknown;status?:number}>,write=false)=>{
  let result:{data:unknown;error:unknown;status?:number};
  try{result=await query;}catch(e){diagnose(inquiryDiagnostic(operation,e));throw messagingFailure(e,write);}
  if(result.error)diagnose(inquiryDiagnostic(operation,result.error,result.status));
  return result;
 };
 const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user)throw new MessagingError('Sign in again to use messaging.',true);return data.user.id;};
 const identity=async(owner:string)=>{if(await user()!==owner)throw new MessagingError('Your account changed. Reopen Chat.',true);};
 return{user,
 async inbox(owner:string,offset=0,signal?:AbortSignal,conversationId?:string):Promise<Conversation[]>{await identity(owner);let q=getClient().rpc('get_messaging_inbox',{p_offset:offset,p_limit:20,...(conversationId?{p_conversation_id:conversationId}:{})});const {data,error}=await request('get_messaging_inbox',timedRead(signal,s=>q.abortSignal(s)));await identity(owner);if(error)throw messagingFailure(error);if(!Array.isArray(data))throw new MessagingError('Inbox response could not be read.');return data.map(r=>parseConversation(r,owner));},
 async messages(owner:string,id:string,direction:'latest'|'older'|'newer',cursor:PersistentMessage|null,signal?:AbortSignal):Promise<PersistentMessage[]>{if(!isUuid(id))throw new MessagingError('Choose a valid conversation.');await identity(owner);let q=getClient().rpc('get_conversation_messages',{p_conversation_id:id,p_direction:direction,p_limit:50,...(cursor?{p_cursor_at:cursor.createdAt,p_cursor_id:cursor.id}:{})});const {data,error}=await request('get_conversation_messages',timedRead(signal,s=>q.abortSignal(s)));await identity(owner);if(error)throw messagingFailure(error);if(!Array.isArray(data))throw new MessagingError('Message response could not be read.');return data.map(r=>parseMessage(r,id));},
 async reconcile(owner:string,id:string,ids:string[],signal?:AbortSignal):Promise<PersistentMessage[]>{if(!isUuid(id)||ids.length<1||ids.length>100||ids.some(v=>!isUuid(v)))throw new MessagingError('Choose valid messages.');await identity(owner);const {data,error}=await request('get_conversation_messages',timedRead(signal,s=>getClient().rpc('get_conversation_messages',{p_conversation_id:id,p_direction:'reconcile',p_known_ids:ids,p_limit:100}).abortSignal(s)));await identity(owner);if(error)throw messagingFailure(error);if(!Array.isArray(data))throw new MessagingError('Message response could not be read.');return data.map(r=>parseMessage(r,id));},
 async send(owner:string,id:string,messageId:string,body:string):Promise<PersistentMessage>{if(!isUuid(id)||!isUuid(messageId))throw new MessagingError('Choose a valid conversation.');const text=validateMessage(body);await identity(owner);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const {data,error}=await request('send_property_message',getClient().rpc('send_property_message',{p_conversation_id:id,p_message_id:messageId,p_body:text}).abortSignal(controller.signal),true);await identity(owner);if(error)throw messagingFailure(error,true);try{const row=parseMessage(data,id);if(row.id!==messageId||row.senderId!==owner)throw Error();return row;}catch{throw new MessagingError('Message receipt could not be verified. Retry safely.',false,true);}}catch(e){throw e instanceof MessagingError?e:messagingFailure(e,true);}finally{clearTimeout(timer);}}
 };
}
export type MessagingService=ReturnType<typeof createMessagingService>;
