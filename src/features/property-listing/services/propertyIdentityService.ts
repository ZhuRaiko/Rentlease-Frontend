import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database,Json} from '../../../shared/services/supabase/database.types';
import {isPropertyUuid,type DraftProperty} from '../models/DraftProperty';
import {identityCorrectionSnapshot,identityDraft,IdentityError,type IdentityContext} from '../models/PropertyIdentityCorrection';
export {identityDraft,IdentityError,type IdentityContext} from '../models/PropertyIdentityCorrection';
interface Journal{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<void>;removeItem(k:string):Promise<void>}
const inflight=new Set<string>();
const unknown=()=>new IdentityError('The correction outcome is unresolved. Check correction status before trying again.','uncertain');
function mapped(e:{code?:string;message?:string}){
 const code=e.code??'';if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[IDENTITY-CORRECTION-DIAG]',{code:/^[A-Z0-9]{5,8}$/.test(code)?code:'unknown'});
 return new IdentityError(code==='PGRST202'?'This feature is not available right now. Try again later.':code==='40001'?'This property or review changed. Your edits are kept. Reload before continuing.':/repair/i.test(e.message??'')?'This property needs trusted identity-data repair. Its approval history is preserved.':/cannot be cancelled/i.test(e.message??'')?'This correction is already being reviewed and cannot be cancelled. Refresh its status.':/tenancy/i.test(e.message??'')?'Identity changes cannot be applied while a tenancy is open.':code==='42501'?'Your account cannot perform this property operation.':'Could not complete the correction. Review the details and check correction status.',code==='40001'?'conflict':'rejected');
}
export function parseIdentityContext(value:unknown,id:string,owner:string):IdentityContext{
 const c=value as IdentityContext|null;
 if(!c||c.property_id!==id||c.owner_id!==owner||!isPropertyUuid(c.edit_version)||typeof c.requires_repair!=='boolean'||typeof c.verified!=='boolean'||typeof c.open_tenancy!=='boolean'||(c.total_floors!==null&&(typeof c.total_floors!=='number'||!Number.isFinite(c.total_floors)))||(!c.requires_repair&&(!c.current||!isPropertyUuid(c.current_revision_id))))throw new IdentityError('Saved identity could not be validated. Retry loading.');
 if(c.current){try{const d=identityDraft(c);identityCorrectionSnapshot(d);}catch{throw new IdentityError('Saved identity could not be validated. Retry loading.');}}
 if(c.correction&&(!isPropertyUuid(c.correction.id)||!isPropertyUuid(c.correction.version)||!c.correction.proposed||!['draft','submitted','applied','rejected','cancelled'].includes(c.correction.status)))throw new IdentityError('Correction status could not be validated.');
 if(c.correction){const j=c.correction.proposed;if(typeof j.property_type!=='string'||typeof j.city!=='string'||typeof j.barangay!=='string'||typeof j.address_line_1!=='string'||['exact_lat','exact_lng','public_lat','public_lng'].some(key=>typeof j[key as keyof typeof j]!=='number'||!Number.isFinite(j[key as keyof typeof j])))throw new IdentityError('Proposed identity could not be validated. Refresh its status.');}
 return c;
}

export function createPropertyIdentityService(getClient:()=>SupabaseClient<Database>,journal:Journal,uuid:()=>string){
 const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user)throw new IdentityError('Sign in again to correct property identity.');return data.user.id;};
 const same=async(owner:string)=>{if(await user()!==owner)throw new IdentityError('Your account changed. Reopen the property.');};
 const key=(o:string,id:string)=>`rentlease:identity-correction:${o}:${id}`;
 const loadFor=async(id:string,owner:string)=>{await same(owner);const {data,error}=await getClient().rpc('get_property_identity_context',{p_property_id:id});if(error)throw mapped(error);await same(owner);return parseIdentityContext(data,id,owner);};
 return {
  async load(id:string){if(!isPropertyUuid(id))throw new IdentityError('Select a saved physical property.');return loadFor(id,await user());},
  async hasPending(id:string){const o=await user();const p=await journal.getItem(key(o,id));await same(o);return !!p;},
  async mutate(c:IdentityContext,action:'same_property_correction'|'cancel',draft?:DraftProperty){
   if(c.requires_repair)throw new IdentityError('Trusted identity-data repair is required.');
   const identity=action==='same_property_correction'?identityCorrectionSnapshot(draft!):undefined;
   const k=key(c.owner_id,c.property_id);if(inflight.has(k))throw unknown();inflight.add(k);let sent=false,marked=false,known=false;
   try{await same(c.owner_id);if(await journal.getItem(k))throw unknown();const operation=uuid();if(!isPropertyUuid(operation))throw new IdentityError('Could not create correction operation.');await journal.setItem(k,JSON.stringify({operation}));marked=true;await same(c.owner_id);sent=true;
    const {data,error}=await getClient().rpc('manage_property_identity',{p_property_id:c.property_id,p_expected_version:c.edit_version,p_operation_id:operation,p_action:action,...(identity?{p_identity:identity as Json}:{}),...(action==='cancel'&&c.correction?{p_correction_id:c.correction.id,p_expected_correction_version:c.correction.version}:{})});
    if(error){if(/^(22|23|25|40|42|P0001|PGRST202)/.test(error.code??'')){known=true;await journal.removeItem(k);throw mapped(error);}throw unknown();}
    if(!data||typeof data!=='object'||Array.isArray(data)||data.property_id!==c.property_id||!isPropertyUuid(data.correction_id))throw unknown();
    const row=await loadFor(c.property_id,c.owner_id);await journal.removeItem(k);return row;
   }catch(e){if(!sent&&marked)try{await journal.removeItem(k);}catch{}if(sent&&!known)throw unknown();throw e instanceof IdentityError?e:new IdentityError('Could not start the correction. Your edits are kept.');}finally{inflight.delete(k);}
  },
  async reconcile(id:string){const o=await user(),k=key(o,id);if(inflight.has(k))throw unknown();const m=await journal.getItem(k);if(!m)return loadFor(id,o);let operation:string;try{operation=JSON.parse(m).operation;if(!isPropertyUuid(operation))throw Error();}catch{throw unknown();}
   const {data,error}=await getClient().rpc('get_property_identity_operation',{p_property_id:id,p_operation_id:operation});if(error)throw mapped(error);await same(o);if(!data)return null;if(typeof data!=='object'||Array.isArray(data)||data.property_id!==id||!isPropertyUuid(data.correction_id))throw unknown();const c=await loadFor(id,o);await same(o);await journal.removeItem(k);return c;}
 };
}
export type PropertyIdentityService=ReturnType<typeof createPropertyIdentityService>;
