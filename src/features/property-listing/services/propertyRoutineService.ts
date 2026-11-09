import {hasModelAttributes,propertyModelAttributes} from '../models/PropertyModelAttributes';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {isPropertyUuid,propertyTypeOptions,propertyCityOptions,furnishingOptions} from '../models/DraftProperty';
import {PropertyEditError,routinePayload,type PropertyEditContext,type RoutineDraft} from '../models/PropertyRoutineEdit';
interface Journal {getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<void>;removeItem(k:string):Promise<void>}
const writes=new Set<string>();
const unresolved=()=>new PropertyEditError('The property save could not be confirmed. Check saved property before trying again.','uncertain');
function errorFor(error:{code?:string;message?:string},stage:string){
 const code=error.code??'';
 if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[PROPERTY-EDIT-DIAG]',{operation:stage==='read'?'get_owned_property_edit_context':stage==='receipt'?'get_property_details_operation':'update_property_details',stage,code:/^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(code)?code:'unknown'});
 return new PropertyEditError(code==='PGRST202'?'Property editing is waiting for its backend migration. Saved property details are unchanged.':code==='40001'?'This property changed elsewhere. Your edits are kept. Reload the saved version before saving.':/80|completeness/i.test(error.message??'')?'Keep the details needed for published and paused listings to remain at least 80% complete.':/open tenancy/i.test(error.message??'')?'Material property details cannot change while a tenancy is open.':code==='42501'?'Your account cannot edit this property. Check ownership and account eligibility.':'Could not save property details. Review the fields and try again.',code==='40001'?'conflict':code==='42501'?'access':'rejected');
}
export function parsePropertyEditContext(value:unknown,id:string,owner:string):PropertyEditContext{
 const bad=()=>{throw new PropertyEditError('Saved property details could not be verified. Retry loading.');};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();
 const c=value as PropertyEditContext;
 if(c.property_id!==id||c.owner_id!==owner||!isPropertyUuid(c.edit_version)||!propertyTypeOptions.some(o=>o.value===c.property_type)||!propertyCityOptions.some(o=>o.value===c.city)||!furnishingOptions.some(o=>o.value===c.furnishing_status)||typeof c.barangay!=='string'||typeof c.open_tenancy!=='boolean'||!(c.access_instructions===null||typeof c.access_instructions==='string')||!Array.isArray(c.amenity_ids)||!Array.isArray(c.catalog))return bad();
 for(const key of ['bedrooms','bathrooms','floor_area_sqm','max_occupants','total_floors','floor_number'] as const)if((key==='bedrooms'||key==='bathrooms'||c[key]!==null)&&(typeof c[key]!=='number'||!Number.isFinite(c[key])))return bad();
 if(c.catalog.some(a=>!a||!Number.isSafeInteger(a.id)||a.id<=0||typeof a.name!=='string'||typeof a.is_active!=='boolean')||c.amenity_ids.some(a=>!Number.isSafeInteger(a)||a<=0))return bad();
 if(c.model_attributes_version===2){
  if(!('property_subtype' in c)||!('lot_area_sqm' in c)||!('parking_spaces' in c)||(c.property_subtype!==null&&typeof c.property_subtype!=='string')||[c.lot_area_sqm,c.parking_spaces].some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v))))return bad();
  try{propertyModelAttributes(c.property_type,{propertySubtype:c.property_subtype??'',lotAreaSqm:c.lot_area_sqm===null?'':String(c.lot_area_sqm),parkingSpaces:c.parking_spaces===null?'':String(c.parking_spaces)});}catch{return bad();}
 }
 // Saved validation problems remain visible for correction rather than becoming blank values.
 return c;
}
export function createPropertyRoutineService(getClient:()=>SupabaseClient<Database>,journal:Journal,uuid:()=>string){
 const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user)throw new PropertyEditError('Sign in again to edit your property.','access');return data.user.id;};
 const identity=async(id:string)=>{if(await user()!==id)throw new PropertyEditError('Your account changed. Reopen your property.','access');};
 const key=(owner:string,id:string)=>`rentlease:property-details:${owner}:${id}`;
 const loadFor=async(id:string,owner:string)=>{await identity(owner);let {data,error}=await getClient().rpc('get_owned_property_edit_context_v2',{p_property_id:id});if(error?.code==='PGRST202')({data,error}=await getClient().rpc('get_owned_property_edit_context',{p_property_id:id}));if(error)throw errorFor(error,'read');await identity(owner);return parsePropertyEditContext(data,id,owner);};
 return {
  async load(id:string){if(!isPropertyUuid(id))throw new PropertyEditError('Select a saved property.');return loadFor(id,await user());},
  async hasPending(id:string){const owner=await user();const value=await journal.getItem(key(owner,id));await identity(owner);return !!value;},
  async save(c:PropertyEditContext,d:RoutineDraft){const payload=routinePayload(c,d);if(c.model_attributes_version!==2&&hasModelAttributes(d))throw new PropertyEditError('Optional model attributes need the Phase 2 backend rollout before saving.');const k=key(c.owner_id,c.property_id);if(writes.has(k))throw unresolved();writes.add(k);let sent=false,marked=false,known=false;
   try{await identity(c.owner_id);if(await journal.getItem(k))throw unresolved();const requestId=uuid();if(!isPropertyUuid(requestId))throw new PropertyEditError('Could not start property update.');await journal.setItem(k,JSON.stringify({requestId,version:c.edit_version}));marked=true;await identity(c.owner_id);sent=true;
    const {p_property_subtype,p_lot_area_sqm,p_parking_spaces,...legacyPayload}=payload;
    const {data,error}=c.model_attributes_version===2?await getClient().rpc('update_property_details_v2',{...payload,p_request_id:requestId}):await getClient().rpc('update_property_details',{...legacyPayload,p_request_id:requestId});
    if(error){if(/^(?:22|23|25|40|42|P0001|PGRST202)/.test(error.code??'')){known=true;await journal.removeItem(k);throw errorFor(error,'rpc');}throw unresolved();}
    const receipt=data as {property_id?:unknown;edit_version?:unknown}|null;
    if(!receipt||receipt.property_id!==c.property_id||!isPropertyUuid(receipt.edit_version))throw unresolved();
    const row=await loadFor(c.property_id,c.owner_id);if(row.edit_version!==receipt.edit_version)throw unresolved();await identity(c.owner_id);await journal.removeItem(k);return row;
   }catch(e){if(!sent&&marked)try{await journal.removeItem(k);}catch{/* Pending marker retained. */}if(sent&&!known)throw unresolved();if(e instanceof PropertyEditError)throw e;throw new PropertyEditError('Could not begin the property update. Your edits are kept.');}finally{writes.delete(k);}
  },
  async reconcile(id:string){const owner=await user(),k=key(owner,id);if(writes.has(k))throw unresolved();const marker=await journal.getItem(k);if(!marker)return loadFor(id,owner);let requestId:string;try{const p=JSON.parse(marker);if(!isPropertyUuid(p.requestId))throw Error();requestId=p.requestId;}catch{throw unresolved();}
   const {data,error}=await getClient().rpc('get_property_details_operation',{p_property_id:id,p_request_id:requestId});if(error)throw errorFor(error,'receipt');await identity(owner);if(!data)return null;
   const receipt=data as {property_id?:unknown;edit_version?:unknown};if(receipt.property_id!==id||!isPropertyUuid(receipt.edit_version))throw unresolved();const row=await loadFor(id,owner);await identity(owner);await journal.removeItem(k);return row;
  }
 };
}
