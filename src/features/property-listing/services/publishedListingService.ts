import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {isPropertyUuid} from '../models/DraftProperty';
import {ListingDraftError,listingDraftPayload,type SavedListingDraft,type ListingDraftFields,type DraftEditTarget} from '../models/PersistedListingDraft';
import {createListingDraftService,type ListingDraftContext} from './listingDraftService';
interface Journal {getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>;removeItem(key:string):Promise<void>}
const writing=new Set<string>();
export const publishedEditable=(status:unknown)=>status==='active'||status==='paused';
const uncertain=(cause?:unknown)=>new ListingDraftError('The changes could not be confirmed. Check the saved listing before trying again.','uncertain',{cause});
export function createPublishedListingService(getClient:()=>SupabaseClient<Database>,journal:Journal){
 const access=createListingDraftService(getClient,journal);
 const key=(c:ListingDraftContext)=>`rentlease:published-content:${c.userId}:${c.propertyId}`;
 const read=(c:ListingDraftContext,id?:string)=>{if(!isPropertyUuid(id))throw new ListingDraftError('Open an exact saved listing before editing.');return access.read(c,id,true);};
 return{
  context:access.context,assertContext:access.assertContext,read,
  hasPending:async(c:ListingDraftContext)=>!!await journal.getItem(key(c)),
  async save(c:ListingDraftContext,form:ListingDraftFields,target?:DraftEditTarget):Promise<SavedListingDraft>{
   if(!target||!isPropertyUuid(target.listingId)||!isPropertyUuid(target.editVersion))throw new ListingDraftError('Load the latest saved listing before editing.');
   const k=key(c);if(writing.has(k))throw uncertain();writing.add(k);let sent=false,known=false,wrote=false;
   try{
    await access.assertContext(c);if(await journal.getItem(k))throw uncertain();
    const before=await read(c,target.listingId);
    if(!before||!publishedEditable(before.status)||before.edit_version!==target.editVersion)throw new ListingDraftError('This listing changed elsewhere. Your edits are kept. Load the latest saved version.','conflict');
    const {p_property_id:_property,...content}=listingDraftPayload(c.propertyId,form);
    await journal.setItem(k,JSON.stringify({listingId:target.listingId}));wrote=true;await access.assertContext(c);sent=true;
    const {data,error}=await getClient().rpc('update_published_listing_content',{...content,p_listing_id:target.listingId,p_expected_edit_version:target.editVersion});
    if(error){
     if(/^(?:22|23|25|40|42|P0001|PGRST202)/.test(error.code??'')){known=true;await journal.removeItem(k);if(error.code==='40001')throw new ListingDraftError('This listing changed elsewhere. Your edits are kept. Load the latest saved version.','conflict',{cause:error});
      throw new ListingDraftError(error.code==='PGRST202'?'Published editing needs the new backend migration before changes can be saved.':/80|completeness/i.test(error.message??'')?'These changes would put the published listing below 80% completeness. Keep the required details.':'The changes were rejected. Check your listing fields, ownership and current status.','rejected',{cause:error});}
     throw uncertain(error);
    }
    const receipt=Array.isArray(data)&&data.length===1?data[0]:null;
    if(!receipt||receipt.id!==before.id||receipt.property_id!==before.property_id||receipt.landlord_id!==c.userId||receipt.status!==before.status||receipt.published_at!==before.published_at||!isPropertyUuid(receipt.edit_version)||receipt.edit_version===before.edit_version||!Number.isFinite(receipt.completeness_score)||(receipt.status==='active'&&receipt.completeness_score<.8))throw uncertain();
    const current=await read(c,target.listingId);if(!current||current.edit_version!==receipt.edit_version||current.status!==receipt.status||current.published_at!==receipt.published_at)throw uncertain();
    await access.assertContext(c);await journal.removeItem(k);return current;
   }catch(error){
    if(!sent&&wrote){try{await journal.removeItem(k);}catch{/* Retain unresolved marker. */}}
    if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[PUBLISHED-EDIT-DIAG]',{operation:'update_published_listing_content',rpcSent:sent,outcome:sent&&!known?'uncertain':'confirmed_failed',code:error instanceof Error&&error.cause&&typeof error.cause==='object'&&'code'in error.cause&&typeof error.cause.code==='string'&&/^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(error.cause.code)?error.cause.code:'unknown'});
    if(sent&&!known)throw uncertain(error);if(error instanceof ListingDraftError)throw error;throw new ListingDraftError('Could not start the update safely. Your entered details are kept.');
   }finally{writing.delete(k);}
  },
  async reconcile(c:ListingDraftContext,selectedListingId?:string):Promise<SavedListingDraft>{
   if(writing.has(key(c)))throw uncertain();const marker=await journal.getItem(key(c));let id=selectedListingId;
   if(marker){try{const parsed=JSON.parse(marker);if(!isPropertyUuid(parsed.listingId)||id&&parsed.listingId!==id)throw Error();id=parsed.listingId;}catch{throw uncertain();}}
   const row=await read(c,id);if(!row)throw uncertain();await access.assertContext(c);await journal.removeItem(key(c));return row;
  }
 };
}
export type PublishedListingService=ReturnType<typeof createPublishedListingService>;
