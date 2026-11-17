import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {ExtensionError,parseExtension,parseExtensionWrite,parsePendingExtensions,validateExtensionOperation,type ExtensionOperation,type ExtensionRead,type ExtensionWrite,type PendingExtension} from '../models/TenancyExtension';

/** SQLSTATEs the extension functions raise on purpose. Anything else is treated as "may or may not have happened". */
const DEFINITE=['42501','22023','40001','23P01','25001','PGRST202'];
type Failure={code?:string|null;message?:string|null}|null;
// The three RPCs are new and may not exist on a project yet: the generated database types do not list them, so they are called through a narrow, typed view of rpc().
type Rpc=(name:string,args?:Record<string,unknown>)=>{abortSignal:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:Failure}>};
const rpc=(client:SupabaseClient<Database>):Rpc=>(name,args)=>(client as unknown as {rpc:Rpc}).rpc(name,args);

/**
 * get_tenancy_extension, get_pending_tenancy_extensions and write_tenancy_extension, nothing else. Identity is rechecked around every call. A read
 * that fails (including a project where the functions are not deployed yet) is an error the caller hides quietly; a write that fails without a
 * definite server answer is uncertain, so the caller retries the SAME operation id (the server replays its stored result).
 */
export function createTenancyExtensionService(client:()=>SupabaseClient<Database>){
  const identity=async(actor:string,signal:AbortSignal)=>{
    const {data,error}=await client().auth.getUser();
    if(error||data.user?.id!==actor||signal.aborted)throw new ExtensionError('Your account changed or the request was canceled.',null,false);
  };
  const definite=(e:Failure)=>new ExtensionError(e?.message??'',e?.code??null,false);
  const call=async(name:string,args:Record<string,unknown>|undefined,signal:AbortSignal)=>{
    try{return await rpc(client())(name,args).abortSignal(signal);}catch{throw new ExtensionError('Request failed.',null,true);}
  };
  return {
    async read(actor:string,tenancyId:string,signal:AbortSignal):Promise<ExtensionRead>{
      await identity(actor,signal);
      const result=await call('get_tenancy_extension',{p_tenancy_id:tenancyId},signal);
      await identity(actor,signal);
      if(result.error)throw result.error.code&&DEFINITE.includes(result.error.code)?definite(result.error):new ExtensionError('Request failed.',null,true);
      return parseExtension(result.data,tenancyId);
    },
    async pending(actor:string,signal:AbortSignal):Promise<PendingExtension[]>{
      await identity(actor,signal);
      const result=await call('get_pending_tenancy_extensions',undefined,signal);
      await identity(actor,signal);
      if(result.error)throw result.error.code&&DEFINITE.includes(result.error.code)?definite(result.error):new ExtensionError('Request failed.',null,true);
      return parsePendingExtensions(result.data);
    },
    async write(actor:string,op:ExtensionOperation,signal:AbortSignal):Promise<ExtensionWrite>{
      validateExtensionOperation(op);
      await identity(actor,signal);
      let result;
      try{result=await rpc(client())('write_tenancy_extension',{p_tenancy_id:op.tenancyId,p_operation_id:op.operationId,p_action:op.action,p_payload:op.payload}).abortSignal(signal);}
      catch{throw new ExtensionError('Outcome not confirmed.',null,true);}
      if(signal.aborted)throw new ExtensionError('Outcome not confirmed.',null,true);
      if(result.error){
        if(result.error.code&&DEFINITE.includes(result.error.code))throw definite(result.error);
        throw new ExtensionError('Outcome not confirmed.',null,true);
      }
      try{await identity(actor,signal);}catch{throw new ExtensionError('Outcome not confirmed for this account.',null,true);}
      return parseExtensionWrite(result.data,op.action);
    },
  };
}
export type TenancyExtensionService=ReturnType<typeof createTenancyExtensionService>;
