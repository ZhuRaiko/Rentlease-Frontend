import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {rentalEstimateEligibility} from '../models/RentalEstimateEligibility';
import type {PredictionTarget} from '../models/RentalPrediction';
import {getSupabaseClient} from '../services/supabase/client';
import {createPricePredictionClient} from '../services/ml/priceEstimationClient';
import {createInlineRentalEstimate} from './inlineRentalEstimate';
const client=createPricePredictionClient(getSupabaseClient);
export function useInlineRentalEstimate(accountId:string|undefined,target:PredictionTarget,property?:Record<string,unknown>|null){
 const eligibility=rentalEstimateEligibility(property),savedKey=JSON.stringify(property);
 const listingId=target.listingId,propertyId=target.propertyId;
 const workflow=useMemo(()=>createInlineRentalEstimate(client,accountId,listingId?{listingId}:{propertyId:propertyId!},eligibility),[accountId,listingId,propertyId,savedKey]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();return()=>workflow.dispose();},[workflow]);
 return {...state,workflow,eligibility};
}
