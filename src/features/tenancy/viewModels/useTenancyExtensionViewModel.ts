import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTenancyExtensionService} from '../services/tenancyExtensionService';
import {createTenancyExtensionWorkflow} from './tenancyExtensionWorkflow';
const service=createTenancyExtensionService(getSupabaseClient);
/** The extension request for one tenancy. Nothing is read unless `enabled` (the tenancy is active), so an ended or upcoming tenancy shows nothing. */
export function useTenancyExtensionViewModel(actor:string|undefined,tenancyId:string,enabled:boolean){
 const workflow=useMemo(()=>createTenancyExtensionWorkflow(service,{actor,tenancyId,enabled},randomUUID),[actor,tenancyId,enabled]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow]);
 return {...state,workflow};
}
export type TenancyExtensionViewModel=ReturnType<typeof useTenancyExtensionViewModel>;
