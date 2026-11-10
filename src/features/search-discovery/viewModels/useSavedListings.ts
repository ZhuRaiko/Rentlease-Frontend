import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createSavedListingsService} from '../services/savedListingsService';
import {createSavedListingsWorkflow} from './savedListingsWorkflow';
const service=createSavedListingsService(getSupabaseClient);
export function useSavedListings(actor:string|undefined,ids:readonly string[],active:boolean){
 const workflow=useMemo(()=>createSavedListingsWorkflow(service,actor),[actor]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 const key=JSON.stringify([...new Set(ids)].sort()),latest=useRef({ids,active});latest.current={ids,active};
 useEffect(()=>{workflow.activate();const listener=AppState.addEventListener('change',s=>{if(s==='active'){void workflow.lookup(latest.current.ids);if(latest.current.active)void workflow.load();}else workflow.clear();});return()=>{listener.remove();workflow.dispose();};},[workflow]);
 useEffect(()=>{void workflow.lookup(ids);},[workflow,key,active]);
 useEffect(()=>{if(active)void workflow.load();},[workflow,active]);
 const refresh=()=>{void workflow.lookup(latest.current.ids);if(latest.current.active)void workflow.load();};
 return{state,workflow,refresh,retry:()=>state.pending?void workflow.retry():refresh()};
}
