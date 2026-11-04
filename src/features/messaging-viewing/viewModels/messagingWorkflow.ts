import {MessagingError,type Conversation,type PersistentMessage} from '../models/PersistentMessaging';
import type {MessagingService} from '../services/messagingService';
const initial=()=>({owner:null as string|null,inbox:[] as Conversation[],inboxBusy:false,inboxError:null as string|null,inboxMore:false,selectedId:null as string|null,conversation:null as Conversation|null,messages:[] as PersistentMessage[],messageBusy:false,messageError:null as string|null,olderBusy:false,hasOlder:false,composer:'',sending:false,sendError:null as string|null,uncertain:false});
export function createMessagingWorkflow(service:MessagingService,newId:()=>string){
 let state=initial(),disposed=false,generation=0,thread=0,inboxOffset=0,reconcileOffset=0,readCursor:PersistentMessage|null=null;
 let inboxController:AbortController|null=null,messageController:AbortController|null=null,olderController:AbortController|null=null;
 let pending:{id:string;body:string;conversationId:string}|null=null;
 const listeners=new Set<()=>void>();const update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
 const clear=()=>{generation++;thread++;inboxController?.abort();messageController?.abort();olderController?.abort();pending=null;readCursor=null;reconcileOffset=0;inboxOffset=0;};
 const failure=(e:unknown)=>{if(e instanceof MessagingError&&e.identity){clear();update({...initial(),inboxError:e.message});return true;}return false;};
 const safe=(e:unknown)=>e instanceof MessagingError?e.message:'Could not load messages. Please retry.';
 const merge=(a:PersistentMessage[],b:PersistentMessage[])=>[...new Map([...a,...b].map(m=>[m.id,m])).values()].sort((x,y)=>x.createdAt.localeCompare(y.createdAt)||x.id.localeCompare(y.id));
 const inbox=async(append=false)=>{if(disposed||state.inboxBusy)return;const g=generation,c=inboxController=new AbortController(),offset=append?inboxOffset:0;update({inboxBusy:true,inboxError:null});
  try{const owner=await service.user();if(disposed||g!==generation)return;const rows=await service.inbox(owner,offset,c.signal);if(disposed||g!==generation)return;inboxOffset=append?offset+rows.length:Math.max(inboxOffset,rows.length);const existing=append?state.inbox:state.inbox.filter(r=>!rows.some(v=>v.id===r.id));const result=append?[...state.inbox,...rows]:[...rows,...existing];update({owner,inbox:[...new Map(result.map(r=>[r.id,r])).values()],inboxMore:append?rows.length===20:(inboxOffset>20?state.inboxMore:rows.length===20)});
  }catch(e){if(!disposed&&g===generation&&!failure(e))update({inboxError:safe(e)});}finally{if(!disposed&&g===generation)update({inboxBusy:false});}};
 const refreshMessages=async()=>{if(disposed||!state.owner||!state.selectedId||state.messageBusy)return;const g=generation,t=thread,owner=state.owner,id=state.selectedId,c=messageController=new AbortController();update({messageBusy:true,messageError:null});
  try{const known=state.messages.slice(reconcileOffset,reconcileOffset+100).map(m=>m.id);
    const [rows,reconciled]=await Promise.all([service.messages(owner,id,readCursor?'newer':'latest',readCursor,c.signal),known.length?service.reconcile(owner,id,known,c.signal):Promise.resolve([])]);
    if(disposed||g!==generation||t!==thread)return;readCursor=rows.at(-1)??readCursor;reconcileOffset=reconcileOffset+100>=state.messages.length?0:reconcileOffset+100;
    const retained=state.messages.filter(m=>!known.includes(m.id)||reconciled.some(r=>r.id===m.id));update({messages:merge(merge(retained,rows),reconciled)});
  }catch(e){if(!disposed&&g===generation&&t===thread&&!failure(e))update({messageError:safe(e)});}finally{if(!disposed&&g===generation&&t===thread)update({messageBusy:false});}};
 const open=async(id:string)=>{if(disposed)return;const g=generation,t=++thread;messageController?.abort();olderController?.abort();pending=null;readCursor=null;reconcileOffset=0;const c=messageController=new AbortController();update({selectedId:id,conversation:null,messages:[],messageBusy:true,messageError:null,olderBusy:false,composer:'',sendError:null,sending:false,uncertain:false});
  try{const owner=await service.user();if(disposed||g!==generation||t!==thread)return;const [rows,messages]=await Promise.all([service.inbox(owner,0,c.signal,id),service.messages(owner,id,'latest',null,c.signal)]);if(disposed||g!==generation||t!==thread)return;const conversation=rows.find(v=>v.id===id);if(!conversation)throw new MessagingError('This conversation is unavailable.');readCursor=messages.at(-1)??null;update({owner,conversation,messages,hasOlder:messages.length===50});
  }catch(e){if(!disposed&&g===generation&&t===thread&&!failure(e))update({messageError:safe(e)});}finally{if(!disposed&&g===generation&&t===thread)update({messageBusy:false});}};
 const older=async()=>{if(disposed||state.olderBusy||!state.hasOlder||!state.owner||!state.selectedId)return;const g=generation,t=thread,c=olderController=new AbortController();update({olderBusy:true});try{const rows=await service.messages(state.owner,state.selectedId,'older',state.messages[0]??null,c.signal);if(!disposed&&g===generation&&t===thread)update({messages:merge(rows,state.messages),hasOlder:rows.length===50});}catch(e){if(!disposed&&g===generation&&t===thread&&!failure(e))update({messageError:safe(e)});}finally{if(!disposed&&g===generation&&t===thread)update({olderBusy:false});}};
 const send=async()=>{if(disposed||state.sending||!state.owner||!state.conversation||state.conversation.status!=='open'||!state.composer.trim())return;const g=generation,t=thread;
  pending??={id:newId(),body:state.composer,conversationId:state.conversation.id};const draft=pending;update({sending:true,sendError:null});
  try{const receipt=await service.send(state.owner,draft.conversationId,draft.id,draft.body);if(disposed||g!==generation||t!==thread)return;pending=null;update({messages:merge(state.messages,[receipt]),composer:'',uncertain:false});void refreshMessages();
  }catch(e){if(!disposed&&g===generation&&t===thread&&!failure(e)){const uncertain=e instanceof MessagingError&&e.uncertain;if(!uncertain)pending=null;update({sendError:safe(e),uncertain});}}finally{if(!disposed&&g===generation&&t===thread)update({sending:false});}};
 // useSyncExternalStore owns subscription cleanup. Clearing its listeners here
 // strands a retained subscription when React replays the lifecycle effect.
 return{getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){disposed=false;},dispose(){clear();disposed=true;state=initial();},inbox,open,older,send,refreshMessages,
 setComposer(value:string){if(!state.sending&&!state.uncertain)update({composer:value});},closeThread(){thread++;messageController?.abort();olderController?.abort();pending=null;readCursor=null;reconcileOffset=0;update({selectedId:null,conversation:null,messages:[],messageBusy:false,messageError:null,hasOlder:false,olderBusy:false,composer:'',sending:false,sendError:null,uncertain:false});},
 async poll(){if(state.selectedId){await refreshMessages();}else await inbox();}
 };
}
