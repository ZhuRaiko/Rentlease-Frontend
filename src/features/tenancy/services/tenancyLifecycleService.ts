import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import type {CareStorage} from './tenancyCareJournal';
import {LifecycleError,parseLifecycle,validateLifecycleOperation,type LifecycleOperation} from '../models/TenancyLifecycle';
export function createLifecycleJournal(storage:CareStorage){const key=(actor:string,id:string)=>'rentlease.tenancy-end.v1:'+actor+':'+id;return{async read(actor:string,id:string){const raw=await storage.getItem(key(actor,id));if(!raw)return null;try{const op=JSON.parse(raw) as LifecycleOperation;validateLifecycleOperation(op);if(op.tenancyId!==id)throw Error();return op;}catch{throw new LifecycleError('Pending lifecycle action is unreadable. Keep app data and request recovery support.');}},save:(actor:string,op:LifecycleOperation)=>storage.setItem(key(actor,op.tenancyId),JSON.stringify(op)),clear:(actor:string,id:string)=>storage.removeItem(key(actor,id))};}
export function createTenancyLifecycleService(client:()=>SupabaseClient<Database>){
 async function identity(actor:string,signal:AbortSignal){const r=await client().auth.getUser();if(signal.aborted||r.error||r.data.user?.id!==actor)throw new LifecycleError('Your account changed or the request timed out. Reopen Tenancy.');}
 return{async read(actor:string,id:string,offset:number,signal:AbortSignal){await identity(actor,signal);const r=await client().rpc('get_tenancy_lifecycle',{p_tenancy_id:id,p_offset:offset}).abortSignal(signal);await identity(actor,signal);if(r.error)throw new LifecycleError(r.error.code==='PGRST202'?'Tenancy completion requires the prepared T6 backend update.':'Tenancy lifecycle could not load. Retry.');return parseLifecycle(r.data,actor,id);},
 async write(actor:string,op:LifecycleOperation,signal:AbortSignal){validateLifecycleOperation(op);await identity(actor,signal);let r;
 try{r=await client().rpc('write_tenancy_lifecycle',{p_tenancy_id:op.tenancyId,p_operation_id:op.operationId,p_action:op.action,p_version:op.version,p_request_revision:op.requestRevision,p_reason:op.reason}).abortSignal(signal);}catch{throw new LifecycleError('Outcome not confirmed. Retry the same lifecycle action.',true);}
 if(signal.aborted)throw new LifecycleError('Outcome not confirmed. Retry the same lifecycle action.',true);
 if(r.error){if(['42501','40001','22023','23505','22P02','PGRST202'].includes(r.error.code))throw new LifecycleError(r.error.code==='PGRST202'?'The prepared T6 backend update is required.':'The tenancy or request changed, or this action is unavailable. Reload.');throw new LifecycleError('Outcome not confirmed. Retry the same lifecycle action.',true);}
 try{await identity(actor,signal);return parseLifecycle(r.data,actor,op.tenancyId);}catch{throw new LifecycleError('Outcome not confirmed for this account. Reopen and reconcile the same action.',true);}
 }};
}
export type TenancyLifecycleService=ReturnType<typeof createTenancyLifecycleService>;
export type LifecycleJournal=ReturnType<typeof createLifecycleJournal>;
