import { readSessionUser } from '../../../shared/services/supabase/sessionUser';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database,Json} from '../../../shared/services/supabase/database.types';
import {CareError,parseCare,parseCareHistory,validateCareOperation,type CareOperation,type CareContext} from '../models/TenancyCare';
import {parseTenancyRelationship} from '../models/TenancyDetails';
import {careErrorMessage,parseMaintenanceInbox,parseMaintenanceRequest} from '../models/Maintenance';
function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{return new Promise((resolve,reject)=>{const abort=()=>reject(new CareError('The rental request was canceled or timed out. Retry.'));if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});}
export function createTenancyCareService(client:()=>SupabaseClient<Database>){
 const identity=async(actor:string,signal:AbortSignal)=>{const r=await abortable(client().auth.getUser(),signal);if(r.error||r.data.user?.id!==actor||signal.aborted)throw new CareError('Your account changed or the request was canceled. Reopen Tenancy.');};
 const readIdentity=async(actor:string,signal:AbortSignal)=>{const r=await abortable(readSessionUser(client()),signal);if(r.error||r.data.user?.id!==actor||signal.aborted)throw new CareError('Your account changed or the request was canceled. Reopen Tenancy.');};
 const failure=(e:{code?:string}|null)=>{if(!e)return;if(e.code==='PGRST202')throw new CareError('This feature is not available right now. Try again later. Existing tenancy details remain available.');throw new CareError('Rental information could not load. Retry.');};
 return {
 async list(actor:string,signal:AbortSignal){await readIdentity(actor,signal);const r=await client().from('tenancies').select('id,property_id,listing_id,conversation_id,tenant_id,landlord_id,status,start_date,expected_end_date,actual_end_date,agreed_monthly_rent,rent_due_day').or('tenant_id.eq.'+actor+',landlord_id.eq.'+actor).in('status',['active','ended']).order('created_at',{ascending:false}).order('id').limit(101).abortSignal(signal);await readIdentity(actor,signal);failure(r.error);if(!r.data||r.data.length>100)throw new CareError('The rental list exceeds this workspace limit. Open a specific tenancy from Tenancy.');return r.data.map(t=>parseTenancyRelationship(t,actor));},
 async read(actor:string,id:string,offset:number,signal:AbortSignal){await readIdentity(actor,signal);const r=await client().rpc('get_tenancy_care',{p_tenancy_id:id,p_offset:offset}).abortSignal(signal);await readIdentity(actor,signal);failure(r.error);return parseCare(r.data,actor,id);},
 /** The landlord's inbox across all their tenancies (20 per page). */
 async inbox(actor:string,offset:number,signal:AbortSignal){await readIdentity(actor,signal);const r=await client().rpc('get_maintenance_inbox',{p_offset:offset}).abortSignal(signal);await readIdentity(actor,signal);if(r.error){if(r.error.code==='42501'||r.error.code==='PGRST202')throw new CareError(careErrorMessage(r.error.code),false,r.error.code);throw new CareError('Maintenance requests could not load. Retry.');}return parseMaintenanceInbox(r.data);},
 /** One request and its thread (oldest first, 20 per page), for either party. */
 async request(actor:string,requestId:string,offset:number,signal:AbortSignal){await readIdentity(actor,signal);const r=await client().rpc('get_maintenance_request',{p_request_id:requestId,p_offset:offset}).abortSignal(signal);await readIdentity(actor,signal);if(r.error){if(r.error.code==='42501'||r.error.code==='PGRST202')throw new CareError(careErrorMessage(r.error.code),false,r.error.code);throw new CareError('This request could not load. Retry.');}return parseMaintenanceRequest(r.data,requestId);},
 async history(actor:string,c:CareContext,id:string,offset:number,signal:AbortSignal){if(!c.requests.some(r=>r.id===id))throw new CareError('Choose an accessible request.');await readIdentity(actor,signal);const r=await client().rpc('get_tenancy_maintenance_history',{p_request_id:id,p_offset:offset}).abortSignal(signal);await readIdentity(actor,signal);failure(r.error);return parseCareHistory(r.data,[c.tenantId,c.landlordId]);},
 async write(actor:string,op:CareOperation,signal:AbortSignal){validateCareOperation(op);await identity(actor,signal);let r;
 try{r=await client().rpc('write_tenancy_care',{p_tenancy_id:op.tenancyId,p_operation_id:op.operationId,p_action:op.action,p_payload:op.payload as Json}).abortSignal(signal);}catch{throw new CareError('Outcome not confirmed. Retry the same operation.',true);}
 if(signal.aborted)throw new CareError('Outcome not confirmed. Retry the same operation.',true);
 if(r.error){if(['42501','22023','40001','22P02','PGRST202'].includes(r.error.code))throw new CareError(careErrorMessage(r.error.code==='22P02'?'22023':r.error.code),false,r.error.code==='22P02'?'22023':r.error.code);throw new CareError('Outcome not confirmed. Retry the same operation.',true);}
 try{await identity(actor,signal);}catch{throw new CareError('Outcome not confirmed for this account. Reopen its workspace.',true);}
 if(!r.data||typeof r.data!=='object'||Array.isArray(r.data)||!('requestId' in r.data))throw new CareError('Outcome not confirmed. Retry the same operation.',true);
 return r.data;
 }};
}
export type TenancyCareService=ReturnType<typeof createTenancyCareService>;
