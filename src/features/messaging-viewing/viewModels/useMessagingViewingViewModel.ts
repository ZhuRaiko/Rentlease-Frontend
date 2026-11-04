import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {messagingService,messageId,messagingForeground} from '../services/messagingDependencies';
import {createMessagingWorkflow} from './messagingWorkflow';
export function useMessagingViewingViewModel(accountId?:string,conversationId?:string){
 const workflow=useMemo(()=>createMessagingWorkflow(messagingService,messageId),[accountId]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();if(conversationId)void workflow.open(conversationId);else void workflow.inbox();const timer=setInterval(()=>{if(messagingForeground())void workflow.poll();},15000);return()=>{clearInterval(timer);workflow.dispose();};},[workflow,conversationId]);
 return{...state,workflow,screen:state.selectedId?'conversation' as const:'inbox' as const,openInbox:()=>{workflow.closeThread();void workflow.inbox();},openConversation:(id:string)=>void workflow.open(id),backFromWorkspace:(onClose:()=>void)=>{if(state.selectedId)workflow.closeThread();else onClose();}};
}
export type MessagingViewingViewModel=ReturnType<typeof useMessagingViewingViewModel>;
