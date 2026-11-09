import {PredictionError,type PredictionReceipt,type PredictionTarget} from '../models/RentalPrediction';
import type {RentalEstimateEligibility} from '../models/RentalEstimateEligibility';
import type {PricePredictionClient} from '../services/ml/priceEstimationClient';
export function createInlineRentalEstimate(client:PricePredictionClient,accountId:string|undefined,target:PredictionTarget,eligibility?:RentalEstimateEligibility){
 let state:{busy:boolean;result:PredictionReceipt|null;error:string|null;errorCode:string|null;retryable:boolean}={busy:false,result:null,error:null,errorCode:null,retryable:true};
 let disposed=false,generation=0,controller:AbortController|undefined;
 const listeners=new Set<()=>void>();
 const update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
 const cancel=()=>{generation++;controller?.abort();};
 return {getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){disposed=false;},dispose(){cancel();disposed=true;state={busy:false,result:null,error:null,errorCode:null,retryable:true};},
 async predict(){if(disposed||state.busy||eligibility?.eligible===false)return;const g=++generation;controller=new AbortController();update({busy:true,result:null,error:null,errorCode:null,retryable:true});
 try{if(!accountId)throw new PredictionError('Sign in to estimate rent.','auth');const result=await client.predict(accountId,target,controller.signal);if(!disposed&&g===generation)update({result});}
 catch(e){if(!disposed&&g===generation)update({error:e instanceof PredictionError?e.message:'The estimator is unavailable. Please retry.',errorCode:e instanceof PredictionError?e.code:'unavailable',retryable:!(e instanceof PredictionError)||['unavailable','upstream','timeout','busy','rate_limit','invalid_result'].includes(e.code)});}
 finally{if(!disposed&&g===generation)update({busy:false});}}
 };
}
