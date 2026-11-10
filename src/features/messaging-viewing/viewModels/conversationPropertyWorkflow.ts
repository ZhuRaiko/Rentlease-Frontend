import type {Conversation} from '../models/PersistentMessaging';
import type {ConversationProperty} from '../models/ConversationProperty';
import type {createConversationPropertyService} from '../services/conversationPropertyService';
export const conversationPropertyKey=(rows:readonly Conversation[])=>rows.map(c=>[c.id,c.listingId,c.tenantId,c.landlordId].join(':')).sort().join(',');
export function createConversationPropertyWorkflow(owner:string|undefined,service:ReturnType<typeof createConversationPropertyService>){
 let state={key:'',rows:{} as Record<string,ConversationProperty>,loading:false,error:null as string|null},disposed=false,generation=0,controller:AbortController|null=null;
 const listeners=new Set<()=>void>(),update=(p:Partial<typeof state>)=>{if(!disposed){state={...state,...p};listeners.forEach(f=>f());}};
 const load=async(conversations:readonly Conversation[],force=false)=>{
  const key=conversationPropertyKey(conversations);if(disposed||!owner||(!force&&state.key===key))return;
  const g=++generation;controller?.abort();const c=controller=new AbortController();update({key,rows:{},loading:true,error:null});
  try{const batches=[];for(let at=0;at<conversations.length;at+=50)batches.push(conversations.slice(at,at+50));
   const rows=Object.assign({},...await Promise.all(batches.map(batch=>service.load(owner,batch,c.signal))));
   if(!disposed&&g===generation)update({rows});
  }catch{if(!disposed&&g===generation)update({rows:{},error:'Property information could not load. Your messages are still available.'});}
  finally{if(!disposed&&g===generation)update({loading:false});}
 };
 return{getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},load,activate(){disposed=false;},dispose(){generation++;controller?.abort();disposed=true;state={key:'',rows:{},loading:false,error:null};}};
}
