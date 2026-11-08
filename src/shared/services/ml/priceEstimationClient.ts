import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../supabase/database.types';
import {parsePredictionTarget,parsePredictionReceipt,PredictionError,type PredictionTarget} from '../../models/RentalPrediction';
const messages:Record<string,string>={auth:'Sign in again to estimate rent.',eligibility:'An active Tier 1 account is required.',access:'This property is unavailable or is not accessible to your account.',input:'Review this property: its model inputs are unsupported or incomplete.',model_input:'The model rejected this property. Review the stored property details.',configuration:'Price estimation needs its server configuration before it can be used.',busy:'An estimate is already in progress. Wait before retrying.',rate_limit:'The estimator is busy. Wait before retrying.',timeout:'The estimator took too long to start. It may be waking up on Render. Please retry.',invalid_result:'The estimator returned an invalid result. Please retry.'};
export function createPricePredictionClient(getClient:()=>SupabaseClient<Database>){
 return {async predict(actor:string,target:PredictionTarget,signal:AbortSignal){
 parsePredictionTarget(target);const identity=async()=>{const {data,error}=await getClient().auth.getUser();if(error||data.user?.id!==actor||signal.aborted)throw new PredictionError('Your account changed or this request was canceled.','auth');};await identity();
 let response;try{response=await getClient().functions.invoke('rental-price-estimate',{body:target,signal,timeout:85000});}catch{await identity();throw new PredictionError('The estimator could not be reached. It may be starting on Render. Please retry.');}await identity();const {data,error}=response;
 if(error){let code='unavailable';const context=error&&typeof error==='object'&&'context' in error?error.context:null;
 if(context instanceof Response){try{const body=await context.json();if(typeof body?.code==='string'&&body.code.trim())code=body.code;}catch{/* Never expose provider error bodies. */}if(context.status===404&&!messages[code])code='configuration';if(context.status===504)code='timeout';}
 throw new PredictionError(messages[code]??'The estimator is unavailable. It may be starting on Render. Please retry.',code);}
 return parsePredictionReceipt(data,target);
 }};
}
export type PricePredictionClient=ReturnType<typeof createPricePredictionClient>;
