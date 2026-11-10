import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTenancyEstablishmentService} from '../services/tenancyEstablishmentService';
import {createTenancyEstablishmentWorkflow} from './tenancyEstablishmentWorkflow';
import {setupActions} from '../models/TenancyEstablishment';
const service=createTenancyEstablishmentService(getSupabaseClient);
export function useTenancyEstablishmentViewModel(actor:string|undefined,reservationId:string){
 const workflow=useMemo(()=>createTenancyEstablishmentWorkflow(service,actor,reservationId,randomUUID),[actor,reservationId]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();const sub=AppState.addEventListener('change',value=>{if(value==='active')void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow]);
 return {...state,workflow,actions:state.context?setupActions(state.context,actor??''):[]};
}
