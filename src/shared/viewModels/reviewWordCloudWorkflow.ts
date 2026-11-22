import {validateReviewCloud,type ReviewCloud,type ReviewCorpus} from '../models/ReviewWordCloud';
import {cloudErrorCopy,nextSelection,type CloudErrorKind} from '../models/reviewCloudPresentation';

export interface CloudCacheEntry{corpus:ReviewCorpus;cloud:ReviewCloud}
/** Where a finished cloud is kept for the rest of the session (in memory only; nothing is written to storage). */
export interface CloudCache{get():CloudCacheEntry|undefined;set(entry:CloudCacheEntry):void}
export interface CloudWorkflowOptions{cache?:CloudCache;timeoutMs?:number;busyRetryMs?:number;wait?:(ms:number,signal:AbortSignal)=>Promise<void>}
const KINDS:readonly string[]=['network','auth','busy','unavailable','invalid','timeout','generic'];
const kindOf=(error:unknown):CloudErrorKind=>{const kind=(error as {kind?:unknown}|null)?.kind;return typeof kind==='string'&&KINDS.includes(kind)?kind as CloudErrorKind:'generic';};
const defaultWait=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('aborted'));},{once:true});});

/**
 * The review word cloud's state. It loads the property's approved review texts and asks the review-wordcloud function for the terms (tags are not sent; Themes are separate).
 * Loaded ONCE per property view and kept for the session: choosing a term is local (no request), and nothing refreshes on a timer or when the app returns to the foreground.
 * Only an explicit Retry asks again. A slow first request (the service can take up to a minute to wake) shows as loading, not an error, and times out after 60 seconds.
 * A "busy" answer is retried once, automatically, after a short wait. Failures become a plain kind; raw error text and review text are never kept, shown or logged.
 */
export function createReviewWordCloudWorkflow(read:(signal:AbortSignal)=>Promise<ReviewCorpus>,process:((corpus:ReviewCorpus,signal:AbortSignal)=>Promise<unknown>)|undefined,options:CloudWorkflowOptions={}){
 const timeoutMs=options.timeoutMs??60000,busyRetryMs=options.busyRetryMs??4000,wait=options.wait??defaultWait,cache=options.cache;
 const initial=()=>({status:'idle' as 'idle'|'loading'|'ready'|'unavailable'|'error',corpus:null as ReviewCorpus|null,cloud:null as ReviewCloud|null,selected:null as string|null,error:null as string|null,errorKind:null as CloudErrorKind|null});
 let state=initial(),generation=0,disposed=false,controller:AbortController|null=null;const listeners=new Set<()=>void>();
 const publish=(next:typeof state)=>{state=next;listeners.forEach(f=>f());};
 const clear=()=>{generation++;controller?.abort();publish(initial());};
 const keep=(cloud:ReviewCloud|null,selected:string|null)=>cloud?.terms.some(t=>t.id===selected)?selected:null;
 /** Always asks the network (first load, and Retry). */
 const load=async()=>{if(disposed)return;const previous=state.selected;controller?.abort();const c=controller=new AbortController(),g=++generation;publish({...initial(),status:'loading'});
  let timeout:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  try{
   const work=async()=>{const corpus=await read(c.signal);if(c.signal.aborted)throw Error('aborted');
    if(corpus.count===0)return{corpus,cloud:{status:'empty',terms:[]} as ReviewCloud,status:'ready' as const};
    if(!process)return{corpus,cloud:null,status:'unavailable' as const};
    let raw:unknown;
    try{raw=await process(corpus,c.signal);}
    catch(e){if(kindOf(e)==='busy'&&!c.signal.aborted){await wait(busyRetryMs,c.signal);raw=await process(corpus,c.signal);}else throw e;}   // "busy": one automatic retry
    const cloud=validateReviewCloud(raw,corpus);
    // Re-read after processing: never publish an already superseded corpus.
    const current=await read(c.signal);if(current.version!==corpus.version||current.count!==corpus.count)throw Error('changed');
    return{corpus:current,cloud,status:'ready' as const};
   };
   const result=await Promise.race([work(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{timedOut=true;c.abort();reject(Error('timeout'));},timeoutMs);})]);
   if(!disposed&&g===generation&&!c.signal.aborted){if(result.status==='ready'&&result.cloud&&result.corpus.count>0)cache?.set({corpus:result.corpus,cloud:result.cloud});publish({...initial(),...result,selected:keep(result.cloud,previous)});}
  }catch(e){if(!disposed&&g===generation){const errorKind:CloudErrorKind=timedOut?'timeout':kindOf(e);publish({...initial(),status:'error',errorKind,error:cloudErrorCopy[errorKind]});}}finally{clearTimeout(timeout);}
 };
 /** Shows what the session already has, and asks the network only when it has nothing. With `expectCount`, a kept cloud is reused only if it was made from that many reviews. */
 const ensure=async(expectCount?:number)=>{if(disposed)return;const hit=cache?.get();if(hit&&(expectCount===undefined||hit.corpus.count===expectCount)){controller?.abort();generation++;publish({...initial(),status:'ready',corpus:hit.corpus,cloud:hit.cloud,selected:keep(hit.cloud,state.selected)});return;}if(state.status==='loading'||state.status==='ready')return;return load();};
 return{getSnapshot:()=>state,subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};},load,ensure,clear,activate(){disposed=false;},dispose(){disposed=true;clear();},
  /** Choosing a term is local: it never starts a request. Choosing the selected term again clears it. */
  select(id:string|null){if(state.status!=='ready')return;publish({...state,selected:keep(state.cloud,nextSelection(state.selected,id))});}};
}
