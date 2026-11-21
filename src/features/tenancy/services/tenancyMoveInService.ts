import {readSessionUser} from '../../../shared/services/supabase/sessionUser';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {MoveInError,parseMoveIn,parseMoveInWrite,parsePendingMoveIns,validateMoveInOperation,type MoveInOperation,type MoveInRead,type MoveInWrite,type PendingMoveIn} from '../models/TenancyMoveIn';

/** SQLSTATEs the move-in functions raise on purpose. Anything else is treated as "may or may not have happened". */
const DEFINITE=['42501','22023','40001','23P01','25001','PGRST202'];
type Failure={code?:string|null;message?:string|null}|null;
// The three RPCs are new: the generated database types do not list them (and are not regenerated here), so they are called through a narrow, typed view of rpc().
type Rpc=(name:string,args?:Record<string,unknown>)=>{abortSignal:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:Failure}>};
const rpc=(client:SupabaseClient<Database>):Rpc=>(name,args)=>(client as unknown as {rpc:Rpc}).rpc(name,args);

/**
 * get_tenancy_move_in, get_pending_tenancy_move_ins and write_tenancy_move_in, nothing else. Identity is rechecked around every call. A read that fails is an error
 * the caller shows with a retry; a write that fails without a definite server answer is uncertain, so the caller retries the SAME operation id (the server replays
 * its stored result).
 */
export function createTenancyMoveInService(client:()=>SupabaseClient<Database>){
  const identity=async(actor:string,signal:AbortSignal,read=false)=>{
    const {data,error}=await (read?readSessionUser(client()):client().auth.getUser());
    if(error||data.user?.id!==actor||signal.aborted)throw new MoveInError('Your account changed or the request was canceled.',null,false);
  };
  const definite=(e:Failure)=>new MoveInError(e?.message??'',e?.code??null,false);
  const call=async(name:string,args:Record<string,unknown>|undefined,signal:AbortSignal)=>{
    try{return await rpc(client())(name,args).abortSignal(signal);}catch{throw new MoveInError('Request failed.',null,true);}
  };
  return {
    async read(actor:string,tenancyId:string,signal:AbortSignal):Promise<MoveInRead>{
      await identity(actor,signal,true);
      const result=await call('get_tenancy_move_in',{p_tenancy_id:tenancyId},signal);
      await identity(actor,signal,true);
      if(result.error)throw result.error.code&&DEFINITE.includes(result.error.code)?definite(result.error):new MoveInError('Request failed.',null,true);
      return parseMoveIn(result.data,tenancyId);
    },
    async pending(actor:string,signal:AbortSignal):Promise<PendingMoveIn[]>{
      await identity(actor,signal,true);
      const result=await call('get_pending_tenancy_move_ins',undefined,signal);
      await identity(actor,signal,true);
      if(result.error)throw result.error.code&&DEFINITE.includes(result.error.code)?definite(result.error):new MoveInError('Request failed.',null,true);
      return parsePendingMoveIns(result.data);
    },
    async write(actor:string,op:MoveInOperation,signal:AbortSignal):Promise<MoveInWrite>{
      validateMoveInOperation(op);
      await identity(actor,signal);
      let result;
      try{result=await rpc(client())('write_tenancy_move_in',{p_tenancy_id:op.tenancyId,p_operation_id:op.operationId,p_action:op.action,p_payload:op.payload}).abortSignal(signal);}
      catch{throw new MoveInError('Outcome not confirmed.',null,true);}
      if(signal.aborted)throw new MoveInError('Outcome not confirmed.',null,true);
      if(result.error){
        if(result.error.code&&DEFINITE.includes(result.error.code))throw definite(result.error);
        throw new MoveInError('Outcome not confirmed.',null,true);
      }
      try{await identity(actor,signal);}catch{throw new MoveInError('Outcome not confirmed for this account.',null,true);}
      return parseMoveInWrite(result.data,op.action);
    },
  };
}
export type TenancyMoveInService=ReturnType<typeof createTenancyMoveInService>;
