import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../supabase/database.types';
import {parsePredictionTarget,parsePredictionReceipt,PredictionError,type PredictionTarget} from '../../models/RentalPrediction';
const messages:Record<string,string>={auth:'Sign in again to estimate rent.',eligibility:'An active Tier 1 account is required.',access:'This property is unavailable or is not accessible to your account.',input:'Review the saved property details: use a supported house, apartment, or condominium and a positive floor area. Measurements must be valid.',model_input:'The model rejected the saved property inputs. Review the property type, measurements, furnishing, and city before estimating again.',configuration:'Price estimation needs its server configuration before it can be used.',busy:'An estimate is already in progress. Wait before retrying.',rate_limit:'The estimator is busy. Wait before retrying.',timeout:'The estimator took too long to start. It may be waking up on Render. Please retry.',invalid_result:'The estimator returned an invalid result. Please retry.',upstream:'The prediction service is temporarily unavailable. Please retry.',unavailable:'The estimator could not be reached. Please retry.'};
export function createPricePredictionClient(getClient:()=>SupabaseClient<Database>){
 return {async predict(actor:string,target:PredictionTarget,signal:AbortSignal){
 parsePredictionTarget(target);const identity=async()=>{const {data,error}=await getClient().auth.getUser();if(error||data.user?.id!==actor||signal.aborted)throw new PredictionError('Your account changed or this request was canceled.','auth');};await identity();
 let response;try{response=await getClient().functions.invoke('rental-price-estimate',{body:target,signal,timeout:85000});}catch{await identity();throw new PredictionError('The estimator could not be reached. It may be starting on Render. Please retry.');}await identity();const {data,error}=response;
 if(error){
 const context=(error&&typeof error==='object'&&'context' in error?error.context:null)??response.response;
 const transport=context&&typeof context==='object'?context as {status?:unknown;json?:()=>Promise<unknown>;clone?:()=>{json:()=>Promise<unknown>}}:null;
 const status=typeof transport?.status==='number'?transport.status:undefined;
 let code=status===422||status===400?'input':status===401?'auth':status===403?'access':status===404?'configuration':status===429?'rate_limit':status===504?'timeout':status===503?'upstream':'unavailable';
 // Native/polyfilled responses may not share the global Response constructor.
 if(typeof transport?.json==='function'){try{const body=await (typeof transport.clone==='function'?transport.clone():transport).json!();if(body&&typeof body==='object'&&'code' in body&&typeof body.code==='string'&&Object.prototype.hasOwnProperty.call(messages,body.code))code=body.code;}catch{/* Never expose raw provider bodies. */}}
 if(status===504)code='timeout';
 throw new PredictionError(messages[code]!,code);}
 return parsePredictionReceipt(data,target);
 }};
}
export type PricePredictionClient=ReturnType<typeof createPricePredictionClient>;
