import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createInAppNotificationService} from '../services/inAppNotificationService';
import {createInAppNotificationWorkflow} from './inAppNotificationWorkflow';
export function useInAppNotifications(owner:string|undefined){const workflow=useMemo(()=>createInAppNotificationWorkflow(owner,createInAppNotificationService(getSupabaseClient)),[owner]);const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);useEffect(()=>{if(!owner)return;void workflow.refresh();const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.refresh();});const timer=setInterval(()=>{if(AppState.currentState==='active')void workflow.refresh();},30000);return()=>{clearInterval(timer);sub.remove();workflow.dispose();};},[workflow,owner]);return{...state,workflow};}
export type InAppNotificationsViewModel=ReturnType<typeof useInAppNotifications>;
