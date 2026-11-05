import {AppState} from 'react-native';
import {createRealtimeSync} from './realtimeSync';
import type {MessagingConnection} from '../services/messagingRealtimeService';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {messagingService,messagingRealtimeService,messageId} from '../services/messagingDependencies';
import {createMessagingWorkflow} from './messagingWorkflow';
export function useMessagingViewingViewModel(accountId?:string,conversationId?:string){
 const workflow=useMemo(()=>createMessagingWorkflow(messagingService,messageId),[accountId]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 const [connection,setConnection]=useState<MessagingConnection>('connecting');
 const [realtimeAttempt,setRealtimeAttempt]=useState(0);
 useEffect(()=>{workflow.activate();return()=>workflow.dispose();},[workflow]);
 useEffect(()=>{if(conversationId)void workflow.open(conversationId);else void workflow.inbox();},[workflow,conversationId]);
 useEffect(()=>{
  if(!state.owner)return;const owner=state.owner,controller=new AbortController();let watchStop:(()=>void)|null=null;
  const sync=createRealtimeSync(()=>workflow.synchronize(controller.signal));
  const connect=()=>{watchStop?.();watchStop=messagingRealtimeService.watch(owner,state.selectedId,()=>sync.request(),setConnection,()=>workflow.clearAccount());sync.request();};
  if(AppState.currentState==='active')connect();
  const foreground=AppState.addEventListener('change',status=>{if(status==='active')connect();else{watchStop?.();watchStop=null;setConnection('connecting');}});
  return()=>{controller.abort();sync.stop();watchStop?.();foreground.remove();};
 },[workflow,state.owner,state.selectedId,realtimeAttempt]);
 return{...state,connection,workflow,refresh:()=>{if(connection==='unavailable')setRealtimeAttempt(value=>value+1);void workflow.synchronize();},screen:state.selectedId?'conversation' as const:'inbox' as const,openInbox:()=>{workflow.closeThread();void workflow.inbox();},openConversation:(id:string)=>void workflow.open(id),backFromWorkspace:(onClose:()=>void)=>{if(state.selectedId)workflow.closeThread();else onClose();}};
}
export type MessagingViewingViewModel=ReturnType<typeof useMessagingViewingViewModel>;
