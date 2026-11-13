import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {isUuid} from '../models/PersistentMessaging';
import {ReservationError,reservationStatusLabels,validCalendarDate,type RentalReservation,type ReservationStatus,type ReservationAction} from '../models/RentalReservation';
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ReservationError('The reservation response could not be verified.');return value as Record<string,unknown>;};
const text=(value:unknown)=>{if(typeof value!=='string')throw new ReservationError('The reservation response could not be verified.');return value;};
const nullable=(value:unknown)=>value==null?null:text(value);
const status=(value:unknown):ReservationStatus=>{const s=text(value);if(!Object.hasOwn(reservationStatusLabels,s))throw new ReservationError('The reservation status could not be verified.');return s as ReservationStatus;};
export function parseReservation(value:unknown,actor:string):RentalReservation{
 const r=record(value);
 for(const key of ['id','conversation_id','listing_id','property_id','tenant_id','landlord_id'])if(!isUuid(r[key]))throw new ReservationError('The reservation response could not be verified.');
 if(![r.tenant_id,r.landlord_id].includes(actor))throw new ReservationError('Reservation access could not be verified.',true);
 if(!validCalendarDate(r.move_in_date)||!validCalendarDate(r.end_date)||r.end_date<=r.move_in_date||!Number.isInteger(r.duration_months)||Number(r.duration_months)<1||Number(r.duration_months)>120||!Number.isInteger(r.revision)||Number(r.revision)<1||!Number.isFinite(Date.parse(text(r.expires_at)))||r.applicant_label!=='Renter'||typeof r.applicant_tier1!=='boolean'||typeof r.applicant_tier2!=='boolean'||!Array.isArray(r.history))throw new ReservationError('The reservation response could not be verified.');
 if(!Number.isFinite(Date.parse(text(r.server_now))))throw new ReservationError('The reservation response could not be verified.');
 return{id:text(r.id),conversationId:text(r.conversation_id),listingId:text(r.listing_id),propertyId:text(r.property_id),tenantId:text(r.tenant_id),landlordId:text(r.landlord_id),listingTitle:nullable(r.listing_title),moveInDate:r.move_in_date,endDate:r.end_date,durationMonths:Number(r.duration_months),message:nullable(r.message),status:status(r.effective_status),storedStatus:status(r.status),expiresAt:text(r.expires_at),serverNow:text(r.server_now),revision:Number(r.revision),responseNote:nullable(r.response_note),applicantLabel:'Renter',applicantTier1:r.applicant_tier1,applicantTier2:r.applicant_tier2,history:r.history.map(value=>{const h=record(value);if(!isUuid(h.actor_id)||!Number.isFinite(Date.parse(text(h.at))))throw new ReservationError('The reservation history could not be verified.');return{actorId:text(h.actor_id),action:text(h.action),at:text(h.at),status:status(h.status),note:nullable(h.note)};})};
}
export function reservationFailure(error:unknown,write=false){const e=error&&typeof error==='object'?error as Record<string,unknown>:{};
 if(e.code==='PGRST202'||e.code==='42883')return new ReservationError('This feature is not available right now. Try again later.');
 if(e.code==='42501'||e.code==='28000')return new ReservationError('This reservation is unavailable or your account is no longer eligible.',true);
 if(e.code==='40001')return new ReservationError('This reservation changed. Refresh and review its latest status.');
 if(e.code==='23P01')return new ReservationError('This unit has a conflicting reservation or tenancy for the requested period.');
 if(e.code==='23505')return new ReservationError('An active reservation request already exists. Refresh to review it.');
 if(e.code==='22023'||e.code==='22008')return new ReservationError('The request expired or is no longer eligible. Refresh and review the dates and status.');
 return new ReservationError(write?'The change was not confirmed. Retry the same request safely.':'Could not load reservations. Check your connection and retry.',false,write);
}
export interface ReservationWrite {id:string;conversationId?:string;reservationId?:string;revision?:number;action?:ReservationAction;moveInDate?:string;durationMonths?:number;message:string|null}
export function createReservationService(getClient:()=>SupabaseClient<Database>){
 const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user)throw new ReservationError('Sign in again to review reservations.',true);return data.user.id;};
 const identity=async(actor:string)=>{if(await user()!==actor)throw new ReservationError('Your account changed. Reopen Reservations.',true);};
 async function request(actor:string,read:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown}>,signal?:AbortSignal,write=false){
  await identity(actor);const c=new AbortController(),cancel=()=>c.abort();if(signal?.aborted)c.abort();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,20000);
  try{const result=await read(c.signal);await identity(actor);if(result.error)throw reservationFailure(result.error,write);return result.data;}catch(e){throw e instanceof ReservationError?e:reservationFailure(e,write);}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 return{user,
  async list(actor:string,conversationId:string|null,offset:number,signal?:AbortSignal){if(conversationId&&!isUuid(conversationId))throw new ReservationError('Choose a valid conversation.');const data=await request(actor,s=>getClient().rpc('get_rental_reservations',{...(conversationId?{p_conversation_id:conversationId}:{}),p_offset:offset,p_limit:20}).abortSignal(s),signal);if(!Array.isArray(data))throw new ReservationError('The reservation response could not be verified.');return data.map(row=>parseReservation(row,actor));},
  async write(actor:string,op:ReservationWrite,signal?:AbortSignal){if(!isUuid(op.id)||(op.reservationId?!isUuid(op.reservationId):!isUuid(op.conversationId)))throw new ReservationError('Choose a valid reservation.');
   const data=await request(actor,s=>op.reservationId?getClient().rpc('respond_rental_reservation',{p_reservation_id:op.reservationId,p_operation_id:op.id,p_expected_revision:op.revision!,p_action:op.action!,p_note:op.message}).abortSignal(s):getClient().rpc('request_rental_reservation',{p_conversation_id:op.conversationId!,p_request_id:op.id,p_move_in_date:op.moveInDate!,p_duration_months:op.durationMonths!,p_message:op.message}).abortSignal(s),signal,true);
   try{return parseReservation(data,actor);}catch(e){if(e instanceof ReservationError&&e.denied)throw e;throw new ReservationError('The reservation receipt could not be verified. Retry the same request safely.',false,true);}
  }
 };
}
export type ReservationService=ReturnType<typeof createReservationService>;
