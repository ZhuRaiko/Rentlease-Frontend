import {ReviewError} from '../models/RentalReview';
import {validateReviewCloud,type ReviewCloud,type ReviewCorpus} from '../models/ReviewWordCloud';
export function createReviewWordCloudWorkflow(read:(signal:AbortSignal)=>Promise<ReviewCorpus>,process:((corpus:ReviewCorpus,signal:AbortSignal)=>Promise<unknown>)|undefined){
 const initial=()=>({status:'idle' as 'idle'|'loading'|'ready'|'unavailable'|'error',corpus:null as ReviewCorpus|null,cloud:null as ReviewCloud|null,selected:null as string|null,error:null as string|null});
 let state=initial(),generation=0,disposed=false,controller:AbortController|null=null;const listeners=new Set<()=>void>();
 const publish=(next:typeof state)=>{state=next;listeners.forEach(f=>f());};
 const clear=()=>{generation++;controller?.abort();publish(initial());};
 const load=async(selected:string|null=null)=>{if(disposed)return;controller?.abort();const c=controller=new AbortController(),g=++generation;publish({...initial(),status:'loading'});
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{
   const work=async()=>{const corpus=await read(c.signal);if(c.signal.aborted)throw Error();
    if(corpus.count===0)return{corpus,cloud:{status:'empty',terms:[]} as ReviewCloud,status:'ready' as const};
    if(!process)return{corpus,cloud:null,status:'unavailable' as const};
    const cloud=validateReviewCloud(await process(corpus,c.signal),corpus);
    // Re-read after processing: never publish an already superseded corpus.
    const current=await read(c.signal);if(current.version!==corpus.version||current.count!==corpus.count)throw Error();
    return{corpus:current,cloud,status:'ready' as const};
   };
   const result=await Promise.race([work(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{c.abort();reject(Error());},60000);})]);
   if(!disposed&&g===generation&&!c.signal.aborted)publish({...initial(),...result,selected:result.cloud?.terms.some(t=>t.id===selected)?selected:null});
  }catch(e){if(!disposed&&g===generation)publish({...initial(),status:'error',error:e instanceof ReviewError?e.message:'Published review themes could not load or changed. Refresh to try again.'});}finally{clearTimeout(timeout);}
 };
 return{getSnapshot:()=>state,subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};},load,clear,activate(){disposed=false;},dispose(){disposed=true;clear();},select(id:string|null){return load(id);}};
}
