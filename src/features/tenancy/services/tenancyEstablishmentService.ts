import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {parseSetupContext,TenancySetupError,setupTerms,type SetupContext,type SetupAction,type SetupDraft} from '../models/TenancyEstablishment';
export interface SetupWrite {context:SetupContext;action:SetupAction;operationId:string;draft:SetupDraft}
export function createTenancyEstablishmentService(client:()=>SupabaseClient<Database>){
 const user=async()=>{const {data,error}=await client().auth.getUser();if(error)throw new TenancySetupError('Sign in again to review tenancy setup.');return data.user?.id??null;};
 const identity=async(actor:string)=>{if(await user()!==actor)throw new TenancySetupError('Your account changed. Reopen tenancy setup.');};
 return {user,async read(actor:string,reservationId:string,signal:AbortSignal){await identity(actor);const {data,error}=await client().rpc('get_tenancy_establishment',{p_reservation_id:reservationId}).abortSignal(signal);await identity(actor);if(error)throw new TenancySetupError(error.code==='PGRST202'?'Tenancy setup needs a backend update. Reservations remain unchanged.':'Tenancy setup could not load. Retry.',false,error.code==='PGRST202');return parseSetupContext(data,actor,reservationId);},
 async write(actor:string,input:SetupWrite,signal:AbortSignal){await identity(actor);const c=input.context;const identityRevision=c.identityRevision??(input.action==='cancel'?c.tenancy?.identityRevision:null);if(!identityRevision)throw new TenancySetupError('Current property identity is unavailable.');
 let response;
 try{if(input.action==='create'){const terms=setupTerms(input.draft);response=await client().rpc('establish_tenancy',{p_reservation_id:c.reservationId,p_operation_id:input.operationId,p_property_version:c.propertyVersion,p_identity_revision:identityRevision,p_monthly_rent:terms.rent,p_due_day:terms.dueDay}).abortSignal(signal);}else{if(!c.setupRevision)throw new TenancySetupError('Reload tenancy setup.');response=await client().rpc('respond_tenancy_establishment',{p_reservation_id:c.reservationId,p_operation_id:input.operationId,p_setup_revision:c.setupRevision,p_property_version:c.propertyVersion,p_identity_revision:identityRevision,p_action:input.action}).abortSignal(signal);}}
 catch(e){if(e instanceof TenancySetupError)throw e;throw new TenancySetupError('Outcome not confirmed. Retry the same operation or reload its authoritative status.',true);}
 await identity(actor);
 if(response.error){const code=response.error.code;if(code==='PGRST202')throw new TenancySetupError('Tenancy setup needs a backend update.',false,true);if(['40001','23505','23P01'].includes(code))throw new TenancySetupError('The rental or property changed. Reload tenancy setup before continuing.');
 if(code==='22023'&&/resolve the pending identity review first/i.test(response.error.message??''))throw new TenancySetupError('Finish or withdraw the pending identity review for this property, then propose the tenancy again.');if(['42501','22023','23514'].includes(code))throw new TenancySetupError('This tenancy action is not permitted for the current rental. Reload its status.');throw new TenancySetupError('Outcome not confirmed. Retry the same operation.',true);}
 try{return parseSetupContext(response.data,actor,c.reservationId);}catch{throw new TenancySetupError('Outcome not confirmed. Reload or retry the same operation.',true);}
 }};
}
export type TenancyEstablishmentService=ReturnType<typeof createTenancyEstablishmentService>;
