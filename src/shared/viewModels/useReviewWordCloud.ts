import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {createRentalReviewService} from '../services/rentalReviewService';
import {getSupabaseClient} from '../services/supabase/client';
import {loadPropertyReviewCorpus,createReviewCloudProcessor} from '../services/reviewWordCloudService';
import {createReviewWordCloudWorkflow} from './reviewWordCloudWorkflow';
import type {ReviewCloudProcessor} from '../models/ReviewWordCloud';
const service=createRentalReviewService(getSupabaseClient);
// Server deployment is separate; failed/missing bridge calls never generate a local cloud.
const liveProcessor=createReviewCloudProcessor(getSupabaseClient);
export function useReviewWordCloud(actor:string|undefined,propertyId:string,processor:ReviewCloudProcessor=liveProcessor){
 const workflow=useMemo(()=>createReviewWordCloudWorkflow(signal=>actor?loadPropertyReviewCorpus(service,actor,propertyId,signal):Promise.reject(Error()),actor&&processor?(corpus,signal)=>processor.process(actor,corpus,signal):undefined),[actor,propertyId,processor]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();if(actor)void workflow.load();const sub=AppState.addEventListener('change',s=>{if(s==='active'&&actor)void workflow.load();else workflow.clear();});
 // No persisted text/cache. Revalidate while mounted; precise remote invalidation needs a server revision contract.
 const timer=setInterval(()=>{if(actor&&AppState.currentState==='active')void workflow.load();},60000);
 return()=>{clearInterval(timer);sub.remove();workflow.dispose();};},[actor,workflow]);
 return{...state,workflow};
}
