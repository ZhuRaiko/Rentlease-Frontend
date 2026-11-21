import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTenancyMoveInService} from '../services/tenancyMoveInService';
import {createTenancyMoveInWorkflow} from './tenancyMoveInWorkflow';
const service=createTenancyMoveInService(getSupabaseClient);
/** The move-in request for one tenancy. Nothing is read unless `enabled` (the tenancy exists and still waits for its start date). `onWritten` runs after a confirmed change. */
export function useTenancyMoveInViewModel(actor:string|undefined,tenancyId:string,enabled:boolean,onWritten?:()=>void){
 // The callback is read through a ref, so a new function each render never restarts the workflow.
 const written=useRef(onWritten);written.current=onWritten;
 const workflow=useMemo(()=>createTenancyMoveInWorkflow(service,{actor,tenancyId,enabled},randomUUID,()=>written.current?.()),[actor,tenancyId,enabled]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow]);
 return {...state,workflow};
}
export type TenancyMoveInViewModel=ReturnType<typeof useTenancyMoveInViewModel>;
