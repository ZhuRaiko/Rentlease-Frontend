import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTenancyLifecycleService,createLifecycleJournal} from '../services/tenancyLifecycleService';
import {createTenancyLifecycleWorkflow} from './tenancyLifecycleWorkflow';
const service=createTenancyLifecycleService(getSupabaseClient),journal=createLifecycleJournal(AsyncStorage);
export function useTenancyLifecycleViewModel(actor:string|undefined,id:string){const workflow=useMemo(()=>createTenancyLifecycleWorkflow(service,journal,actor,id,randomUUID),[actor,id]),state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow]);return{...state,workflow};}
