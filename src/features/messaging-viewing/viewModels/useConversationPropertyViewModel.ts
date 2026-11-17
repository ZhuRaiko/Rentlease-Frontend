import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import type {Conversation} from '../models/PersistentMessaging';
import {conversationPropertyService} from '../services/messagingDependencies';
import {conversationPropertyKey,createConversationPropertyWorkflow} from './conversationPropertyWorkflow';
import {createAccountCache,pickCached} from '../../../shared/utils/accountCache';
import type {ConversationProperty} from '../models/ConversationProperty';
/** The last property contexts (title, photos, "Your listing") per signed-in user, keyed by listing (memory only), so a list opened again has its photos at once. */
const contextCache=createAccountCache<Record<string,ConversationProperty>>();
export function useConversationPropertyViewModel(owner:string|undefined,rows:readonly Conversation[]){
 const workflow=useMemo(()=>createConversationPropertyWorkflow(owner,conversationPropertyService),[owner]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot),key=conversationPropertyKey(rows);
 useEffect(()=>{workflow.activate();return()=>workflow.dispose();},[workflow]);
 const token=useRef(0);
 useEffect(()=>{token.current=contextCache.begin();void workflow.load(rows);},[workflow,key]);
 useEffect(()=>{if(owner&&state.key===key&&Object.keys(state.rows).length)contextCache.set(owner,{...(contextCache.peek(owner)??{}),...state.rows},token.current);},[owner,key,state.key,state.rows]);
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.load(rows,true);});return()=>sub.remove();},[workflow,key]);
 return{...state,rows:state.key===key?state.rows:pickCached(contextCache.peek(owner),rows.map(row=>row.listingId)),refresh:()=>void workflow.load(rows,true)};
}
