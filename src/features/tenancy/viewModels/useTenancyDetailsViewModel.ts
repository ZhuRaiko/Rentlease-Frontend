import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
import {createTenancyDetailsService} from '../services/tenancyDetailsService';
import {createTenancyDetailsWorkflow} from './tenancyDetailsWorkflow';
const service=createTenancyDetailsService(getSupabaseClient);
export function useTenancyDetailsViewModel(actor:string|undefined,id:string,sourceId:string|null,paused=false){
 const workflow=useMemo(()=>createTenancyDetailsWorkflow(service,actor,id,sourceId),[actor,id,sourceId]),pause=useRef(paused);pause.current=paused;
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();const sub=AppState.addEventListener('change',value=>{if(value==='active'&&!pause.current)void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow]);
 const wasPaused=useRef(paused);useEffect(()=>{if(wasPaused.current&&!paused)void workflow.load();wasPaused.current=paused;},[paused,workflow]);
 const t=state.data?.tenancy,identities=usePublicIdentitiesViewModel(actor,t?[t.tenant_id,t.landlord_id]:[]);
 return {...state,workflow,identities};
}
