import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {viewingService,messageId} from '../services/messagingDependencies';
import {createViewingWorkflow} from './viewingWorkflow';
import type {Conversation} from '../models/PersistentMessaging';
export function usePropertyViewingsViewModel(accountId:string|undefined,conversation:Conversation|null){
 const workflow=useMemo(()=>createViewingWorkflow(viewingService,messageId),[accountId]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.open(conversation);const sub=AppState.addEventListener('change',status=>{if(status==='active')void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow,conversation?.id]);
 const publicIdentities=usePublicIdentitiesViewModel(accountId,state.rows.map(r=>r.tenantId===accountId?r.landlordId:r.tenantId));
 return{...state,publicIdentities,workflow};
}
export type PropertyViewingsViewModel=ReturnType<typeof usePropertyViewingsViewModel>;
