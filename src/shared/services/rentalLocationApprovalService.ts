import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from './supabase/database.types';
import {isPredictionId} from '../models/RentalPrediction';
import {rentalLocationPolicy,parsePublicRentalPoint,type RentalCoordinates} from '../models/RentalCoordinateProjection';
export interface RentalLocationApproval {revision:string;approved:boolean;eligible:boolean;policy:string;point:RentalCoordinates|null}
export function parseRentalLocationApproval(value:unknown):RentalLocationApproval {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Location approval is unavailable.');
 const r=value as Record<string,unknown>;
 if(!isPredictionId(r.revision)||typeof r.approved!=='boolean'||typeof r.eligible!=='boolean'||r.policy!==rentalLocationPolicy)throw Error('Location approval is unavailable.');
 const point=parsePublicRentalPoint(r.point);
 if(r.eligible&&!point)throw Error('Location approval point is unavailable.');
 return {revision:r.revision,approved:r.approved,eligible:r.eligible,policy:r.policy,point};
}
export function createRentalLocationApprovalService(client:()=>SupabaseClient<Database>){
 const identity=async(actor:string)=>{const {data,error}=await client().auth.getUser();if(error||data.user?.id!==actor)throw Error('Your account changed. Reopen this property.');};
 return {async load(actor:string,propertyId:string,signal:AbortSignal){
 await identity(actor);const {data,error}=await client().rpc('get_rental_location_approval',{p_property_id:propertyId}).abortSignal(signal);await identity(actor);
 if(error){if(error.code==='PGRST202')return null;throw Error('Location approval could not load. Retry.');}return parseRentalLocationApproval(data);
 },async save(actor:string,propertyId:string,state:RentalLocationApproval,approve:boolean,signal:AbortSignal){
 await identity(actor);const {data,error}=await client().rpc('set_rental_location_approval',{p_property_id:propertyId,p_revision:state.revision,p_policy:state.policy,p_approve:approve}).abortSignal(signal);await identity(actor);
 if(error)throw Error('Approval was not confirmed. Reload its status before trying again.');return parseRentalLocationApproval(data);
 }};
}
