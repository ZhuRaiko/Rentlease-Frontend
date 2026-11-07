import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import type {Conversation} from '../models/PersistentMessaging';
import {conversationPropertyService} from '../services/messagingDependencies';
import {conversationPropertyKey,createConversationPropertyWorkflow} from './conversationPropertyWorkflow';
export function useConversationPropertyViewModel(owner:string|undefined,rows:readonly Conversation[]){
 const workflow=useMemo(()=>createConversationPropertyWorkflow(owner,conversationPropertyService),[owner]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot),key=conversationPropertyKey(rows);
 useEffect(()=>{workflow.activate();return()=>workflow.dispose();},[workflow]);
 useEffect(()=>{void workflow.load(rows);},[workflow,key]);
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.load(rows,true);});return()=>sub.remove();},[workflow,key]);
 return{...state,rows:state.key===key?state.rows:{},refresh:()=>void workflow.load(rows,true)};
}
