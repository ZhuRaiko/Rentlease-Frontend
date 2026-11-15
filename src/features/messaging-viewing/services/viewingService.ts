import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {isUuid} from '../models/PersistentMessaging';
import {ViewingError,type PropertyViewing,type ViewingAction,type ViewingEvent,viewingStatusLabels} from '../models/PropertyViewing';
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new ViewingError('The viewing response could not be verified.');return v as Record<string,unknown>;}
function text(v:unknown):string{if(typeof v!=='string')throw new ViewingError('The viewing response could not be verified.');return v;}
const nullable=(v:unknown)=>v==null?null:text(v);
export function parseViewing(value:unknown,actor:string):PropertyViewing{
 const r=row(value);for(const key of ['id','conversation_id','listing_id','tenant_id','landlord_id','proposed_by'])if(!isUuid(r[key]))throw new ViewingError('The viewing response could not be verified.');
 if(![r.tenant_id,r.landlord_id].includes(actor))throw new ViewingError('Viewing access could not be verified.',true);
 const status=text(r.status) as PropertyViewing['status'];if(!Object.hasOwn(viewingStatusLabels,status)||!Number.isInteger(r.revision)||Number(r.revision)<1||!Number.isFinite(Date.parse(text(r.starts_at)))||!Number.isFinite(Date.parse(text(r.ends_at)))||Date.parse(text(r.ends_at))<=Date.parse(text(r.starts_at)))throw new ViewingError('The viewing response could not be verified.');
 const history:ViewingEvent[]=Array.isArray(r.history)?r.history.map(v=>{const h=row(v);return{action:text(h.action),actorId:text(h.actor_id),at:text(h.event_at),startsAt:text(h.starts_at),endsAt:text(h.ends_at),status:text(h.status) as PropertyViewing['status'],note:nullable(h.action==='request'?h.request_note:h.response_note)};}):[];
 return{id:text(r.id),conversationId:text(r.conversation_id),listingId:text(r.listing_id),listingTitle:nullable(r.listing_title),tenantId:text(r.tenant_id),landlordId:text(r.landlord_id),proposedBy:text(r.proposed_by),startsAt:text(r.starts_at),endsAt:text(r.ends_at),status,revision:Number(r.revision),requestNote:nullable(r.request_note),responseNote:nullable(r.response_note),history};
}
export function viewingFailure(error:unknown,write=false){const e=error&&typeof error==='object'?error as Record<string,unknown>:{};
 if(e.code==='PGRST202'||e.code==='42883')return new ViewingError('This feature is not available right now. Try again later.');
 if(e.code==='42501'||e.code==='28000')return new ViewingError('This viewing is unavailable or your account is no longer eligible.',true);
 if(e.code==='40001')return new ViewingError('This appointment changed. Refresh and review its latest status.');
 if(e.code==='23P01')return new ViewingError('This time overlaps a confirmed appointment. Propose a different time.');
 if(e.code==='23505')return new ViewingError('A viewing request already exists. Refresh to review it.');
 if(e.code==='22023')return new ViewingError('The appointment or listing is no longer eligible. Refresh and choose a valid future time.');
 return new ViewingError(write?'The change was not confirmed. Retry the same request safely.':'Could not load viewings. Check your connection and retry.',false,write);
}
export interface ViewingWrite {id:string;conversationId?:string;viewingId?:string;revision?:number;action?:ViewingAction;startsAt?:string;endsAt?:string;note:string|null}
export function createViewingService(getClient:()=>SupabaseClient<Database>){
 const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user)throw new ViewingError('Sign in again to view appointments.',true);return data.user.id;};
 const identity=async(actor:string)=>{if(await user()!==actor)throw new ViewingError('Your account changed. Reopen Viewings.',true);};
 async function request(actor:string,read:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown}>,signal?:AbortSignal,write=false){
 await identity(actor);const controller=new AbortController(),cancel=()=>controller.abort();if(signal?.aborted)controller.abort();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,20000);
 try{const result=await read(controller.signal);await identity(actor);if(result.error)throw viewingFailure(result.error,write);return result.data;}catch(e){throw e instanceof ViewingError?e:viewingFailure(e,write);}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}}
 return{user,
 async list(actor:string,conversationId:string|null,offset:number,signal?:AbortSignal){if(conversationId&&!isUuid(conversationId))throw new ViewingError('Choose a valid conversation.');const data=await request(actor,s=>getClient().rpc('get_property_viewings',{...(conversationId?{p_conversation_id:conversationId}:{}),p_offset:offset,p_limit:20}).abortSignal(s),signal);if(!Array.isArray(data))throw new ViewingError('The viewing response could not be verified.');return data.map(r=>parseViewing(r,actor));},
 async write(actor:string,op:ViewingWrite,signal?:AbortSignal){if(!isUuid(op.id)||(!op.viewingId&&!isUuid(op.conversationId))||(op.viewingId&&!isUuid(op.viewingId)))throw new ViewingError('Choose a valid viewing.');const data=await request(actor,s=>op.viewingId?getClient().rpc('respond_property_viewing',{p_viewing_id:op.viewingId,p_operation_id:op.id,p_expected_revision:op.revision!,p_action:op.action!,p_note:op.note,...(op.startsAt?{p_starts_at:op.startsAt,p_ends_at:op.endsAt!}:{})}).abortSignal(s):getClient().rpc('request_property_viewing',{p_conversation_id:op.conversationId!,p_request_id:op.id,p_starts_at:op.startsAt!,p_ends_at:op.endsAt!,p_note:op.note}).abortSignal(s),signal,true);try{return parseViewing(data,actor);}catch(e){if(e instanceof ViewingError&&e.denied)throw e;throw new ViewingError('The viewing receipt could not be verified. Retry the same request safely.',false,true);}}
 };
}
export type ViewingService=ReturnType<typeof createViewingService>;
