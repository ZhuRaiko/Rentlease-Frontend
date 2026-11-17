import {decisionPayload,mapExtensionError,requestPayload,type ExtensionAction,type ExtensionOperation,type ExtensionRead} from '../models/TenancyExtension';
import type {TenancyExtensionService} from '../services/tenancyExtensionService';

export interface ExtensionContext {actor:string|undefined;tenancyId:string;/** Only an active tenancy loads anything; otherwise nothing is read and nothing is shown. */enabled:boolean}
const initial=()=>({
  read:null as ExtensionRead|null,ready:false,busy:false,saving:false,
  /** A mapped sentence for the last refusal, or null. Never raw server text. */error:null as string|null,
  /** The first clashing date from the last 23P01 (a request or an accept), or null. */conflictDate:null as string|null,
  notice:null as string|null,pending:null as ExtensionOperation|null,
});

/**
 * One tenancy's extension request. Rules this file keeps:
 * - A fresh operation id for every user action. After an unknown outcome the SAME action is retried with the SAME id (retry()); nothing else
 *   can start until it is resolved, and nothing retries by itself.
 * - A definite refusal is mapped to one sentence. 40001 reloads; 23P01 keeps the first clashing date for the alert; the screen stays where it is.
 * - A read that fails leaves read null, so the screen shows nothing for the feature (the RPCs may not be deployed yet).
 */
export function createTenancyExtensionWorkflow(service:Pick<TenancyExtensionService,'read'|'write'>,ctx:ExtensionContext,newId:()=>string){
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
      update({read,busy:false,ready:true});
      return true;
    }catch{
      if(!disposed&&g===generation)update({read:null,busy:false,ready:true});
      return false;
    }finally{clearTimeout(timer);}
  };

  const perform=async(op:ExtensionOperation):Promise<boolean>=>{
    if(!ctx.actor||disposed)return false;
    controller?.abort();
    const c=controller=new AbortController(),g=++generation,timer=setTimeout(()=>c.abort(),20000);
    update({saving:true,error:null,conflictDate:null,notice:null,pending:op});
    try{
      await service.write(ctx.actor,op,c.signal);
      if(disposed||g!==generation)return false;
      update({saving:false,pending:null});
      await load();
      return true;
    }catch(e){
      if(disposed||g!==generation)return false;
      const m=mapExtensionError(e,state.read?.currentEndDate??null);
      // Unknown outcome: keep the operation for Retry. Anything definite is over: the next tap is a new action with a new id.
      update({saving:false,pending:m.uncertain?op:null,error:m.reload?null:m.text,conflictDate:m.conflictDate,notice:m.reload?m.text:null});
      if(m.reload)await load(true);
      return false;
    }finally{clearTimeout(timer);}
  };

  const start=(action:ExtensionAction,payload:Record<string,string>):Promise<boolean>=>{
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
    /** The tenant asks for a new end date. */
    request:(requestedEndDate:string)=>start('request',requestPayload(requestedEndDate)),
    /** The tenant cancels the pending request. */
    withdraw:()=>{const q=open();return q?start('withdraw',decisionPayload(q.id,q.revision)):Promise.resolve(false);},
    accept:()=>{const q=open();return q?start('accept',decisionPayload(q.id,q.revision)):Promise.resolve(false);},
    decline:(note?:string)=>{const q=open();return q?start('decline',decisionPayload(q.id,q.revision,note)):Promise.resolve(false);},
    /** Repeats only the unresolved write, with the same operation id. */
    retry():Promise<boolean>{const op=state.pending;if(!op||state.saving||disposed)return Promise.resolve(false);return perform(op);},
    clearError(){if(!state.saving)update({error:null,conflictDate:null});},
  };
}
export type TenancyExtensionWorkflow=ReturnType<typeof createTenancyExtensionWorkflow>;
