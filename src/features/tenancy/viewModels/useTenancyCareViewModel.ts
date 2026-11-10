import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTenancyCareService} from '../services/tenancyCareService';
import {createCareJournal} from '../services/tenancyCareJournal';
import {createTenancyCareWorkflow} from './tenancyCareWorkflow';
const service=createTenancyCareService(getSupabaseClient),journal=createCareJournal(AsyncStorage);
export function useTenancyCareViewModel(actor:string|undefined,id:string){const workflow=useMemo(()=>createTenancyCareWorkflow(service,journal,actor,id,randomUUID),[actor,id]),state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow]);return{...state,workflow};}
