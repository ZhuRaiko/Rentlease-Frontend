import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {isPropertyUuid} from '../models/DraftProperty';
import {UnfinishedPostError,type UnfinishedPostStatus} from '../models/UnfinishedPostDeletion';
interface Journal {getItem(key:string):Promise<string|null>;removeItem(key:string):Promise<void>}
export function createUnfinishedPostService(getClient:()=>SupabaseClient<Database>,journal:Journal){
 const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user)throw new UnfinishedPostError('Sign in again to manage your post.');return data.user.id;};
 const sameUser=async(owner:string)=>{if(await user()!==owner)throw new UnfinishedPostError('Your account changed. Reopen My Rentals.');};
 const parse=(value:unknown,id?:string):UnfinishedPostStatus=>{
  const v=value as UnfinishedPostStatus;
  if(!v||!isPropertyUuid(v.propertyId)||(id&&v.propertyId!==id)||!['live','cleanup_pending','completed'].includes(v.state)||typeof v.eligible!=='boolean'||!(v.reason===null||typeof v.reason==='string'))throw new UnfinishedPostError('Deletion status could not be verified. Check again.');
  return v;
 };
 const checked=async(id:string)=>{if(!isPropertyUuid(id))throw new UnfinishedPostError('Select a saved property.');const owner=await user();
  for(const prefix of ['property-details','property-photos','listing-draft-save'])if(await journal.getItem(`rentlease:${prefix}:${owner}:${id}`)){
   // A confirmed tombstone may finish cleanup despite another session's stale save journal.
   const {data,error}=await getClient().rpc('get_unfinished_post_deletion',{p_property_id:id});await sameUser(owner);
   if(error||parse(data,id).state==='live')throw new UnfinishedPostError('An earlier save needs confirmation before deletion. Check saved property and photo status.');
  }
  return owner;
 };
 const inspect=async(id:string)=>{const owner=await checked(id);const {data,error}=await getClient().rpc('get_unfinished_post_deletion',{p_property_id:id});await sameUser(owner);if(error)throw new UnfinishedPostError(error.code==='PGRST202'?'Deleting unfinished posts is not available yet. Your post is unchanged.':'Could not check deletion eligibility. Refresh and try again.');const status=parse(data,id);if(status.state!=='live')await clearReceipt(owner,id);return status;};
 const clearReceipt=async(owner:string,id:string)=>{const key=`rentlease:property-creation:${owner}`;const stored=await journal.getItem(key);if(stored){let value:unknown;try{value=JSON.parse(stored);}catch{return;}if(value&&typeof value==='object'&&'propertyId' in value&&value.propertyId===id)await journal.removeItem(key);}};
 return {inspect,
  async pending(){const owner=await user();const {data,error}=await getClient().rpc('list_unfinished_post_cleanup');await sameUser(owner);if(error){if(error.code==='PGRST202')return [];throw new UnfinishedPostError('Pending media cleanup could not load. Refresh My Rentals.');}if(!Array.isArray(data))throw new UnfinishedPostError('Cleanup status could not be verified.');return data.map(v=>parse(v));},
  async remove(id:string){const owner=await checked(id);const {data,error}=await getClient().functions.invoke('delete-unfinished-post',{body:{propertyId:id},timeout:30000});await sameUser(owner);
   if(error||!data||data.propertyId!==id||!['completed','cleanup_pending'].includes(data.state)){
    // Read-only reconciliation: never infer success or create a new deletion request.
    const status=await inspect(id);if(status.state==='live')throw new UnfinishedPostError(status.reason??'Deletion did not complete. Refresh eligibility before trying again.');await clearReceipt(owner,id);return status;
   }
   await clearReceipt(owner,id);return {propertyId:id,state:data.state,eligible:false,reason:null} as UnfinishedPostStatus;
  }
 };
}
