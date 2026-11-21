import {decisionPayload,mapMoveInError,requestPayload,type MoveInAction,type MoveInOperation,type MoveInRead} from '../models/TenancyMoveIn';
import type {TenancyMoveInService} from '../services/tenancyMoveInService';

export interface MoveInContext {actor:string|undefined;tenancyId:string;/** Only a tenancy that still waits for its start date is read; otherwise nothing is read and nothing is shown. */enabled:boolean}
const initial=()=>({
  read:null as MoveInRead|null,ready:false,
  /** The last read failed. The screen shows a plain message with Reload; an older read, if any, stays on screen. */loadFailed:false,
  busy:false,saving:false,
  /** A mapped sentence for the last refusal, or null. Never raw server text. */error:null as string|null,
  /** The first clashing date from the last 23P01 (a request or an accept), or null. */conflictDate:null as string|null,
  notice:null as string|null,
  /** The write whose outcome is unknown. Retry repeats exactly this, with the same operation id. */pending:null as MoveInOperation|null,
});

/**
 * One tenancy's move-in request, mirroring the extension workflow. Rules this file keeps:
 * - A fresh operation id for every user action. After an unknown outcome the SAME action is retried with the SAME id (retry()); nothing else can start until it
 *   is resolved, and nothing retries by itself. "Check status" reads again and says whether the unresolved action went through.
 * - A definite refusal is mapped to one sentence. 40001 reloads; 23P01 keeps the first clashing date; the screen stays where it is.
 * - Every write is followed by a read, so the screen never keeps a stale state.
 */
export function createTenancyMoveInWorkflow(service:Pick<TenancyMoveInService,'read'|'write'>,ctx:MoveInContext,newId:()=>string,onWritten?:()=>void){
  let state=initial(),disposed=false,generation=0,controller:AbortController|null=null;
  const listeners=new Set<()=>void>();
  const update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};

  const load=async(keepNotice=false):Promise<boolean>=>{
    if(!ctx.actor||!ctx.enabled||disposed)return false;
    controller?.abort();
    const c=controller=new AbortController(),g=++generation,timer=setTimeout(()=>c.abort(),20000);
    update({busy:true,...(keepNotice?{}:{notice:null})});
    try{
      const read=await service.read(ctx.actor,ctx.tenancyId,c.signal);
      if(disposed||g!==generation)return false;
      update({read,busy:false,ready:true,loadFailed:false});
      return true;
    }catch{
      if(!disposed&&g===generation)update({busy:false,ready:true,loadFailed:true});
      return false;
    }finally{clearTimeout(timer);}
  };

  const perform=async(op:MoveInOperation):Promise<boolean>=>{
    if(!ctx.actor||disposed)return false;
    controller?.abort();
    const c=controller=new AbortController(),g=++generation,timer=setTimeout(()=>c.abort(),20000);
    update({saving:true,error:null,conflictDate:null,notice:null,pending:op});
    try{
      await service.write(ctx.actor,op,c.signal);
      if(disposed||g!==generation)return false;
      update({saving:false,pending:null});
      await load(true);
      onWritten?.();
      return true;
    }catch(e){
      if(disposed||g!==generation)return false;
      const m=mapMoveInError(e,state.read?.currentStartDate??null);
      // Unknown outcome: keep the operation for Retry. Anything definite is over: the next tap is a new action with a new id.
      update({saving:false,pending:m.uncertain?op:null,error:m.reload||m.uncertain?null:m.text,conflictDate:m.conflictDate,notice:m.reload?m.text:null});
      if(m.reload)await load(true);
      return false;
    }finally{clearTimeout(timer);}
  };

  const start=(action:MoveInAction,payload:Record<string,string>):Promise<boolean>=>{
    if(state.saving||state.busy||!state.ready||state.pending||!ctx.enabled)return Promise.resolve(false);
    return perform({tenancyId:ctx.tenancyId,operationId:newId(),action,payload});
  };
  const open=():{id:string;revision:string}|null=>{const q=state.read?.request;return q&&q.status==='pending'?{id:q.id,revision:q.revision}:null;};

  return {
    subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
    getSnapshot:()=>state,
    activate(){disposed=false;},
    dispose(){disposed=true;generation++;controller?.abort();state=initial();},
    load:()=>load(),
    /** Either person asks for an earlier move-in date, with an optional note. */
    request:(requestedStartDate:string,note?:string)=>start('request',requestPayload(requestedStartDate,note)),
    /** The asker takes the pending request back. */
    withdraw:()=>{const q=open();return q?start('withdraw',decisionPayload(q.id,q.revision)):Promise.resolve(false);},
    accept:()=>{const q=open();return q?start('accept',decisionPayload(q.id,q.revision)):Promise.resolve(false);},
    decline:(note?:string)=>{const q=open();return q?start('decline',decisionPayload(q.id,q.revision,note)):Promise.resolve(false);},
    /** Repeats only the unresolved write, with the same operation id. */
    retry():Promise<boolean>{const op=state.pending;if(!op||state.saving||disposed)return Promise.resolve(false);return perform(op);},
    /** Reads again. If a write was unresolved, says whether it went through; if it did, nothing is left to retry. */
    async checkStatus():Promise<boolean>{
      if(state.saving||state.busy||disposed)return false;
      const op=state.pending,ok=await load(true);
      if(!ok||!op)return ok;
      const q=state.read?.request??null;
      const went=op.action==='request'?!!q&&q.status==='pending'&&q.requestedByMe&&q.requestedStartDate===op.payload.requestedStartDate
        :!(q&&q.status==='pending'&&q.id===op.payload.requestId&&q.revision===op.payload.revision);
      update(went?{pending:null,notice:'It went through.'}:{notice:'It has not gone through yet. Try again.'});
      if(went)onWritten?.();
      return true;
    },
    clearError(){if(!state.saving)update({error:null,conflictDate:null});},
  };
}
export type TenancyMoveInWorkflow=ReturnType<typeof createTenancyMoveInWorkflow>;
