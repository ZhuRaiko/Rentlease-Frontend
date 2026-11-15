import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createPricePredictionClient} from '../../../shared/services/ml/priceEstimationClient';
import {createEstimatePropertyService} from '../services/estimatePropertyService';
import {createPriceEstimationWorkflow} from './priceEstimationWorkflow';
import type {EstimateActor} from '../models/RentalPriceEstimate';
const propertyService=createEstimatePropertyService(getSupabaseClient),predictionClient=createPricePredictionClient(getSupabaseClient);
export function useRentalPriceEstimationViewModel(actor:EstimateActor,accountId:string|undefined){
 const workflow=useMemo(()=>createPriceEstimationWorkflow(propertyService,predictionClient,accountId,actor==='landlord'?'owned':'published'),[accountId,actor]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();return()=>workflow.dispose();},[workflow]);
 const safe=state.owner&&state.owner!==accountId?{...state,properties:[],selected:null,result:null}:state;
 return {...safe,workflow,backFromWorkspace:(onClose:()=>void)=>{if(!workflow.back())onClose();}};
}
export type RentalPriceEstimationViewModel=ReturnType<typeof useRentalPriceEstimationViewModel>;
