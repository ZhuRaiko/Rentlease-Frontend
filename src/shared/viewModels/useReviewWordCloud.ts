import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {createRentalReviewService} from '../services/rentalReviewService';
import {getSupabaseClient} from '../services/supabase/client';
import {loadPropertyReviewCorpus,createReviewCloudProcessor} from '../services/reviewWordCloudService';
import {createReviewWordCloudWorkflow,type CloudCache,type CloudCacheEntry} from './reviewWordCloudWorkflow';
import {cloudChips,cloudView,highlightForReview,matchingReviews} from '../models/reviewCloudPresentation';
import type {ReviewCloudProcessor} from '../models/ReviewWordCloud';
const service=createRentalReviewService(getSupabaseClient);
// Server deployment is separate; failed/missing bridge calls never generate a local cloud.
const liveProcessor=createReviewCloudProcessor(getSupabaseClient);
// In memory for the session only (cleared when the app restarts): one entry per account and property.
const sessionCache=new Map<string,CloudCacheEntry>();
const cacheFor=(key:string):CloudCache=>({get:()=>sessionCache.get(key),set:entry=>{sessionCache.set(key,entry);}});

/**
 * The property review word cloud for one property view. `enabled` says whether the cloud is on screen; it loads the first time it is, once, and then comes from the session cache.
 * The View only renders what this returns (the card state, the chips, the matching reviews and the highlight for a review); choosing a term makes no request.
 */
export function useReviewWordCloud(actor:string|undefined,propertyId:string,options:{enabled?:boolean;processor?:ReviewCloudProcessor}={}){
 const enabled=options.enabled??true,processor=options.processor??liveProcessor;
 const workflow=useMemo(()=>createReviewWordCloudWorkflow(signal=>actor?loadPropertyReviewCorpus(service,actor,propertyId,signal):Promise.reject(Error('signed out')),actor&&processor?(corpus,signal)=>processor.process(actor,corpus,signal):undefined,{cache:cacheFor(`${actor??'-'}:${propertyId}`)}),[actor,propertyId,processor]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();if(actor&&enabled)void workflow.ensure();return()=>{workflow.dispose();};},[actor,enabled,workflow]);
 const term=state.cloud?.terms.find(t=>t.id===state.selected)??null;
 return{...state,term,workflow,
  view:cloudView({signedIn:!!actor,status:state.status,cloud:state.cloud,errorKind:state.errorKind}),
  chips:useMemo(()=>cloudChips(state.cloud),[state.cloud]),
  matching:useMemo(()=>matchingReviews(state.corpus,term),[state.corpus,term]),
  highlight:(reviewId:string,shownText:string|null)=>highlightForReview(state.corpus,term,reviewId,shownText),
  select:(id:string|null)=>workflow.select(id),
  retry:()=>{void workflow.load();}};
}
